// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Webhook Unificado Multi-Bot (Dispatcher)
//
// Responsabilidad única:
//   1. Deduplicar updates entrantes (anti-retry).
//   2. Despachar callback_query al CallbackHandler.
//   3. Despachar comandos al CommandHandler.
//   4. Despachar mensajes conversacionales al MessageHandler.
// ─────────────────────────────────────────────────────────────────────────────

import { type BotIdentity } from '../ia/agent.js';
import {
  isDuplicateUpdate,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendChatAction,
} from './telegram-client.js';
import { handleCallbackQuery } from './handlers/callback.handler.js';
import { handleCommand } from './handlers/command.handler.js';
import { handleIncomingMessage } from './handlers/message.handler.js';

// Re-exportar funciones de transporte para compatibilidad hacia atrás
export { sendTelegramMessage, sendTelegramPhoto, sendChatAction };

export async function handleTelegramWebhook(
  update: any,
  botIdentity: BotIdentity,
  botToken: string,
): Promise<void> {
  // 1. Anti-retries: ignorar si el update_id ya fue procesado o está en curso
  if (isDuplicateUpdate(update?.update_id)) {
    console.warn(`[Webhook Anti-Retry] update_id=${update?.update_id} ya procesado (${botIdentity}).`);
    return;
  }

  // 2. Rama Callback Query (botones inline / Action Bento / Taller Desk)
  if (update?.callback_query) {
    await handleCallbackQuery(update.callback_query, botIdentity, botToken);
    return;
  }

  // 3. Rama Mensajes (texto / fotos / comandos)
  const msg = update?.message || update?.edited_message;
  if (!msg) return;

  // Interceptar comandos de control, autenticación y bóveda
  const isCommand = await handleCommand(msg, botIdentity, botToken);
  if (isCommand) return;

  // Procesar mensaje conversacional, multimodal o redacción de ensayo
  await handleIncomingMessage(msg, botIdentity, botToken);
}
