#!/usr/bin/env node
/**
 * scripts/audit-content.mjs
 *
 * TGP Hemeroteca — Auditor de Contenido
 *
 * Recorre src/content/ensayos/ y valida que cada post tenga
 * la estructura correcta para ser procesado por Astro Content Layer.
 *
 * Exit 0 = todo válido
 * Exit 1 = errores críticos encontrados
 *
 * Uso: node scripts/audit-content.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENSAYOS_DIR = path.resolve(__dirname, '../src/content/ensayos');

// ─── COLORES ANSI ─────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};

const ok  = (msg) => `  ${C.green}✓${C.reset} ${msg}`;
const err = (msg) => `  ${C.red}✗${C.reset} ${msg}`;
const warn = (msg) => `  ${C.yellow}⚠${C.reset} ${msg}`;
const info = (msg) => `  ${C.dim}·${C.reset} ${msg}`;

// ─── AUDITORÍA ────────────────────────────────────────────────────────────────
function auditPost(slug, dirPath) {
  const issues   = [];   // errores críticos
  const warnings = [];   // advertencias no bloqueantes
  const notes    = [];   // información útil

  // 1. Verificar index.json
  const jsonPath = path.join(dirPath, 'index.json');
  if (!fs.existsSync(jsonPath)) {
    issues.push('FALTA index.json');
    return { slug, issues, warnings, notes, data: null };
  }

  let data;
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e) {
    issues.push(`index.json con JSON inválido: ${e.message}`);
    return { slug, issues, warnings, notes, data: null };
  }

  // 2. Verificar campos obligatorios
  if (!data.title || data.title.trim() === '') {
    issues.push('Campo "title" vacío o ausente');
  }

  // 3. Verificar content.mdoc
  const mdocPath = path.join(dirPath, 'content.mdoc');
  if (!fs.existsSync(mdocPath)) {
    warnings.push('FALTA content.mdoc — el editor de Keystatic no tendrá cuerpo');
  } else {
    const mdocContent = fs.readFileSync(mdocPath, 'utf-8').trim();
    if (mdocContent.length === 0) {
      warnings.push('content.mdoc está vacío');
    } else if (mdocContent.length < 50) {
      warnings.push(`content.mdoc muy corto (${mdocContent.length} chars)`);
    }
  }

  // 4. Advertencias sobre campos opcionales pero importantes
  if (!data.date) {
    warnings.push('Sin campo "date" — no aparecerá en secciones ordenadas por año');
  }
  if (!data.category) {
    warnings.push('Sin campo "category" — no aparecerá en filtros ni colecciones');
  }
  if (!data.excerpt) {
    warnings.push('Sin campo "excerpt" — no habrá bajada en las tarjetas de listado');
  }
  if (!data.coverImage) {
    warnings.push('Sin coverImage — se mostrará fondo gris en el hero');
  }

  // 5. Info
  const draftStatus = data.draft === true ? `${C.yellow}BORRADOR${C.reset}` : `${C.green}PUBLICADO${C.reset}`;
  notes.push(`draft: ${draftStatus}`);
  if (data.generadorTexto && data.generadorTexto.length > 50) {
    notes.push(`generadorTexto: ${data.generadorTexto.length} chars`);
  }
  if (data.coverImage) {
    // Verificar que el archivo de imagen exista físicamente
    const imgRelPath = data.coverImage.replace(/^\//, '');
    const imgAbsPath = path.resolve(__dirname, '..', imgRelPath);
    if (!fs.existsSync(imgAbsPath)) {
      warnings.push(`coverImage apunta a un archivo que NO existe: ${data.coverImage}`);
    }
  }

  return { slug, issues, warnings, notes, data };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
function main() {
  console.log(`\n${C.bold}${C.cyan}TGP Hemeroteca — Auditoría de Contenido${C.reset}`);
  console.log(`${C.dim}Directorio: ${ENSAYOS_DIR}${C.reset}\n`);

  if (!fs.existsSync(ENSAYOS_DIR)) {
    console.error(err(`El directorio no existe: ${ENSAYOS_DIR}`));
    process.exit(1);
  }

  const slugs = fs.readdirSync(ENSAYOS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  if (slugs.length === 0) {
    console.log(warn('No se encontraron posts en el directorio.'));
    process.exit(0);
  }

  let criticalErrors = 0;
  let totalWarnings  = 0;
  let published      = 0;
  let drafts         = 0;

  const results = slugs.map(slug => {
    const dirPath = path.join(ENSAYOS_DIR, slug);
    return auditPost(slug, dirPath);
  });

  // ─── REPORTE ───────────────────────────────────────────────────────────────
  for (const { slug, issues, warnings, notes, data } of results) {
    const hasIssues   = issues.length > 0;
    const hasWarnings = warnings.length > 0;

    const prefix = hasIssues
      ? `${C.red}✗${C.reset}`
      : hasWarnings
        ? `${C.yellow}⚠${C.reset}`
        : `${C.green}✓${C.reset}`;

    console.log(`${prefix} ${C.bold}${slug}${C.reset}`);

    for (const issue of issues) {
      console.log(err(`  ${issue}`));
      criticalErrors++;
    }
    for (const w of warnings) {
      console.log(warn(`  ${w}`));
      totalWarnings++;
    }
    for (const n of notes) {
      console.log(info(`  ${n}`));
    }

    if (data?.draft === true) drafts++;
    else if (data) published++;

    if (hasIssues || hasWarnings || notes.length) console.log('');
  }

  // ─── RESUMEN ───────────────────────────────────────────────────────────────
  console.log('─'.repeat(50));
  console.log(`${C.bold}Resumen:${C.reset}`);
  console.log(info(`Total posts:      ${slugs.length}`));
  console.log(info(`Publicados:       ${C.green}${published}${C.reset}`));
  console.log(info(`Borradores:       ${C.yellow}${drafts}${C.reset}`));
  console.log(info(`Errores críticos: ${criticalErrors > 0 ? C.red : C.green}${criticalErrors}${C.reset}`));
  console.log(info(`Advertencias:     ${totalWarnings > 0 ? C.yellow : C.green}${totalWarnings}${C.reset}`));

  if (criticalErrors > 0) {
    console.log(`\n${C.red}${C.bold}❌ Auditoría FALLIDA — ${criticalErrors} error(es) crítico(s)${C.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${C.green}${C.bold}✅ Auditoría EXITOSA${C.reset}${totalWarnings > 0 ? ` (${totalWarnings} advertencias no bloqueantes)` : ''}\n`);
    process.exit(0);
  }
}

main();
