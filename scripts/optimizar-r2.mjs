/**
 * scripts/optimizar-r2.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Script de optimización de imágenes pesadas en Cloudflare R2 (> 1.5 MB).
 * 
 * Funcionalidad:
 * 1. Conecta al bucket R2 usando @aws-sdk/client-s3 (S3 Compatible API).
 * 2. Lista todos los objetos con soporte para paginación (ListObjectsV2Command).
 * 3. Filtra archivos con peso > 1.5 MB (1.5 * 1024 * 1024 bytes).
 * 4. Descarga el archivo a memoria (Buffer).
 * 5. Redimensiona con sharp a max 1920px de ancho (withoutEnlargement) y comprime a WebP (calidad 80).
 * 6. Sobrescribe el archivo en R2 con el buffer optimizado y ContentType: 'image/webp'.
 * 
 * Uso:
 *   node scripts/optimizar-r2.mjs            -> Ejecuta y optimiza en R2
 *   node scripts/optimizar-r2.mjs --dry-run   -> Solo lista los archivos > 1.5 MB sin modificarlos
 */

import 'dotenv/config';
import { 
  S3Client, 
  ListObjectsV2Command, 
  GetObjectCommand, 
  PutObjectCommand 
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

// ── 1. CONFIGURACIÓN Y CREDENCIALES ──────────────────────────────────────────
const accountId       = process.env.R2_ACCOUNT_ID;
const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName      = process.env.R2_BUCKET_NAME || 'tgp-storage';
const endpoint        = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

const DRY_RUN = process.argv.includes('--dry-run');
const SIZE_LIMIT_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error('\n❌ ERROR: Faltan credenciales de Cloudflare R2 en el archivo .env');
  console.error('Verifica que existan: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME\n');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// Extensiones de imagen soportadas por sharp
const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|avif|tiff?|bmp|gif)$/i;

// Convierte un ReadableStream / Stream de Node a Buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── 2. PROCESO PRINCIPAL ─────────────────────────────────────────────────────
async function main() {
  console.log('\n======================================================');
  console.log('  ⚡ TGP CLOUDFLARE R2 — OPTIMIZADOR DE IMÁGENES');
  console.log('======================================================');
  console.log(`• Bucket:       ${bucketName}`);
  console.log(`• Endpoint:     ${endpoint}`);
  console.log(`• Límite:       > 1.5 MB (${formatBytes(SIZE_LIMIT_BYTES)})`);
  console.log(`• Optimización: Max ${MAX_WIDTH}px (ancho) · WebP (q=${WEBP_QUALITY})`);
  if (DRY_RUN) {
    console.log('• MODO:         🔍 DRY RUN (Simulación, sin sobrescribir)\n');
  } else {
    console.log('• MODO:         🚀 PRODUCCIÓN (Sobrescribiendo archivos pesados)\n');
  }

  // 1. Listar todos los objetos con paginación
  console.log('📡 Conectando y listando objetos en R2...');
  const allObjects = [];
  let isTruncated = true;
  let continuationToken = undefined;

  while (isTruncated) {
    const listParams = {
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    };
    const response = await s3Client.send(new ListObjectsV2Command(listParams));
    
    if (response.Contents) {
      allObjects.push(...response.Contents);
    }
    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
  }

  console.log(`✔ Total de objetos encontrados en el bucket: ${allObjects.length}`);

  // 2. Filtrar los que superen 1.5 MB y sean imágenes
  const heavyImages = allObjects.filter(obj => {
    const isImage = IMAGE_EXT_REGEX.test(obj.Key || '');
    const isHeavy = (obj.Size || 0) > SIZE_LIMIT_BYTES;
    return isImage && isHeavy;
  });

  console.log(`🔍 Imágenes que superan 1.5 MB: ${heavyImages.length}\n`);

  if (heavyImages.length === 0) {
    console.log('🎉 ¡Excelente! No se encontraron imágenes mayores a 1.5 MB en el bucket.\n');
    return;
  }

  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;
  let successCount = 0;
  let errorCount = 0;

  // 3. Procesar cada imagen pesada
  for (let i = 0; i < heavyImages.length; i++) {
    const item = heavyImages[i];
    const key = item.Key;
    const originalSize = item.Size || 0;
    totalOriginalBytes += originalSize;

    console.log(`[${i + 1}/${heavyImages.length}] Procesando: "${key}" (${formatBytes(originalSize)})`);

    if (DRY_RUN) {
      console.log(`   ↳ [DRY-RUN] Se descargaría y comprimiría a WebP.`);
      continue;
    }

    try {
      // Descargar desde R2
      const getCmd = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      const getRes = await s3Client.send(getCmd);
      const originalBuffer = await streamToBuffer(getRes.Body);

      // Optimizar con sharp
      const optimizedBuffer = await sharp(originalBuffer)
        .resize({
          width: MAX_WIDTH,
          withoutEnlargement: true,
          fit: 'inside',
        })
        .webp({
          quality: WEBP_QUALITY,
          effort: 4,
        })
        .toBuffer();

      const newSize = optimizedBuffer.length;
      totalOptimizedBytes += newSize;
      const reduction = (((originalSize - newSize) / originalSize) * 100).toFixed(1);

      // Subir de vuelta a R2 (sobrescribiendo el Key original)
      const putCmd = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: optimizedBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      });
      await s3Client.send(putCmd);

      console.log(`   ✔ Optimizado: ${formatBytes(originalSize)} → ${formatBytes(newSize)} (Reducción del ${reduction}%)\n`);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Error procesando "${key}":`, err.message, '\n');
      errorCount++;
      totalOptimizedBytes += originalSize; // fallback al original
    }
  }

  // ── 3. RESUMEN FINAL ────────────────────────────────────────────────────────
  console.log('======================================================');
  console.log('  📊 RESUMEN DE LA OPTIMIZACIÓN');
  console.log('======================================================');
  console.log(`• Total analizados:       ${allObjects.length}`);
  console.log(`• Objetos > 1.5 MB:       ${heavyImages.length}`);
  if (!DRY_RUN) {
    console.log(`• Optimizados con éxito:  ${successCount}`);
    if (errorCount > 0) {
      console.log(`• Errores:                ${errorCount}`);
    }
    const savedBytes = totalOriginalBytes - totalOptimizedBytes;
    console.log(`• Peso original total:    ${formatBytes(totalOriginalBytes)}`);
    console.log(`• Peso optimizado total:  ${formatBytes(totalOptimizedBytes)}`);
    console.log(`• Espacio liberado:       ${formatBytes(savedBytes)} (${(((savedBytes) / totalOriginalBytes) * 100).toFixed(1)}%)`);
  }
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('\n❌ Error fatal durante la ejecución:', err);
  process.exit(1);
});
