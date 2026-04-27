// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  build: {
    format: 'directory'
  },
  vite: {
    plugins: [tailwindcss()]
  },
  
  // EL TRUCO MAESTRO:
  // Si estamos en la nube (producción), Keystatic no se carga. 
  // Así Astro no pide servidores y Cloudflare compila la Hemeroteca en paz.
  integrations: [
    react(), 
    markdoc(), 
    process.env.NODE_ENV === 'production' ? null : keystatic()
  ].filter(Boolean)
});