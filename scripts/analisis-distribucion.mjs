#!/usr/bin/env node
/**
 * scripts/analisis-distribucion.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Analiza la distribución editorial ACTUAL de la Hemeroteca TGP.
 * Simula exactamente la lógica de src/pages/index.astro para mostrar qué
 * posts terminarían en cada bloque de la Home: Hero, Lead, Secundarios,
 * Recientes y Archivo — sin necesidad de levantar Astro.
 *
 * Uso:   node scripts/analisis-distribucion.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'src', 'content');

// ── Colores ANSI ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',  cyan: '\x1b[36m',  yellow: '\x1b[33m',
  green: '\x1b[32m', red: '\x1b[31m',   bold: '\x1b[1m',
  dim: '\x1b[2m',    magenta: '\x1b[35m', blue: '\x1b[34m',
  white: '\x1b[37m',
};
const hr  = (ch = '─', n = 72) => C.dim + ch.repeat(n) + C.reset;
const col = (label, ...rest) => `${C.bold}${C.cyan}${label}${C.reset}${rest.join('')}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJson(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return null; }
}

function hasValidImage(data) {
  const candidates = [
    data?.coverImage, data?.image, data?.portada, data?.foto, data?.imagen
  ];
  for (const c of candidates) {
    if (!c) continue;
    const s = typeof c === 'object' ? (c.src || c.href || '') : String(c);
    if (!s || s.trim().length === 0) continue;
    if (s.trim().length > 80 && s.includes(' ')) continue; // es un prompt
    if (/\.(jpe?g|png|webp|avif|gif|svg)/i.test(s)) return true;
    if (s.startsWith('http') || s.startsWith('/') || s.startsWith('data:image')) return true;
  }
  // Wikimedia bank
  const wm = data?.bancoImagenesWikimedia || data?.buscadorWikimedia;
  if (wm) {
    try {
      const p = typeof wm === 'string' ? JSON.parse(wm) : wm;
      if (p?.selectedItems?.length > 0) return true;
    } catch {}
  }
  // IA image inside generadorTexto JSON
  const gen = data?.generadorTexto || data?.generadorGeoref || data?.generador;
  if (gen && typeof gen === 'string' && gen.trim().startsWith('{')) {
    try {
      const p = JSON.parse(gen);
      if (p?.image && /\.(jpe?g|png|webp|avif|gif|svg)/i.test(p.image)) return true;
      if (p?.image && p.image.startsWith('http')) return true;
    } catch {}
  }
  return false;
}

function getTextLength(data, contentPath) {
  // mdoc body
  if (fs.existsSync(contentPath)) {
    const body = fs.readFileSync(contentPath, 'utf8').trim();
    if (body.length > 0) return body.length;
  }
  // IA text
  const gen = data?.generadorTexto || data?.generadorGeoref || data?.generador;
  if (gen && typeof gen === 'string') {
    if (gen.trim().startsWith('{')) {
      try { const p = JSON.parse(gen); return (p?.text || '').length; } catch {}
    }
    return gen.length;
  }
  return 0;
}

function getMtime(jsonPath) {
  try { return fs.statSync(jsonPath).mtime.toISOString(); }
  catch { return new Date(0).toISOString(); }
}

// ── Cargar colección ──────────────────────────────────────────────────────────
function loadCollection(collectionDir, collectionName, isCinematic = false) {
  const slugs = fs.readdirSync(collectionDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  return slugs.map(slug => {
    const dir  = path.join(collectionDir, slug);
    const json = readJson(path.join(dir, 'index.json')) || {};
    const mdoc = path.join(dir, 'content.mdoc');
    const date = json.date || getMtime(path.join(dir, 'index.json'));
    const textLen = getTextLength(json, mdoc);
    const hasImg  = hasValidImage(json);
    const isDraft = json.draft === true;
    const isEmpty = textLen === 0 && !hasImg;
    const isOnlyAI = textLen > 0 && !fs.existsSync(mdoc) || (fs.existsSync(mdoc) && fs.readFileSync(mdoc,'utf8').trim().length === 0 && textLen > 0);
    
    return {
      slug,
      title: json.title || slug,
      collection: collectionName,
      isCinematic,
      hasImg,
      textLen,
      isEmpty,
      isDraft,
      isOnlyAI,
      date,
    };
  });
}

// ── Simular sortEssaysByVisualFirst ──────────────────────────────────────────
function sortVisualFirst(a, b) {
  const isTestA = !a.hasImg && (a.slug.includes('test') || a.slug.includes('prueba') || a.title.toLowerCase().includes('test'));
  const isTestB = !b.hasImg && (b.slug.includes('test') || b.slug.includes('prueba') || b.title.toLowerCase().includes('test'));
  if (isTestA !== isTestB) return isTestA ? 1 : -1;

  // Cinemáticos primero
  if (a.isCinematic !== b.isCinematic) return a.isCinematic ? -1 : 1;

  // Con imagen primero
  if (a.hasImg !== b.hasImg) return (b.hasImg ? 1 : 0) - (a.hasImg ? 1 : 0);

  // Más reciente primero
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
console.log('\n' + hr('═'));
console.log(`${C.bold}${C.magenta}  🎬 TGP HEMEROTECA — ANÁLISIS DE DISTRIBUCIÓN EDITORIAL${C.reset}`);
console.log(hr('═'));

// Cargar las 4 colecciones
const cinematicos = loadCollection(path.join(CONTENT, 'ensayos-cinematicos'), 'Cinemáticos', true);
const ensayos     = loadCollection(path.join(CONTENT, 'ensayos'), 'Ensayos', false);
const georefs     = loadCollection(path.join(CONTENT, 'georreferencias'), 'Georreferencias', false);
const arquetipos  = loadCollection(path.join(CONTENT, 'arquetipos-globales'), 'Arquetipos', false);

// Ordenar cinemáticos por fecha (más reciente primero)
const cinematicosSorted = [...cinematicos]
  .filter(p => !p.isDraft)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

// Combinar todas las colecciones como lo hace index.astro
const allPublishable = [
  ...cinematicosSorted,
  ...ensayos.filter(p => !p.isDraft),
  ...georefs.filter(p => !p.isDraft),
  ...arquetipos.filter(p => !p.isDraft),
].sort(sortVisualFirst);

// ── ESTADÍSTICAS GENERALES ────────────────────────────────────────────────────
console.log(`\n${C.bold}📊 INVENTARIO ACTUAL${C.reset}\n`);
const allAll = [...cinematicos, ...ensayos, ...georefs, ...arquetipos];
console.log(`  Total de entradas:       ${C.bold}${allAll.length}${C.reset}`);
console.log(`  ✅ Con foto:             ${C.green}${allAll.filter(p => p.hasImg).length}${C.reset}`);
console.log(`  ❌ Sin foto:             ${C.red}${allAll.filter(p => !p.hasImg).length}${C.reset}`);
console.log(`  📭 Completamente vacíos: ${C.red}${allAll.filter(p => p.isEmpty).length}${C.reset}`);
console.log(`  📝 Solo texto IA (sin .mdoc):  ${C.yellow}${allAll.filter(p => p.isOnlyAI && !p.isEmpty).length}${C.reset}`);
console.log(`  ✍️  Borradores:           ${C.dim}${allAll.filter(p => p.isDraft).length}${C.reset}`);
console.log(`  📡 Publicables:          ${C.bold}${C.cyan}${allPublishable.length}${C.reset}`);

// ── DISTRIBUCIÓN EN HOME ──────────────────────────────────────────────────────
console.log('\n' + hr());
console.log(`\n${C.bold}🏠 DISTRIBUCIÓN EN HOME (simulada)${C.reset}\n`);

const HERO_MAX   = 6;
const heroSlides = allPublishable.slice(0, Math.min(HERO_MAX, allPublishable.length));
const remaining  = allPublishable.slice(heroSlides.length);
const leadStory  = remaining[0] ?? null;
const secondaryA = remaining[1] ?? null;
const secondaryB = remaining[2] ?? null;

const topFeatured = new Set([
  cinematicosSorted[0]?.slug,
  leadStory?.slug,
  secondaryA?.slug,
  secondaryB?.slug,
].filter(Boolean));

const recentEssays = [
  ...cinematicosSorted.filter(c => !topFeatured.has(c.slug)),
  ...remaining.filter(e => !topFeatured.has(e.slug) && !cinematicosSorted.some(c => c.slug === e.slug))
].slice(0, 4);

const recentSlugs = new Set(recentEssays.map(e => e.slug));
const archiveRows = remaining
  .filter(e => !topFeatured.has(e.slug) && !recentSlugs.has(e.slug))
  .slice(0, 10);

function printPost(p, label = '') {
  const img  = p.hasImg  ? `${C.green}[FOTO]${C.reset}` : `${C.red}[SIN FOTO]${C.reset}`;
  const txt  = p.textLen > 0 ? `${C.green}[TEXTO ${p.textLen}c]${C.reset}` : `${C.red}[VACÍO]${C.reset}`;
  const cin  = p.isCinematic ? `${C.magenta}[CINE]${C.reset} ` : '';
  const lbl  = label ? `${C.yellow}${label}${C.reset} ` : '';
  const col  = p.isEmpty ? C.dim : '';
  console.log(`  ${lbl}${cin}${col}${p.title.substring(0,45).padEnd(45)}${C.reset} ${img} ${txt} ${C.dim}(${p.collection})${C.reset}`);
}

console.log(`${C.bold}🎠 BLOQUE 1 — HERO SLIDER (${heroSlides.length} slides)${C.reset}`);
heroSlides.forEach((p, i) => printPost(p, `S${i+1}`));

console.log(`\n${C.bold}📰 BLOQUE 2A — ÚLTIMO DOSSIER (Lead Story)${C.reset}`);
if (leadStory) printPost(leadStory, 'LEAD');
else console.log(`  ${C.red}(vacío)${C.reset}`);

console.log(`\n${C.bold}📰 BLOQUE 2B — DOSSIERES RECIENTES (SecA + SecB)${C.reset}`);
if (secondaryA) printPost(secondaryA, 'SEC-A');
if (secondaryB) printPost(secondaryB, 'SEC-B');

console.log(`\n${C.bold}📺 BLOQUE 3 — ENSAYOS RECIENTES (Netflix Row, max 4)${C.reset}`);
if (recentEssays.length > 0) recentEssays.forEach(p => printPost(p));
else console.log(`  ${C.red}(vacío)${C.reset}`);

console.log(`\n${C.bold}🗃️  BLOQUE 5 — DEL ARCHIVO (Premier Sequences, max 10)${C.reset}`);
if (archiveRows.length > 0) archiveRows.forEach(p => printPost(p));
else console.log(`  ${C.dim}(vacío)${C.reset}`);

// ── DIAGNÓSTICO DE PROBLEMAS ──────────────────────────────────────────────────
console.log('\n' + hr());
console.log(`\n${C.bold}⚠️  DIAGNÓSTICOS Y CONFLICTOS${C.reset}\n`);

const heroWithoutImg = heroSlides.filter(p => !p.hasImg);
if (heroWithoutImg.length > 0) {
  console.log(`${C.red}❌ Posts en HERO sin imagen (bloquean el slider):${C.reset}`);
  heroWithoutImg.forEach(p => console.log(`   • ${p.slug} (${p.collection})`));
}

const emptyInVisible = [...heroSlides, leadStory, secondaryA, secondaryB, ...recentEssays]
  .filter(Boolean).filter(p => p.isEmpty);
if (emptyInVisible.length > 0) {
  console.log(`\n${C.red}❌ Posts VACÍOS en posiciones visibles:${C.reset}`);
  emptyInVisible.forEach(p => console.log(`   • ${p.slug} (${p.collection})`));
}

// ── CANDIDATOS PARA WIKIMEDIA ─────────────────────────────────────────────────
console.log('\n' + hr());
console.log(`\n${C.bold}📸 CANDIDATOS PRIORITARIOS PARA IMAGEN WIKIMEDIA${C.reset}\n`);
console.log(`${C.dim}(Posts con texto ≥1000c, sin foto, no vacíos — ordenados por tamaño de texto)${C.reset}\n`);

const wikiCandidates = allAll
  .filter(p => !p.isDraft && !p.hasImg && p.textLen >= 500)
  .sort((a, b) => b.textLen - a.textLen);

if (wikiCandidates.length === 0) {
  console.log(`  ${C.green}✅ No hay candidatos pendientes.${C.reset}`);
} else {
  wikiCandidates.forEach((p, i) => {
    const score = p.textLen >= 3000 ? `${C.green}★★★${C.reset}` : p.textLen >= 1500 ? `${C.yellow}★★ ${C.reset}` : `${C.dim}★  ${C.reset}`;
    console.log(`  ${String(i+1).padStart(2)}. ${score} ${p.title.substring(0,40).padEnd(40)} ${C.dim}[${p.collection}] ${p.textLen}c${C.reset}`);
  });
}

// ── CANDIDATOS PARA ELIMINAR ──────────────────────────────────────────────────
console.log('\n' + hr());
console.log(`\n${C.bold}🗑️  CANDIDATOS PARA ELIMINAR (vacíos o duplicados)${C.reset}\n`);

const toDelete = allAll.filter(p => {
  if (p.isDraft) return false; // ya están ocultos
  if (p.isEmpty) return true;  // sin foto y sin texto = eliminar
  // Duplicados obvios: slug termina en -1, -2, o -mgzn con 0 texto
  if (/-(1|2|3|mgzn)$/.test(p.slug) && p.textLen < 100) return true;
  return false;
});

if (toDelete.length === 0) {
  console.log(`  ${C.green}✅ No hay posts vacíos detectados.${C.reset}`);
} else {
  console.log(`  ${C.red}Total: ${toDelete.length} posts para eliminar${C.reset}\n`);
  toDelete.forEach((p, i) => {
    const reason = p.isEmpty ? 'VACÍO TOTAL' : `Solo ${p.textLen}c (duplicado)`;
    console.log(`  ${String(i+1).padStart(2)}. ${C.dim}[${p.collection}]${C.reset} ${p.slug.padEnd(50)} ${C.red}${reason}${C.reset}`);
  });
}

// ── RESUMEN FINAL ─────────────────────────────────────────────────────────────
console.log('\n' + hr('═'));
console.log(`\n${C.bold}📋 RESUMEN DEL PLAN DE SANEAMIENTO${C.reset}\n`);
console.log(`  1. 🗑️  Eliminar: ${C.red}${toDelete.length} posts${C.reset} vacíos/duplicados`);
console.log(`  2. 📸 Wiki-Hero: ${C.yellow}${wikiCandidates.length} posts${C.reset} necesitan imagen Wikimedia`);
console.log(`  3. ✅ Ya completos: ${C.green}${allAll.filter(p => p.hasImg && p.textLen > 0).length} posts${C.reset} publicables con foto y texto`);
console.log(`\n${C.dim}  Ejecuta 'node scripts/sanear-hemeroteca.mjs --dry-run' para preview del borrado.${C.reset}`);
console.log('\n' + hr('═') + '\n');
