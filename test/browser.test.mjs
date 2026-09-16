import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { argumentsFor, findBrowser, root } from '../scripts/lib/browser.mjs';

test('explicit missing executable fails instead of silently choosing an installed browser', async () => {
  await assert.rejects(findBrowser(join(root, 'missing-browser.exe')), /Browser not found/);
});

test('browser CLI rejects conflicting connection options and remote hosts', () => {
  const original = process.argv;
  try {
    process.argv = ['node', 'test', '--cdp-url', 'http://127.0.0.1:9222', '--browser-path', 'chrome'];
    assert.throws(() => argumentsFor(), /cannot be combined/);
    process.argv = ['node', 'test', '--cdp-url', 'http://example.com:9222'];
    assert.throws(() => argumentsFor(), /loopback/);
    process.argv = ['node', 'test', '--browser-path', 'a path with spaces'];
    assert.equal(argumentsFor()['browser-path'], 'a path with spaces');
  } finally { process.argv = original; }
});

test('invalid screenshot modes fail before building or opening a browser', () => {
  for (const [args, message] of [
    [['--mode', 'unknown'], /must be inject or extension/],
    [['--user-data-dir', 'unused'], /temporary isolated profile/],
    [['--mode', 'extension'], /requires --user-data-dir or --cdp-url/],
    [['--url', 'https://example.com/'], /must be an https/]
  ]) {
    const result = spawnSync(process.execPath, ['scripts/docs/screenshots.mjs', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stdout, /vite.*building/);
  }
});

test('both READMEs have matching structure, line counts and 14 existing images', async () => {
  const texts = await Promise.all(['README.md', 'README.zh-cn.md'].map(file => readFile(join(root, file), 'utf8')));
  const rows = texts.map(text => text.trimEnd().split(/\r?\n/));
  assert.equal(rows[0].length, rows[1].length);
  const structure = lines => lines.map(line => line.match(/^(#+|\| |```|<details>|<\/details>|<summary>)/)?.[1] || '');
  assert.deepEqual(structure(rows[0]), structure(rows[1]));
  for (const text of texts) {
    const images = [...text.matchAll(/!\[[^\]]*\]\((docs\/images\/preview\/[^)]+)\)/g)].map(match => match[1]);
    assert.equal(new Set(images).size, 14);
    for (const image of images) {
      assert.match(image, /\/(light|dark)-(original|npm|vercel|fluent|material|apple|github)\.png$/);
      await access(join(root, image));
      const bytes = await readFile(join(root, image));
      assert.equal(bytes.readUInt32BE(16), 1440, `${image} width`);
      assert.ok(bytes.readUInt32BE(20) > 1000, `${image} full page`);
    }
  }
});
