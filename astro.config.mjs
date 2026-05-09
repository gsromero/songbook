// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { chordPrerender } from './src/integrations/chordPrerender.js';

export default defineConfig({
  site: 'https://gsromero.github.io',
  base: '/guitar-master/',
  output: 'static',
  integrations: [chordPrerender()],
  vite: {
    plugins: [tailwindcss()],
  },
});