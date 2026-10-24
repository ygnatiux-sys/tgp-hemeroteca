/**
 * scripts/build-cloud.mjs
 * ============================================================================
 * Compilador Aislado para Cloud Run (SOMA + ARGON LIGHT)
 * ============================================================================
 * Empaqueta src/cloud/server.ts y sus dependencias internas hacia dist/cloud/server.js
 * sin tocar el build de Astro ni Cloudflare Workers.
 */

import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('dist/cloud');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('[Build Cloud] Compilando microservicio Cloud Run con esbuild...');

try {
  await esbuild.build({
    entryPoints: ['src/cloud/server.ts'],
    outfile: 'dist/cloud/server.js',
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    packages: 'external', // Deja todos los paquetes de node_modules (sharp, pdfkit, @google/genai) como externos nativos
    sourcemap: true,
    logLevel: 'info',
    banner: {
      js: `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim(),
    },
  });

  const stats = fs.statSync('dist/cloud/server.js');
  console.log(`[Build Cloud] ✓ Bundle generado con éxito en dist/cloud/server.js (${(stats.size / 1024).toFixed(1)} KB)`);
} catch (error) {
  console.error('[Build Cloud] ✗ Error durante la compilación:', error);
  process.exit(1);
}
