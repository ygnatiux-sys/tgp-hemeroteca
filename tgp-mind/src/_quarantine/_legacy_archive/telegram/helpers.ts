// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo Telegram: Helpers del Bot Principal
// Extraído de index.ts. Contiene:
//   - Tipos e interfaces del wizard (SesionConfig)
//   - Estado de sesiones en memoria (sesiones, pendingTextQueries)
//   - Constructor de inline keyboard principal (buildInlineKeyboard)
//   - Funciones de envío/edición de mensajes (TELEGRAM_API principal)
// ─────────────────────────────────────────────────────────────────────────────

// ── Config (recibida como parámetros para evitar coupling con index) ──────────
// Las constantes TELEGRAM_TOKEN, TELEGRAM_API se pasan en init() para mantener
// el módulo sin efectos secundarios en la carga.

let _TELEGRAM_API = '';
let _XAVIER_CHAT_ID = 0;

export function initTelegramHelpers(telegramApi: string, xavierChatId: number) {
  _TELEGRAM_API = telegramApi;
  _XAVIER_CHAT_ID = xavierChatId;
}

export function getXavierChatId() { return _XAVIER_CHAT_ID; }

// ── Gestor de Estado de Sesiones (Inline Keyboard Wizard) ────────────────────
export interface SesionConfig {
  tema: string;
  destino:    'social' | 'hemeroteca' | 'alternative';
  modelo:     'flash'  | 'pro';
  fuenteImg:  'none'   | 'wiki' | 'imagen3' | 'telegram';
  cantidadImg: 1 | 3 | 5;
  imagenTelegramUrl?: string;
  coleccion?: 'ensayos-cinematicos' | 'ensayos';
}
export const sesiones = new Map<number, SesionConfig>();
export const pendingTextQueries = new Map<string, string>();

// ── Inline Keyboard Builder ───────────────────────────────────────────────────
export function buildInlineKeyboard(cfg: SesionConfig) {
  const mark = (active: boolean, label: string) => (active ? `✅ ${label}` : label);
  const filaImagenes = [
    { text: mark(cfg.fuenteImg === 'none',    'Sin imagen'), callback_data: 'img_none'    },
    { text: mark(cfg.fuenteImg === 'wiki',    'Wiki'),       callback_data: 'img_wiki'    },
    { text: mark(cfg.fuenteImg === 'imagen3', 'Imagen 3'),   callback_data: 'img_imagen3' },
  ];
  if (cfg.imagenTelegramUrl) {
    filaImagenes.push({ text: mark(cfg.fuenteImg === 'telegram', '📷 Foto R2'), callback_data: 'img_telegram' });
  }

  return {
    inline_keyboard: [
      [
        { text: mark(cfg.destino === 'social',      'Social'),      callback_data: 'dest_social' },
        { text: mark(cfg.destino === 'hemeroteca',  'Hemeroteca'),  callback_data: 'dest_hem'   },
        { text: mark(cfg.destino === 'alternative', 'Alternative'), callback_data: 'dest_alt'   },
      ],
      [
        { text: mark(cfg.modelo === 'flash', 'Flash'), callback_data: 'mod_flash' },
        { text: mark(cfg.modelo === 'pro',   'Pro'),   callback_data: 'mod_pro'   },
      ],
      filaImagenes,
      [
        { text: mark(cfg.cantidadImg === 1, '1 secc'), callback_data: 'cant_1' },
        { text: mark(cfg.cantidadImg === 3, '3 secc'), callback_data: 'cant_3' },
        { text: mark(cfg.cantidadImg === 5, '5 secc'), callback_data: 'cant_5' },
      ],
      [
        { text: '🚀 GENERAR ENSAYO', callback_data: 'generar_ok' },
      ],
    ],
  };
}

// ── Telegram Helpers (Bot Principal) ─────────────────────────────────────────
export async function sendTelegram(chatId: number, text: string): Promise<void> {
  try {
    const MAX_CHUNK = 4000;
    if (text.length > MAX_CHUNK) {
      for (let i = 0; i < text.length; i += MAX_CHUNK) await sendTelegram(chatId, text.slice(i, i + MAX_CHUNK));
      return;
    }
    const res = await fetch(`${_TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.warn(`[Telegram] sendMessage error: ${await res.text()}`);
  } catch (err) { console.error('[Telegram] sendTelegram fatal:', err); }
}

export async function answerCallbackQuery(callbackQueryId: string, text = ''): Promise<void> {
  try {
    await fetch(`${_TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) { console.error('[Telegram] answerCallbackQuery error:', err); }
}

export async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup: object): Promise<void> {
  try {
    await fetch(`${_TELEGRAM_API}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
    });
  } catch (err) { console.error('[Telegram] editMessageReplyMarkup error:', err); }
}

export async function editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: object): Promise<void> {
  try {
    const payload: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await fetch(`${_TELEGRAM_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) { console.error('[Telegram] editMessageText error:', err); }
}
