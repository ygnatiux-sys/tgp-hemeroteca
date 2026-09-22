// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo Telegram: Bot Social + Publicación Zernio
// Extraído de index.ts. Contiene:
//   - Tipo SesionSocialConfig
//   - Estado de sesiones sociales (sesionesSocial)
//   - Constructor de inline keyboard social (buildSocialInlineKeyboard)
//   - Helpers de Telegram para el bot social (sendTelegramSocial, etc.)
//   - Función de publicación en Zernio (publicarEnZernio)
// ─────────────────────────────────────────────────────────────────────────────

// ── Init: config inyectada desde index.ts ─────────────────────────────────────
let _TELEGRAM_SOCIAL_API = '';
let _ZERNIO_API_KEY = '';
let _ZERNIO_FB_ID = '';
let _ZERNIO_TIKTOK_ID = '';

export interface SocialInitConfig {
  telegramSocialApi: string;
  zernioApiKey: string;
  zernioFbId: string;
  zernioTiktokId: string;
}

export function initSocialBot(cfg: SocialInitConfig) {
  _TELEGRAM_SOCIAL_API = cfg.telegramSocialApi;
  _ZERNIO_API_KEY       = cfg.zernioApiKey;
  _ZERNIO_FB_ID         = cfg.zernioFbId;
  _ZERNIO_TIKTOK_ID     = cfg.zernioTiktokId;
}

// ── Tipo de sesión ────────────────────────────────────────────────────────────
export interface SesionSocialConfig {
  tema: string;
  redes: 'facebook' | 'tiktok';
  modelo: 'flash' | 'pro';
  imagen: 'si' | 'no';
}
export const sesionesSocial = new Map<number, SesionSocialConfig>();

// ── Inline Keyboard ───────────────────────────────────────────────────────────
export function buildSocialInlineKeyboard(cfg: SesionSocialConfig) {
  const mark = (active: boolean, label: string) => (active ? `✅ ${label}` : label);
  return {
    inline_keyboard: [
      [
        { text: mark(cfg.redes === 'facebook', '🔵 Facebook'), callback_data: 'red_fb'     },
        { text: mark(cfg.redes === 'tiktok',   '⚫ TikTok'),   callback_data: 'red_tiktok' },
      ],
      [
        { text: mark(cfg.modelo === 'flash', 'Flash'), callback_data: 'mod_flash' },
        { text: mark(cfg.modelo === 'pro',   'Pro'),   callback_data: 'mod_pro'   },
      ],
      [
        { text: mark(cfg.imagen === 'si', 'Con Imagen'), callback_data: 'img_si' },
        { text: mark(cfg.imagen === 'no', 'Sin Imagen'), callback_data: 'img_no' },
      ],
      [{ text: '🚀 GENERAR Y PUBLICAR', callback_data: 'generar_social' }],
    ],
  };
}

// ── Telegram Helpers (Bot Social) ─────────────────────────────────────────────
export async function sendTelegramSocial(chatId: number, text: string): Promise<void> {
  try {
    const MAX_CHUNK = 4000;
    if (text.length > MAX_CHUNK) {
      for (let i = 0; i < text.length; i += MAX_CHUNK) await sendTelegramSocial(chatId, text.slice(i, i + MAX_CHUNK));
      return;
    }
    const res = await fetch(`${_TELEGRAM_SOCIAL_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.warn(`[Telegram Social] sendMessage error: ${await res.text()}`);
  } catch (err) { console.error('[Telegram Social] sendTelegram fatal:', err); }
}

export async function answerCallbackQuerySocial(callbackQueryId: string, text = ''): Promise<void> {
  try {
    await fetch(`${_TELEGRAM_SOCIAL_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) { console.error('[Telegram Social] answerCallbackQuery error:', err); }
}

export async function editMessageReplyMarkupSocial(chatId: number, messageId: number, replyMarkup: object): Promise<void> {
  try {
    await fetch(`${_TELEGRAM_SOCIAL_API}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
    });
  } catch (err) { console.error('[Telegram Social] editMessageReplyMarkup error:', err); }
}

export async function editMessageTextSocial(chatId: number, messageId: number, text: string, replyMarkup?: object): Promise<void> {
  try {
    const pl: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
    if (replyMarkup) pl.reply_markup = replyMarkup;
    await fetch(`${_TELEGRAM_SOCIAL_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pl),
    });
  } catch (err) { console.error('[Telegram Social] editMessageText error:', err); }
}

// ── Publicación Zernio ────────────────────────────────────────────────────────
export interface ZernioPublishParams {
  redes: 'facebook' | 'tiktok';
  texto: string;
  urlImagen?: string;
}

export interface ZernioPublishResult {
  postUrl: string;
  postId: string;
}

export async function publicarEnZernio(params: ZernioPublishParams): Promise<ZernioPublishResult> {
  const { redes, texto, urlImagen } = params;

  const platforms = redes === 'facebook'
    ? [{ platform: 'facebook', accountId: _ZERNIO_FB_ID }]
    : [{ platform: 'tiktok',   accountId: _ZERNIO_TIKTOK_ID }];

  const payload: any = { platforms, content: texto, publishNow: true };
  if (urlImagen) payload.mediaItems = [{ type: 'image', url: urlImagen }];

  console.log('[Zernio] Payload:', JSON.stringify(payload));

  const res = await fetch('https://api.zernio.com/v1/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_ZERNIO_API_KEY}` },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zernio API Error ${res.status}: ${errText}`);
  }

  const data: any = await res.json();
  console.log('[Zernio] Respuesta:', JSON.stringify(data));

  const postUrl: string =
    data?.post?.platforms?.[0]?.platformPostUrl ||
    data?.post?.platforms?.[0]?.postUrl         ||
    data?.post?.platforms?.[0]?.url             ||
    data?.post?.url                             ||
    data?.post?.postUrl                         ||
    '';

  return { postUrl, postId: data?.post?._id || 'N/A' };
}
