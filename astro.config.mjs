// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://songbook.gsromerolab.com',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
