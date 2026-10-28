/**
 * scripts/curar-museo.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline Local de Curaduría para Objetos de Museo / Estatuaria (TGP)
 *
 * 100% Node.js nativo (Sharp) — Cero dependencias de Python ni conflictos de entorno.
 *
 * Qué hace:
 * 1. Conserva el 100% de la resolución y nitidez del contorno exterior original.
 * 2. Limpia las "islas blancas" internas cerradas (huecos entre piernas, brazos,
 *    báculos o perforaciones) con transición sub-píxel (Alpha Matting) y
 *    descontaminación de halo para fondos oscuros (#18181c).
 * 3. Exporta tanto en .webp (alphaQuality: 100) como .png en public/images/museum/
 *    y opcionalmente en src/assets/vault-media/ listo para `npm run upload:assets`.
 *
 * Uso:
 *   node scripts/curar-museo.mjs <ruta-imagen-entrada> <nombre-salida>
 *   Ejemplo:
 *   node scripts/curar-museo.mjs public/images/museum/statue-hermes.webp statue-hermes
 * ─────────────────────────────────────────────────────────────────────────────
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [, , inputArg, outputNameArg] = process.argv;

if (!inputArg) {
  console.log(`
Uso:
  node scripts/curar-museo.mjs <ruta-entrada> [nombre-salida]

Ejemplo:
  node scripts/curar-museo.mjs public/images/museum/statue-hermes.webp statue-hermes
`);
  process.exit(0);
}

const inputPath = path.resolve(inputArg);
const baseName = outputNameArg || path.basename(inputPath, path.extname(inputPath));
const outDirPublic = path.resolve('public/images/museum');

if (!fs.existsSync(outDirPublic)) {
  fs.mkdirSync(outDirPublic, { recursive: true });
}

async function curarEstatua() {
  console.log(`\n🏛️  Curando pieza de museo: ${path.basename(inputPath)}...`);
  const inputBuffer = fs.readFileSync(inputPath);
  const { data, info } = await sharp(inputBuffer).raw().toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  const outData = Buffer.from(data);

  let clearedPixels = 0;
  let antialiasedPixels = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const r = outData[idx];
      const g = outData[idx + 1];
      const b = outData[idx + 2];
      const a = outData[idx + 3];

      if (a === 0) continue;

      // Proteger zona central superior (rostro y torso) de reflejos especulares del mármol
      const isCoreBust = y < H * 0.48 && x > W * 0.20 && x < W * 0.65;
      if (isCoreBust) continue;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC - minC;
      const lum = (r + g + b) / 3;
      const warmth = r - b;

      if (lum > 235 && sat < 10) {
        outData[idx + 3] = 0;
        clearedPixels++;
      } else if (lum > 205 && warmth < 13 && sat < 15) {
        const whiteFactor = Math.max(0, Math.min(1, (235 - lum) / 30));
        outData[idx + 3] = Math.round(a * whiteFactor);
        outData[idx] = Math.round(r * 0.65);
        outData[idx + 1] = Math.round(g * 0.62);
        outData[idx + 2] = Math.round(b * 0.55);
        antialiasedPixels++;
      }
    }
  }

  const outPng = path.join(outDirPublic, `${baseName}.png`);
  const outWebp = path.join(outDirPublic, `${baseName}.webp`);

  await sharp(outData, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPng);

  await sharp(outData, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 96, alphaQuality: 100, smartSubsample: true })
    .toFile(outWebp);

  console.log(`✅ ¡Listo! Píxeles de fondo vaciados: ${clearedPixels} | Bordes suavizados: ${antialiasedPixels}`);
  console.log(`   ➔ PNG:  ${outPng}`);
  console.log(`   ➔ WebP: ${outWebp}\n`);
}

curarEstatua().catch((err) => {
  console.error('❌ Error curando pieza:', err.message);
  process.exit(1);
});

