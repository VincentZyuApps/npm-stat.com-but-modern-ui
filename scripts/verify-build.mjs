import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifact = resolve(import.meta.dirname, '../dist/npm-stat-modern-ui.user.js');
const source = await readFile(artifact, 'utf8');
const required = ['// ==UserScript==', '@match        https://npm-stat.com/*', '@run-at       document-start', 'npm-stat-modern-ui-styles'];
const missing = required.filter((value) => !source.includes(value));

if (missing.length > 0) throw new Error(`Build verification failed. Missing: ${missing.join(', ')}`);
console.log(`Verified ${artifact}`);
