// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://gsromero.github.io',
  base: '/guitar-master/',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});