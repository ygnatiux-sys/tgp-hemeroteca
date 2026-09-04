#!/usr/bin/env node
/**
 * scripts/buscar-sin-hero.mjs
 * 
 * TGP Hemeroteca — Auditor y Asignador de Portadas (Hero) para 'ensayosCinematicos'
 * 
 * Escanea la colección 'ensayosCinematicos' (src/content/ensayos-cinematicos/)
 * y detecta los posts que no tienen una imagen de portada (hero) asignada
 * o cuya imagen de portada no existe en el disco.
 * 
 * Opciones:
 *   --auto-fix       Extrae automáticamente las imágenes base64 de IA de generadorTexto
 *                    hacia archivos físicos en src/assets/ensayos-cinematicos/<slug>/coverImage.jpg
 *                    y asigna el campo 'coverImage' formal en index.json.
 *   --allow-ai       No devuelve código de error si el post tiene imagen de IA en generadorTexto.
 * 
 * Uso:
 *   node scripts/buscar-sin-hero.mjs
 *   node scripts/buscar-sin-hero.mjs --auto-fix
 *   npm run audit:hero
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CINEMATIC_DIR = path.join(ROOT_DIR, 'src', 'content', 'ensayos-cinematicos');
const ASSETS_CINEMATIC_DIR = path.join(ROOT_DIR, 'src', 'assets', 'ensayos-cinematicos');

const AUTO_FIX = process.argv.includes('--auto-fix') || process.argv.includes('--fix');
const ALLOW_AI = process.argv.includes('--allow-ai');

// ─── COLORES ANSI ─────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// ─── PARSERS ──────────────────────────────────────────────────────────────────
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yamlBlock = match[1];
  const data = {};

  yamlBlock.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      data[key] = val;
    }
  });

  return data;
}

/**
 * Extrae y valida la información de un post cinemático
 */
function auditCinematicPost(entryName, postPath) {
  let slug = entryName;
  let data = {};
  let rawContent = '';

  const stat = fs.statSync(postPath);
  if (stat.isDirectory()) {
    slug = entryName;
    const jsonPath = path.join(postPath, 'index.json');
    if (fs.existsSync(jsonPath)) {
      try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (e) {
        return {
          slug,
          title: slug,
          status: 'ERROR',
          detail: `JSON corrupto en index.json: ${e.message}`,
        };
      }
    }

    const mdocPath = path.join(postPath, 'content.mdoc');
    if (fs.existsSync(mdocPath)) {
      rawContent = fs.readFileSync(mdocPath, 'utf8');
      const fm = parseFrontmatter(rawContent);
      data = { ...fm, ...data };
    }
  } else if (entryName.endsWith('.md') || entryName.endsWith('.mdx')) {
    slug = entryName.replace(/\.(md|mdx)$/, '');
    rawContent = fs.readFileSync(postPath, 'utf8');
    data = parseFrontmatter(rawContent);
  } else {
    return null;
  }

  const title = data.title || slug;

  // Campo de portada en Keystatic: 'coverImage'
  let coverImage = data.coverImage || data.image || data.portada || null;
  if (!coverImage && Array.isArray(data.gallery) && data.gallery.length > 0) {
    coverImage = data.gallery[0];
  }

  // Verificar si hay imagen en generadorTexto (Gemini Cinematic)
  let aiImagePayload = null;
  if (typeof data.generadorTexto === 'string' && data.generadorTexto.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(data.generadorTexto);
      if (parsed?.image && typeof parsed.image === 'string' && parsed.image.length > 20) {
        aiImagePayload = parsed.image;
      }
    } catch (e) {}
  }

  // Caso especial: si es 'el-tapir' y existe el asset en 'el-tapir-sudamericano'
  const altAssetDir = path.join(ASSETS_CINEMATIC_DIR, `${slug}-sudamericano`);
  const hasAltAsset = fs.existsSync(path.join(altAssetDir, 'coverImage.jpg'));

  // AUTO-FIX: Extraer base64 a archivo físico o sincronizar asset existente
  if (AUTO_FIX && (!coverImage || typeof coverImage !== 'string' || coverImage.trim() === '')) {
    const targetAssetDir = path.join(ASSETS_CINEMATIC_DIR, slug);
    const targetImgPath = path.join(targetAssetDir, 'coverImage.jpg');
    const relativeAssetPath = `/src/assets/ensayos-cinematicos/${slug}/coverImage.jpg`;

    let fixApplied = false;

    if (aiImagePayload && aiImagePayload.startsWith('data:image/')) {
      if (!fs.existsSync(targetAssetDir)) {
        fs.mkdirSync(targetAssetDir, { recursive: true });
      }
      const base64Data = aiImagePayload.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(targetImgPath, Buffer.from(base64Data, 'base64'));

      // Actualizar index.json
      const jsonPath = path.join(postPath, 'index.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const parsedGen = JSON.parse(data.generadorTexto);
          parsedGen.image = relativeAssetPath;
          data.coverImage = relativeAssetPath;
          data.generadorTexto = JSON.stringify(parsedGen);
          fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
          coverImage = relativeAssetPath;
          fixApplied = true;
        } catch (e) {}
      }
    } else if (hasAltAsset) {
      if (!fs.existsSync(targetAssetDir)) {
        fs.mkdirSync(targetAssetDir, { recursive: true });
      }
      fs.copyFileSync(path.join(altAssetDir, 'coverImage.jpg'), targetImgPath);
      const jsonPath = path.join(postPath, 'index.json');
      if (fs.existsSync(jsonPath)) {
        data.coverImage = relativeAssetPath;
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
        coverImage = relativeAssetPath;
        fixApplied = true;
      }
    }

    if (fixApplied) {
      return {
        slug,
        title,
        status: 'OK',
        detail: `[AUTO-FIXED] Portada extraída y asignada: ${coverImage}`,
        coverImage,
      };
    }
  }

  // Evaluación de estado
  if (!coverImage || (typeof coverImage === 'string' && coverImage.trim() === '')) {
    if (aiImagePayload) {
      return {
        slug,
        title,
        status: 'AI_FALLBACK_ONLY',
        detail: 'Sin coverImage formal en Keystatic (usa imagen IA de generadorTexto)',
        coverImage: null,
        canAutoFix: aiImagePayload.startsWith('data:image/'),
      };
    }
    if (hasAltAsset) {
      return {
        slug,
        title,
        status: 'AI_FALLBACK_ONLY',
        detail: `Existe asset alternativo en ${slug}-sudamericano/coverImage.jpg`,
        coverImage: null,
        canAutoFix: true,
      };
    }
    return {
      slug,
      title,
      status: 'MISSING_HERO',
      detail: 'Sin ninguna imagen asignada (Hero vacío)',
      coverImage: null,
      canAutoFix: false,
    };
  }

  // Si coverImage es un string de ruta local (/src/assets/...)
  if (typeof coverImage === 'string') {
    if (coverImage.startsWith('/src/') || coverImage.startsWith('src/')) {
      const relativePath = coverImage.replace(/^\//, '');
      const diskPath = path.resolve(ROOT_DIR, relativePath);
      if (!fs.existsSync(diskPath)) {
        return {
          slug,
          title,
          status: 'BROKEN_HERO',
          detail: `Archivo físico no encontrado en disco: ${coverImage}`,
          coverImage,
        };
      }
    }
  }

  return {
    slug,
    title,
    status: 'OK',
    detail: `Portada válida: ${typeof coverImage === 'object' ? JSON.stringify(coverImage) : coverImage.slice(0, 70)}`,
    coverImage,
  };
}

// ─── EJECUCIÓN PRINCIPAL ──────────────────────────────────────────────────────
function main() {
  console.log(`\n${C.bold}${C.cyan}======================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  TGP Hemeroteca — Auditoría de Portadas (Hero)      ${C.reset}`);
  console.log(`${C.bold}${C.cyan}  Colección: 'ensayosCinematicos'                     ${C.reset}`);
  console.log(`${C.bold}${C.cyan}======================================================${C.reset}`);
  console.log(`${C.dim}Directorio: ${CINEMATIC_DIR}${C.reset}`);
  if (AUTO_FIX) console.log(`${C.green}${C.bold}Modo AUTO-FIX activado: Extrayendo imágenes base64 a disco...${C.reset}`);
  console.log('');

  if (!fs.existsSync(CINEMATIC_DIR)) {
    console.error(`${C.red}✗ Error: El directorio no existe: ${CINEMATIC_DIR}${C.reset}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(CINEMATIC_DIR)
    .filter(name => name !== '.gitkeep')
    .sort();

  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(CINEMATIC_DIR, entry);
    const result = auditCinematicPost(entry, fullPath);
    if (result) results.push(result);
  }

  const missingHero = results.filter(r => r.status === 'MISSING_HERO');
  const aiFallbackOnly = results.filter(r => r.status === 'AI_FALLBACK_ONLY');
  const brokenHero = results.filter(r => r.status === 'BROKEN_HERO');
  const okHero = results.filter(r => r.status === 'OK');

  // ─── REPORTE EN CONSOLA ──────────────────────────────────────────────────────
  if (missingHero.length > 0) {
    console.log(`${C.bold}${C.red}❌ POSTS SIN PORTADA (Requieren asignación en Keystatic):${C.reset}`);
    missingHero.forEach(p => {
      console.log(`  ${C.red}• [${p.slug}]${C.reset} ${C.bold}"${p.title}"${C.reset}`);
      console.log(`    ${C.dim}└─ ${p.detail}${C.reset}`);
    });
    console.log('');
  }

  if (brokenHero.length > 0) {
    console.log(`${C.bold}${C.yellow}⚠️ POSTS CON PORTADA ROTA (Ruta inexistente en disco):${C.reset}`);
    brokenHero.forEach(p => {
      console.log(`  ${C.yellow}• [${p.slug}]${C.reset} ${C.bold}"${p.title}"${C.reset}`);
      console.log(`    ${C.dim}└─ ${p.detail}${C.reset}`);
    });
    console.log('');
  }

  if (aiFallbackOnly.length > 0) {
    console.log(`${C.bold}${C.magenta}✦ POSTS CON IMAGEN IA EMBEBIDA (Sin coverImage formal en Keystatic):${C.reset}`);
    aiFallbackOnly.forEach(p => {
      console.log(`  ${C.magenta}• [${p.slug}]${C.reset} ${C.bold}"${p.title}"${C.reset}`);
      console.log(`    ${C.dim}└─ ${p.detail}${C.reset}`);
    });
    console.log(`  ${C.cyan}💡 Tip: Puedes ejecutar ${C.bold}npm run audit:hero -- --auto-fix${C.reset}${C.cyan} para extraer estas imágenes a archivos físicos en disco y asignarlas automáticamente.${C.reset}\n`);
  }

  if (okHero.length > 0) {
    console.log(`${C.bold}${C.green}✓ POSTS CON PORTADA VÁLIDA (${okHero.length}):${C.reset}`);
    okHero.forEach(p => {
      console.log(`  ${C.green}✓ [${p.slug}]${C.reset} ${p.title}`);
    });
    console.log('');
  }

  // ─── RESUMEN FINAL ───────────────────────────────────────────────────────────
  console.log(`${C.bold}------------------------------------------------------${C.reset}`);
  console.log(`${C.bold}Resumen de Auditoría:${C.reset}`);
  console.log(`  Total posts en ensayosCinematicos: ${C.bold}${results.length}${C.reset}`);
  console.log(`  ${C.green}✓ Con portada válida en disco:     ${okHero.length}${C.reset}`);
  console.log(`  ${C.magenta}✦ Con imagen IA (generadorTexto):  ${aiFallbackOnly.length}${C.reset}`);
  console.log(`  ${C.yellow}⚠ Con portada rota (falta archivo): ${brokenHero.length}${C.reset}`);
  console.log(`  ${C.red}✗ Sin ninguna imagen (Hero vacío):  ${missingHero.length}${C.reset}`);
  console.log(`${C.bold}------------------------------------------------------${C.reset}\n`);

  if (missingHero.length > 0 || brokenHero.length > 0 || (!ALLOW_AI && aiFallbackOnly.length > 0)) {
    if (missingHero.length > 0 || brokenHero.length > 0) {
      console.log(`${C.bold}${C.yellow}Para corregir los posts en Keystatic:${C.reset}`);
      console.log(`1. Inicia Keystatic: ${C.cyan}npm run dev${C.reset}`);
      console.log(`2. Entra a: ${C.cyan}http://localhost:4321/keystatic/collection/ensayosCinematicos${C.reset}`);
      console.log(`3. Abre cada slug listado arriba y sube una imagen en el campo "Imagen de Portada (Opcional)".\n`);
    }
    // Si solo hay posts con imagen IA y no faltan fotos críticas
    if (missingHero.length === 0 && brokenHero.length === 0) {
      process.exit(0);
    }
    process.exit(1);
  } else {
    console.log(`${C.green}${C.bold}🎉 ¡Todos los ensayos cinemáticos cuentan con imagen disponible!${C.reset}\n`);
    process.exit(0);
  }
}

main();
