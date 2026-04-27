import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Modo híbrido: Todo es estático, excepto Keystatic
  output: 'hybrid',
  adapter: cloudflare(),
  
  vite: {
    plugins: [tailwindcss()]
  },
  
  integrations: [react(), markdoc(), keystatic()]
});