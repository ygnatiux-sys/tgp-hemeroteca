/**
 * src/lib/vault-r2.mjs
 * Módulo Agnóstico de Ingesta, Conversión WebP y Subida a Cloudflare R2
 * Compatible con Node.js en Desk Local y Workers/Cloud Run.
 */

import crypto from 'node:crypto';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const R2_PUBLIC_BASE = 'https://storage.thegreatpuzzleproject.com';
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tgp-storage';

function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('Credenciales de Cloudflare R2 incompletas en variables de entorno (.env).');
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

/**
 * Transmuta cualquier buffer de imagen a WebP optimizado y lo sube a R2
 * @param {Buffer} buffer - Buffer binario de la imagen
 * @param {string} folder - Carpeta destino en R2 (ej: 'wikimedia', 'sinteticas-banana')
 * @param {string} customName - Nombre base del archivo (sin extensión)
 * @returns {Promise<{ url: string, key: string, width: number, height: number }>}
 */
export async function uploadBufferToR2Webp(buffer, folder = 'wikimedia', customName = '') {
  const metadata = await sharp(buffer).metadata();
  const webpBuffer = await sharp(buffer)
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const hash = crypto.createHash('md5').update(webpBuffer).digest('hex').slice(0, 8);
  const cleanBase = (customName || `tgp-${Date.now()}`)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 40);

  const key = `${folder}/${Date.now()}-${cleanBase}-${hash}.webp`;
  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: webpBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    url: `${R2_PUBLIC_BASE}/${key}`,
    key,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Descarga una imagen remota (ej: Wikimedia Commons), la convierte a WebP y la sube a R2
 * @param {string} remoteUrl - URL original de Wikimedia
 * @param {string} folder - Carpeta destino en R2
 * @param {string} titleHint - Título o tema para el nombre de archivo
 * @returns {Promise<string>} - URL pública final en R2
 */
export async function transmuteRemoteToR2(remoteUrl, folder = 'wikimedia', titleHint = '') {
  if (remoteUrl.includes('storage.thegreatpuzzleproject.com')) {
    return remoteUrl; // Ya está alojada en R2
  }

  const res = await fetch(remoteUrl, {
    headers: {
      'User-Agent': 'TGP-Vault-Transmuter/1.0 (contact@thegreatpuzzleproject.com)',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Fallo al descargar imagen remota (${res.status}): ${remoteUrl}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const result = await uploadBufferToR2Webp(buffer, folder, titleHint);
  return result.url;
}
