import { defineConfig } from 'astro/config';
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';
import cloudflare from '@astrojs/cloudflare';

// DETECCIÓN BLINDADA ABSOLUTA: Combina 4 métodos para que Vite nunca pierda el estado local
const isDev = 
  process.argv.includes('dev') || 
  process.argv.includes('--force') || 
  process.env.npm_lifecycle_event === 'dev' || 
  process.env.NODE_ENV === 'development';

// https://astro.build/config
export default defineConfig({
  site: 'https://tgp-hemeroteca.pages.dev',
  output: 'static',
  trailingSlash: 'ignore',
  
  // EL ESCUDO VITE: En local aislamos React como external puro; en build forzamos empaquetado para Cloudflare
  vite: {
    ...tgpViteConfig,
    ssr: isDev
      ? {
          external: ['react', 'react-dom']
        }
      : {
          noExternal: true
        }
  },

  // EL CORTE ARQUITECTÓNICO (Cloudflare apagado en local)
  adapter: isDev ? undefined : cloudflare({
    routes: {
      extend: {
        include: [
          { pattern: '/keystatic' },
          { pattern: '/keystatic/*' },
          { pattern: '/api/keystatic/*' },
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