/**
 * src/cloud/services/r2-uploader.ts
 * ============================================================================
 * CONECTOR CLOUDFLARE R2 (S3-Compatible) — CDN Público y Almacenamiento
 * ============================================================================
 * Implementa enrutamiento Multi-Bucket:
 * - PDFs -> R2_BUCKET_PDF (fallback R2_BUCKET_NAME || 'tgp-pdf')
 * - EPUBs -> R2_BUCKET_EPUB (fallback R2_BUCKET_NAME || 'tgp-epub')
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface R2UploadOptions {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  folder?: string;
  customBucket?: string;
}

export interface R2UploadResult {
  success: boolean;
  key?: string;
  bucket?: string;
  publicUrl?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Determina el bucket R2 correspondiente según el formato y mimetype
 */
export function resolveTargetBucket(filename: string, mimeType?: string, customBucket?: string): string {
  if (customBucket) return customBucket;

  const isPdf = (mimeType && mimeType.includes('pdf')) || filename.toLowerCase().endsWith('.pdf');
  const isEpub = (mimeType && (mimeType.includes('epub') || mimeType.includes('zip'))) || filename.toLowerCase().endsWith('.epub');

  if (isPdf) {
    return process.env.R2_BUCKET_PDF || process.env.R2_BUCKET_NAME || 'tgp-pdf';
  }

  if (isEpub) {
    return process.env.R2_BUCKET_EPUB || process.env.R2_BUCKET_NAME || 'tgp-epub';
  }

  return process.env.R2_BUCKET_NAME || 'tgp-storage';
}

/**
 * Inicializa el cliente S3 para Cloudflare R2
 */
function getR2Client(): { client: S3Client; accountId: string } | null {
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false,
  });

  return { client, accountId };
}

/**
 * Sube un buffer a Cloudflare R2 con enrutamiento inteligente de bucket
 */
export async function uploadToR2(options: R2UploadOptions): Promise<R2UploadResult> {
  const r2 = getR2Client();

  if (!r2) {
    console.warn('[R2 Uploader] Omitido: Variables R2_ACCOUNT_ID, R2_ACCESS_KEY o R2_SECRET_KEY no configuradas.');
    return {
      success: false,
      skipped: true,
      reason: 'Variables de conexión a Cloudflare R2 no configuradas en el entorno.',
    };
  }

  const targetBucket = resolveTargetBucket(options.filename, options.mimeType, options.customBucket);
  const folder = options.folder ? `${options.folder.replace(/^\/+|\/+$/g, '')}/` : '';
  const key = `${folder}${options.filename}`;
  const contentType = options.mimeType || (options.filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

  try {
    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: key,
      Body: options.buffer,
      ContentType: contentType,
    });

    await r2.client.send(command);

    // Construcción de la URL pública si existe un dominio configurado
    const publicDomain = process.env.R2_PUBLIC_URL || process.env.PUBLIC_R2_URL || process.env.R2_DEV_URL;
    let publicUrl: string | undefined;

    if (publicDomain) {
      const cleanDomain = publicDomain.replace(/\/+$/, '');
      publicUrl = `${cleanDomain}/${key}`;
    }

    console.log(`[R2 Uploader] ✓ Archivo subido con éxito a R2 (Bucket: ${targetBucket}, Key: ${key})`);

    return {
      success: true,
      key,
      bucket: targetBucket,
      publicUrl,
    };
  } catch (error: any) {
    console.error(`[R2 Uploader] ✗ Error al subir a R2 (${targetBucket}/${key}):`, error?.message || error);
    return {
      success: false,
      error: error?.message || 'Error desconocido al subir a Cloudflare R2.',
    };
  }
}
