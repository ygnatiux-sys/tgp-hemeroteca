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

// ── Envío simple a Telegram con Fallback de Seguridad ──────────────────────────
async function sendTelegramMessage(
  chatId: number,
  token: string,
  text: string,
  parseMode: 'Markdown' | 'HTML' | undefined = 'Markdown',
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Webhook Telegram Error ${res.status}]: ${errText}`);
      // Fallback: Si Telegram rechaza por sintaxis de Markdown (400), reintentar como texto plano
      if (parseMode) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
          }),
        });
      }
    }
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

  // ── Extraer texto: msg.text (mensaje plano) o msg.caption (pie de foto) ────
  // CRÍTICO: ambas fuentes son mutuamente excluyentes en la API de Telegram.
  // msg.text solo existe en mensajes de texto puro.
  // msg.caption existe cuando el usuario envía una imagen con texto adjunto.
  const rawText    = typeof msg.text    === 'string' ? msg.text.trim()    : '';
  const rawCaption = typeof msg.caption === 'string' ? msg.caption.trim() : '';
  const text       = rawText || rawCaption; // el que exista
  const textSource = rawText ? 'text' : rawCaption ? 'caption' : 'none';

  const photos = msg.photo as Array<{ file_id: string; width: number; height: number }> | undefined;
  const hasPhotos = Array.isArray(photos) && photos.length > 0;

  console.log(`[Webhook] chat_id=${chatId} bot=${botIdentity} text_source=${textSource} has_photo=${hasPhotos} text="${text.slice(0, 80)}"`); 

  // ── Comandos de control ────────────────────────────────────────────────────
  if (text.startsWith('/nuevo') || text.startsWith('/cancel') || text.startsWith('/reset')) {
    await clearChatHistory(chatId, botIdentity); // Limpia solo la memoria de ESTE bot
    await sendTelegramMessage(chatId, botToken, '🔄 Sesión reiniciada. ¿En qué te ayudo?');
    return;
  }

  // ── ESCUDO R2: Interceptar foto ANTES de hablar con Gemini ────────────────
  // Si hay foto, se sube a R2 y se crea un turno único en D1 fusionando:
  //   - El contexto de imagen (URL R2)
  //   - El caption/texto del usuario (si existe)
  // Así Gemini recibe todo en un único turn coherente y no hay duplicados.
  let imageContextPrefix = '';
  let fotoGuardadaEnD1   = false; // flag para no duplicar el guardado en el agente

  if (hasPhotos) {
    const bestPhoto = photos!.reduce((a, b) => (a.width > b.width ? a : b));

    try {
      console.log(`[Webhook R2] Subiendo foto file_id=${bestPhoto.file_id} a R2 (chat_id=${chatId})...`);
      const { url: r2Url } = await procesarFotoTelegramAR2(bestPhoto.file_id, 'telegram', botToken);
      console.log(`[Webhook R2] ✅ Imagen respaldada en R2: ${r2Url}`);

      imageContextPrefix = `[Sistema: Imagen recibida. URL permanente en R2: ${r2Url}. Usa esta URL como url_imagen en la Ficha Visual y en la Tool publish_social.]`;

      // Turno fusionado: contexto R2 + caption (si hay) en un solo turno D1
      // AISLAMIENTO: se escribe en la partición exclusiva de este bot.
      const partsD1: Array<{ text: string }> = [{ text: imageContextPrefix }];
      if (text) partsD1.push({ text: `Caption del usuario: ${text}` });

      await appendTurn(chatId, 'user', partsD1, botIdentity);
      fotoGuardadaEnD1 = true;

    } catch (err: any) {
      // Log detallado del crash de R2 para diagnóstico en Cloud Run
      const errMsg    = err?.message || String(err);
      const errStatus = err?.status  || err?.statusCode || 'N/A';
      const errBody   = err?.body    || err?.data       || '';
      console.error(`[Webhook R2] ❌ CRASH en Escudo R2 — chat_id=${chatId} file_id=${bestPhoto.file_id}`);
      console.error(`[Webhook R2] Error message: ${errMsg}`);
      console.error(`[Webhook R2] HTTP status: ${errStatus}`);
      if (errBody) console.error(`[Webhook R2] Response body: ${JSON.stringify(errBody).slice(0, 500)}`);
      console.error(`[Webhook R2] Stack:`, err?.stack || '(sin stack)');

      // Continuar el flujo con aviso al agente (no bloqueamos al usuario)
      imageContextPrefix = `[Sistema: El usuario envió una foto pero falló la subida a R2 (error: ${errMsg}). No hay URL disponible. Informa al usuario y pide que reenvíe la imagen.]`;
      const partsD1: Array<{ text: string }> = [{ text: imageContextPrefix }];
      if (text) partsD1.push({ text: `Caption del usuario: ${text}` });
      await appendTurn(chatId, 'user', partsD1, botIdentity);
      fotoGuardadaEnD1 = true;
    }
  }

  // ── Sanity check: ignorar mensajes vacíos sin foto ────────────────────────
  const userTextForAgent = text || (hasPhotos ? '(imagen adjunta sin caption)' : '');
  if (!userTextForAgent && !fotoGuardadaEnD1) {
    console.warn(`[Webhook] Mensaje vacío ignorado para chat_id=${chatId}`);
    return;
  }

  try {
    // CRÍTICO: Si la foto + caption ya fueron guardados como un turno fusionado
    // en D1 (fotoGuardadaEnD1 = true), NO le pasamos imageContextPrefix al agente.
    // processTelegramMessage llamará appendUserText(userTextForAgent) internamente,
    // pero dado que el caption ya está en el turno de imagen, aquí enviamos un
    // texto vacío de marcador si no queremos duplicar.
    //
    // Solución limpia: si ya guardamos en D1 via appendTurn (foto+caption fusionado),
    // pasamos userTextForAgent vacío para que processTelegramMessage no duplique el
    // guardado (usa '' como señal de que el turno ya existe).
    const textParaAgente = fotoGuardadaEnD1
      ? ''          // El historial D1 ya tiene el turno completo (R2 URL + caption)
      : userTextForAgent;

    const responseText = await processTelegramMessage(
      chatId,
      textParaAgente,
      botIdentity,
      // Cuando hay foto con texto y ya se guardó en D1, pasamos imageContextPrefix
      // como contexto adicional para que Gemini sepa que hay una imagen disponible.
      fotoGuardadaEnD1 ? imageContextPrefix : undefined,
    );

    if (responseText) {
      await sendTelegramMessage(chatId, botToken, responseText);
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[Webhook] ❌ CRASH en processTelegramMessage — chat_id=${chatId}: ${errMsg}`);
    console.error('[Webhook] Stack:', err?.stack || '(sin stack)');
    await sendTelegramMessage(
      chatId,
      botToken,
      '⚠️ Hubo un error al procesar tu solicitud. Intenta de nuevo.',
    );
  }
}
