import { defineConfig } from 'astro/config';
// ELIMINAMOS la importación de @astrojs/cloudflare
import tailwindcss from '@tailwindcss/vite'; 
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';

export default defineConfig({
  output: 'static', 
  
  build: {
    format: 'directory'
  },

  site: 'https://tgp-hemeroteca.pages.dev',
  
  // ELIMINAMOS EL BLOQUE 'adapter: cloudflare(...)' POR COMPLETO

  vite: {
    ...tgpViteConfig,
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['gsap'],
    },
  },
  
  integrations: tgpIntegrations
});