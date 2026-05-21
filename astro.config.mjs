// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { chordPrerender } from './src/integrations/chordPrerender.js';
import { fileURLToPath } from 'url';
import { join } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  site: 'https://songbook.gsromerolab.com',
  output: 'static',
  integrations: [chordPrerender()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Force Vite to use chordsheetjs ESM build (lib/module.js) instead of CJS
        'chordsheetjs': join(__dirname, 'node_modules/chordsheetjs/lib/module.js'),
      },
    },
  },
});