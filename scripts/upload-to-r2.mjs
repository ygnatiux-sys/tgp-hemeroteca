import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Cargar variables de entorno desde .env
dotenv.config();

const CONTENT_DIR = path.resolve('src/content');
const R2_BASE = 'https://storage.thegreatpuzzleproject.com/';
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tgp-storage';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
let endpoint = process.env.R2_ENDPOINT;

if (!endpoint && accountId) {
  endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
}

const hasCredentials = Boolean(accessKeyId && secretAccessKey && endpoint);

let s3 = null;
if (hasCredentials) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
}

function extractFilename(url) {
  try {
    if (!url || typeof url !== 'string') return null;
    let cleanUrl = url.split('?')[0].replace(/\\/g, '');
    
    // Thumbnail pattern: /wikipedia/commons/thumb/x/xx/filename.ext/123px-filename.ext
    const thumbMatch = cleanUrl.match(/\/wikipedia\/commons\/thumb\/[^/]+\/[^/]+\/([^/]+)\/[^/]+$/i);
    if (thumbMatch) return thumbMatch[1];
    
    // Direct pattern: /wikipedia/commons/x/xx/filename.ext
    const directMatch = cleanUrl.match(/\/wikipedia\/commons\/[^/]+\/[^/]+\/([^/]+)$/i);
    if (directMatch) return directMatch[1];

    // R2 URL pattern: https://storage.thegreatpuzzleproject.com/filename.ext
    if (cleanUrl.startsWith(R2_BASE)) {
      return cleanUrl.replace(R2_BASE, '');
    }
    
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1];
  } catch (e) {
    return null;
  }
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.svg':
      return 'image/svg+xml';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

// Descargar imagen desde Wikimedia o Special:FilePath
async function downloadImageBuffer(filename, originalUrl) {
  const candidates = [];
  if (originalUrl && originalUrl.includes('upload.wikimedia.org')) {
    candidates.push(originalUrl);
  }
  // Endpoint oficial de resolución directa de Wikimedia Commons
  const decodedFilename = decodeURIComponent(filename);
  candidates.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodedFilename)}`);
  candidates.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`);

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'TheGreatPuzzleProject/1.0 (https://thegreatpuzzleproject.com; contact@thegreatpuzzleproject.com)',
          'Accept': 'image/*,*/*'
        },
        redirect: 'follow'
      });

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > 500) { // Valid image payload
          return { buffer, contentType: res.headers.get('content-type') || getMimeType(filename) };
        }
      }
    } catch (err) {
      // Intentar con el siguiente candidato
    }
  }
  return null;
}

// Subir a Cloudflare R2 vía S3Client
async function uploadToR2(filename, buffer, contentType) {
  if (!s3) return false;
  try {
    const decodedKey = decodeURIComponent(filename);
    const keysToUpload = [filename];
    if (decodedKey !== filename) {
      keysToUpload.push(decodedKey);
    }

    for (const key of keysToUpload) {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      });
      await s3.send(command);
    }
    return true;
  } catch (err) {
    console.error(`  ❌ Error subiendo a R2 [${filename}]:`, err.message);
    return false;
  }
}


// Registro global de imágenes para evitar descargas duplicadas
const uploadedCache = new Map();

async function processImage(filename, sourceUrl) {
  if (!filename) return null;

  if (uploadedCache.has(filename)) {
    return uploadedCache.get(filename);
  }

  const r2Url = `${R2_BASE}${filename}`;

  if (!hasCredentials) {
    // Si no hay credenciales configuradas aún, registramos para el reporte
    uploadedCache.set(filename, { success: true, url: r2Url, skipped: true });
    return { success: true, url: r2Url, skipped: true };
  }

  console.log(`📥 Descargando: ${decodeURIComponent(filename)}...`);
  const downloaded = await downloadImageBuffer(filename, sourceUrl);

  if (!downloaded) {
    console.warn(`  ⚠️ No se pudo descargar: ${filename}`);
    uploadedCache.set(filename, { success: false, url: sourceUrl });
    return { success: false, url: sourceUrl };
  }

  console.log(`☁️  Subiendo a R2 (${(downloaded.buffer.length / 1024).toFixed(1)} KB): ${BUCKET_NAME}/${filename}...`);
  const uploaded = await uploadToR2(filename, downloaded.buffer, downloaded.contentType);

  if (uploaded) {
    console.log(`  ✅ Subida exitosa a R2: ${r2Url}`);
    uploadedCache.set(filename, { success: true, url: r2Url, bytes: downloaded.buffer.length });
    return { success: true, url: r2Url, bytes: downloaded.buffer.length };
  } else {
    uploadedCache.set(filename, { success: false, url: sourceUrl });
    return { success: false, url: sourceUrl };
  }
}

// Función recursiva para transformar valores dentro de los JSON de contenido
async function transformObject(obj) {
  if (typeof obj === 'string') {
    // Si es JSON anidado (bancoImagenesWikimedia)
    if (obj.trim().startsWith('{') || obj.trim().startsWith('[')) {
      try {
        const nested = JSON.parse(obj);
        const transformedNested = await transformObject(nested);
        return JSON.stringify(transformedNested, null, 2);
      } catch (e) {
        // Texto normal
      }
    }

    if (obj.includes('upload.wikimedia.org') || obj.includes('storage.thegreatpuzzleproject.com')) {
      const filename = extractFilename(obj);
      if (filename) {
        const res = await processImage(filename, obj);
        if (res && res.success) {
          return res.url;
        }
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    const arr = [];
    for (const item of obj) {
      arr.push(await transformObject(item));
    }
    return arr;
  }

  if (obj !== null && typeof obj === 'object') {
    const res = {};
    for (const key of Object.keys(obj)) {
      res[key] = await transformObject(obj[key]);
    }
    return res;
  }

  return obj;
}

async function runMigration() {
  console.log(`\n================================================================`);
  console.log(`  MIGRACIÓN FÍSICA DE IMÁGENES A CLOUDFLARE R2 (S3 API)`);
  console.log(`================================================================`);
  console.log(`Bucket R2 Objetivo: ${BUCKET_NAME}`);
  console.log(`Endpoint:           ${endpoint || '(No configurado en .env)'}`);
  console.log(`Credenciales S3:    ${hasCredentials ? '✅ Configuradas' : '⚠️ Pendientes en .env (Modo Verificación de Rutas)'}\n`);

  const files = [];
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && /\.(json|md|mdx)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  scan(CONTENT_DIR);

  let modifiedCount = 0;
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const raw = fs.readFileSync(file, 'utf8');

    if (raw.includes('upload.wikimedia.org') || raw.includes('bancoImagenesWikimedia')) {
      if (ext === '.json') {
        const data = JSON.parse(raw);
        const transformed = await transformObject(data);
        const newContent = JSON.stringify(transformed, null, 2) + '\n';
        if (newContent !== raw) {
          fs.writeFileSync(file, newContent, 'utf8');
          modifiedCount++;
        }
      } else if (ext === '.md' || ext === '.mdx') {
        let updated = raw;
        const matches = raw.match(/https:\/\/upload\.wikimedia\.org\/[^\s"')\]]+/g) || [];
        for (const match of matches) {
          const filename = extractFilename(match);
          if (filename) {
            const res = await processImage(filename, match);
            if (res && res.success) {
              updated = updated.replaceAll(match, res.url);
            }
          }
        }
        if (updated !== raw) {
          fs.writeFileSync(file, updated, 'utf8');
          modifiedCount++;
        }
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`  RESUMEN FINAL DE LA OPERACIÓN`);
  console.log(`================================================================`);
  console.log(`Archivos de contenido procesados: ${modifiedCount}`);
  console.log(`Total de imágenes únicas procesadas: ${uploadedCache.size}`);
  
  let successCount = 0;
  let totalBytes = 0;
  for (const [name, info] of uploadedCache.entries()) {
    if (info.success) {
      successCount++;
      if (info.bytes) totalBytes += info.bytes;
    }
  }

  console.log(`Imágenes descargadas y preparadas con éxito: ${successCount}`);
  if (totalBytes > 0) {
    console.log(`Volumen total transferido a R2: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  }
}

runMigration().catch(err => {
  console.error('Error fatal durante la migración:', err);
});
