#!/usr/bin/env node
/**
 * scripts/curar-museo.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * PIPELINE DE CURADURÍA Y RECORTE DE OBJETOS DE MUSEO (WIKIMEDIA → R2 + BENTO DARK & DIURNO)
 *
 * Reglas Mandatorias de Eficiencia (Cero gasto innecesario de cómputo/créditos):
 * 1. Pre-Check de Caché (R2 + Local): Si la pieza `.webp` ya existe en Cloudflare R2
 *    (`vault-media/<slug>.webp`) o en caché local (y no se pasa `--force`), retorna de
 *    inmediato la URL de R2 con fallback local sin volver a correr la IA ni descargar nada.
 * 2. Conversión Directa a WebP (`quality: 95, alphaQuality: 100`) con Auto-Crop (`sharp.trim()`).
 * 3. Subida Inmediata a Cloudflare R2 (`tgp-storage` -> `vault-media/<slug>.webp`) en el
 *    mismo acto y devolución de `{ r2Url, localFallbackUrl }`.
 * 4. Calibración Dual-Theme: Bordes suaves anti-halo tanto para Apple Bento Dark (#1a1a1f)
 *    como para Bento Diurno (#fbfbfd).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import sharp from 'sharp';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const USER_AGENT = 'TGP-Hemeroteca/1.0 (https://thegreatpuzzleproject.com; editorial@thegreatpuzzleproject.com)';
const R2_PUBLIC_URL = 'https://storage.thegreatpuzzleproject.com';
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tgp-storage';

// ── CLIENTE R2 CON FALLBACK SEGURO ───────────────────────────────────────────

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint =
    process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

async function existsInR2(s3, r2Key) {
  if (!s3) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: r2Key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadWebpToR2(s3, r2Key, webpBuffer) {
  if (!s3) return false;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: r2Key,
        Body: webpBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    return true;
  } catch (err) {
    console.warn(`⚠️ [Fallback Local] No se pudo subir a R2 (${err.message}). Usando copia local.`);
    return false;
  }
}

// ── 1. RESOLUCIÓN Y DESCARGA DESDE WIKIMEDIA COMMONS ─────────────────────────

export async function resolveWikimediaImageUrl(queryOrTitle) {
  if (/^https?:\/\//i.test(queryOrTitle)) {
    return queryOrTitle;
  }

  let fileTitle = queryOrTitle.trim();

  if (!/^File:/i.test(fileTitle)) {
    for (const lang of ['en', 'es']) {
      try {
        const wpUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=pageimages&pithumbsize=1600&redirects=1&format=json`;
        const wpRes = await fetch(wpUrl, { headers: { 'User-Agent': USER_AGENT } });
        if (wpRes.ok) {
          const wpData = await wpRes.json();
          const pages = wpData?.query?.pages || {};
          for (const id in pages) {
            if (id === '-1') continue;
            const thumb = pages[id]?.thumbnail?.source;
            if (thumb && /\.(jpe?g|png|webp)/i.test(thumb)) {
              console.log(`🔎 [Wikipedia ${lang.toUpperCase()} PageImage] Seleccionada imagen canónica para "${fileTitle}"`);
              return thumb;
            }
          }
        }
      } catch {
        // Fallback a Commons
      }
    }

    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(fileTitle)}&srnamespace=6&srlimit=10&format=json`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!searchRes.ok) throw new Error(`Error consultando Wikimedia API (${searchRes.status})`);
    const searchData = await searchRes.json();
    const hits = searchData?.query?.search || [];

    const validHit = hits.find(
      h => /\.(jpe?g|png|webp)$/i.test(h.title) && !/(map|flag|icon|diagram|locator|logo|stamp)/i.test(h.title)
    );
    if (!validHit) {
      throw new Error(`No se encontró imagen válida en Wikimedia Commons para: "${queryOrTitle}"`);
    }
    fileTitle = validHit.title;
    console.log(`🔎 [Wikimedia Commons] Archivo seleccionado: ${fileTitle}`);
  }

  const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|dimensions&iiurlwidth=1600&titles=${encodeURIComponent(fileTitle)}`;
  const infoRes = await fetch(infoUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!infoRes.ok) throw new Error(`Error obteniendo imageinfo (${infoRes.status})`);
  const infoData = await infoRes.json();
  const pages = infoData?.query?.pages || {};

  for (const pageId in pages) {
    const info = pages[pageId]?.imageinfo?.[0];
    if (info) {
      return info.thumburl || info.url;
    }
  }

  throw new Error(`No se pudo resolver URL de descarga para ${fileTitle}`);
}

export async function downloadBuffer(url) {
  console.log(`📥 Descargando imagen en alta resolución: ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Fallo HTTP ${res.status} al descargar ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── 2. AISLAMIENTO DE SUBPROCESO PARA @imgly (CERO COLISIÓN DE DLLS) ─────────

function runImglyInSubprocess(inputPngBuffer) {
  const tmpIn = path.join(os.tmpdir(), `tgp_in_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  const tmpOut = path.join(os.tmpdir(), `tgp_out_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  fs.writeFileSync(tmpIn, inputPngBuffer);

  const scriptCode = `
    import { removeBackground } from '@imgly/background-removal-node';
    import fs from 'node:fs';
    const buf = fs.readFileSync(${JSON.stringify(tmpIn)});
    const blob = await removeBackground(new Blob([buf], { type: 'image/png' }));
    const ab = await blob.arrayBuffer();
    fs.writeFileSync(${JSON.stringify(tmpOut)}, Buffer.from(ab));
  `;

  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', scriptCode], {
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    return fs.readFileSync(tmpOut);
  } finally {
    if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  }
}

// ── 3. MOTOR DE LIMPIEZA Y MATTING DUAL-THEME (DARK & DIURNO) ────────────────

function hasTransparentBackground(rawData, width, height) {
  const corners = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ];
  let transparentCorners = 0;
  for (const [cx, cy] of corners) {
    const idx = (cy * width + cx) * 4;
    if (rawData[idx + 3] < 15) transparentCorners++;
  }
  return transparentCorners >= 2;
}

export async function curarObjetoMuseoBuffer(inputBuffer) {
  const normalizedBuf = await sharp(inputBuffer, { limitInputPixels: false })
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer();

  const { data: origRgba, info } = await sharp(normalizedBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  const alreadyCutout = hasTransparentBackground(origRgba, W, H);

  let baseAlpha = Buffer.alloc(W * H);

  if (!alreadyCutout) {
    console.log('🧠 Fondo opaco detectado: extrayendo máscara neuronal preservando RGB original...');
    const flatPng = await sharp(normalizedBuf)
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();

    const maskPngBuf = runImglyInSubprocess(flatPng);

    const { data: maskRgba } = await sharp(maskPngBuf)
      .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < W * H; i++) {
      baseAlpha[i] = maskRgba[i * 4 + 3];
    }
  } else {
    console.log('✨ Contorno transparente previo detectado: preservando nitidez exterior original...');
    for (let i = 0; i < W * H; i++) {
      baseAlpha[i] = origRgba[i * 4 + 3];
    }
  }

  const smoothAlpha = await sharp(baseAlpha, { raw: { width: W, height: H, channels: 1 } })
    .toColourspace('b-w')
    .blur(0.85)
    .linear(1.35, -25)
    .raw()
    .toBuffer();

  const outRgba = Buffer.from(origRgba);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const idx = i * 4;
      let a = smoothAlpha[i];

      if (a < 8) {
        outRgba[idx + 3] = 0;
        continue;
      }

      const r = outRgba[idx];
      const g = outRgba[idx + 1];
      const b = outRgba[idx + 2];

      const isCoreCenter = y > H * 0.15 && y < H * 0.48 && x > W * 0.25 && x < W * 0.75;

      if (alreadyCutout && !isCoreCenter) {
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC - minC;
        const lum = (r + g + b) / 3;
        const warmth = r - b;

        if (lum > 240 && sat < 8) {
          a = 0;
        } else if (lum > 215 && warmth < 11 && sat < 12) {
          const whiteFactor = Math.max(0, Math.min(1, (240 - lum) / 25));
          a = Math.round(a * whiteFactor);
        }
      }

      if (a > 0 && a < 225) {
        const edgeRatio = 0.74 + 0.26 * (a / 225);
        outRgba[idx] = Math.round(r * edgeRatio);
        outRgba[idx + 1] = Math.round(g * edgeRatio);
        outRgba[idx + 2] = Math.round(b * edgeRatio);
      }

      outRgba[idx + 3] = a;
    }
  }

  const trimmedPngBuffer = await sharp(outRgba, { raw: { width: W, height: H, channels: 4 } })
    .trim({ threshold: 8 })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const trimmedWebpBuffer = await sharp(trimmedPngBuffer)
    .webp({ quality: 95, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toBuffer();

  return {
    pngBuffer: trimmedPngBuffer,
    webpBuffer: trimmedWebpBuffer,
  };
}

// ── 4. PIPELINE PRINCIPAL CON PRE-CHECK Y SUBIDA INMEDIATA A R2 + FALLBACK ───

export async function curarPiezaMuseo(sourceInput, outputSlug, { force = false } = {}) {
  const cleanSlug = outputSlug
    .replace(/\.(webp|png|jpe?g)$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toLowerCase();

  const fileNameBase =
    cleanSlug.startsWith('statue-') || cleanSlug.startsWith('museum-') || cleanSlug.startsWith('artifact-')
      ? cleanSlug
      : `artifact-${cleanSlug}`;

  const publicDir = path.resolve('public/images/museum');
  const assetsVaultDir = path.resolve('src/assets/vault-media');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(assetsVaultDir, { recursive: true });

  const publicWebpPath = path.join(publicDir, `${fileNameBase}.webp`);
  const publicPngPath = path.join(publicDir, `${fileNameBase}.png`);
  const r2ReadyWebpPath = path.join(assetsVaultDir, `${fileNameBase}.webp`);

  const r2Key = `vault-media/${fileNameBase}.webp`;
  const r2Url = `${R2_PUBLIC_URL}/${r2Key}`;
  const localUrl = `/images/museum/${fileNameBase}.webp`;

  const s3 = getR2Client();

  // 1. PRE-CHECK ANTI-GASTO: Si ya está procesado en local y/o R2 y no es --force, ahorrar cómputo
  if (!force && fs.existsSync(publicWebpPath)) {
    const alreadyOnR2 = await existsInR2(s3, r2Key);
    if (alreadyOnR2) {
      console.log(`⚡ [Caché R2 Activo — 0 cómputo] ${fileNameBase}.webp ya existe en R2: ${r2Url}`);
      return { primaryUrl: r2Url, fallbackUrl: localUrl, r2Url, localUrl, publicWebpPath, publicPngPath, r2ReadyWebpPath };
    } else if (s3) {
      // Ya está procesado localmente en WebP, solo lo subimos a R2 sin re-ejecutar IA
      const existingWebpBuf = fs.readFileSync(publicWebpPath);
      const uploaded = await uploadWebpToR2(s3, r2Key, existingWebpBuf);
      if (uploaded) {
        console.log(`☁️  [Subido desde caché local a R2 — 0 cómputo IA] ${r2Url}`);
        return { primaryUrl: r2Url, fallbackUrl: localUrl, r2Url, localUrl, publicWebpPath, publicPngPath, r2ReadyWebpPath };
      }
    }
  }

  // 2. INGESTA Y PROCESAMIENTO (solo cuando es pieza nueva o --force)
  let rawBuffer;
  if (fs.existsSync(sourceInput)) {
    console.log(`📂 Leyendo archivo local: ${sourceInput}`);
    rawBuffer = fs.readFileSync(sourceInput);
  } else {
    const resolvedUrl = await resolveWikimediaImageUrl(sourceInput);
    rawBuffer = await downloadBuffer(resolvedUrl);
  }

  const { pngBuffer, webpBuffer } = await curarObjetoMuseoBuffer(rawBuffer);

  fs.writeFileSync(publicWebpPath, webpBuffer);
  fs.writeFileSync(publicPngPath, pngBuffer);
  fs.writeFileSync(r2ReadyWebpPath, webpBuffer);

  // 3. SUBIDA INMEDIATA A CLOUDFLARE R2 CON FALLBACK LOCAL AUTOMÁTICO
  const uploadedToR2 = await uploadWebpToR2(s3, r2Key, webpBuffer);
  const primaryUrl = uploadedToR2 ? r2Url : localUrl;

  console.log(`✅ [${fileNameBase}] Curado, convertido a WebP (${(webpBuffer.length / 1024).toFixed(1)} KB) y listo:`);
  console.log(`   • R2 Storage:     ${uploadedToR2 ? r2Url + ' (ONLINE)' : 'Pendiente (usando Fallback Local)'}`);
  console.log(`   • Fallback Local: ${localUrl}\n`);

  return {
    primaryUrl,
    fallbackUrl: localUrl,
    r2Url,
    localUrl,
    publicWebpPath,
    publicPngPath,
    r2ReadyWebpPath,
  };
}

// ── 5. CLI ───────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const cleanArgs = args.filter(a => a !== '--force');
  const wikiIdx = cleanArgs.indexOf('--wiki');

  let sourceArg = null;
  let slugArg = null;

  if (wikiIdx !== -1) {
    sourceArg = cleanArgs[wikiIdx + 1];
    slugArg = cleanArgs[wikiIdx + 2] || sourceArg;
  } else {
    sourceArg = cleanArgs[0];
    slugArg = cleanArgs[1] || (sourceArg ? path.basename(sourceArg, path.extname(sourceArg)) : null);
  }

  if (!sourceArg) {
    console.log(`
Uso:
  npm run curar:museo -- --wiki "<búsqueda o File: en Wikimedia>" <nombre-salida> [--force]
`);
    process.exit(0);
  }

  curarPiezaMuseo(sourceArg, slugArg, { force }).catch(err => {
    console.error('\n❌ Error en curaduría de museo:', err.message);
    process.exit(1);
  });
}
