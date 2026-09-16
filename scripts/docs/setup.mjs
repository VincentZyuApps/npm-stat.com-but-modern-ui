import { readFile } from 'node:fs/promises';
import { argumentsFor, artifact, build, launch, root } from '../lib/browser.mjs';
import { join } from 'node:path';

const options = argumentsFor();
if (options.help) {
  console.log('npm run docs:setup -- --user-data-dir <dedicated-profile> [--browser-path <executable>]\nBuilds the userscript and leaves a visible browser open for manual Tampermonkey installation.');
  process.exit(0);
}
if (options['cdp-url']) throw new Error('setup launches a dedicated profile; use docs:screenshots to connect to an existing browser.');
if (!options['user-data-dir']) throw new Error('Specify --user-data-dir, e.g. E:\\BrowserProfiles\\npm-stat-docs. This profile will be preserved.');
await build();
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const environment = await launch(options, { persistent: true, setup: true });
console.log(`
浏览器已打开，专用档案会长期保留：${environment.profile}
请在这个窗口完成：
1. 从应用店安装 Tampermonkey，并按浏览器提示允许用户脚本运行。
2. Tampermonkey → 新建脚本 → 删除模板，粘贴以下文件的全部内容并保存：
   ${artifact}
3. 确认脚本已启用，版本为 ${version}，刷新 npm-stat 测试页，确认右上角出现风格选择框。
4. 保持浏览器打开，运行：
   npm run docs:screenshots -- --mode extension --cdp-url ${environment.endpoint}

浏览器不会自动关闭。关闭后可使用相同 --user-data-dir 重新运行截图。
以后修改源码，需要重新构建并手动覆盖已安装的用户脚本。
详细说明：scripts/docs/readme.md
`);
