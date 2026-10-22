import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

const input = Object.fromEntries(
  readdirSync(rootDir)
    .filter((file) => file.endsWith('.html'))
    .map((file) => [file.replace('.html', ''), resolve(rootDir, file)])
);

export default defineConfig({
  // Multi-page app: unknown URLs return 404 instead of falling back to index.html
  appType: 'mpa',
  build: {
    rollupOptions: { input },
  },
});