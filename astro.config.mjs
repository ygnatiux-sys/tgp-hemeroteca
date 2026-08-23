import { defineConfig } from 'astro/config';
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';
import cloudflare from '@astrojs/cloudflare';

// DETECCIÓN BLINDADA CORREGIDA
const isCloudflare = process.env.CF_PAGES === '1';
const isBuild = process.argv.includes('build') || process.env.npm_lifecycle_event === 'build';

// Si estamos en Cloudflare o en proceso de build, JAMÁS es Dev.
const isDev = !(isCloudflare || isBuild) && (
  process.argv.includes('dev') || 
  process.env.npm_lifecycle_event === 'dev' || 
  process.env.NODE_ENV === 'development'
);

// https://astro.build/config
export default defineConfig({
  // Dominio principal
  site: 'https://thegreatpuzzleproject.com',
  output: 'server',  // CRÍTICO: genera _worker.js para Cloudflare Pages Functions
  trailingSlash: 'ignore',
  
  // EL ESCUDO VITE: En local aislamos React como external puro; en build forzamos empaquetado para Cloudflare
  vite: {
    ...tgpViteConfig,
    ssr: isDev
      ? { external: ['react', 'react-dom'] }
      : { noExternal: true }
  },

  // EL CORTE ARQUITECTÓNICO: Worker SSR maneja el sitio, CDN sirve los estáticos
  adapter: isDev ? undefined : cloudflare({
    routes: {
      extend: {
        exclude: [
          // Bundles Vite (CSS, JS, assets hasheados) — CDN nativa de Cloudflare
          '/_astro/*',
          '/assets/*',
          // Imágenes y recursos estáticos de public/
          '/images/*',
          '/favicon.svg',
          '/favicon.png',
          '/favicon.ico',
          '/faviconTGP.png',
          '/perfil.webp',
          '/intro.cinematic.wav',
          '/intro_cinematic.wav',
          '/outro.cinematic.wav',
          '/outro_cinematic.wav',
          // Páginas con export const prerender = true → archivos HTML estáticos
          '/hemeroteca/*',
          '/papers',
          '/papers/*',
          '/ensayos-cinematicos/*',
        ],
      },
    }
  }),

  integrations: [
    ...tgpIntegrations,
    {
      name: 'gemini-motor-local',
      hooks: {
        'astro:config:setup': ({ injectRoute, command }) => {
          if (command === 'dev' || isDev) {
            injectRoute({ pattern: '/api/generar-tgp', entrypoint: './src/api/_generar-tgp.ts' });
            injectRoute({ pattern: '/api/generar-sujeto', entrypoint: './src/api/_generar-sujeto.ts' });
            injectRoute({ pattern: '/api/generar-arte', entrypoint: './src/api/_generar-arte.ts' });
            injectRoute({ pattern: '/api/guardar-ensayo', entrypoint: './src/api/_guardar-ensayo.ts' });
            injectRoute({ pattern: '/api/generar-georreferencia', entrypoint: './src/api/_generar-georreferencia.ts' });
            injectRoute({ pattern: '/api/generar-arquetipo', entrypoint: './src/api/_generar-arquetipo.ts' });
            injectRoute({ pattern: '/api/guardar-georreferencia', entrypoint: './src/api/_guardar-georreferencia.ts' });
            injectRoute({ pattern: '/api/agente-erudito', entrypoint: './src/api/agente-erudito.ts' });
          }
        }
      }
    }
  ],
});