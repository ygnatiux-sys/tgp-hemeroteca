import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';

const isDev = process.env.NODE_ENV !== 'production';

// https://astro.build/config
export default defineConfig({
  site: 'https://tgp-hemeroteca.pages.dev',
  output: isDev ? 'server' : 'static', 
  adapter: isDev ? node({ mode: 'standalone' }) : undefined,
  vite: tgpViteConfig,
  integrations: [
    ...tgpIntegrations,
    {
      name: 'gemini-motor-local',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          if (isDev) {
            injectRoute({
              pattern: '/api/generar-tgp',
              entrypoint: './src/api/generar-tgp.ts'
            });
          }
        }
      }
    }
  ]
});
