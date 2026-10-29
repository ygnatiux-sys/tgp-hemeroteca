/**
 * scripts/optimizar-remotas.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Rastreador, Optimizador WebP y Sincronizador Inmediato a Cloudflare R2
 *
 * Funcionalidad Integral (Detector de Imágenes Escondidas en Desk):
 * 1. Lista en 1 sola llamada (ListObjectsV2Command) todas las claves activas en
 *    el bucket Cloudflare R2 ("tgp-storage") para no gastar operaciones innecesarias.
 * 2. Escanea TODO src/assets/ y public/images/museum/:
 *    - Si encuentra cualquier imagen local (.jpg, .png, .webp, .avif) que falte en R2,
 *      la optimiza a WebP en memoria (según su perfil Sharp) y la sube SIN FALTA a R2.
 *    - En src/assets/remotas/ y src/assets/alternativa/, genera también su par .webp
 *      y lo sube a R2 para que cualquier referencia .webp o .jpg funcione en la nube.
 * 3. Escanea todos los archivos (.astro, .tsx, .ts, .js, .md, .mdx, .mdoc, .json) en src/:
 *    - Detecta URLs externas de Wikimedia Commons, las descarga, convierte a .webp,
 *      sube a R2 y reemplaza la URL en el código por https://storage.thegreatpuzzleproject.com/remotas/<archivo>.webp.
 *    - Detecta rutas locales "/src/assets/..." escondidas en componentes .astro/.tsx/.jsx
 *      y las reemplaza directamente por su URL pública en Cloudflare R2 tras verificar
 *      que el archivo esté subido en R2.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
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
const ASSETS_DIR = path.resolve('src/assets');
const ASSETS_REMOTE_DIR = path.resolve('src/assets/remotas');
const ASSETS_ALT_DIR = path.resolve('src/assets/alternativa');
const PUBLIC_MUSEUM_DIR = path.resolve('public/images/museum');

const DIRS_TO_SCAN = [
  path.resolve('src/pages'),
  path.resolve('src/components'),
  path.resolve('src/content'),
  path.resolve('src/layouts'),
  path.resolve('src/config'),
  path.resolve('src/lib')
];

const URL_REGEX = /https:\/\/(?:upload|thumb)\.wikimedia\.org\/[^\s"'`\\]+/g;
const LOCAL_ASSET_UI_REGEX = /(['"`])\/src\/assets\/((?:remotas|alternativa|vault-media|busts)\/[^'"`\s]+)\1/g;
const ALLOWED_EXTS = /\.(astro|md|mdx|mdoc|json|ts|js|tsx|jsx)$/;
const IMAGE_EXTS = /\.(jpe?g|png|webp|avif)$/i;

if (!fs.existsSync(ASSETS_REMOTE_DIR)) {
  fs.mkdirSync(ASSETS_REMOTE_DIR, { recursive: true });
}

// Caché en memoria de claves existentes en R2
const r2ExistingKeys = new Set();

async function loadR2KeysIndex() {
  if (!s3) return;
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: token,
    }));
    for (const obj of (res.Contents || [])) {
      if (obj.Key) r2ExistingKeys.add(obj.Key);
    }
    token = res.NextContinuationToken;
  } while (token);
}

async function ensureBufferUploadedToR2(r2Key, buffer, contentType = 'image/webp') {
  if (!s3) return false;
  if (r2ExistingKeys.has(r2Key)) return true;

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    r2ExistingKeys.add(r2Key);
    const kb = (buffer.length / 1024).toFixed(1);
    console.log(`☁️  [R2 SUBIDO] ${R2_PUBLIC_URL}/${r2Key} (${kb} KB)`);
    return true;
  } catch (err) {
    console.error(`❌ Error subiendo ${r2Key} a R2:`, err.message);
    return false;
  }
}

async function ensureFileUploadedAsWebp(r2Key, localFilePath) {
  if (!s3 || !fs.existsSync(localFilePath)) return false;
  if (r2ExistingKeys.has(r2Key)) return true;

  try {
    const rawBuffer = fs.readFileSync(localFilePath);
    let uploadBuffer = rawBuffer;
    let contentType = 'image/webp';

    if (IMAGE_EXTS.test(localFilePath)) {
      const { resizeOptions, webpOptions } = resolveSharpParams(path.basename(localFilePath));
      uploadBuffer = await sharp(rawBuffer, { limitInputPixels: false })
        .resize(resizeOptions)
        .webp(webpOptions)
        .toBuffer();
    }

    return await ensureBufferUploadedToR2(r2Key, uploadBuffer, contentType);
  } catch (err) {
    console.error(`❌ Error optimizando/subiendo ${r2Key}:`, err.message);
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
    await ensureBufferUploadedToR2(r2Key, fs.readFileSync(destPath), 'image/webp');
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

    const webpBuffer = await sharp(buffer, { limitInputPixels: false })
      .resize(resizeOptions)
      .webp(webpOptions)
      .toBuffer();

    fs.writeFileSync(destPath, webpBuffer);
    await ensureBufferUploadedToR2(r2Key, webpBuffer, 'image/webp');
    return s3 ? r2Url : localAssetUrl;
  } catch (error) {
    console.error(`❌ Error procesando ${url}:`, error.message);
    return null;
  }
}

/**
 * Audita TODO src/assets/ y public/images/museum/ contra el índice de R2:
 * - Cualquier archivo en src/assets/ que no esté en R2 se optimiza a WebP y se sube.
 * - En remotas/ y alternativa/, si un archivo es .jpg/.png, también garantiza que su
 *   equivalente .webp exista en disco y en R2.
 * - En public/images/museum/, garantiza que todo .webp esté en vault-media/<file> en R2.
 */
async function syncAllHiddenDeskAssetsToR2() {
  if (!s3) {
    console.warn('⚠️ Sin credenciales R2 en .env: omitiendo verificación en la nube.');
    return 0;
  }

  let uploadedCount = 0;

  // 1. Escanear absolutamente todo src/assets/
  const allAssets = [];
  walkDir(ASSETS_DIR, (fullPath) => {
    if (IMAGE_EXTS.test(fullPath)) allAssets.push(fullPath);
  });

  for (const fullPath of allAssets) {
    const relKey = path.relative(ASSETS_DIR, fullPath).split(path.sep).join('/');

    // Garantizar que la clave exacta exista en R2 (convertida a WebP por Sharp)
    if (!r2ExistingKeys.has(relKey)) {
      const ok = await ensureFileUploadedAsWebp(relKey, fullPath);
      if (ok) uploadedCount++;
    }

    // Si está en remotas/ o alternativa/ y es .jpg/.png, crear y subir también su .webp
    if ((relKey.startsWith('remotas/') || relKey.startsWith('alternativa/')) && /\.(jpe?g|png)$/i.test(relKey)) {
      const webpKey = relKey.replace(/\.(jpe?g|png)$/i, '.webp');
      const webpLocalPath = fullPath.replace(/\.(jpe?g|png)$/i, '.webp');
      if (!fs.existsSync(webpLocalPath)) {
        const { resizeOptions, webpOptions } = resolveSharpParams(path.basename(webpLocalPath));
        await sharp(fullPath, { limitInputPixels: false })
          .resize(resizeOptions)
          .webp(webpOptions)
          .toFile(webpLocalPath);
        console.log(`🔄 Convertido a WebP local: ${webpKey}`);
      }
      if (!r2ExistingKeys.has(webpKey)) {
        const ok = await ensureBufferUploadedToR2(webpKey, fs.readFileSync(webpLocalPath), 'image/webp');
        if (ok) uploadedCount++;
      }
    }
  }

  // 2. Escanear public/images/museum/ -> vault-media/ en R2
  if (fs.existsSync(PUBLIC_MUSEUM_DIR)) {
    const museumFiles = fs.readdirSync(PUBLIC_MUSEUM_DIR).filter(f => /\.webp$/i.test(f));
    for (const file of museumFiles) {
      const r2Key = `vault-media/${file}`;
      if (!r2ExistingKeys.has(r2Key)) {
        const fullPath = path.join(PUBLIC_MUSEUM_DIR, file);
        const ok = await ensureBufferUploadedToR2(r2Key, fs.readFileSync(fullPath), 'image/webp');
        if (ok) uploadedCount++;
      }
    }
  }

  return uploadedCount;
}

// ── BUCLE PRINCIPAL ──────────────────────────────────────────────────────────
async function main() {
  console.log('======================================================');
  console.log('  🌐 TGP - DETECTOR DE IMÁGENES EN DESK + R2 SYNC');
  console.log('======================================================');
  console.log(printProfileSummary());

  await loadR2KeysIndex();
  console.log(`☁️  Claves activas verificadas en Cloudflare R2: ${r2ExistingKeys.size}`);

  // Paso 1: Detectar cualquier imagen en desk que falte pasar a WebP / R2
  const newlyUploaded = await syncAllHiddenDeskAssetsToR2();

  // Paso 2: Escanear código en busca de URLs de Wikimedia o rutas locales escondidas en UI
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
    let changed = false;

    // 2A. URLs externas de Wikimedia
    const wikiMatches = content.match(URL_REGEX);
    if (wikiMatches && wikiMatches.length > 0) {
      const uniqueUrls = [...new Set(wikiMatches)];
      for (const url of uniqueUrls) {
        const finalUrl = await processUrl(url);
        if (finalUrl && finalUrl !== url) {
          const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          content = content.replace(new RegExp(escapedUrl, 'g'), finalUrl);
          changed = true;
          totalReplaced++;
        }
      }
    }

    // 2B. Rutas "/src/assets/remotas|alternativa|vault-media|busts/..." escondidas en .astro/.tsx/.jsx
    if (/\.(astro|tsx|jsx)$/.test(filePath) && s3) {
      content = content.replace(LOCAL_ASSET_UI_REGEX, (fullMatch, quote, relAssetPath) => {
        const webpCandidate = relAssetPath.replace(/\.(jpe?g|png)$/i, '.webp');
        const targetKey = r2ExistingKeys.has(webpCandidate) ? webpCandidate : relAssetPath;
        if (r2ExistingKeys.has(targetKey)) {
          changed = true;
          totalReplaced++;
          return `${quote}${R2_PUBLIC_URL}/${targetKey}${quote}`;
        }
        return fullMatch;
      });
    }

    // 2C. Subdominio legado assets.thegreatpuzzleproject.com → storage.thegreatpuzzleproject.com
    if (content.includes('https://assets.thegreatpuzzleproject.com/')) {
      content = content.replace(/https:\/\/assets\.thegreatpuzzleproject\.com\//g, `${R2_PUBLIC_URL}/`);
      changed = true;
      totalReplaced++;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf-8');
      filesModified++;
      console.log(`📝 Actualizado código en: ${path.relative(process.cwd(), filePath)}`);
    }
  }

  console.log('\n======================================================');
  console.log(`  ✅ Auditoría y sincronización finalizada.`);
  console.log(`  • Imágenes escondidas en desk subidas a R2: ${newlyUploaded}`);
  console.log(`  • Referencias en código actualizadas a R2:  ${totalReplaced}`);
  console.log(`  • Archivos de código actualizados:          ${filesModified}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
