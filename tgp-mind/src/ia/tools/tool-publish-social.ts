import { genai } from '../gemini.js';
import { registrarResguardoD1 } from '../../storage/d1.js';

export const TOOL_PUBLISH_SOCIAL = {
  name: 'publish_social',
  description: 'Genera el copy de un post y lo publica en redes sociales (Facebook/TikTok) usando el motor Gemini. Requiere siempre la URL de la imagen en R2.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      tema: {
        type: 'STRING' as const,
        description: 'Tema o contenido del post. Puede incluir el texto base del ensayo si ya fue redactado.',
      },
      red: {
        type: 'STRING' as const,
        description: 'Red social de destino.',
        enum: ['facebook', 'tiktok'],
      },
      motor: {
        type: 'STRING' as const,
        description: 'Motor de redacción. "flash" para copy ágil, "pro" para copy denso con análisis.',
        enum: ['flash', 'pro'],
      },
      url_imagen: {
        type: 'STRING' as const,
        description: 'URL de la imagen alojada en R2. Requerida para poder publicar. Si el usuario no la envió, solicítala.',
      },
    },
    required: ['tema', 'red', 'motor', 'url_imagen'],
  },
};

// ── Normalización defensiva ────────────────────────────────────────────────────
function normalizarRed(raw?: string): 'facebook' | 'tiktok' {
  if (!raw) return 'facebook';
  const clean = raw.toLowerCase();
  if (clean.includes('tiktok') || clean.includes('tok')) return 'tiktok';
  return 'facebook';
}

function normalizarMotor(raw?: string): 'flash' | 'pro' {
  if (!raw) return 'flash';
  return raw.toLowerCase().includes('pro') ? 'pro' : 'flash';
}

// ── Zernio API (publicación real en Facebook/TikTok) ─────────────────────────
async function publicarEnZernio(params: {
  red: 'facebook' | 'tiktok';
  caption: string;
  imageUrl: string;
}): Promise<{ postId?: string; url?: string; error?: string }> {
  const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY || '';
  const ZERNIO_FB_ID   = process.env.ZERNIO_FB_ID   || '';
  const ZERNIO_TIKTOK_ID = process.env.ZERNIO_TIKTOK_ID || '';

  if (!ZERNIO_API_KEY) {
    console.warn('[Zernio] ZERNIO_API_KEY no configurada. Simulando publicación.');
    return { url: params.imageUrl, error: 'Zernio no configurado (simulación).' };
  }

  const channelId = params.red === 'facebook' ? ZERNIO_FB_ID : ZERNIO_TIKTOK_ID;
  if (!channelId) {
    return { error: `ZERNIO_${params.red.toUpperCase()}_ID no configurado.` };
  }

  try {
    const res = await fetch('https://api.zernio.com/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZERNIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel_id: channelId,
        caption: params.caption,
        media_url: params.imageUrl,
        media_type: 'image',
        publish_now: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Zernio] Error ${res.status}: ${errText}`);
      return { error: `Error Zernio ${res.status}: ${errText}` };
    }

    const data: any = await res.json();
    const postId = data?.id || data?.post_id || '';
    const url    = data?.url || data?.permalink || '';
    console.log(`[Zernio] Post publicado en ${params.red}: ${postId || url}`);
    return { postId, url };
  } catch (err: any) {
    console.error('[Zernio] Error inesperado:', err?.message);
    return { error: err?.message || 'Error desconocido en Zernio.' };
  }
}

// ── Ejecución principal ───────────────────────────────────────────────────────
export async function ejecutarPublishSocial(args: {
  tema: string;
  red?: string;
  motor?: string;
  url_imagen: string;
  chatId: number;
}): Promise<string> {
  const { tema, url_imagen, chatId } = args;
  const red   = normalizarRed(args.red);
  const motor = normalizarMotor(args.motor);

  console.log(`[Tool:publish_social] START red="${red}" motor="${motor}" url_imagen="${url_imagen}" chatId=${chatId}`);

  if (!url_imagen) {
    throw new Error('url_imagen es requerida para publicar en redes. Solicítala al usuario o pide que envíe una foto.');
  }

  try {
    // PASO 1 — Generar copy con Gemini
    const modelName  = motor === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
    const toneByRed  = red === 'tiktok'
      ? 'Para TikTok: copy corto (máx 150 palabras), gancho visual en la primera línea, tono joven y analítico. Usa 2-3 emojis temáticos.'
      : 'Para Facebook: copy profundo (200-300 palabras), análisis cultural Dark Academia, elegante y compartible. Incluye 1-2 emojis.';

    const promptCopy = `Eres el copywriter de TGP Project. Redacta el copy de un post en ${red.toUpperCase()} sobre el siguiente tema:

Tema: "${tema}"
Imagen disponible: ${url_imagen}

${toneByRed}

Escribe SOLO el copy del post, sin prefijos ni explicaciones.`;

    console.log(`[Tool:publish_social] Paso 1 — Generando copy con ${modelName}...`);
    const response = await genai.models.generateContent({
      model: modelName,
      contents: [{ text: promptCopy }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const caption = (response.text || '').trim();
    if (!caption) throw new Error('Gemini no generó copy para el post.');

    console.log(`[Tool:publish_social] Paso 1 OK — Copy: ${caption.slice(0, 100)}...`);

    // PASO 2 — Resguardo en D1
    console.log('[Tool:publish_social] Paso 2 — Guardando en D1...');
    await registrarResguardoD1({
      origen: 'telegram-social',
      destino: 'social',
      tema,
      textoGenerado: caption,
      imagenR2Url: url_imagen,
      metadatos: { red, motor, url_imagen },
      chatId,
    });

    // PASO 3 — Publicar via Zernio
    console.log(`[Tool:publish_social] Paso 3 — Publicando en ${red} via Zernio...`);
    const zernioResult = await publicarEnZernio({ red, caption, imageUrl: url_imagen });

    if (zernioResult.error && !zernioResult.url) {
      // Fallo total en Zernio — pero el copy ya está en D1
      throw new Error(`Zernio no pudo publicar: ${zernioResult.error}`);
    }

    // PASO 4 — Construir respuesta con URLs
    const redLabel = red === 'facebook' ? 'Facebook' : 'TikTok';
    let respuesta = `Post publicado en **${redLabel}**.\n\n`;
    respuesta    += `📝 Copy generado:\n${caption}\n\n`;
    respuesta    += `🖼️ Imagen: ${url_imagen}\n`;

    if (zernioResult.url) {
      respuesta += `🔗 Ver el post: ${zernioResult.url}\n`;
    }
    if (zernioResult.postId) {
      respuesta += `🆔 Post ID: ${zernioResult.postId}\n`;
    }
    if (zernioResult.error) {
      respuesta += `⚠️ Aviso Zernio: ${zernioResult.error}\n`;
    }

    console.log(`[Tool:publish_social] ÉXITO — ${redLabel}: ${zernioResult.url || 'sin URL de post'}`);
    return respuesta;

  } catch (err: any) {
    console.error(`[Tool:publish_social] CRASH — red="${red}" tema="${tema}"`);
    console.error('[Tool:publish_social] ERROR STACK:', err?.stack || err?.message || String(err));
    throw new Error(`Error en publish_social: ${err?.message || 'Error desconocido'}`);
  }
}
