// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  build: {
    format: 'directory'
  },
  vite: {
    plugins: [tailwindcss()]
  },
  
  // SOLO LAS INTEGRACIONES ESENCIALES PARA RENDERIZAR LA WEB
  integrations: [react(), markdoc()]
});