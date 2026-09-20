// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo Storage: Cloudflare R2
// Extraído de index.ts. Contiene:
//   - subirBufferAR2         — carga un Buffer binario a R2
//   - subirBufferOsintAR2    — carga de imágenes OSINT con cache-control largo
//   - subirImagenAR2         — descarga remota y sube a R2
//   - procesarFotoTelegramAR2— descarga foto por file_id de Telegram y la sube a R2
// ─────────────────────────────────────────────────────────────────────────────

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'node:crypto';

// ── Config inyectada ──────────────────────────────────────────────────────────
let _r2Client: S3Client | null = null;
let _R2_BUCKET_NAME  = 'tgp-storage';
let _R2_PUBLIC_DOMAIN = 'https://storage.thegreatpuzzleproject.com';
let _TELEGRAM_TOKEN   = '';
let _TELEGRAM_API     = '';

export interface R2InitConfig {
  accountId:    string;
  accessKeyId:  string;
  secretKey:    string;
  bucketName:   string;
  publicDomain: string;
  telegramToken: string;
  telegramApi:   string;
}

export function initR2(cfg: R2InitConfig) {
  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     cfg.accessKeyId,
      secretAccessKey: cfg.secretKey,
    },
  });
  _R2_BUCKET_NAME   = cfg.bucketName;
  _R2_PUBLIC_DOMAIN = cfg.publicDomain;
  _TELEGRAM_TOKEN   = cfg.telegramToken;
  _TELEGRAM_API     = cfg.telegramApi;
}

function getClient(): S3Client {
  if (!_r2Client) throw new Error('[R2] initR2() no fue llamado antes de usar el módulo.');
  return _r2Client;
}

// ── Pipeline de Conversión y Estandarización WebP ────────────────────────────

/**
 * Convierte cualquier Buffer de imagen (JPEG, PNG, AVIF, TIFF) a formato WebP optimizado.
 */
export async function convertirAWebP(inputBuffer: Buffer, quality = 85): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      .webp({ quality, effort: 4 })
      .toBuffer();
  } catch (err: any) {
    console.warn('[R2 WebP] No se pudo convertir buffer con sharp, usando buffer original:', err?.message);
    return inputBuffer;
  }
}

/**
 * Normaliza y almacena cualquier imagen (URL remota o Buffer binario) como WebP permanente en R2.
 * Origen de la verdad universal para todas las imágenes del ecosistema.
 */
export async function estandarizarYSubirImagenAR2(input: Buffer | string, prefix = 'media'): Promise<string> {
  let rawBuffer: Buffer;

  if (typeof input === 'string') {
    // Si ya es un asset permanente WebP en nuestro R2, retornar directamente
    if (input.startsWith(_R2_PUBLIC_DOMAIN) && input.endsWith('.webp')) {
      return input;
    }
    const ua = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
    const res = await fetch(input, { headers: { 'User-Agent': ua } });
    if (!res.ok) throw new Error(`HTTP ${res.status} al descargar imagen desde ${input}`);
    rawBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    rawBuffer = input;
  }

  const webpBuffer = await convertirAWebP(rawBuffer);
  const uid = crypto.randomUUID().slice(0, 8);
  const fileKey = `${prefix}/${Date.now()}-${uid}.webp`;

  await getClient().send(new PutObjectCommand({
    Bucket:       _R2_BUCKET_NAME,
    Key:          fileKey,
    Body:         webpBuffer,
    ContentType:  'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  const publicUrl = `${_R2_PUBLIC_DOMAIN}/${fileKey}`;
  console.log(`[R2 Estandarizado WebP] Asset alojado: ${publicUrl}`);
  return publicUrl;
}

// ── Funciones públicas retrocompatibles ───────────────────────────────────────

export async function subirBufferAR2(buffer: Buffer, key: string, contentType = 'image/jpeg'): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket:      _R2_BUCKET_NAME,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }));
  const publicUrl = `${_R2_PUBLIC_DOMAIN}/${key}`;
  console.log(`[R2] Buffer subido exitosamente: ${publicUrl}`);
  return publicUrl;
}

export async function subirBufferOsintAR2(imageBuffer: Buffer, id: string, mimeType = 'image/webp'): Promise<string> {
  // Asegurar que el buffer OSINT esté realmente en formato WebP
  const webpBuffer = await convertirAWebP(imageBuffer);
  const fileKey = `osint/${id}.webp`;
  await getClient().send(new PutObjectCommand({
    Bucket:       _R2_BUCKET_NAME,
    Key:          fileKey,
    Body:         webpBuffer,
    ContentType:  'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${_R2_PUBLIC_DOMAIN}/${fileKey}`;
}

export async function subirImagenAR2(imageUrl: string): Promise<string> {
  return await estandarizarYSubirImagenAR2(imageUrl, 'wikimedia');
}

export async function procesarFotoTelegramAR2(fileId: string, customSlug = 'telegram'): Promise<{ url: string; mimeType: string; fileName: string }> {
  // 1. Obtener file_path de Telegram
  const fileInfoRes = await fetch(`${_TELEGRAM_API}/getFile?file_id=${fileId}`);
  if (!fileInfoRes.ok) throw new Error(`Error en getFile de Telegram: ${fileInfoRes.statusText}`);
  const fileInfo = await fileInfoRes.json() as any;
  const filePath = fileInfo?.result?.file_path;
  if (!filePath) throw new Error('Telegram no devolvió file_path');

  // 2. Descargar binario
  const fileDownloadUrl = `https://api.telegram.org/file/bot${_TELEGRAM_TOKEN}/${filePath}`;
  const imgRes = await fetch(fileDownloadUrl);
  if (!imgRes.ok) throw new Error(`Error descargando imagen de Telegram: ${imgRes.statusText}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  // 3. Estandarizar a WebP
  const webpBuffer = await convertirAWebP(buffer);
  const fileName = `${customSlug}-${Date.now()}.webp`;
  const r2Key    = `telegram/${fileName}`;

  // 4. Subir a R2 con ContentType WebP
  const url = await subirBufferAR2(webpBuffer, r2Key, 'image/webp');
  return { url, mimeType: 'image/webp', fileName };
}

/**
 * Lista las imágenes más recientes alojadas en R2 (repositorio visual de TGP).
 */
export async function listarImagenesRecientesR2(limit = 30): Promise<Array<{ id: string; url: string; filename: string }>> {
  try {
    const res = await getClient().send(new ListObjectsV2Command({
      Bucket: _R2_BUCKET_NAME,
      MaxKeys: 100,
    }));
    const items = (res.Contents || [])
      .filter(c => c.Key && /\.(jpe?g|png|webp|avif)$/i.test(c.Key))
      .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
      .slice(0, limit);

    return items.map(item => ({
      id: item.Key!,
      url: `${_R2_PUBLIC_DOMAIN}/${item.Key}`,
      filename: item.Key!.split('/').pop() || item.Key!,
    }));
  } catch (err: any) {
    console.error('[R2 Listar Imágenes Error]:', err);
    return [];
  }
}

// Re-export R2_PUBLIC_DOMAIN para uso en otros módulos (ej: TTS en D1)
export function getR2PublicDomain(): string { return _R2_PUBLIC_DOMAIN; }
export function getR2BucketName():  string  { return _R2_BUCKET_NAME;   }
export function getR2Client():      S3Client { return getClient(); }
