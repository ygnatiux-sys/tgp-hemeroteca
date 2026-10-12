#!/usr/bin/env node
/**
 * scripts/curador-visual.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * DIRECTOR DE ORQUESTA: CURADOR VISUAL TGP (WIKIMEDIA + IMAGEN 3 + SHARP)
 *
 * Principio de Responsabilidad Única:
 *   - Maneja la interfaz de línea de comandos (CLI) y flags.
 *   - Orquesta la cascada: intenta Wikimedia primero; si no es apta, recurre a IA.
 *   - Modo Dual:
 *       1. Modo Web (Default): 1 portada monumental optimizada para Keystatic.
 *       2. Modo Video (--video-array): hasta 5 imágenes + assets_array.json para DaVinci.
 *   - Optimiza con Sharp a WebP (q88 max 2560px) y persiste en assets + index.json.
 * ─────────────────────────────────────────────────────────────────────────────
 * Uso:
 *   node scripts/curador-visual.mjs --slug=el-filo-de-la-voluntad
 *   node scripts/curador-visual.mjs --all
 *   node scripts/curador-visual.mjs --slug=el-filo-de-la-voluntad --video-array
 *   node scripts/curador-visual.mjs --all --dry-run
 *   node scripts/curador-visual.mjs --slug=el-filo-de-la-voluntad --force-ai
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import dotenv from 'dotenv';

import { curarWikimedia, extraerCandidatosDraft } from './lib/wikimedia-engine.mjs';
import { curarSintetica } from './lib/synthetic-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(ROOT_DIR, '.env') });

// ── PARSEO DE ARGUMENTOS CLI ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const match = args.find(a => a.startsWith(`--${flag}=`));
  return match ? match.split('=')[1] : null;
};
const hasFlag = (flag) => args.includes(`--${flag}`);

const TARGET_SLUG = getArg('slug');
const TARGET_COLLECTION = getArg('collection') || 'ensayos-cinematicos';
const IS_ALL = hasFlag('all');
const IS_VIDEO_ARRAY = hasFlag('video-array') || hasFlag('video');
const IS_DRY_RUN = hasFlag('dry-run');
const IS_FORCE_AI = hasFlag('force-ai');
const IS_DRAFT = hasFlag('draft') || hasFlag('prepare');


const C = {
  reset: '\x1b[0m', cyan: '\x1b[36m', yellow: '\x1b[33m',
  green: '\x1b[32m', red: '\x1b[31m', bold: '\x1b[1m', dim: '\x1b[2m',
  magenta: '\x1b[35m', blue: '\x1b[34m'
};

// ── DETECCIÓN DE POSTS Y LECTURA DE INDEX.JSON ─────────────────────────────────
function obtenerColeccionPath(col) {
  if (col === 'ensayos') return path.join(ROOT_DIR, 'src', 'content', 'ensayos');
  return path.join(ROOT_DIR, 'src', 'content', 'ensayos-cinematicos');
}

function obtenerAssetsPath(col, slug) {
  if (col === 'ensayos') return path.join(ROOT_DIR, 'src', 'assets', 'ensayos', slug);
  return path.join(ROOT_DIR, 'src', 'assets', 'ensayos-cinematicos', slug);
}

function leerPost(col, slug) {
  const postDir = path.join(obtenerColeccionPath(col), slug);
  if (!fs.existsSync(postDir)) return null;

  const jsonPath = path.join(postDir, 'index.json');
  let data = {};
  if (fs.existsSync(jsonPath)) {
    try {
      data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch {}
  }

  // Leer frontmatter de content.mdoc si existe
  const mdocPath = path.join(postDir, 'content.mdoc');
  if (fs.existsSync(mdocPath)) {
    const raw = fs.readFileSync(mdocPath, 'utf8');
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const lines = fmMatch[1].split(/\r?\n/);
      for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon !== -1) {
          const k = line.slice(0, colon).trim();
          const v = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
          if (!data[k]) data[k] = v;
        }
      }
    }
  }

  return {
    slug,
    collection: col,
    postDir,
    jsonPath,
    data,
    title: data.title || slug,
    excerpt: data.excerpt || data.dek || '',
    coverImage: data.coverImage || data.image || data.portada || null,
    atmosfera: data.atmosfera?.discriminant || 'obsidiana',
  };
}

function encontrarPostsSinHero(col) {
  const baseDir = obtenerColeccionPath(col);
  if (!fs.existsSync(baseDir)) return [];

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const sinHero = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const post = leerPost(col, ent.name);
    if (!post) continue;

    const cover = post.coverImage;
    let tienePortadaValida = false;

    if (cover && typeof cover === 'string' && cover.trim().length > 0) {
      if (cover.startsWith('/src/') || cover.startsWith('src/')) {
        const diskPath = path.resolve(ROOT_DIR, cover.replace(/^\//, ''));
        tienePortadaValida = fs.existsSync(diskPath);
      } else if (cover.startsWith('http://') || cover.startsWith('https://')) {
        tienePortadaValida = true; // URL remota (R2)
      }
    }

    if (!tienePortadaValida) {
      sinHero.push(post);
    }
  }

  return sinHero;
}

// ── PROCESAMIENTO CON SHARP ───────────────────────────────────────────────────
async function procesarYGuardarWebp(buffer, destFile) {
  fs.mkdirSync(path.dirname(destFile), { recursive: true });

  await sharp(buffer)
    .resize(2560, null, { withoutEnlargement: true })
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(destFile);
}

// ── EJECUCIÓN PRINCIPAL DEL ORQUESTADOR ───────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔═══════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   🏛️  TGP HEMEROTECA — CURADOR VISUAL (TRINIDAD MODULAR)   ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚═══════════════════════════════════════════════════════════╝${C.reset}`);

  console.log(`\n⚙️  Configuración Activa:`);
  console.log(`   • Colección:       ${C.bold}${TARGET_COLLECTION}${C.reset}`);
  console.log(`   • Modo:            ${IS_VIDEO_ARRAY ? `${C.magenta}🎬 Video Array (DaVinci Resolve Ready)${C.reset}` : `${C.green}🖼️ Web Hero (1 Portada Canónica)${C.reset}`}`);
  console.log(`   • Modo Dry-Run:    ${IS_DRY_RUN ? `${C.yellow}Activado (sin escrituras)${C.reset}` : 'Desactivado (escribe en disco)'}`);
  console.log(`   • Estrategia:      ${IS_FORCE_AI ? `${C.yellow}Forzar generación IA${C.reset}` : 'Cascada (Wikimedia primero ➜ Fallback Imagen 3)'}\n`);

  let postsAProcesar = [];

  if (TARGET_SLUG) {
    const post = leerPost(TARGET_COLLECTION, TARGET_SLUG);
    if (!post) {
      console.error(`${C.red}❌ Error: No se encontró el post con slug "${TARGET_SLUG}" en ${TARGET_COLLECTION}.${C.reset}`);
      process.exit(1);
    }
    postsAProcesar.push(post);
  } else if (IS_ALL) {
    postsAProcesar = encontrarPostsSinHero(TARGET_COLLECTION);
    console.log(`🔎 Escaneo de colección completo: se encontraron ${C.bold}${postsAProcesar.length}${C.reset} post(s) sin portada válida.`);
  } else {
    // Si no se pasó ni --slug ni --all, buscar el primero sin hero
    const encontrados = encontrarPostsSinHero(TARGET_COLLECTION);
    if (encontrados.length > 0) {
      console.log(`ℹ️ No se especificó --slug ni --all. Procesando el primer post sin portada: ${C.bold}${encontrados[0].slug}${C.reset}`);
      postsAProcesar.push(encontrados[0]);
    } else {
      console.log(`${C.green}✅ Todos los posts de ${TARGET_COLLECTION} tienen portada válida. ¡Nada por curar!${C.reset}`);
      console.log(`💡 Para forzar un post existente usa: node scripts/curador-visual.mjs --slug=<slug>`);
      process.exit(0);
    }
  }

  if (IS_DRAFT) {
    console.log(`\n${C.bold}${C.cyan}📝 Modo Draft / HITL Activado: Extrayendo hasta 10 candidatos sin descargar archivos pesados...${C.reset}\n`);
    const drafts = [];
    const curadorDir = path.join(ROOT_DIR, '.curador');
    fs.mkdirSync(curadorDir, { recursive: true });

    for (const post of postsAProcesar) {
      console.log(`🎯 [Borrador] ${C.bold}${post.title}${C.reset} (${post.slug})`);
      try {
        const draftResult = await extraerCandidatosDraft(post.title, post.excerpt, 10);
        drafts.push({
          slug: post.slug,
          title: post.title,
          collection: post.collection,
          total: draftResult.candidates.length,
          candidates: draftResult.candidates,
        });
      } catch (err) {
        console.warn(`⚠️ Error extrayendo candidatos para ${post.slug}: ${err.message}`);
      }
    }

    const draftFilePath = path.join(curadorDir, 'draft_candidates.json');
    fs.writeFileSync(draftFilePath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      posts: drafts,
    }, null, 2), 'utf8');

    console.log(`\n${C.green}✅ Archivo borrador de candidatos guardado exitosamente:${C.reset} ${draftFilePath}`);
    console.log(`🌐 Visita la interfaz interactiva para evaluar y confirmar: ${C.bold}http://localhost:4321/admin/curador${C.reset}\n`);
    return;
  }

  let totalExitos = 0;
  let totalFallidos = 0;

  for (const post of postsAProcesar) {
    console.log(`\n${C.dim}───────────────────────────────────────────────────────────${C.reset}`);
    console.log(`🎯 [Procesando] ${C.bold}${post.title}${C.reset} (${C.dim}${post.slug}${C.reset})`);


    let resultado = null;

    // FASE A: WIKIMEDIA COMMONS (si no es --force-ai)
    if (!IS_FORCE_AI) {
      try {
        resultado = await curarWikimedia({
          title: post.title,
          excerpt: post.excerpt,
          isVideoArray: IS_VIDEO_ARRAY,
          maxImages: 5,
        });
      } catch (err) {
        console.warn(`   ⚠️ Error durante pipeline de Wikimedia: ${err.message}`);
      }
    }

    // FASE B: FALLBACK A IMAGEN 3 SINTÉTICA (si Wikimedia falló o fue rechazada)
    if (!resultado || !resultado.ok || resultado.items.length === 0) {
      const motivo = resultado?.reason || 'modo_force_ai';
      console.log(`   ⚡ Wikimedia no disponible (${motivo}). Activando fallback a Imagen 3...`);

      try {
        resultado = await curarSintetica({
          title: post.title,
          excerpt: post.excerpt,
          atmosfera: post.atmosfera,
          isVideoArray: IS_VIDEO_ARRAY,
          count: IS_VIDEO_ARRAY ? 4 : 1,
        });
      } catch (err) {
        console.error(`   ❌ Falló generación sintética: ${err.message}`);
      }
    }

    if (!resultado || !resultado.ok || resultado.items.length === 0) {
      console.error(`   ❌ No fue posible obtener imágenes ni de Wikimedia ni de IA para "${post.slug}".`);
      totalFallidos++;
      continue;
    }

    // FASE C: PERSISTENCIA Y ATRIBUCIÓN
    if (IS_DRY_RUN) {
      console.log(`   ${C.yellow}[DRY-RUN] Simulación exitosa:${C.reset}`);
      console.log(`     • Imágenes obtenidas: ${resultado.items.length}`);
      console.log(`     • Fuente: ${resultado.isSynthetic ? 'IA (Imagen 3)' : 'Wikimedia Commons'}`);
      console.log(`     • Atribución:`, resultado.items[0].attribution);
      totalExitos++;
      continue;
    }

    const assetsDir = obtenerAssetsPath(post.collection, post.slug);
    fs.mkdirSync(assetsDir, { recursive: true });

    if (!IS_VIDEO_ARRAY) {
      // ── MODO 1: WEB HERO (1 portada) ───────────────────────────
      const primaryItem = resultado.primary || resultado.items[0];
      const coverFileName = 'coverImage.webp';
      const coverDiskPath = path.join(assetsDir, coverFileName);
      const coverRelativePath = `/src/assets/${post.collection}/${post.slug}/${coverFileName}`;

      console.log(`   💾 Optimizando y guardando WebP en disco: ${coverDiskPath}...`);
      await procesarYGuardarWebp(primaryItem.buffer, coverDiskPath);

      // Actualizar index.json
      if (fs.existsSync(post.jsonPath)) {
        const jsonData = JSON.parse(fs.readFileSync(post.jsonPath, 'utf8'));
        jsonData.coverImage = coverRelativePath;
        jsonData.coverImageAttribution = primaryItem.attribution;

        // Si provino de Wikimedia, estructurar bancoImagenesWikimedia para Keystatic
        if (!resultado.isSynthetic) {
          jsonData.bancoImagenesWikimedia = JSON.stringify({
            selectedItems: [{
              id: primaryItem.title.replace(/\s+/g, '_'),
              url: primaryItem.sourceUrl || coverRelativePath,
              thumbUrl: coverRelativePath,
              title: primaryItem.title,
              author: primaryItem.attribution.author,
              license: primaryItem.attribution.license,
              width: primaryItem.width,
              height: primaryItem.height,
              aspectRatio: 1.78,
              role: 'HERO',
            }],
          });
        }

        fs.writeFileSync(post.jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
        console.log(`   📝 index.json actualizado exitosamente.`);
      }

      console.log(`   ✅ [Completado] Portada Hero asignada con éxito.`);
      totalExitos++;

    } else {
      // ── MODO 2: VIDEO ARRAY (DaVinci Resolve / Remotion) ─────────
      const videoAssetsDir = path.join(assetsDir, 'video_assets');
      fs.mkdirSync(videoAssetsDir, { recursive: true });

      const assetListForJson = [];

      for (let i = 0; i < resultado.items.length; i++) {
        const it = resultado.items[i];
        const numStr = String(i + 1).padStart(2, '0');
        const assetName = `asset_${numStr}.webp`;
        const assetDiskPath = path.join(videoAssetsDir, assetName);
        const assetRelPath = `/src/assets/${post.collection}/${post.slug}/video_assets/${assetName}`;

        await procesarYGuardarWebp(it.buffer, assetDiskPath);

        assetListForJson.push({
          index: i + 1,
          filename: assetName,
          title: it.title,
          relativePath: assetRelPath,
          absolutePath: assetDiskPath.replace(/\\/g, '/'),
          width: it.width,
          height: it.height,
          aspectRatio: '16:9',
          attribution: it.attribution,
        });
      }

      // Generar assets_array.json en la carpeta del post (para DaVinci Resolve)
      const arrayJsonPath = path.join(post.postDir, 'assets_array.json');
      const arrayPayload = {
        slug: post.slug,
        title: post.title,
        generatedAt: new Date().toISOString(),
        mode: 'video-array',
        source: resultado.isSynthetic ? 'Synthetic AI (Imagen 3)' : 'Wikimedia Commons',
        totalAssets: assetListForJson.length,
        assets: assetListForJson,
      };

      fs.writeFileSync(arrayJsonPath, JSON.stringify(arrayPayload, null, 2), 'utf8');
      console.log(`   🎬 [DaVinci Ready] Creado: ${arrayJsonPath} (${assetListForJson.length} fotos optimizadas).`);

      // Asignar además la primera imagen como coverImage si el post no tenía
      if (!post.coverImage || post.coverImage.trim() === '') {
        const coverFileName = 'coverImage.webp';
        const coverDiskPath = path.join(assetsDir, coverFileName);
        const coverRelativePath = `/src/assets/${post.collection}/${post.slug}/${coverFileName}`;
        fs.copyFileSync(path.join(videoAssetsDir, 'asset_01.webp'), coverDiskPath);

        if (fs.existsSync(post.jsonPath)) {
          const jsonData = JSON.parse(fs.readFileSync(post.jsonPath, 'utf8'));
          jsonData.coverImage = coverRelativePath;
          jsonData.coverImageAttribution = assetListForJson[0].attribution;
          fs.writeFileSync(post.jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
          console.log(`   📝 Asignada también como coverImage principal en index.json.`);
        }
      }

      console.log(`   ✅ [Completado] Paquete de video y metadatos listos para ingesta.`);
      totalExitos++;
    }
  }

  console.log(`\n${C.bold}${C.cyan}===========================================================${C.reset}`);
  console.log(`${C.bold}  Resumen de Curaduría: ${C.green}${totalExitos} exitosos${C.reset} | ${C.red}${totalFallidos} fallidos${C.reset}`);
  console.log(`${C.bold}${C.cyan}===========================================================${C.reset}\n`);
}

main().catch(err => {
  console.error(`\n💥 Error crítico en curador-visual:`, err);
  process.exit(1);
});
