/**
 * scripts/optimizar-remotas.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Rastreador, Optimizador WebP y Sincronizador Inmediato a Cloudflare R2
 *
 * Funcionalidad:
 * 1. Escanea todos los archivos (.astro, .ts, .js, .md, .mdx, .json) en src/.
 * 2. Detecta URLs externas de imágenes (Wikimedia Commons) y las convierte a WebP.
 * 3. Las guarda como respaldo local en src/assets/remotas/ y las sube SIN FALTA
 *    en el acto a Cloudflare R2 (https://storage.thegreatpuzzleproject.com/remotas/...).
 * 4. Además, audita src/assets/remotas/ y src/assets/alternativa/ para asegurar
 *    que ningún archivo local haya quedado sin subir a Cloudflare R2 (con pre-check
 *    HeadObjectCommand para no gastar cómputo ni ancho de banda si ya existe).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { resolveSharpParams, printProfileSummary } from './lib/sharp-profiles.mjs';

dotenv.config();

// ── CONFIGURACIÓN R2 ─────────────────────────────────────────────────────────
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tgp-storage';
const R2_PUBLIC_URL = 'https://storage.thegreatpuzzleproject.com';
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

const s3 = (accessKeyId && secretAccessKey && endpoint)
  ? new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: false,
    })
  : null;

// ── CONFIGURACIÓN DE DIRECTORIOS ─────────────────────────────────────────────
const ASSETS_REMOTE_DIR = path.resolve('src/assets/remotas');
const ASSETS_ALT_DIR = path.resolve('src/assets/alternativa');
const DIRS_TO_SCAN = [
  path.resolve('src/pages'),
  path.resolve('src/components'),
  path.resolve('src/content'),
  path.resolve('src/layouts'),
  path.resolve('src/config'),
  path.resolve('src/lib')
];

const URL_REGEX = /https:\/\/(?:upload|thumb)\.wikimedia\.org\/[^\s"'`\\]+/g;
const ALLOWED_EXTS = /\.(astro|md|mdx|json|ts|js|tsx|jsx)$/;

if (!fs.existsSync(ASSETS_REMOTE_DIR)) {
  fs.mkdirSync(ASSETS_REMOTE_DIR, { recursive: true });
}

// ── UTILIDADES R2 ────────────────────────────────────────────────────────────
async function existsInR2(r2Key) {
  if (!s3) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: r2Key }));
    return true;
  } catch {
    return false;
  }
}

async function ensureUploadedToR2(r2Key, localFilePath, contentType = 'image/webp') {
  if (!s3 || !fs.existsSync(localFilePath)) return false;
  const alreadyThere = await existsInR2(r2Key);
  if (alreadyThere) return true;

  try {
    const body = fs.readFileSync(localFilePath);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: r2Key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    const kb = (body.length / 1024).toFixed(1);
    console.log(`☁️  [R2 SUBIDO] ${R2_PUBLIC_URL}/${r2Key} (${kb} KB)`);
    return true;
  } catch (err) {
    console.error(`❌ Error subiendo ${r2Key} a R2:`, err.message);
    return false;
  }
}

// ── UTILIDADES DE ARCHIVOS ───────────────────────────────────────────────────
function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

function getCleanFilename(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    let last = parts[parts.length - 1];
    last = decodeURIComponent(last);
    last = last.replace(/^\d+px-/, '');
    last = last.replace(/\.[a-zA-Z0-9]+$/, '');
    last = last.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (last.length < 3) throw new Error('Nombre muy corto');
    if (last.length > 50) last = last.substring(0, 50);

    return last + '.webp';
  } catch {
    return 'img-' + crypto.createHash('md5').update(url).digest('hex').substring(0, 8) + '.webp';
  }
}

async function processUrl(url) {
  const filename = getCleanFilename(url);
  const destPath = path.join(ASSETS_REMOTE_DIR, filename);
  const r2Key = `remotas/${filename}`;
  const r2Url = `${R2_PUBLIC_URL}/${r2Key}`;
  const localAssetUrl = `/src/assets/remotas/${filename}`;

  if (fs.existsSync(destPath)) {
    await ensureUploadedToR2(r2Key, destPath, 'image/webp');
    return s3 ? r2Url : localAssetUrl;
  }

  console.log(`\n📥 Descargando: ${url}`);
  try {
    await new Promise(r => setTimeout(r, 400));

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'TgpImageOptimizer/1.0 (https://thegreatpuzzleproject.com; admin@thegreatpuzzleproject.com)'
      }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { profile, resizeOptions, webpOptions } = resolveSharpParams(filename);
    console.log(`✨ [${profile.name.toUpperCase()}] ${profile.log}: ${filename}`);

    await sharp(buffer, { limitInputPixels: false })
      .resize(resizeOptions)
      .webp(webpOptions)
      .toFile(destPath);

    await ensureUploadedToR2(r2Key, destPath, 'image/webp');
    return s3 ? r2Url : localAssetUrl;
  } catch (error) {
    console.error(`❌ Error procesando ${url}:`, error.message);
    return null;
  }
}

/**
 * Audita src/assets/remotas/ y src/assets/alternativa/:
 * - Si hay un .jpg/.png en remotas/ sin su par .webp, genera el .webp automáticamente.
 * - Verifica que cada archivo exista en Cloudflare R2 y lo sube si falta.
 */
async function syncExistingLocalAssetsToR2() {
  if (!s3) {
    console.warn('⚠️ Sin credenciales R2 en .env: omitiendo verificación en la nube.');
    return;
  }

  // 1. Asegurar conversión WebP y subida de src/assets/remotas/
  if (fs.existsSync(ASSETS_REMOTE_DIR)) {
    const remoteFiles = fs.readdirSync(ASSETS_REMOTE_DIR);
    for (const file of remoteFiles) {
      const fullPath = path.join(ASSETS_REMOTE_DIR, file);
      if (!fs.statSync(fullPath).isFile()) continue;

      if (/\.(jpe?g|png)$/i.test(file)) {
        const webpName = file.replace(/\.(jpe?g|png)$/i, '.webp');
        const webpPath = path.join(ASSETS_REMOTE_DIR, webpName);
        if (!fs.existsSync(webpPath)) {
          const { resizeOptions, webpOptions } = resolveSharpParams(webpName);
          await sharp(fullPath, { limitInputPixels: false })
            .resize(resizeOptions)
            .webp(webpOptions)
            .toFile(webpPath);
          console.log(`🔄 Convertido a WebP local: remotas/${webpName}`);
        }
        await ensureUploadedToR2(`remotas/${webpName}`, webpPath, 'image/webp');
        await ensureUploadedToR2(`remotas/${file}`, fullPath, file.endsWith('.png') ? 'image/png' : 'image/jpeg');
      } else if (/\.webp$/i.test(file)) {
        await ensureUploadedToR2(`remotas/${file}`, fullPath, 'image/webp');
      }
    }
  }

  // 2. Asegurar subida de src/assets/alternativa/
  if (fs.existsSync(ASSETS_ALT_DIR)) {
    const altFiles = fs.readdirSync(ASSETS_ALT_DIR);
    for (const file of altFiles) {
      const fullPath = path.join(ASSETS_ALT_DIR, file);
      if (!fs.statSync(fullPath).isFile()) continue;
      const mime = /\.webp$/i.test(file) ? 'image/webp' : /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
      await ensureUploadedToR2(`alternativa/${file}`, fullPath, mime);
    }
  }
}

// ── BUCLE PRINCIPAL ──────────────────────────────────────────────────────────
async function main() {
  console.log('======================================================');
  console.log('  🌐 TGP - AUTO-OPTIMIZADOR WEBP + R2 SYNC OBLIGATORIO');
  console.log('======================================================');
  console.log(printProfileSummary());

  // Paso 1: Garantizar que todos los archivos en remotas/ y alternativa/ estén en R2
  await syncExistingLocalAssetsToR2();

  // Paso 2: Escanear código en busca de nuevas URLs de Wikimedia
  let filesToScan = [];
  DIRS_TO_SCAN.forEach(dir => {
    walkDir(dir, (filePath) => {
      if (ALLOWED_EXTS.test(filePath)) {
        filesToScan.push(filePath);
      }
    });
  });

  let totalReplaced = 0;
  let filesModified = 0;

  for (const filePath of filesToScan) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(URL_REGEX);

    if (matches && matches.length > 0) {
      let changed = false;
      const uniqueUrls = [...new Set(matches)];

      for (const url of uniqueUrls) {
        const finalUrl = await processUrl(url);

        if (finalUrl && finalUrl !== url) {
          const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const replaceRegex = new RegExp(escapedUrl, 'g');

          content = content.replace(replaceRegex, finalUrl);
          changed = true;
          totalReplaced++;
        }
      }

      if (changed) {
        fs.writeFileSync(filePath, content, 'utf-8');
        filesModified++;
        console.log(`📝 Actualizado código en: ${path.relative(process.cwd(), filePath)}`);
      }
    }
  }

  console.log('\n======================================================');
  console.log(`  ✅ Proceso finalizado.`);
  console.log(`  • URLs externas convertidas y subidas a R2: ${totalReplaced}`);
  console.log(`  • Archivos de código actualizados:          ${filesModified}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
