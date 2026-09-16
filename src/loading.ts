const titles: Record<string, string> = { days: 'Downloads per day', weeks: 'Downloads per week', months: 'Downloads per month', years: 'Downloads per year' };
type State = 'loading' | 'rendering' | 'ready' | 'empty' | 'error';
const states = new Map<HTMLElement, State>();
let activeRequest: Element | null = null;
let slowTimer: ReturnType<typeof setTimeout> | undefined;
let renderTimer: ReturnType<typeof setTimeout> | undefined;

function announce(message: string): void {
  let status = document.getElementById('ns-chart-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'ns-chart-status';
    status.className = 'ns-sr-only';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.body.append(status);
  }
  if (status.textContent !== message) status.textContent = message;
}

export function chartState(figure: HTMLElement, state: State): void {
  if (states.get(figure) === state) return;
  states.set(figure, state);
  const busy = state === 'loading' || state === 'rendering';
  figure.setAttribute('aria-busy', String(busy));
  figure.querySelector('.ns-chart-placeholder')?.remove();
  if (state !== 'ready') {
    const panel = document.createElement('div');
    panel.className = 'ns-chart-placeholder';
    panel.dataset.state = state;
    const title = document.createElement('strong');
    title.className = 'ns-placeholder-title';
    title.textContent = titles[figure.id] || 'Downloads';
    const center = document.createElement('div');
    center.className = 'ns-placeholder-center';
    const indicator = document.createElement('span');
    indicator.className = 'ns-chart-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', '16'); circle.setAttribute('cy', '16'); circle.setAttribute('r', '12');
    svg.append(circle);
    indicator.append(svg);
    for (let index = 0; index < 12; index++) {
      const segment = document.createElement('i');
      segment.style.setProperty('--segment', String(index));
      indicator.append(segment);
    }
    const message = document.createElement('span');
    message.className = 'ns-placeholder-message';
    message.textContent = state === 'loading' ? '正在加载下载数据…' : state === 'rendering' ? '正在绘制图表…'
      : state === 'empty' ? '所选范围暂无数据。' : '图表加载失败，请查看页面错误信息或刷新重试。';
    if (busy) center.append(indicator);
    center.append(message);
    panel.append(title, center);
    figure.append(panel);
  }
  if (state === 'error') announce('图表加载失败，请查看页面错误信息或刷新重试。');
  if ([...states.values()].every(value => value === 'ready' || value === 'empty')) {
    clearTimeout(slowTimer);
    clearTimeout(renderTimer);
    announce([...states.values()].every(value => value === 'empty') ? '所选范围暂无数据。' : '图表加载完成。');
  }
}

/** Observe the upstream request marker, not URL guesses or four independent requests. */
export function syncChartLoading(): void {
  const request = document.getElementById('loading');
  const error = document.querySelector('div[style*="background: #900"], .ns-error');
  if (error) {
    clearTimeout(slowTimer);
    clearTimeout(renderTimer);
    activeRequest = null;
    for (const id of Object.keys(titles)) {
      const figure = document.getElementById(id);
      if (figure && states.get(figure) !== 'ready') chartState(figure, 'error');
    }
    return;
  }
  if (request && request !== activeRequest) {
    activeRequest = request;
    clearTimeout(slowTimer);
    clearTimeout(renderTimer);
    for (const id of Object.keys(titles)) {
      const figure = document.getElementById(id);
      if (figure) chartState(figure, 'loading');
    }
    announce('正在加载下载数据…');
    slowTimer = setTimeout(() => {
      const message = '仍在加载，较长时间范围或多包对比可能需要更久…';
      for (const [figure, state] of states) {
        const label = figure.querySelector('.ns-placeholder-message');
        if (state === 'loading' && label) label.textContent = message;
      }
      if ([...states.values()].includes('loading')) announce(message);
    }, 10_000);
  } else if (!request && activeRequest) {
    activeRequest = null;
    clearTimeout(slowTimer);
    for (const [figure, state] of states) if (state === 'loading') chartState(figure, 'rendering');
    // Removal precedes synchronous drawCharts upstream. Allow first paint before diagnosing a missing renderer.
    renderTimer = setTimeout(() => {
      for (const [figure, state] of states) if (state === 'rendering') chartState(figure, 'error');
    }, 15_000);
  }
}
