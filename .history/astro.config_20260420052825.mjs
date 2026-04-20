// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';

// https://astro.build/config
export default defineConfig({
  // CAMBIO VITAL: Volvemos a 'static' para evitar el error de Cloudflare Workers
  output: 'static',
  build: {
    format: 'directory'
  },
  // ELIMINADO: Se quitó el adapter de Cloudflare que causaba el pánico del sistema
  vite: {
    plugins: [tailwindcss()]
  },
  
  integrations: [react(), markdoc(), keystatic()]
});