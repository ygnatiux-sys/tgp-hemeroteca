// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Servicio de Medios y Pipeline Multimodal R2
// ─────────────────────────────────────────────────────────────────────────────
import {
  initR2,
  convertirAWebP,
  subirBufferAR2,
  estandarizarYSubirImagenAR2,
  listarImagenesRecientesR2,
} from '../storage/r2.js';
import {
  CLOUDFLARE_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_DOMAIN,
  TELEGRAM_TOKEN,
  TELEGRAM_API,
} from '../config/env.js';

// Auto-inicialización de R2 si los valores están presentes
if (CLOUDFLARE_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  try {
    initR2({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretKey: R2_SECRET_ACCESS_KEY,
      bucketName: R2_BUCKET_NAME,
      publicDomain: R2_PUBLIC_DOMAIN,
      telegramToken: TELEGRAM_TOKEN,
      telegramApi: TELEGRAM_API,
    });
  } catch (err: any) {
    console.warn('[MediaService] Advertencia al auto-iniciar R2:', err?.message);
  }
}

export interface ProcessedPhotoResult {
  url: string;
  mimeType: 'image/webp';
  fileName: string;
  base64: string; // inlineData listo para Gemini Multimodal
  buffer: Buffer;
}

/**
 * Descarga una foto de Telegram, la transmuta a WebP, la sube a R2
 * y extrae el payload Base64 para Visión Multimodal real en Gemini.
 */
export async function procesarFotoTelegramMultimodal(
  fileId: string,
  customSlug = 'telegram',
  botToken?: string
): Promise<ProcessedPhotoResult> {
  const token = botToken || TELEGRAM_TOKEN;
  const api = `https://api.telegram.org/bot${token}`;

  // 1. Obtener file_path
  const fileInfoRes = await fetch(`${api}/getFile?file_id=${fileId}`);
  if (!fileInfoRes.ok) throw new Error(`Error en getFile de Telegram: ${fileInfoRes.statusText}`);
  const fileInfo = (await fileInfoRes.json()) as any;
  const filePath = fileInfo?.result?.file_path;
  if (!filePath) throw new Error('Telegram no devolvió file_path');

  // 2. Descargar binario
  const fileDownloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const imgRes = await fetch(fileDownloadUrl);
  if (!imgRes.ok) throw new Error(`Error descargando imagen de Telegram: ${imgRes.statusText}`);
  const rawBuffer = Buffer.from(await imgRes.arrayBuffer());

  // 3. Estandarizar a WebP
  const webpBuffer = await convertirAWebP(rawBuffer);
  const fileName = `${customSlug}-${Date.now()}.webp`;
  const r2Key = `telegram/${fileName}`;

  // 4. Subida a Cloudflare R2
  const url = await subirBufferAR2(webpBuffer, r2Key, 'image/webp');
  const base64 = webpBuffer.toString('base64');

  return {
    url,
    mimeType: 'image/webp',
    fileName,
    base64,
    buffer: webpBuffer,
  };
}

/**
 * Guarda un respaldo .bak.md de cualquier texto o ensayo en Cloudflare R2.
 */
export async function guardarRespaldoMarkdownEnR2(
  slug: string,
  markdownContent: string
): Promise<{ url: string; key: string; backupId: string }> {
  const safeSlug = (slug || 'borrador-peloteo')
    .replace(/[^a-z0-9-_]/gi, '-')
    .toLowerCase()
    .slice(0, 30) || 'draft';
  const backupId = `${safeSlug}-${Date.now()}`;
  const key = `backups/${backupId}.bak.md`;
  const buffer = Buffer.from(markdownContent, 'utf-8');

  const url = await subirBufferAR2(buffer, key, 'text/markdown; charset=utf-8');
  console.log(`[R2 Auto-Respaldo] Guardado: ${url} (backupId: ${backupId})`);
  return { url, key, backupId };
}

export {
  convertirAWebP,
  subirBufferAR2,
  estandarizarYSubirImagenAR2,
  listarImagenesRecientesR2,
};
