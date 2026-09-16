import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import packageJson from './package.json';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'npm-stat Modern UI',
        namespace: 'https://github.com/pvorb/npm-stat.com',
        version: packageJson.version,
        description: 'A modern interface for npm-stat.com',
        license: 'MIT',
        match: ['https://npm-stat.com/*', 'http://npm-stat.com/*'],
        'run-at': 'document-start',
        grant: 'none'
      },
      build: {
        fileName: 'npm-stat-modern-ui.user.js'
      }
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: false
  }
});
