/**
 * scripts/patch-astro-environment.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Parche quirúrgico para Astro 7 / Vite 8 Environment API:
 * Resuelve el error 'Unexpectedly unable to find a component instance for route'
 * en desarrollo (`astro dev`), asegurando que el runner SSR de Vite y el servidor
 * HTTP de Node compartan el mapa de entornos a través de globalThis.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'node:fs';
import path from 'node:path';

const targetFile = path.resolve('node_modules/astro/dist/core/environment/index.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch-astro-env] Astro no instalado en node_modules, omitiendo.');
  process.exit(0);
}

let content = fs.readFileSync(targetFile, 'utf8');

if (content.includes('globalThis.__ASTRO_ENVIRONMENTS__')) {
  console.log('[patch-astro-env] El puente de entorno en Astro ya está activo.');
  process.exit(0);
}

const originalNeedle = 'const environments = new WeakMap();';
const patchedCode = `const environments = globalThis.__ASTRO_ENVIRONMENTS__ ??= new WeakMap();`;

if (content.includes(originalNeedle)) {
  content = content.replace(originalNeedle, patchedCode);
  content = content.replace(
    'export function setEnvironment(manifest, env) {',
    'export function setEnvironment(manifest, env) {\n\tglobalThis.__ASTRO_LAST_DEV_ENV__ = env;'
  );
  content = content.replace(
    'return environments.get(manifest) ?? productionEnvironment;',
    'return environments.get(manifest) ?? globalThis.__ASTRO_LAST_DEV_ENV__ ?? productionEnvironment;'
  );
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-astro-env] ✅ Puente globalThis aplicado exitosamente a node_modules/astro.');
} else {
  console.log('[patch-astro-env] Patrón no encontrado en Astro (posible versión diferente).');
}
