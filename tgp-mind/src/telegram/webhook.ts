// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Webhook Unificado Multi-Bot con Escudo R2
//
// Responsabilidades:
//   1. Detectar identidad del bot por token.
//   2. ESCUDO R2: Si llega una foto → subir a R2 ANTES de hablar con Gemini.
//      Inyectar la URL permanente como mensaje de sistema en el historial D1.
//   3. Manejar comandos /nuevo y /cancel (borrar historial).
//   4. Delegar todo el razonamiento a agent.ts (processTelegramMessage).
//
// Garantía de datos: Ninguna imagen llega a Gemini como buffer en memoria.
// Solo llegan URLs R2 permanentes. Toda imagen existe en storage antes del LLM.
// ─────────────────────────────────────────────────────────────────────────────

import { procesarFotoTelegramAR2 } from '../storage/r2.js';
import { appendUserText, appendTurn, clearChatHistory } from '../storage/d1.js';
import { processTelegramMessage, BotIdentity } from '../ia/agent.js';

// ── Envío simple a Telegram ───────────────────────────────────────────────────
async function sendTelegramMessage(
  chatId: number,
  token: string,
  text: string,
  parseMode: 'Markdown' | 'HTML' | undefined = 'Markdown',
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error('[Webhook] Error enviando mensaje a Telegram:', err);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function handleTelegramWebhook(
  update: any,
  botIdentity: BotIdentity,
  botToken: string,
): Promise<void> {
  const msg = update?.message || update?.edited_message;
  if (!msg) return;

  const chatId: number = msg.chat.id;
  const text: string   = (msg.text || msg.caption || '').trim();
  const photos         = msg.photo as Array<{ file_id: string; width: number; height: number }> | undefined;

  // ── Comandos de control ────────────────────────────────────────────────────
  if (text.startsWith('/nuevo') || text.startsWith('/cancel') || text.startsWith('/reset')) {
    await clearChatHistory(chatId);
    await sendTelegramMessage(chatId, botToken, '🔄 Sesión reiniciada. ¿En qué te ayudo?');
    return;
  }

  // ── ESCUDO R2: Interceptar foto ANTES de hablar con Gemini ────────────────
  // Si el mensaje incluye fotos, se procesan en R2 primero.
  // El resultado es una URL permanente que Gemini puede usar en la Ficha Visual.
  let imageContextPrefix = '';
  if (photos && photos.length > 0) {
    // Obtener la foto de mayor resolución
    const bestPhoto = photos.reduce((a, b) => (a.width > b.width ? a : b));

    try {
      console.log(`[Webhook R2] Interceptando foto file_id=${bestPhoto.file_id} para chat_id=${chatId}`);
      const { url: r2Url } = await procesarFotoTelegramAR2(bestPhoto.file_id, 'telegram', botToken);

      // Mensaje de sistema transparente para inyectar en el historial
      imageContextPrefix = `[Sistema: Imagen recibida y respaldada permanentemente en R2. URL disponible para la Ficha y para Tool publish_social: ${r2Url}]`;

      // Guardar el mensaje de sistema en D1 como turno de usuario para que
      // Gemini lo vea en el historial. Se usa appendTurn directamente porque
      // es un mensaje de sistema, no texto del usuario.
      await appendTurn(chatId, 'user', [{ text: imageContextPrefix }]);

      console.log(`[Webhook R2] Imagen respaldada exitosamente: ${r2Url}`);
    } catch (err: any) {
      console.error('[Webhook R2] Error en Escudo R2:', err?.message);
      // No bloqueamos el flujo si falla el upload. Notificamos al agente.
      imageContextPrefix = '[Sistema: Se recibió una foto pero falló la subida a R2. No hay URL disponible.]';
      await appendTurn(chatId, 'user', [{ text: imageContextPrefix }]);
    }
  }

  // ── Pasar control al Agente Orquestador ────────────────────────────────────
  // Si no hay texto y solo había una foto, usamos un texto por defecto
  // para que el agente sepa que el usuario envió algo.
  const userTextForAgent = text || (photos?.length ? '(imagen adjunta)' : '');

  if (!userTextForAgent && !imageContextPrefix) {
    // Mensaje vacío sin foto: ignorar.
    return;
  }

  try {
    // El agente guardará el texto del usuario en D1 como primer paso.
    // Si ya guardamos imageContextPrefix como turno separado, no lo duplicamos.
    const responseText = await processTelegramMessage(
      chatId,
      userTextForAgent,
      botIdentity,
      // Solo pasamos el prefijo de imagen al agente si hay texto adicional
      // del usuario que acompañe la foto. El agente lo fusionará en un solo turno.
      photos?.length && text ? imageContextPrefix : undefined,
    );

    if (responseText) {
      await sendTelegramMessage(chatId, botToken, responseText);
    }
  } catch (err: any) {
    console.error('[Webhook] Error en processTelegramMessage:', err?.message);
    await sendTelegramMessage(
      chatId,
      botToken,
      '⚠️ Hubo un error al procesar tu solicitud. Intenta de nuevo.',
    );
  }
}
