// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },
  
  output: 'static',
  build: {
    format: 'directory'
  },
  adapter: node({
    mode: 'standalone'
  }),

  integrations: [react(), markdoc(), keystatic()]
});