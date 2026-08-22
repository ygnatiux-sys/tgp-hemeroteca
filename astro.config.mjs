import { defineConfig } from 'astro/config';
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://tgp-hemeroteca.pages.dev',
  // A partir de Astro 5, 'hybrid' fue removido. Usa 'static' y apaga el prerender individualmente con export const prerender = false;
  output: 'static',
  trailingSlash: 'ignore',
  vite: tgpViteConfig,

  adapter: cloudflare({
    routes: {
      extend: {
        // El Worker de Cloudflare intercepta estas rutas dinámicas en producción
        include: [
          { pattern: '/keystatic' },
          { pattern: '/keystatic/*' },
          { pattern: '/api/keystatic/*' },
        ],
      },
    },
    platformProxy: {
      enabled: true,
    },
  }),

  integrations: [
    ...tgpIntegrations,
    {
      name: 'gemini-motor-local',
      hooks: {
        'astro:config:setup': ({ injectRoute, command }) => {
          // En modo desarrollo local (astro dev), inyectamos dinámicamente las rutas API de Gemini
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
              pattern: '/api/generar-arquetipo',
              entrypoint: './src/api/_generar-arquetipo.ts'
            });
            injectRoute({
              pattern: '/api/guardar-georreferencia',
              entrypoint: './src/api/_guardar-georreferencia.ts'
            });
            injectRoute({
              pattern: '/api/agente-erudito',
              entrypoint: './src/api/agente-erudito.ts'
            });
          }
        }
      }
    }
  ],
});