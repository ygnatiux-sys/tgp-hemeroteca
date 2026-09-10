#!/usr/bin/env node
/**
 * scripts/auditar-todo.mjs
 *
 * TGP Hemeroteca — Relevamiento y Auditor Integral de Colecciones
 *
 * Escanea TODAS las colecciones de contenido:
 *   - src/content/ensayos/
 *   - src/content/georreferencias/
 *   - src/content/arquetipos-globales/
 *   - src/content/ensayos-cinematicos/
 *
 * Analiza para cada post:
 *   1. ¿Tiene foto / portada válida? (coverImage, assets locales, URLs externas, o si está rota/vacía)
 *   2. ¿Tiene contenido / cuerpo de texto? (content.mdoc o campo de IA generadorTexto/generadorGeoref)
 *   3. ¿Qué metadatos le faltan? (title, date, category, excerpt/dek, draft)
 *
 * Uso: node scripts/auditar-todo.mjs [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');

const COLLECTIONS = [
  { id: 'ensayos', name: 'Ensayos', dir: path.join(CONTENT_DIR, 'ensayos') },
  { id: 'georreferencias', name: 'Georreferencias Arqueosemióticas', dir: path.join(CONTENT_DIR, 'georreferencias') },
  { id: 'arquetipos-globales', name: 'Arquetipos Globales', dir: path.join(CONTENT_DIR, 'arquetipos-globales') },
  { id: 'ensayos-cinematicos', name: 'Ensayos Cinemáticos (GSAP)', dir: path.join(CONTENT_DIR, 'ensayos-cinematicos') },
];

// ─── VALIDACIÓN DE IMÁGENES ───────────────────────────────────────────────────
function checkCoverImage(data, collectionId, slug) {
  let rawCover = data.coverImage || data.image || data.portada || null;

  // Si no hay cover directo, buscar en generadorTexto si tiene JSON con image
  if (!rawCover) {
    const rawGen = data.generadorTexto || data.generadorGeoref;
    if (typeof rawGen === 'string' && rawGen.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawGen);
        if (parsed?.image && typeof parsed.image === 'string' && parsed.image.length > 5) {
          rawCover = parsed.image;
        }
      } catch (e) {}
    }
  }

  // Si hay banco de imágenes wikimedia
  if (!rawCover && data.bancoImagenesWikimedia) {
    try {
      const parsed = typeof data.bancoImagenesWikimedia === 'string' ? JSON.parse(data.bancoImagenesWikimedia) : data.bancoImagenesWikimedia;
      if (parsed?.selectedItems?.length > 0) {
        rawCover = parsed.selectedItems[0].url || parsed.selectedItems[0].thumbUrl;
      }
    } catch (e) {}
  }

  if (!rawCover || (typeof rawCover === 'string' && rawCover.trim() === '')) {
    return { hasImage: false, status: 'SIN_FOTO', detail: 'No tiene imagen de portada asignada' };
  }

  const trimmed = typeof rawCover === 'object' ? (rawCover.src || '') : String(rawCover).trim();

  // Data URI base64
  if (trimmed.startsWith('data:image/')) {
    return { hasImage: true, status: 'BASE64_IA', detail: 'Imagen base64 embebida de IA (no es archivo en disco)' };
  }

  // URL externa http / https
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { hasImage: true, status: 'URL_EXTERNA', detail: `URL remota: ${trimmed.slice(0, 60)}...` };
  }

  // Ruta local de src/assets
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('src/assets/')) {
    const relPath = trimmed.replace(/^\//, '');
    const absPath = path.resolve(ROOT_DIR, relPath);
    if (fs.existsSync(absPath)) {
      return { hasImage: true, status: 'OK_LOCAL', detail: `Archivo en disco verificado (${trimmed})` };
    } else {
      return { hasImage: false, status: 'ROTA_FALTA_ARCHIVO', detail: `Ruta asignada pero el archivo NO existe en disco: ${trimmed}` };
    }
  }

  return { hasImage: true, status: 'OTRA', detail: trimmed };
}

// ─── VALIDACIÓN DE TEXTO / CUERPO ─────────────────────────────────────────────
function checkContent(postDir, data) {
  let mdocChars = 0;
  let hasMdoc = false;
  const mdocPath = path.join(postDir, 'content.mdoc');

  if (fs.existsSync(mdocPath)) {
    hasMdoc = true;
    const content = fs.readFileSync(mdocPath, 'utf8').trim();
    mdocChars = content.length;
  }

  // Contenido alternativo en campos IA de index.json
  let aiChars = 0;
  let aiSource = null;

  if (data.generadorGeoref && typeof data.generadorGeoref === 'string') {
    aiChars = data.generadorGeoref.trim().length;
    aiSource = 'generadorGeoref';
  } else if (data.generadorTexto && typeof data.generadorTexto === 'string') {
    if (data.generadorTexto.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(data.generadorTexto);
        if (parsed.text) {
          aiChars = parsed.text.trim().length;
          aiSource = 'generadorTexto.json.text';
        }
      } catch (e) {}
    } else {
      aiChars = data.generadorTexto.trim().length;
      aiSource = 'generadorTexto';
    }
  }

  const effectiveChars = Math.max(mdocChars, aiChars);

  if (effectiveChars === 0) {
    return { hasContent: false, status: 'VACIO', chars: 0, detail: 'Sin ningún texto ni en content.mdoc ni en campos IA' };
  }

  if (effectiveChars < 150) {
    return { hasContent: true, status: 'MUY_CORTO', chars: effectiveChars, detail: `Texto extremadamente breve (${effectiveChars} caracteres)` };
  }

  if (hasMdoc && mdocChars > 150) {
    return { hasContent: true, status: 'OK_MDOC', chars: mdocChars, detail: `content.mdoc con ${mdocChars} caracteres` };
  }

  return { hasContent: true, status: 'OK_IA_FIELD', chars: aiChars, detail: `Texto en campo ${aiSource} (${aiChars} caracteres, content.mdoc vacío)` };
}

// ─── AUDITORÍA DE UN POST ─────────────────────────────────────────────────────
function auditPost(collectionId, slug, postDir) {
  const jsonPath = path.join(postDir, 'index.json');
  if (!fs.existsSync(jsonPath)) {
    return {
      slug,
      collection: collectionId,
      error: 'Falta index.json',
      faltantes: ['index.json']
    };
  }

  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    return {
      slug,
      collection: collectionId,
      error: `JSON inválido: ${e.message}`,
      faltantes: ['index.json corrupto']
    };
  }

  const faltantes = [];

  // 1. Título
  if (!data.title || data.title.trim() === '') {
    faltantes.push('Título vacío');
  }

  // 2. Fecha
  if (!data.date || String(data.date).trim() === '') {
    faltantes.push('Fecha ausente');
  }

  // 3. Excerpt / Dek / Sinopsis
  if ((!data.excerpt || data.excerpt.trim() === '') && (!data.dek || data.dek.trim() === '')) {
    faltantes.push('Sin Excerpt/Bajada');
  }

  // 4. Portada
  const imageInfo = checkCoverImage(data, collectionId, slug);
  if (!imageInfo.hasImage || imageInfo.status === 'ROTA_FALTA_ARCHIVO') {
    faltantes.push(`Sin Portada (${imageInfo.detail})`);
  } else if (imageInfo.status === 'BASE64_IA') {
    faltantes.push('Portada en Base64 IA (debe exportarse a archivo)');
  }

  // 5. Contenido
  const contentInfo = checkContent(postDir, data);
  if (!contentInfo.hasContent) {
    faltantes.push('Sin Contenido de Texto');
  } else if (contentInfo.status === 'MUY_CORTO') {
    faltantes.push(`Contenido muy corto (${contentInfo.chars} chars)`);
  } else if (contentInfo.status === 'OK_IA_FIELD') {
    faltantes.push('Texto solo en campo IA (content.mdoc vacío)');
  }

  return {
    slug,
    title: data.title || slug,
    collection: collectionId,
    date: data.date || null,
    draft: data.draft === true,
    imageInfo,
    contentInfo,
    faltantes,
    isComplete: faltantes.length === 0,
  };
}

// ─── RELEVAMIENTO COMPLETO ────────────────────────────────────────────────────
export function auditarHemeroteca() {
  const allResults = [];

  for (const col of COLLECTIONS) {
    if (!fs.existsSync(col.dir)) continue;

    const slugs = fs.readdirSync(col.dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== '.gitkeep')
      .map(d => d.name)
      .sort();

    for (const slug of slugs) {
      const postDir = path.join(col.dir, slug);
      const res = auditPost(col.id, slug, postDir);
      allResults.push(res);
    }
  }

  return allResults;
}

// ─── EJECUCIÓN CLI ────────────────────────────────────────────────────────────
const results = auditarHemeroteca();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

console.log('\n' + '='.repeat(70));
console.log('  🏛️  TGP HEMEROTECA — RELEVAMIENTO INTEGRAL DE COLECCIONES');
console.log('='.repeat(70) + '\n');

const porColeccion = {};
for (const col of COLLECTIONS) porColeccion[col.id] = [];
results.forEach(r => {
  if (!porColeccion[r.collection]) porColeccion[r.collection] = [];
  porColeccion[r.collection].push(r);
});

let totalCompletos = 0;
let totalIncompletos = 0;
let totalSinFoto = 0;
let totalSinTexto = 0;

for (const col of COLLECTIONS) {
  const items = porColeccion[col.id] || [];
  console.log(`\n📂 COLECCIÓN: ${col.name.toUpperCase()} (${items.length} posts)`);
  console.log('-'.repeat(60));

  if (items.length === 0) {
    console.log('  (Colección vacía)');
    continue;
  }

  for (const item of items) {
    const tag = item.isComplete ? '✅ OK' : '⚠️ INCOMPLETO';
    const draftTag = item.draft ? ' [BORRADOR]' : '';
    console.log(`\n• ${tag} [${item.slug}] "${item.title}"${draftTag}`);

    if (item.isComplete) {
      totalCompletos++;
      console.log(`    ✓ Foto: ${item.imageInfo.detail}`);
      console.log(`    ✓ Texto: ${item.contentInfo.detail}`);
    } else {
      totalIncompletos++;
      if (!item.imageInfo?.hasImage) totalSinFoto++;
      if (!item.contentInfo?.hasContent) totalSinTexto++;

      console.log(`    🔴 FALTANTES / DETALLES:`);
      for (const f of item.faltantes) {
        console.log(`       - ${f}`);
      }
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log('📊 RESUMEN EJECUTIVO:');
console.log(`  Total posts en todas las colecciones: ${results.length}`);
console.log(`  ✅ 100% Completos y listos:           ${totalCompletos}`);
console.log(`  ⚠️ Con algún faltante:                ${totalIncompletos}`);
console.log(`  📸 Sin foto o con foto rota:          ${totalSinFoto}`);
console.log(`  📝 Sin texto o texto vacío:           ${totalSinTexto}`);
console.log('='.repeat(70) + '\n');
