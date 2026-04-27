import { defineConfig } from 'astro/config';
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';

// https://astro.build/config
export default defineConfig({
  site: 'https://tgp-hemeroteca.pages.dev',
  output: 'static', 
  vite: tgpViteConfig,
  integrations: [
    ...tgpIntegrations,
    {
      name: 'gemini-motor-local',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          if (process.env.NODE_ENV === 'development') {
            injectRoute({
              pattern: '/api/generar-tgp',
              entrypoint: './src/api/_generar-tgp.ts'
            });
          }
        }
      }
    }
  ]
});