// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Servicio de Extracción de Adjuntos de Google Chat y R2
// Extrae fotos adjuntas en mensajes de Google Chat y las aloja en Cloudflare R2
// ─────────────────────────────────────────────────────────────────────────────
import { GoogleAuth } from 'google-auth-library';
import { estandarizarYSubirImagenAR2 } from '../storage/r2.js';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/chat.bot'],
});

/**
 * Busca si en el payload de Google Chat o Dialogflow CX existe una imagen adjunta
 * o una URL de imagen explícita en el cuerpo del mensaje.
 */
export function detectarAdjuntoImagen(body: any, rawText: string): {
  tipo: 'attachment' | 'url' | null;
  downloadUri?: string;
  thumbnailUri?: string;
  resourceName?: string;
  contentName?: string;
  urlDirecta?: string;
} {
  // 1. Google Chat nativo: message.attachment
  const attachments =
    body.message?.attachment ||
    body.attachment ||
    body.queryParams?.payload?.data?.chat?.messagePayload?.message?.attachment ||
    [];

  if (Array.isArray(attachments) && attachments.length > 0) {
    const att = attachments[0];
    const isImage = (att.contentType || '').startsWith('image/') || /\.(jpe?g|png|webp|avif)$/i.test(att.contentName || '');
    if (isImage || att.downloadUri || att.thumbnailUri) {
      return {
        tipo: 'attachment',
        downloadUri: att.downloadUri,
        thumbnailUri: att.thumbnailUri,
        resourceName: att.attachmentDataRef?.resourceName || att.name,
        contentName: att.contentName || 'imagen-adjunta.jpg',
      };
    }
  }

  // 2. URL de imagen pasada directamente en el texto del usuario
  const urlMatch = rawText.match(/https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>]*)?/i);
  if (urlMatch) {
    return {
      tipo: 'url',
      urlDirecta: urlMatch[0],
    };
  }

  return { tipo: null };
}

/**
 * Descarga una imagen adjunta de Google Chat (vía downloadUri o Media API)
 * y la estandariza a WebP subiéndola a Cloudflare R2 bajo el prefijo 'portadas'.
 */
export async function procesarImagenGoogleChatAR2(
  infoAdjunto: ReturnType<typeof detectarAdjuntoImagen>,
  slugReferencia: string
): Promise<string | null> {
  if (!infoAdjunto.tipo) return null;

  const safeSlug = slugReferencia
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `chat-${Date.now()}`;

  let imageBuffer: Buffer | null = null;

  // Caso A: URL directa
  if (infoAdjunto.tipo === 'url' && infoAdjunto.urlDirecta) {
    try {
      console.log(`[Chat Attachment] Descargando imagen desde URL directa: "${infoAdjunto.urlDirecta.slice(0, 80)}..."`);
      const r = await fetch(infoAdjunto.urlDirecta, { headers: { 'User-Agent': 'TGPMind/1.0' } });
      if (r.ok) {
        imageBuffer = Buffer.from(await r.arrayBuffer());
      }
    } catch (e: any) {
      console.warn('[Chat Attachment] Falló descarga directa:', e?.message);
    }
  }

  // Caso B: Adjunto de Google Chat (downloadUri con token activo o thumbnailUri)
  if (infoAdjunto.tipo === 'attachment' && !imageBuffer) {
    const uris = [infoAdjunto.downloadUri, infoAdjunto.thumbnailUri].filter(Boolean) as string[];

    for (const uri of uris) {
      try {
        console.log(`[Chat Attachment] Intentando descargar desde URI de Google Chat...`);
        const r = await fetch(uri, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        const cType = r.headers.get('content-type') || '';
        if (r.ok && cType.startsWith('image/')) {
          imageBuffer = Buffer.from(await r.arrayBuffer());
          console.log(`[Chat Attachment] ✅ Imagen descargada (${imageBuffer.byteLength} bytes) vía URI.`);
          break;
        }
      } catch (e: any) {
        console.warn('[Chat Attachment] Error descargando URI:', e?.message);
      }
    }

    // Caso C: Google Chat Media API con OAuth Bearer Token
    if (!imageBuffer && infoAdjunto.resourceName) {
      try {
        console.log(`[Chat Attachment] Intentando descarga vía Google Chat Media API (${infoAdjunto.resourceName})...`);
        const client = await auth.getClient();
        const tokenResp = await client.getAccessToken();
        const bearer = tokenResp.token;

        if (bearer) {
          const mediaUrl = `https://chat.googleapis.com/v1/media/${infoAdjunto.resourceName}?alt=media`;
          const r = await fetch(mediaUrl, {
            headers: { Authorization: `Bearer ${bearer}` },
          });
          const cType = r.headers.get('content-type') || '';
          if (r.ok && cType.startsWith('image/')) {
            imageBuffer = Buffer.from(await r.arrayBuffer());
            console.log(`[Chat Attachment] ✅ Imagen descargada vía Media API (${imageBuffer.byteLength} bytes).`);
          }
        }
      } catch (e: any) {
        console.warn('[Chat Attachment] Media API falló:', e?.message);
      }
    }
  }

  if (!imageBuffer) {
    console.warn('[Chat Attachment] No se pudieron obtener los bytes de la imagen adjunta.');
    return null;
  }

  // Subir a Cloudflare R2 como WebP estandarizado permanente
  try {
    const publicUrl = await estandarizarYSubirImagenAR2(imageBuffer, 'portadas', safeSlug);
    console.log(`[Chat Attachment] 🚀 Imagen de Google Chat subida con éxito a R2: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error('[Chat Attachment] Error subiendo imagen a R2:', err);
    return null;
  }
}
