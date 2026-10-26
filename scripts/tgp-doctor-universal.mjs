#!/usr/bin/env node
/**
 * scripts/tgp-doctor-universal.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * TGP DOCTOR UNIVERSAL Y AGNÓSTICO (PORTABLE PARA CUALQUIER REPOSITORIO TGP)
 *
 * Características:
 *  • 100% Nativo de Node.js (cero dependencias externas ni paquetes npm).
 *  • Detección automática del workspace (funciona en hemeroteca o tgp-web-alternative).
 *  • Escanea todas las carpetas de colecciones en src/content/ automáticamente.
 *  • Clasifica fuentes de cada post:
 *      1. Cloudflare R2 Wikimedia (/wikimedia/ en bucket)
 *      2. Cloudflare R2 General (/storage.thegreatpuzzleproject.com/)
 *      3. Local (/src/assets/ o @assets/)
 *      4. Wikimedia Directo (llamadas en caliente sin persistir)
 *      5. Sin imagen / archivos locales inexistentes (rotos)
 *  • Código de salida:
 *      - Exit code 0: Si todo está sano.
 *      - Exit code 1: Si hay archivos locales faltantes o posts sin imagen.
 *
 * Modo de uso:
 *  node scripts/tgp-doctor-universal.mjs
 *  npm run doctor (al integrarlo en package.json)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detección automática de la raíz del proyecto buscando package.json o src/
function findProjectRoot(startDir) {
  let cur = startDir;
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'package.json')) && fs.existsSync(path.join(cur, 'src'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return path.resolve(startDir, '..');
}

const ROOT_DIR = findProjectRoot(__dirname);
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

if (!fs.existsSync(CONTENT_DIR)) {
  console.error(`${C.red}❌ No se encontró el directorio de contenido: ${CONTENT_DIR}${C.reset}`);
  process.exit(1);
}

// Colecciones que no requieren coverImage (estilos, esquemas o pruebas internas)
const NON_EDITORIAL_COLLECTIONS = new Set(['estilos-visuales', 'test', 'informes']);

// Descubrimiento dinámico de todas las colecciones existentes en src/content
const detectedCollections = fs
  .readdirSync(CONTENT_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
  .map(d => d.name);

const stats = {
  total: 0,
  local_assets: 0,
  r2_wikimedia: 0,
  r2_general: 0,
  wikimedia_direct: 0,
  otros: 0,
  sin_imagen: 0,
};

const brokenList = [];
const directWikiList = [];

console.log(`\n${C.bold}${C.cyan}╔═══════════════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}${C.cyan}║   🩺 TGP DOCTOR UNIVERSAL — AUDITOR DE INTEGRIDAD DE MEDIOS   ║${C.reset}`);
console.log(`${C.bold}${C.cyan}╚═══════════════════════════════════════════════════════════════╝${C.reset}`);
console.log(`${C.dim}Directorio base: ${ROOT_DIR}${C.reset}`);
console.log(`${C.dim}Colecciones detectadas (${detectedCollections.length}): ${detectedCollections.join(', ')}${C.reset}\n`);

for (const col of detectedCollections) {
  const colPath = path.join(CONTENT_DIR, col);
  const items = fs.readdirSync(colPath, { withFileTypes: true });

  for (const item of items) {
    let cover = null;
    let title = item.name.replace(/\.[^/.]+$/, '');
    const isDir = item.isDirectory();
    const isFilePost = item.isFile() && /\.(md|mdx|mdoc|json)$/.test(item.name);

    if (!isDir && !isFilePost) continue;
    stats.total++;

    const itemPath = path.join(colPath, item.name);

    if (isDir) {
      // 1. Carpeta Keystatic: Buscar en index.json
      const jsonPath = path.join(itemPath, 'index.json');
      if (fs.existsSync(jsonPath)) {
        try {
          let raw = fs.readFileSync(jsonPath, 'utf8');
          if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
          const d = JSON.parse(raw);
          cover = d.coverImage || d.image || d.portada || null;
          title = d.title || title;
        } catch (err) {
          brokenList.push({
            col,
            slug: item.name,
            issue: `JSON corrupto: ${err.message}`,
          });
        }
      }

      // 2. Buscar en content.mdoc o content.md si no hay portada
      if (!cover) {
        for (const mdocName of ['content.mdoc', 'content.md', 'index.mdoc', 'index.md']) {
          const mdocPath = path.join(itemPath, mdocName);
          if (fs.existsSync(mdocPath)) {
            let raw = fs.readFileSync(mdocPath, 'utf8');
            if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
            const match = raw.match(/(?:coverImage|heroUrl|imageUrl|image|portada):\s*['"]?([^'"\s\n]+)/);
            if (match) {
              cover = match[1];
              break;
            }
          }
        }
      }
    } else if (isFilePost) {
      // Archivo Markdown/MDX plano
      let raw = fs.readFileSync(itemPath, 'utf8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      
      const titleMatch = raw.match(/title:\s*['"]?([^'"\n\r]+)/);
      if (titleMatch) title = titleMatch[1];

      const match = raw.match(/(?:coverImage|heroUrl|imageUrl|image|portada):\s*['"]?([^'"\s\n]+)/);
      if (match) {
        cover = match[1];
      }
    }

    // 3. Clasificación de la Fuente
    const isEditorial = !['test', 'estilos-visuales', 'informes'].includes(col);
    if (!cover || typeof cover !== 'string' || cover.trim() === '') {
      stats.sin_imagen++;
      if (isEditorial) {
        brokenList.push({
          col,
          slug: item.name,
          title,
          issue: 'Post sin portada (coverImage vacía o no declarada)',
        });
      }
    } else if (cover.includes('storage.thegreatpuzzleproject.com/wikimedia/')) {
      stats.r2_wikimedia++;
    } else if (cover.includes('storage.thegreatpuzzleproject.com/')) {
      stats.r2_general++;
    } else if (cover.includes('wikimedia.org') || cover.includes('wikipedia.org')) {
      stats.wikimedia_direct++;
      directWikiList.push({ col, slug: item.name, title, url: cover });
    } else if (
      cover.startsWith('/src/assets/') ||
      cover.startsWith('src/assets/') ||
      cover.startsWith('/assets/') ||
      cover.startsWith('@assets/')
    ) {
      stats.local_assets++;
      const localRel = cover.replace(/^[@/]+/, '').replace(/^assets\//, 'src/assets/');
      const localDisk = path.resolve(ROOT_DIR, localRel);
      if (!fs.existsSync(localDisk)) {
        brokenList.push({
          col,
          slug: item.name,
          title,
          issue: `Archivo local inexistente en disco: ${cover}`,
        });
      }
    } else {
      stats.otros++;
    }
  }
}

// ── REPORTE FINAL ─────────────────────────────────────────────────────────────
console.log(`${C.bold}📊 Censo de Fuentes de Portadas (${stats.total} entradas analizadas):${C.reset}`);
console.log(` 📁 Assets Locales (/src/assets/):             ${C.green}${C.bold}${stats.local_assets}${C.reset} (${stats.total ? ((stats.local_assets / stats.total) * 100).toFixed(1) : 0}%)`);
console.log(` ☁️  Cloudflare R2 Wikimedia (/wikimedia/):      ${C.cyan}${C.bold}${stats.r2_wikimedia}${C.reset} (${stats.total ? ((stats.r2_wikimedia / stats.total) * 100).toFixed(1) : 0}%)`);
console.log(` ☁️  Cloudflare R2 General (/storage/):           ${C.blue}${C.bold}${stats.r2_general}${C.reset} (${stats.total ? ((stats.r2_general / stats.total) * 100).toFixed(1) : 0}%)`);
console.log(` 🌐 Wikimedia Directo (no cacheada en R2):     ${stats.wikimedia_direct > 0 ? C.yellow : C.dim}${C.bold}${stats.wikimedia_direct}${C.reset}`);
console.log(` 🔗 Otros CDNs Externos:                       ${C.dim}${stats.otros}${C.reset}`);
console.log(` ❌ Sin Portada / Archivos Rotos:              ${brokenList.length > 0 ? C.red : C.green}${C.bold}${brokenList.length}${C.reset}\n`);

if (directWikiList.length > 0) {
  console.log(`${C.yellow}⚠️ Posts con enlaces directos a Wikimedia (recomendado cachear en R2):${C.reset}`);
  for (const w of directWikiList) {
    console.log(` • [${w.col}] ${w.slug}: ${C.dim}${w.url.slice(0, 70)}...${C.reset}`);
  }
  console.log('');
}

if (brokenList.length > 0) {
  console.log(`${C.red}❌ Se encontraron anomalías críticas (${brokenList.length}):${C.reset}`);
  for (const b of brokenList) {
    console.log(` • [${b.col}] ${b.slug} (${b.title || 'Sin Título'})`);
    console.log(`   ${C.dim}${b.issue}${C.reset}`);
  }
  console.log('');
  process.exit(1);
} else {
  console.log(`${C.green}✅ Estado de salud: ÓPTIMO. Cero imágenes rotas y 100% de cobertura.${C.reset}\n`);
  process.exit(0);
}
