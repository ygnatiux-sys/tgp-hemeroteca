import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite'; 
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';

export default defineConfig({
  // Forzamos el modo estático para que genere los archivos .html en /dist
  output: 'static', 
  
  site: 'https://tgp-hemeroteca.pages.dev',
  
  // En modo estático, el adapter ayuda con funciones específicas pero no bloquea el servidor
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    nodeCompat: true,
  }),
  
  vite: {
    ...tgpViteConfig,
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['gsap'],
    },
    // Optimizamos el chunking para evitar el warning de >500kb que vimos en el log
    build: {
      chunkSizeWarningLimit: 1000,
    }
  },
  
  integrations: tgpIntegrations
});