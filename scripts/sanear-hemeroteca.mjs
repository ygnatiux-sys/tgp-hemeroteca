#!/usr/bin/env node
/**
 * scripts/sanear-hemeroteca.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Limpia la Hemeroteca TGP: elimina posts vacíos y duplicados detectados
 * por el análisis de distribución.
 *
 * Uso:
 *   node scripts/sanear-hemeroteca.mjs --dry-run   → preview (no borra nada)
 *   node scripts/sanear-hemeroteca.mjs             → borra definitivamente
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'src', 'content');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Colores ANSI ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', cyan: '\x1b[36m', yellow: '\x1b[33m',
  green: '\x1b[32m', red: '\x1b[31m', bold: '\x1b[1m', dim: '\x1b[2m',
  magenta: '\x1b[35m',
};

// ── Lista de posts a eliminar (resultado del análisis) ────────────────────────
// Formato: { collection: 'nombre-dir', slug: 'slug-del-post', reason: '...' }
const TO_DELETE = [
  // ─── Ensayos: duplicados/vacíos ───────────────────────────────────────────
  { collection: 'ensayos',            slug: 'bonampak-2',                         reason: 'Duplicado de bonampak (14 chars)' },
  { collection: 'ensayos',            slug: 'julio-cesar-y-los-galos-2',           reason: 'Duplicado de julio-cesar-y-los-galos-2026 (87c)' },
  { collection: 'ensayos',            slug: 'los-carpocracianos-1',                reason: 'Duplicado de los-carpocracianos (64c)' },
  { collection: 'ensayos',            slug: 'los-nestorianos-1',                   reason: 'Duplicado de los-nestorianos (73c)' },
  { collection: 'ensayos',            slug: 'tikal-1',                             reason: 'Duplicado de tikal (14c)' },
  { collection: 'ensayos',            slug: 'el-diablo-en-el-tarot-1',             reason: 'Duplicado de el-diablo-en-el-tarot' },
  { collection: 'ensayos',            slug: 'atila-y-el-papa-1',                   reason: 'Duplicado de atila-y-el-papa' },
  // ─── Georreferencias: vacíos ──────────────────────────────────────────────
  { collection: 'georreferencias',    slug: 'meroe-sudan',                         reason: 'Vacío total (0 chars, sin foto)' },
  { collection: 'georreferencias',    slug: 'pedra-do-inga-mgzn',                  reason: 'Duplicado de pedra-inga (0 chars)' },
  { collection: 'georreferencias',    slug: 'pedra-inga-1',                        reason: 'Duplicado de pedra-inga (vacío)' },
  { collection: 'georreferencias',    slug: 'isla-de-los-estados',                 reason: 'Duplicado de isla-de-los-estados-en-tierra-del-fuego (0 chars)' },
  { collection: 'georreferencias',    slug: 'santuario-de-ballenas-peninsula-de-valdez', reason: 'Duplicado con -patagonia (0 chars)' },
  // ─── Arquetipos: vacíos / duplicados ─────────────────────────────────────
  { collection: 'arquetipos-globales', slug: 'demeter2',                           reason: 'Vacío total (sin foto, sin texto)' },
  { collection: 'arquetipos-globales', slug: 'los-annunaki',                       reason: 'Vacío total (sin foto, sin texto)' },
  { collection: 'arquetipos-globales', slug: 'los-annunakis',                      reason: 'Duplicado de los-annunaki (vacío)' },
  { collection: 'arquetipos-globales', slug: 'jung-y-los-arquetipos',              reason: 'Duplicado: ya existe en Ensayos con texto completo' },
  { collection: 'arquetipos-globales', slug: 'jupiter-y-la-astrologia-el-benigno', reason: 'Duplicado: ya existe en Ensayos' },
  { collection: 'arquetipos-globales', slug: 'saturno-y-la-astrologia',            reason: 'Duplicado: ya existe en Ensayos' },
  { collection: 'arquetipos-globales', slug: 'mercurio',                           reason: 'Vacío total (sin foto, sin texto)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function deleteDir(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const hr = (c = '─', n = 72) => C.dim + c.repeat(n) + C.reset;

console.log('\n' + hr('═'));
console.log(`${C.bold}${C.magenta}  🗑️  TGP HEMEROTECA — SANEAMIENTO${DRY_RUN ? ' [DRY RUN]' : ''}${C.reset}`);
console.log(hr('═'));

if (DRY_RUN) {
  console.log(`\n${C.yellow}  ⚠️  MODO PREVIEW — No se eliminará nada. Omite --dry-run para ejecutar.${C.reset}\n`);
}

let deleted = 0;
let skipped = 0;
let notFound = 0;

for (const { collection, slug, reason } of TO_DELETE) {
  const dir = path.join(CONTENT, collection, slug);
  const label = `[${collection}] ${slug}`;

  if (!dirExists(dir)) {
    console.log(`  ${C.dim}⊘ NO ENCONTRADO  ${label}${C.reset}`);
    notFound++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`  ${C.yellow}🔍 PREVIEW${C.reset}   ${label.padEnd(60)} ${C.dim}${reason}${C.reset}`);
    deleted++;
  } else {
    try {
      deleteDir(dir);
      console.log(`  ${C.green}✅ ELIMINADO${C.reset}  ${label.padEnd(60)} ${C.dim}${reason}${C.reset}`);
      deleted++;
    } catch (err) {
      console.log(`  ${C.red}❌ ERROR${C.reset}      ${label.padEnd(60)} ${C.red}${err.message}${C.reset}`);
      skipped++;
    }
  }
}

console.log('\n' + hr('═'));
console.log(`\n  ${C.bold}Resumen:${C.reset}`);
if (DRY_RUN) {
  console.log(`  ${C.yellow}Listos para eliminar: ${deleted}${C.reset}`);
} else {
  console.log(`  ${C.green}Eliminados:  ${deleted}${C.reset}`);
  console.log(`  ${C.red}Con error:   ${skipped}${C.reset}`);
}
console.log(`  ${C.dim}No encontrados: ${notFound}${C.reset}`);

if (!DRY_RUN && deleted > 0) {
  console.log(`\n  ${C.cyan}Ejecuta 'npm run audit:todo' para verificar el estado del catálogo.${C.reset}`);
  console.log(`  ${C.cyan}Ejecuta 'node scripts/analisis-distribucion.mjs' para ver la nueva distribución.${C.reset}`);
}

console.log('\n' + hr('═') + '\n');
