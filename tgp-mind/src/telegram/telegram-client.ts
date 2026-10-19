// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Cliente HTTP Nativo de Telegram & Chunking Anti-Colapso
// ─────────────────────────────────────────────────────────────────────────────
import type { InlineKeyboard } from './keyboards.js';

// ── Indicador de escritura "Typing" no bloqueante ───────────────────────────
export async function sendChatAction(chatId: number, token: string, action = 'typing'): Promise<void> {
  try {
    fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    }).catch(() => {});
  } catch {}
}

// ── Helpers de Telegram API ───────────────────────────────────────────────────
export async function telegramPost(token: string, method: string, body: object): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000), // 10s timeout
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`[Telegram API] ${method} error ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

// ── Envío de mensaje individual con teclado opcional + Fallback sin Markdown ────
export async function sendSingleTelegramMessage(
  chatId: number,
  token: string,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  const replyMarkup = keyboard
    ? { inline_keyboard: keyboard }
    : undefined;

  const payload: any = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!res.ok) {
      // Fallback: sin Markdown, pero conservar el teclado
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
    }
  } catch (err) {
    console.error('[Telegram Client] Error enviando mensaje a Telegram:', err);
  }
}

// ── Envío con Chunking Anti-Colapso y Orden Secuencial Estricto ──────────────
export async function sendTelegramMessage(
  chatId: number,
  token: string,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  if (!text) return;

  // Si el texto supera el límite de Telegram (4096 caracteres), dividir en fragmentos
  if (text.length > 4000) {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= 4000) {
        chunks.push(remaining);
        break;
      }
      let splitIdx = remaining.lastIndexOf('\n\n', 4000);
      if (splitIdx === -1 || splitIdx < 1500) {
        splitIdx = remaining.lastIndexOf('\n', 4000);
      }
      if (splitIdx === -1 || splitIdx < 1500) {
        splitIdx = 4000;
      }
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx).trimStart();
    }

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      await sendSingleTelegramMessage(chatId, token, chunks[i], isLast ? keyboard : undefined);
      if (!isLast) {
        // Pausa estricta de 100ms para asegurar el orden cronológico de entrega en los clientes de Telegram
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return;
  }

  await sendSingleTelegramMessage(chatId, token, text, keyboard);
}

// ── Enviar Foto a Telegram ───────────────────────────────────────────────────
export async function sendTelegramPhoto(
  chatId: number,
  token: string,
  photoUrl: string,
  caption?: string
): Promise<void> {
  const payload: any = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: 'Markdown',
    ...(caption ? { caption } : {}),
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      // Fallback: sin parse_mode
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
        signal: AbortSignal.timeout(15000),
      });
    }
  } catch (err) {
    console.error('[Telegram Client] Error enviando foto a Telegram:', err);
  }
}

// ── Responder a un callback_query (detiene el spinner en la app del usuario) ─
export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  await telegramPost(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text, show_alert: showAlert } : {}),
  });
}

// ── Editar teclado de un mensaje existente ───────────────────────────────────
export async function editMessageReplyMarkup(
  token: string,
  chatId: number,
  messageId: number,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await telegramPost(token, 'editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: keyboard ? { inline_keyboard: keyboard } : { inline_keyboard: [] },
  });
}

// ── Deduplicación de Updates (anti-retries Telegram) ──────────────────────────
const seenUpdateIds = new Set<number>();
export function isDuplicateUpdate(updateId?: number): boolean {
  if (!updateId) return false;
  if (seenUpdateIds.has(updateId)) return true;
  seenUpdateIds.add(updateId);
  if (seenUpdateIds.size > 2000) {
    const firstItem = seenUpdateIds.values().next().value;
    if (firstItem !== undefined) seenUpdateIds.delete(firstItem);
  }
  return false;
}
