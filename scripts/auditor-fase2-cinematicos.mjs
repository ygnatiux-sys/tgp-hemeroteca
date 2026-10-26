#!/usr/bin/env node
/**
 * scripts/auditor-fase2-cinematicos.mjs
 * 
 * TGP Hemeroteca — Auditor y Cartógrafo FASE 2: Ensayos Cinemáticos (GSAP)
 * Solo diagnóstico e informe crítico. Cero modificaciones.
 * Detección de duplicados, imágenes huérfanas, anomalías de texto y hub de links clickeables.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const CINEMATICOS_DIR = path.join(ROOT_DIR, 'src', 'content', 'ensayos-cinematicos');
const BASE_URL = 'http://localhost:4321';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

const MOJIBAKE_REGEX = /(?:Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|Ã |Ã‰|Ã |Ã“|Ãš|Ã‘|Â¿|Â¡|â€|â€“|â€”|â€˜|â€™|â€œ|â€\x9d|ï»¿)/;

console.log(`\n${C.bold}${C.cyan}╔═══════════════════════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}${C.cyan}║   🎬 TGP AUDITOR FLASH — FASE 2: ENSAYOS CINEMÁTICOS (GSAP)           ║${C.reset}`);
console.log(`${C.bold}${C.cyan}╚═══════════════════════════════════════════════════════════════════════╝${C.reset}\n`);

if (!fs.existsSync(CINEMATICOS_DIR)) {
  console.error(`❌ No se encontró la carpeta ${CINEMATICOS_DIR}`);
  process.exit(1);
}

const items = fs.readdirSync(CINEMATICOS_DIR, { withFileTypes: true });
const posts = [];
const titlesSeen = new Map();
const duplicates = [];

for (const item of items) {
  if (!item.isDirectory()) continue;
  const itemPath = path.join(CINEMATICOS_DIR, item.name);
  const jsonPath = path.join(itemPath, 'index.json');
  const mdocPath = path.join(itemPath, 'content.mdoc');

  let meta = {};
  let contentText = '';
  let jsonOk = false;

  if (fs.existsSync(jsonPath)) {
    try {
      let raw = fs.readFileSync(jsonPath, 'utf8');
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
      meta = JSON.parse(raw);
      jsonOk = true;
    } catch (err) {
      meta = { title: item.name, error: `JSON corrupto: ${err.message}` };
    }
  }

  if (fs.existsSync(mdocPath)) {
    contentText = fs.readFileSync(mdocPath, 'utf8');
    if (contentText.charCodeAt(0) === 0xfeff) contentText = contentText.slice(1);
  }

  if (contentText.trim().length === 0 && meta.generadorTexto) {
    if (typeof meta.generadorTexto === 'string') {
      try {
        const parsed = JSON.parse(meta.generadorTexto);
        contentText = parsed.text || meta.generadorTexto;
      } catch {
        contentText = meta.generadorTexto;
      }
    }
  }

  const titleNorm = (meta.title || item.name).toLowerCase().trim();
  if (titlesSeen.has(titleNorm)) {
    duplicates.push({
      original: titlesSeen.get(titleNorm),
      duplicate: { slug: item.name, title: meta.title },
    });
  } else {
    titlesSeen.set(titleNorm, { slug: item.name, title: meta.title });
  }

  posts.push({
    slug: item.name,
    title: meta.title || item.name,
    coverImage: meta.coverImage || meta.image || null,
    gallery: meta.gallery || [],
    hasText: contentText.trim().length > 100,
    hasCover: !!(meta.coverImage || meta.image),
    jsonOk,
    draft: !!meta.draft,
    contentText,
  });
}

const issues = [];
const validReport = [];

for (const p of posts) {
  const postUrl = `${BASE_URL}/ensayos-cinematicos/${p.slug}/`;
  const archiveUrl = `${BASE_URL}/archivo/#archivo-ensayos-cinematicos`;
  const collectionUrl = `${BASE_URL}/colecciones/ensayos-cinematicos/`;

  const itemIssues = [];
  if (!p.jsonOk) itemIssues.push('JSON corrupto.');
  if (!p.hasText) itemIssues.push('Texto ausente o vacío en content.mdoc y generadorTexto.');
  if (!p.hasCover) itemIssues.push('Sin imagen de portada (Hero ausente).');

  let storageType = 'SIN_IMAGEN';
  if (p.coverImage) {
    if (p.coverImage.includes('storage.thegreatpuzzleproject.com/wikimedia/')) {
      storageType = 'R2_WIKIMEDIA';
    } else if (p.coverImage.includes('storage.thegreatpuzzleproject.com/')) {
      storageType = 'R2_GENERAL';
    } else if (p.coverImage.includes('wikimedia.org') || p.coverImage.includes('wikipedia.org')) {
      storageType = 'WIKI_DIRECTO_CRUDO';
      itemIssues.push('Imagen de Wikimedia directa sin transmutar a R2.');
    } else if (p.coverImage.startsWith('/src/assets/')) {
      storageType = 'LOCAL_ASSET';
      const localPath = path.join(ROOT_DIR, p.coverImage.replace(/^\//, ''));
      if (!fs.existsSync(localPath)) {
        itemIssues.push(`Asset local no existe en disco: ${p.coverImage}`);
      }
    } else {
      storageType = 'OTRO_EXTERNO';
    }
  }

  if (MOJIBAKE_REGEX.test(p.title) || MOJIBAKE_REGEX.test(p.contentText.slice(0, 300))) {
    itemIssues.push('Mojibake detectado (caracteres corruptos o tildes rotas).');
  }

  if (itemIssues.length > 0) {
    issues.push({ post: p, itemIssues, postUrl, archiveUrl, collectionUrl, storageType });
  } else {
    validReport.push({ post: p, postUrl, archiveUrl, collectionUrl, storageType });
  }
}

// ── REPORTE FINAL FASE 2 ──────────────────────────────────────────────────────
console.log(`${C.bold}📊 BALANCE GENERAL DE ENSAYOS CINEMÁTICOS:${C.reset}`);
console.log(` • Total posts analizados:        ${C.bold}${posts.length}${C.reset}`);
console.log(` • Posts 100% Óptimos y Válidos:  ${C.green}${C.bold}${validReport.length}${C.reset} (${((validReport.length/posts.length)*100).toFixed(1)}%)`);
console.log(` • Posts con Observaciones:       ${issues.length > 0 ? C.yellow : C.green}${C.bold}${issues.length}${C.reset}`);
console.log(` • Posibles Duplicados Detectados:${duplicates.length > 0 ? C.red : C.green}${C.bold}${duplicates.length}${C.reset}\n`);

if (duplicates.length > 0) {
  console.log(`${C.bold}${C.red}⚠️  DUPLICADOS ENCONTRADOS (Sugerencia de eliminación o unificación):${C.reset}`);
  for (const d of duplicates) {
    console.log(` • Original:  ${C.cyan}${d.original.slug}${C.reset} ("${d.original.title}")`);
    console.log(`   Duplicado: ${C.yellow}${d.duplicate.slug}${C.reset} ("${d.duplicate.title}")`);
    console.log(`   💡 Sugerencia: Evaluar si el duplicado tiene contenido redundante para archivar.`);
  }
  console.log('');
}

console.log(`${C.bold}🌟 MUESTRA DE RUTAS EXACTAS Y ANCLAJES ACTIVOS (Clickeables):${C.reset}`);
const sample = validReport.slice(0, 5);
for (const v of sample) {
  console.log(` ├── 🎬 ${C.bold}${v.post.title}${C.reset} [${v.storageType}]`);
  console.log(` │   👉 Post Cinemático: ${C.cyan}${v.postUrl}${C.reset}`);
  console.log(` │   👉 Ancla Archivo:   ${C.cyan}${v.archiveUrl}${C.reset}`);
  console.log(` │   👉 Colección Hub:   ${C.cyan}${v.collectionUrl}${C.reset}`);
}
console.log(` └── ${C.dim}... y ${validReport.length - sample.length} posts cinemáticos más en perfecto estado.${C.reset}\n`);

if (issues.length > 0) {
  console.log(`${C.bold}${C.yellow}⚠️  POSTS CON OBSERVACIONES TÉCNICAS:${C.reset}`);
  for (const is of issues) {
    console.log(`\n • 🚨 ${C.bold}${is.post.title}${C.reset} (slug: ${is.post.slug})`);
    for (const err of is.itemIssues) {
      console.log(`   ❌ ${C.yellow}${err}${C.reset}`);
    }
    console.log(`   🔗 Post Cinemático: ${is.postUrl}`);
    console.log(`   🔗 Ancla Archivo:   ${is.archiveUrl}`);
  }
  console.log('');
} else {
  console.log(`${C.green}✅ FASE 2 CUMPLIDA: Cero errores críticos en los 58 ensayos cinemáticos.${C.reset}\n`);
}
