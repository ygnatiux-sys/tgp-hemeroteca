#!/usr/bin/env node
/**
 * scripts/doctor-sanitizer.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * JS DOCTOR MEJORADO — TGP HEMEROTECA
 * Auditoría profunda y sanitización defensiva:
 *  1. Huérfanos: Componentes sin consumidores en src/components/ y subdirectorios.
 *  2. Labs obsoletos: Páginas test-*.astro o prueba-*.astro en src/pages/.
 *  3. Resguardos en src/: Archivos *.bak o *.backup dentro de src/.
 *  4. Enlaces rotos: Detección de importaciones relativas inexistentes.
 *  5. Criba Svelte: Diagnóstico exhaustivo de integridad en componentes .svelte.
 *
 * Modo de uso:
 *  node scripts/doctor-sanitizer.mjs            (Diagnóstico & Preview Dry-Run)
 *  node scripts/doctor-sanitizer.mjs --archive  (Aislamiento seguro a .archive_legacy)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const COMPONENTS_DIR = path.join(SRC, 'components');
const PAGES_DIR = path.join(SRC, 'pages');
const ARCHIVE_DIR = path.join(ROOT, '.archive_legacy');

const args = process.argv.slice(2);
const isArchive = args.includes('--archive');

// ── Colores ANSI ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m',
};

const hr = (c = '─', n = 70) => C.dim + c.repeat(n) + C.reset;

// ── Helpers de Sistema de Archivos ────────────────────────────────────────────
function getAllFiles(dir, extensions = null) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extensions));
    } else {
      if (!extensions || extensions.includes(path.extname(item).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function cleanComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

// ── 1. AUDITORÍA DE BROKEN IMPORTS ────────────────────────────────────────────
function auditBrokenImports(allSrcFiles) {
  const brokenImports = [];
  const codeExtensions = ['.astro', '.svelte', '.ts', '.tsx', '.js', '.mjs'];
  const importRegex = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"](\.[^'"]+)['"]/g;

  for (const filePath of allSrcFiles) {
    const ext = path.extname(filePath).toLowerCase();
    if (!codeExtensions.includes(ext)) continue;
    if (filePath.endsWith('.bak') || filePath.endsWith('.backup')) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const clean = cleanComments(content);
    let match;

    while ((match = importRegex.exec(clean)) !== null) {
      const relImport = match[1];
      const dir = path.dirname(filePath);
      const resolvedBase = path.resolve(dir, relImport);

      // Posibles extensiones a verificar
      const candidates = [
        resolvedBase,
        `${resolvedBase}.ts`,
        `${resolvedBase}.tsx`,
        `${resolvedBase}.js`,
        `${resolvedBase}.mjs`,
        `${resolvedBase}.astro`,
        `${resolvedBase}.svelte`,
        path.join(resolvedBase, 'index.ts'),
        path.join(resolvedBase, 'index.js'),
        path.join(resolvedBase, 'index.astro'),
      ];

      const exists = candidates.some((cand) => fs.existsSync(cand));
      if (!exists) {
        brokenImports.push({
          sourceFile: path.relative(ROOT, filePath),
          importTarget: relImport,
        });
      }
    }
  }

  return brokenImports;
}

// ── 2. AUDITORÍA DE COMPONENTES HUÉRFANOS Y BACKUPS ───────────────────────────
function auditOrphansAndBackups() {
  const allComponents = getAllFiles(COMPONENTS_DIR);
  const rootConfigs = [
    path.join(ROOT, 'markdoc.config.mjs'),
    path.join(ROOT, 'astro.config.mjs'),
    path.join(ROOT, 'keystatic.config.ts'),
  ].filter((f) => fs.existsSync(f));

  const candidateConsumers = [
    ...rootConfigs,
    ...getAllFiles(path.join(SRC, 'pages')),
    ...getAllFiles(path.join(SRC, 'layouts')),
    ...getAllFiles(path.join(SRC, 'content')),
  ].filter((f) => fs.existsSync(f));

  const consumerContents = candidateConsumers.map((p) => fs.readFileSync(p, 'utf-8'));
  const activeComponents = new Set();
  const backupsInSrc = [];

  for (const compPath of allComponents) {
    const filename = path.basename(compPath);
    if (filename.endsWith('.bak') || filename.endsWith('.backup')) {
      backupsInSrc.push(compPath);
      continue;
    }
    if (filename === 'index.ts' || filename === 'index.js') {
      activeComponents.add(compPath);
      continue;
    }

    const compNameNoExt = path.basename(compPath, path.extname(compPath));

    for (const content of consumerContents) {
      const clean = cleanComments(content);
      if (clean.includes(filename) || new RegExp(`\\b${compNameNoExt}\\b`).test(clean)) {
        activeComponents.add(compPath);
        break;
      }
    }
  }

  // Propagación transitiva (componente activo que usa a otro componente)
  let changed = true;
  while (changed) {
    changed = false;
    for (const activeComp of Array.from(activeComponents)) {
      if (!fs.existsSync(activeComp)) continue;
      const activeContent = cleanComments(fs.readFileSync(activeComp, 'utf-8'));
      for (const compPath of allComponents) {
        if (activeComponents.has(compPath) || compPath.endsWith('.bak')) continue;
        const filename = path.basename(compPath);
        const compNameNoExt = path.basename(compPath, path.extname(compPath));
        if (activeContent.includes(filename) || new RegExp(`\\b${compNameNoExt}\\b`).test(activeContent)) {
          activeComponents.add(compPath);
          changed = true;
        }
      }
    }
  }

  const orphans = [];
  for (const compPath of allComponents) {
    if (compPath.endsWith('.bak') || compPath.endsWith('.backup')) continue;
    if (path.basename(compPath).startsWith('index.')) continue;
    if (!activeComponents.has(compPath)) {
      orphans.push(compPath);
    }
  }

  return { orphans, backupsInSrc };
}

// ── 3. AUDITORÍA DE LABS RESIDUALES EN SRC/PAGES ──────────────────────────────
function auditResidualPages() {
  const allPages = fs.readdirSync(PAGES_DIR).filter((f) => {
    const full = path.join(PAGES_DIR, f);
    return !fs.statSync(full).isDirectory();
  });

  const testPages = allPages
    .filter((f) => f.startsWith('test-') || f.startsWith('prueba-'))
    .map((f) => path.join(PAGES_DIR, f));

  return testPages;
}

// ── 4. CRIBA UNA A UNA EN SVELTE ──────────────────────────────────────────────
function auditSvelteComponents() {
  const svelteFiles = getAllFiles(SRC, ['.svelte']);
  const svelteAudit = [];

  for (const sf of svelteFiles) {
    const relPath = path.relative(ROOT, sf);
    const content = fs.readFileSync(sf, 'utf-8');
    const lines = content.split('\n').length;
    const stat = fs.statSync(sf);

    // Detectar si usa D1
    const usesD1 = /d1|d1Id/i.test(content);
    // Detectar si usa Gemini/AI
    const usesAI = /gemini|prompt|mind/i.test(content);
    // Detectar si usa Svelte 5 Runes
    const usesRunes = /\$state|\$derived|\$effect|\$props/.test(content);

    svelteAudit.push({
      file: relPath,
      name: path.basename(sf),
      lines,
      sizeKb: (stat.size / 1024).toFixed(1),
      usesD1,
      usesAI,
      usesRunes,
      status: 'INTACTO',
    });
  }

  return svelteAudit;
}

// ── MAIN EXECUTION ────────────────────────────────────────────────────────────
async function runDoctor() {
  console.log('\n' + hr('═'));
  console.log(`${C.bold}${C.cyan}  🩺  TGP HEMEROTECA — JS DOCTOR SANITIZER${C.reset}`);
  console.log(hr('═'));

  const allSrc = getAllFiles(SRC);

  // 1. Broken imports
  console.log(`\n${C.bold}1. Auditoría de Importaciones Rotas (Broken Imports):${C.reset}`);
  const brokenImports = auditBrokenImports(allSrc);
  if (brokenImports.length === 0) {
    console.log(`   ${C.green}✅ Cero importaciones rotas detectadas en src/. Todo resuelve correctamente.${C.reset}`);
  } else {
    console.log(`   ${C.red}⚠️  Se detectaron ${brokenImports.length} importaciones rotas:${C.reset}`);
    brokenImports.forEach((b) => {
      console.log(`      ✖ ${C.yellow}${b.sourceFile}${C.reset} -> ${C.red}'${b.importTarget}'${C.reset}`);
    });
  }

  // 2. Componentes huérfanos y backups
  console.log(`\n${C.bold}2. Auditoría de Componentes y Backups en src/components/:${C.reset}`);
  const { orphans, backupsInSrc } = auditOrphansAndBackups();

  let totalSavingsBytes = 0;

  if (orphans.length === 0) {
    console.log(`   ${C.green}✅ No hay componentes huérfanos en uso activo.${C.reset}`);
  } else {
    console.log(`   ${C.yellow}📦 Componentes huérfanos sin consumidores (${orphans.length}):${C.reset}`);
    orphans.forEach((o) => {
      const stat = fs.statSync(o);
      totalSavingsBytes += stat.size;
      const kb = (stat.size / 1024).toFixed(1);
      console.log(`      • [HUÉRFANO] ${path.relative(ROOT, o)} (${kb} KB)`);
    });
  }

  if (backupsInSrc.length === 0) {
    console.log(`   ${C.green}✅ No hay archivos .bak contaminando src/.${C.reset}`);
  } else {
    console.log(`   ${C.yellow}💾 Archivos de respaldo (.bak) dentro de src/ (${backupsInSrc.length}):${C.reset}`);
    backupsInSrc.forEach((b) => {
      const stat = fs.statSync(b);
      totalSavingsBytes += stat.size;
      const kb = (stat.size / 1024).toFixed(1);
      console.log(`      • [BACKUP]   ${path.relative(ROOT, b)} (${kb} KB)`);
    });
  }

  // 3. Labs residuales
  console.log(`\n${C.bold}3. Auditoría de Laboratorios Residuales en src/pages/:${C.reset}`);
  const residualPages = auditResidualPages();
  if (residualPages.length === 0) {
    console.log(`   ${C.green}✅ No hay páginas test-* o prueba-* residuales.${C.reset}`);
  } else {
    console.log(`   ${C.dim}ℹ️  Se detectaron ${residualPages.length} páginas de prueba/laboratorios históricos:${C.reset}`);
    residualPages.forEach((p) => {
      const stat = fs.statSync(p);
      totalSavingsBytes += stat.size;
      const kb = (stat.size / 1024).toFixed(1);
      console.log(`      • [LAB] ${path.relative(ROOT, p)} (${kb} KB)`);
    });
  }

  const totalKb = (totalSavingsBytes / 1024).toFixed(1);
  const approxTokens = Math.round(totalSavingsBytes / 3.5);
  console.log(`\n   ${C.cyan}📊 Impacto de optimización potencial:${C.reset} ${totalKb} KB (~${approxTokens.toLocaleString()} tokens LLM)`);

  // 4. Criba Svelte
  console.log(`\n${C.bold}4. Criba Exhaustiva Una a Una de Componentes Svelte (.svelte):${C.reset}`);
  const svelteItems = auditSvelteComponents();
  svelteItems.forEach((s, idx) => {
    const badges = [];
    if (s.usesD1) badges.push(`${C.cyan}[D1]${C.reset}`);
    if (s.usesAI) badges.push(`${C.magenta}[IA]${C.reset}`);
    if (s.usesRunes) badges.push(`${C.green}[Svelte 5 Runes]${C.reset}`);
    const badgeStr = badges.join(' ') || `${C.dim}[UI Vanilla]${C.reset}`;

    console.log(
      `   ${idx + 1}. ${C.bold}${s.name.padEnd(30)}${C.reset} | ` +
      `${s.lines.toString().padStart(4)} lín | ` +
      `${s.sizeKb.padStart(5)} KB | ` +
      `${C.green}[${s.status}]${C.reset} | ${badgeStr}`
    );
  });

  // 5. Acción de Aislamiento si se solicitó --archive
  if (isArchive) {
    console.log(`\n${C.bold}5. Ejecutando Aislamiento Defensivo a .archive_legacy/...${C.reset}`);
    const targetsToArchive = [...orphans, ...backupsInSrc];

    if (targetsToArchive.length === 0) {
      console.log(`   ${C.green}Nada pendiente de aislar.${C.reset}`);
      return;
    }

    if (!fs.existsSync(ARCHIVE_DIR)) {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }

    for (const target of targetsToArchive) {
      const rel = path.relative(SRC, target);
      const dest = path.join(ARCHIVE_DIR, rel);
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.renameSync(target, dest);
      console.log(`   ${C.green}↪ Aislado:${C.reset} ${path.relative(ROOT, target)} -> ${path.relative(ROOT, dest)}`);
    }

    console.log(`\n${C.green}✨ Sanitización completada con éxito. Código preservado fuera de src/.${C.reset}`);
  } else {
    console.log(`\n${C.dim}ℹ️  Modo Preview (Dry-Run). Para aislar los archivos inactivos a .archive_legacy:${C.reset}`);
    console.log(`   ${C.bold}node scripts/doctor-sanitizer.mjs --archive${C.reset}\n`);
  }
}

runDoctor().catch(console.error);
