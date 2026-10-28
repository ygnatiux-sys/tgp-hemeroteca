#!/usr/bin/env node
/**
 * scripts/curar-museo.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * PIPELINE DE CURADURÍA Y RECORTE DE OBJETOS DE MUSEO (WIKIMEDIA → BENTO DARK & DIURNO)
 *
 * Flujo automatizado:
 * 1. Ingesta desde Wikimedia Commons (búsqueda por término, título "File:..." o URL directa)
 *    o desde archivo local.
 * 2. Si la imagen de Wikimedia tiene fondo opaco (JPG/PNG de museo), extrae la silueta
 *    neuronal en un subproceso aislado (evitando colisión de DLLs en Windows) y aplica
 *    la máscara sobre los píxeles RGB originales en alta resolución (cero pixelado).
 * 3. Vacía las "islas internas" cerradas (huecos entre piernas, brazos, perforaciones).
 * 4. Calibración Dual-Theme (Apple Bento Dark #18181c + Modo Diurno #f5f5f7):
 *    Suavizado sub-píxel (Alpha Matting) y descontaminación cromática neutra en bordes
 *    semitransparentes para evitar halos blancos en Dark y bordes oscuros en Light.
 * 5. Auto-Crop (sharp.trim()) para anclaje lítico exacto en la base inferior.
 * 6. Guarda en:
 *    - public/images/museum/<prefijo>-<slug>.webp (y .png)
 *    - src/assets/vault-media/<prefijo>-<slug>.webp (listo para `npm run upload:assets` a R2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import sharp from 'sharp';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const USER_AGENT = 'TGP-Hemeroteca/1.0 (https://thegreatpuzzleproject.com; editorial@thegreatpuzzleproject.com)';

// ── 1. RESOLUCIÓN Y DESCARGA DESDE WIKIMEDIA COMMONS ─────────────────────────

export async function resolveWikimediaImageUrl(queryOrTitle) {
  if (/^https?:\/\//i.test(queryOrTitle)) {
    return queryOrTitle;
  }

  let fileTitle = queryOrTitle.trim();

  if (!/^File:/i.test(fileTitle)) {
    // 1. Intentar primero la imagen principal curada de Wikipedia (en y es)
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

    // 2. Fallback: Búsqueda directa en Wikimedia Commons
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

// ── 2. AISLAMIENTO DE SUBPROCESO PARA @imgly (EVITA COLISIÓN DE LIBVIPS EN WINDOWS) ──

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
    const outBuf = fs.readFileSync(tmpOut);
    return outBuf;
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
    console.log('🧠 Fondo opaco detectado: extrayendo máscara neuronal (subproceso aislado) preservando RGB original...');
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

  // Suavizar la máscara alfa 1px (Alpha Matting) para que los bordes jamás tengan "dientes de sierra"
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

      // Proteger centro del objeto frente a brillos especulares
      const isCoreCenter = y > H * 0.15 && y < H * 0.48 && x > W * 0.25 && x < W * 0.75;

      // Solo vaciar islas blancas por color si la imagen venía pre-recortada sin IA (caso Hermes).
      // Si pasó por la red neuronal (!alreadyCutout), respetamos al 100% los reflejos especulares de oro/bronce.
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

      // Descontaminación cromática neutra para bordes semitransparentes (Dual-Theme: Dark #18181c + Diurno #f5f5f7)
      if (a > 0 && a < 225) {
        const edgeRatio = 0.74 + 0.26 * (a / 225);
        outRgba[idx] = Math.round(r * edgeRatio);
        outRgba[idx + 1] = Math.round(g * edgeRatio);
        outRgba[idx + 2] = Math.round(b * edgeRatio);
      }

      outRgba[idx + 3] = a;
    }
  }

  // Auto-Crop (sharp.trim()) para eliminar aire vacío y apoyar sobre la sombra de contacto
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

export async function curarPiezaMuseo(sourceInput, outputSlug) {
  let rawBuffer;
  if (fs.existsSync(sourceInput)) {
    console.log(`📂 Leyendo archivo local: ${sourceInput}`);
    rawBuffer = fs.readFileSync(sourceInput);
  } else {
    const resolvedUrl = await resolveWikimediaImageUrl(sourceInput);
    rawBuffer = await downloadBuffer(resolvedUrl);
  }

  const cleanSlug = outputSlug
    .replace(/\.(webp|png|jpe?g)$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toLowerCase();

  const fileNameBase =
    cleanSlug.startsWith('statue-') || cleanSlug.startsWith('museum-') || cleanSlug.startsWith('artifact-')
      ? cleanSlug
      : `artifact-${cleanSlug}`;

  const { pngBuffer, webpBuffer } = await curarObjetoMuseoBuffer(rawBuffer);

  const publicDir = path.resolve('public/images/museum');
  const assetsVaultDir = path.resolve('src/assets/vault-media');

  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(assetsVaultDir, { recursive: true });

  const publicWebpPath = path.join(publicDir, `${fileNameBase}.webp`);
  const publicPngPath = path.join(publicDir, `${fileNameBase}.png`);
  const r2ReadyWebpPath = path.join(assetsVaultDir, `${fileNameBase}.webp`);

  fs.writeFileSync(publicWebpPath, webpBuffer);
  fs.writeFileSync(publicPngPath, pngBuffer);
  fs.writeFileSync(r2ReadyWebpPath, webpBuffer);

  console.log(`✅ [${fileNameBase}] Curado y recortado (Dual-Theme: Dark #18181c + Diurno #f5f5f7):`);
  console.log(`   • Local WebP: /images/museum/${fileNameBase}.webp (${(webpBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`   • R2 Staging: src/assets/vault-media/${fileNameBase}.webp\n`);

  return {
    localUrl: `/images/museum/${fileNameBase}.webp`,
    r2Url: `https://storage.thegreatpuzzleproject.com/vault-media/${fileNameBase}.webp`,
    publicWebpPath,
    publicPngPath,
    r2ReadyWebpPath,
  };
}

// ── 4. CLI ───────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);
  const wikiIdx = args.indexOf('--wiki');

  let sourceArg = null;
  let slugArg = null;

  if (wikiIdx !== -1) {
    sourceArg = args[wikiIdx + 1];
    slugArg = args[wikiIdx + 2] || sourceArg;
  } else {
    sourceArg = args[0];
    slugArg = args[1] || (sourceArg ? path.basename(sourceArg, path.extname(sourceArg)) : null);
  }

  if (!sourceArg) {
    console.log(`
Uso:
  npm run curar:museo -- --wiki "<búsqueda o File: en Wikimedia>" <nombre-salida>
`);
    process.exit(0);
  }

  curarPiezaMuseo(sourceArg, slugArg).catch(err => {
    console.error('\n❌ Error en curaduría de museo:', err.message);
    process.exit(1);
  });
}
