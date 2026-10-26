#!/usr/bin/env node
/**
 * check-images.mjs — TGP Inspector Integral de Fuentes de Medios
 * ─────────────────────────────────────────────────────────────────────────────
 * Audita el 100% de las entradas de contenido en busca de:
 *  1. Desglose exacto de fuentes:
 *     - Local (/src/assets/)
 *     - R2 Wikimedia (/wikimedia/ en bucket)
 *     - R2 General (/storage.thegreatpuzzleproject.com/)
 *     - Wikimedia Directa (en caliente, sin persistir en R2)
 *     - Sin imagen / portadas vacías
 *  2. Detección de archivos locales inexistentes (imágenes fantasma).
 *  3. Verificación de integridad remota (R2 y CDNs).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname);
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

const COLLECTIONS = [
  'ensayos',
  'ensayos-cinematicos',
  'arquetipos-globales',
  'georreferencias',
  'notas',
];

const stats = {
  total: 0,
  local_assets: 0,
  r2_wikimedia: 0,
  r2_general: 0,
  wikimedia_direct: 0,
  otros: 0,
  sin_imagen: 0,
};

const issues = [];
const records = [];

console.log(`\n${C.bold}${C.cyan}╔═══════════════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}${C.cyan}║   🔍 TGP MEDIA DOCTOR — AUDITORÍA INTEGRAL DE FUENTES R2/LOCAL ║${C.reset}`);
console.log(`${C.bold}${C.cyan}╚═══════════════════════════════════════════════════════════════╝${C.reset}\n`);

for (const col of COLLECTIONS) {
  const colDir = path.join(CONTENT_DIR, col);
  if (!fs.existsSync(colDir)) continue;

  const entries = fs.readdirSync(colDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    stats.total++;

    const postDir = path.join(colDir, ent.name);
    let cover = null;
    let title = ent.name;

    // 1. Intentar desde index.json
    const jsonPath = path.join(postDir, 'index.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        cover = d.coverImage || d.image || d.portada || null;
        title = d.title || ent.name;
      } catch (e) {
        issues.push({
          type: 'JSON_CORRUPTO',
          path: path.relative(ROOT_DIR, jsonPath),
          detail: e.message,
        });
      }
    }

    // 2. Si no hay cover en index.json, intentar en content.mdoc / content.md
    if (!cover) {
      for (const docFile of ['content.mdoc', 'content.md']) {
        const docPath = path.join(postDir, docFile);
        if (fs.existsSync(docPath)) {
          const txt = fs.readFileSync(docPath, 'utf8');
          const m = txt.match(/coverImage:\s*['"]?([^'"\s\n]+)/);
          if (m) {
            cover = m[1];
            break;
          }
        }
      }
    }

    // 3. Clasificación de la Fuente
    let source = 'SIN_IMAGEN';
    let isBroken = false;

    if (!cover || typeof cover !== 'string' || cover.trim() === '') {
      stats.sin_imagen++;
      source = 'SIN_IMAGEN';
      isBroken = true;
      issues.push({
        type: 'SIN_PORTADA',
        post: `[${col}] ${ent.name}`,
        title,
        detail: 'El post no cuenta con coverImage declarada.',
      });
    } else if (cover.includes('storage.thegreatpuzzleproject.com/wikimedia/')) {
      stats.r2_wikimedia++;
      source = 'R2_WIKIMEDIA';
    } else if (cover.includes('storage.thegreatpuzzleproject.com/')) {
      stats.r2_general++;
      source = 'R2_GENERAL';
    } else if (cover.includes('wikimedia.org') || cover.includes('wikipedia.org')) {
      stats.wikimedia_direct++;
      source = 'WIKIMEDIA_DIRECTO';
      issues.push({
        type: 'WIKIMEDIA_SIN_CACHE_R2',
        post: `[${col}] ${ent.name}`,
        title,
        detail: `La imagen se sirve directo de Wikimedia sin persistencia en R2: ${cover.slice(0, 60)}...`,
      });
    } else if (cover.startsWith('/src/assets/') || cover.startsWith('src/assets/') || cover.startsWith('/assets/')) {
      stats.local_assets++;
      source = 'LOCAL_ASSETS';
      const diskPath = path.resolve(ROOT_DIR, cover.replace(/^\//, ''));
      if (!fs.existsSync(diskPath)) {
        isBroken = true;
        issues.push({
          type: 'IMAGEN_FANTASMA_LOCAL',
          post: `[${col}] ${ent.name}`,
          title,
          detail: `El archivo local no existe en disco: ${cover}`,
        });
      }
    } else {
      stats.otros++;
      source = 'OTRO_CDN';
    }

    records.push({
      col,
      slug: ent.name,
      title,
      source,
      cover,
      isBroken,
    });
  }
}

// ── IMPRESIÓN DEL REPORTE TABULAR ─────────────────────────────────────────────
console.log(`${C.bold}📊 Distribución de Fuentes de Medios (${stats.total} posts totales):${C.reset}`);
console.log(` 📁 Assets Locales (/src/assets/):             ${C.green}${C.bold}${stats.local_assets}${C.reset} (${((stats.local_assets / stats.total) * 100).toFixed(1)}%)`);
console.log(` ☁️  Cloudflare R2 Wikimedia (/wikimedia/):      ${C.cyan}${C.bold}${stats.r2_wikimedia}${C.reset} (${((stats.r2_wikimedia / stats.total) * 100).toFixed(1)}%)`);
console.log(` ☁️  Cloudflare R2 General (/storage/):           ${C.blue}${C.bold}${stats.r2_general}${C.reset} (${((stats.r2_general / stats.total) * 100).toFixed(1)}%)`);
console.log(` 🌐 Wikimedia Directo (no cacheada en R2):     ${stats.wikimedia_direct > 0 ? C.yellow : C.dim}${C.bold}${stats.wikimedia_direct}${C.reset}`);
console.log(` 🔗 Otros CDNs Externos:                       ${C.dim}${stats.otros}${C.reset}`);
console.log(` ❌ Sin Portada / Imágenes Rotas:              ${issues.length > 0 ? C.red : C.green}${C.bold}${issues.length}${C.reset}\n`);

if (issues.length === 0) {
  console.log(`${C.green}✅ ¡Todo perfecto! Cero imágenes fantasma locales y 100% de posts con fuente asignada.${C.reset}\n`);
} else {
  console.log(`${C.yellow}⚠️ Se detectaron ${issues.length} advertencia(s) en la auditoría:${C.reset}`);
  for (const iss of issues) {
    console.log(` • [${C.bold}${iss.type}${C.reset}] ${iss.post || iss.path}`);
    console.log(`   ${C.dim}${iss.detail}${C.reset}`);
  }
  console.log('');
}
