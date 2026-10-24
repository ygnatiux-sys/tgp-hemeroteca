import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';

function startupLogger() {
  return {
    name: 'tgp-startup-logger',
    hooks: {
      'astro:server:start': ({ address }) => {
        const host = (address.address === '127.0.0.1' || address.address === '::1' || address.address === '0.0.0.0') 
          ? 'localhost' 
          : address.address;
        const webBaseUrl = `http://${host}:${address.port}`;
        const mindPort = process.env.MIND_PORT || 3001;
        const mindBaseUrl = `http://localhost:${mindPort}`;

        const checkAlive = async (url) => {
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(600) });
            return res.status >= 200 && res.status < 500;
          } catch {
            return false;
          }
        };

        // Sondeo asíncrono de salud para no bloquear el inicio de Astro
        (async () => {
          let webAlive = false;
          let mindAlive = false;

          // Espera activa de hasta 5 segundos (10 sondeos de 500ms)
          for (let i = 0; i < 10; i++) {
            if (!webAlive) webAlive = await checkAlive(`${webBaseUrl}/`);
            if (!mindAlive) mindAlive = await checkAlive(`${mindBaseUrl}/health`) || await checkAlive(`${mindBaseUrl}/`);

            if (webAlive && mindAlive) break;
            await new Promise((r) => setTimeout(r, 500));
          }

          const C = {
            reset: '\x1b[0m',
            bold: '\x1b[1m',
            green: '\x1b[32m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            yellow: '\x1b[33m',
            blue: '\x1b[94m',
            underline: '\x1b[4m',
            gray: '\x1b[90m',
            red: '\x1b[31m',
            bgGreen: '\x1b[42m\x1b[1m\x1b[30m',
            bgMagenta: '\x1b[45m\x1b[1m\x1b[30m',
            bgCyan: '\x1b[46m\x1b[1m\x1b[30m',
            bgYellow: '\x1b[43m\x1b[1m\x1b[30m',
          };

          const blueLink = (url) => `${C.blue}${C.underline}${url}${C.reset}`;

          console.log(`\n  ${C.bold}\x1b[37m╭────────────────────────────────────────────────────────────────────────╮${C.reset}`);
          console.log(`  ${C.bold}\x1b[37m│               ⚡ TGP UNIFIED DEV HUB · SERVICIOS ACTIVOS               │${C.reset}`);
          console.log(`  ${C.bold}\x1b[37m╰────────────────────────────────────────────────────────────────────────╯${C.reset}`);

          // Servicio 1: WEB (Astro App & Keystatic CMS)
          if (webAlive) {
            console.log(`  ${C.bgGreen} TGP APP  ${C.reset} ${C.green}Local dev:${C.reset}    ${blueLink(`${webBaseUrl}/`)}  ${C.green}● online${C.reset}`);
            console.log(`  ${C.bgMagenta} ADMIN    ${C.reset} ${C.magenta}Keystatic:${C.reset}    ${blueLink(`${webBaseUrl}/keystatic`)}  ${C.green}● online${C.reset}`);
          } else {
            console.log(`  ${C.bgGreen} TGP APP  ${C.reset} ${C.green}Local dev:${C.reset}    ${C.red}Iniciando puerto ${address.port}...${C.reset}`);
          }

          // Servicio 2: MIND (Dispatcher & Diagnóstico)
          if (mindAlive) {
            console.log(`  ${C.bgCyan} TGP MIND ${C.reset} ${C.cyan}Dispatcher:${C.reset}   ${blueLink(`${mindBaseUrl}/`)}  ${C.green}● online${C.reset}`);
            console.log(`  ${C.bgYellow} HEALTH   ${C.reset} ${C.yellow}Diagnóstico:${C.reset}  ${blueLink(`${mindBaseUrl}/health`)}  ${C.green}● online${C.reset}`);
          } else {
            console.log(`  ${C.bgCyan} TGP MIND ${C.reset} ${C.cyan}Dispatcher:${C.reset}   ${C.gray}[esperando o fuera de línea en puerto ${mindPort}]${C.reset}`);
          }

          console.log(``);
        })();
      }
    }
  };
}

function localApiDevPlugin() {
  return {
    name: 'tgp-local-api-dev',
    hooks: {
      'astro:server:setup': async ({ server }) => {
        try {
          const { handleLocalApi } = await import('../api/local/router.ts');
          server.middlewares.use(handleLocalApi);
        } catch (err) {
          console.error('[tgp-local-api-dev] Error cargando router local:', err);
        }
      }
    }
  };
}

export const tgpIntegrations = [
  react(),
  svelte(), // ← ScriptoriumCapture.svelte y futuras islas Svelte
  markdoc(), 
  keystatic(), // ← activo en todos los entornos (local + Cloudflare Worker)
  startupLogger(),
  localApiDevPlugin()
];

export const tgpViteConfig = {
  plugins: [tailwindcss()],
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'SOURCEMAP_ERROR' || (warning.message && warning.message.includes('points to missing source files'))) {
          return;
        }
        warn(warning);
      }
    }
  },
  optimizeDeps: {
    // La lista nuclear de paquetes CommonJS que Vite debe traducir sí o sí
    include: [
      'lodash/debounce', 
      'lodash', 
      'direction', 
      'is-hotkey', 
      'is-plain-object', 
      'slate', 
      'slate-react', 
      'slate-history',
      'use-sync-external-store/shim/index.js',
      'cookie',
      'remove-accents',
      'brace-expansion',
      'debug',
      'acorn-jsx',
      'escape-string-regexp',
      '@braintree/sanitize-url',
      'fast-deep-equal',
      '@sindresorhus/slugify',
      'marked'
    ]
  },
  ssr: {
    noExternal: process.env.NODE_ENV === 'development'
      ? ['@keystatic/core', '@keystatic/astro']
      : true
  }
};
