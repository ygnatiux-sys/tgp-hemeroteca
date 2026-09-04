/**
 * sync-assets-r2.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincroniza el directorio local src/assets/ con el bucket Cloudflare R2
 * "tgp-storage", conservando la estructura de carpetas exacta.
 *
 * CARACTERÍSTICAS:
 *  • Solo sube archivos NUEVOS o MODIFICADOS (compara ETag MD5 remoto vs checksum local).
 *  • --force    → re-sube todos los archivos sin comparar.
 *  • --dry-run  → muestra qué se subiría sin hacer cambios reales.
 *  • --prefix <subcarpeta> → opera solo sobre un subdirectorio de src/assets/.
 *  • Concurrencia de 5 uploads en paralelo (configurable con CONCURRENCY).
 *
 * VARIABLES DE ENTORNO requeridas en .env:
 *  R2_ACCOUNT_ID        → ID de tu cuenta Cloudflare
 *  R2_ACCESS_KEY_ID     → Access Key ID del token R2
 *  R2_SECRET_ACCESS_KEY → Secret Access Key del token R2
 *  R2_BUCKET_NAME       → (opcional) Nombre del bucket, default: "tgp-storage"
 *  R2_ENDPOINT          → (opcional) Se construye automáticamente desde R2_ACCOUNT_ID
 *
 * USO:
 *  npm run upload:assets                          # incremental
 *  npm run upload:assets -- --force               # fuerza re-subida
 *  npm run upload:assets -- --dry-run             # simulación
 *  npm run upload:assets -- --prefix ensayos      # solo /src/assets/ensayos/
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

dotenv.config();

// ── Configuración ─────────────────────────────────────────────────────────────

const ASSETS_DIR    = path.resolve('src/assets');
const BUCKET_NAME   = process.env.R2_BUCKET_NAME || 'tgp-storage';
const R2_PUBLIC_URL = 'https://storage.thegreatpuzzleproject.com';
const CONCURRENCY   = 5;

const args      = process.argv.slice(2);
const FORCE     = args.includes('--force');
const DRY_RUN   = args.includes('--dry-run');
const prefixIdx = args.indexOf('--prefix');
const PREFIX    = prefixIdx !== -1 ? args[prefixIdx + 1] : null;

// ── Credenciales ─────────────────────────────────────────────────────────────

const accountId       = process.env.R2_ACCOUNT_ID;
const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint        = process.env.R2_ENDPOINT
  || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error(`
FALTAN CREDENCIALES R2 — agrega estas variables a tu archivo .env:

  R2_ACCOUNT_ID        = <tu Account ID de Cloudflare>
  R2_ACCESS_KEY_ID     = <Access Key ID del token R2>
  R2_SECRET_ACCESS_KEY = <Secret Access Key del token R2>
  R2_BUCKET_NAME       = tgp-storage

Cómo crear el token:
  1. Abre https://dash.cloudflare.com
  2. Navega a R2 > tgp-storage > "Manage R2 API Tokens"
  3. Crea un token con permiso "Object Read & Write"
  4. Copia las claves al .env
`);
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: false,
});

// ── MIME types ────────────────────────────────────────────────────────────────

const MIME = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.pdf':  'application/pdf',
  '.json': 'application/json',
};

function getMime(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function md5hex(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function toR2Key(absolutePath) {
  // src/assets/ensayos/mi-post/imagen.jpg → ensayos/mi-post/imagen.jpg
  return path.relative(ASSETS_DIR, absolutePath).replace(/\\/g, '/');
}

function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

async function needsUpload(key, localBuffer) {
  if (FORCE) return true;
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    const remoteETag = (head.ETag || '').replace(/"/g, '');
    return remoteETag !== md5hex(localBuffer);
  } catch (err) {
    // 404 / NoSuchKey → el archivo no existe → hay que subirlo
    return true;
  }
}

async function uploadFile(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket:       BUCKET_NAME,
    Key:          key,
    Body:         buffer,
    ContentType:  contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function runWithConcurrency(tasks, limit) {
  let index = 0;
  async function worker() {
    while (index < tasks.length) await tasks[index++]();
  }
  await Promise.all(Array.from({ length: limit }, worker));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n================================================================');
  console.log('   SYNC src/assets/ → Cloudflare R2  (' + BUCKET_NAME + ')');
  console.log('================================================================');
  console.log('  Endpoint: ' + endpoint);
  console.log('  Modo:     ' + (DRY_RUN ? 'DRY-RUN (sin cambios)' : FORCE ? 'FORCE (re-sube todo)' : 'Incremental'));
  if (PREFIX) console.log('  Prefijo:  ' + PREFIX);
  console.log('');

  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('ERROR: No se encontro el directorio src/assets/');
    process.exit(1);
  }

  let files = walkDir(ASSETS_DIR);

  if (PREFIX) {
    const p = PREFIX.replace(/\\/g, '/').replace(/\/$/, '');
    files = files.filter(f => toR2Key(f).startsWith(p));
  }

  if (files.length === 0) {
    console.log('No se encontraron archivos para sincronizar.');
    return;
  }

  console.log('Archivos locales encontrados: ' + files.length);
  if (!DRY_RUN) console.log('Comparando con R2...\n');

  const stats = { uploaded: 0, skipped: 0, errors: 0, bytes: 0, errorFiles: [], firstKey: null };

  const tasks = files.map(filePath => async () => {
    const key  = toR2Key(filePath);
    const mime = getMime(filePath);
    let buffer;
    try {
      buffer = fs.readFileSync(filePath);
    } catch (err) {
      console.log('  [ERROR LECTURA] ' + key + ' — ' + err.message);
      stats.errors++;
      stats.errorFiles.push(key);
      return;
    }

    if (DRY_RUN) {
      console.log('  [DRY-RUN] Subiria: ' + key + ' (' + (buffer.length / 1024).toFixed(1) + ' KB)');
      stats.uploaded++;
      return;
    }

    const must = await needsUpload(key, buffer);
    if (!must) {
      console.log('  [OK-IGUAL]  ' + key);
      stats.skipped++;
      return;
    }

    try {
      await uploadFile(key, buffer, mime);
      const kb = (buffer.length / 1024).toFixed(1);
      console.log('  [SUBIDO] ' + kb + ' KB  →  ' + key);
      stats.uploaded++;
      stats.bytes += buffer.length;
      if (!stats.firstKey) stats.firstKey = key;
    } catch (err) {
      console.log('  [ERROR UPLOAD] ' + key + ' — ' + err.message);
      stats.errors++;
      stats.errorFiles.push(key);
    }
  });

  await runWithConcurrency(tasks, CONCURRENCY);

  const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
  console.log('\n================================================================');
  console.log('   RESUMEN FINAL');
  console.log('================================================================');
  console.log('  Archivos subidos:   ' + stats.uploaded);
  console.log('  Archivos omitidos:  ' + stats.skipped);
  console.log('  Errores:            ' + stats.errors);
  console.log('  Volumen subido:     ' + mb + ' MB');
  if (stats.firstKey) {
    console.log('  URL publica base:   ' + R2_PUBLIC_URL + '/');
    console.log('  Ejemplo:            ' + R2_PUBLIC_URL + '/' + stats.firstKey);
  }
  if (stats.errorFiles.length > 0) {
    console.log('\n  Archivos con error:');
    stats.errorFiles.forEach(f => console.log('    - ' + f));
  }
  console.log('');
  if (stats.errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nError fatal:', err.message);
  process.exit(1);
});
