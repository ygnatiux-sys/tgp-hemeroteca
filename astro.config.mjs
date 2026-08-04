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
        'astro:config:setup': ({ injectRoute, command }) => {
          // En modo desarrollo local (astro dev), inyectamos dinámicamente las rutas API de Keystatic y Gemini
          if (command === 'dev' || process.env.NODE_ENV === 'development') {
            injectRoute({
              pattern: '/api/generar-tgp',
              entrypoint: './src/api/_generar-tgp.ts'
            });
            injectRoute({
              pattern: '/api/generar-sujeto',
              entrypoint: './src/api/_generar-sujeto.ts'
            });
            injectRoute({
              pattern: '/api/generar-arte',
              entrypoint: './src/api/_generar-arte.ts'
            });
            injectRoute({
              pattern: '/api/guardar-ensayo',
              entrypoint: './src/api/_guardar-ensayo.ts'
            });
            injectRoute({
              pattern: '/api/generar-georreferencia',
              entrypoint: './src/api/_generar-georreferencia.ts'
            });
            injectRoute({
              pattern: '/api/guardar-georreferencia',
              entrypoint: './src/api/_guardar-georreferencia.ts'
            });
          }
        }
      }
    }
  ]
});