import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite'; // Importación vital para Tailwind 4
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  // En Astro 6 no hace falta 'output: hybrid', es el estándar.
  site: 'https://tgp-hemeroteca.pages.dev',
  
  adapter: isDev ? undefined : cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  
  vite: {
    ...tgpViteConfig,
    plugins: [tailwindcss()], // Forzamos a Vite a procesar tus estilos
  },
  
  integrations: tgpIntegrations
});