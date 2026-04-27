import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';

const isDev = process.env.NODE_ENV === 'development';

// https://astro.build/config
export default defineConfig({
  // En desarrollo desactivamos el adaptador de Cloudflare para evitar el error de 'unenv' (fs).
  // Keystatic necesita acceso al sistema de archivos (fs) para leer el contenido localmente.
  site: 'https://tgp-hemeroteca.pages.dev',
  adapter: isDev ? undefined : cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  
  vite: tgpViteConfig,
  
  integrations: tgpIntegrations
});