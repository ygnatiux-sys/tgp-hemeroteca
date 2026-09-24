// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Webhook Unificado Multi-Bot con Escudo R2
//
// Responsabilidades:
//   1. Detectar identidad del bot por token.
//   2. ESCUDO R2: Si llega una foto → subir a R2 ANTES de hablar con Gemini.
//      Inyectar la URL permanente como mensaje de sistema en el historial D1.
//   3. Manejar callback_query (teclados inline): tratar callback_data como texto.
//   4. Manejar comandos /nuevo, /cancel, /reset, /menu.
//   5. Delegar todo el razonamiento a agent.ts (processTelegramMessage).
//   6. Inyectar teclados inline en la respuesta cuando corresponde:
//      - Ficha Visual → Teclado de Confirmación
//      - Cualquier respuesta post-tool → Sin teclado (ya confirmaron)
//
// Garantía de datos: Ninguna imagen llega a Gemini como buffer en memoria.
// Solo llegan URLs R2 permanentes. Toda imagen existe en storage antes del LLM.
// ─────────────────────────────────────────────────────────────────────────────

import { procesarFotoTelegramAR2 } from '../storage/r2.js';
import { appendTurn, clearChatHistory, getConversationHistory, getHITLState, setHITLState, clearHITLState } from '../storage/d1.js';
import { processTelegramMessage, BotIdentity } from '../ia/agent.js';
import { EruditoAgent } from '../core/agents/EruditoAgent.js';
import { wikimediaTool } from '../core/tools/wikimediaTool.js';
import { nanoBananaTool } from '../core/tools/nanoBananaTool.js';
import {
  esFichaVisual,
  TECLADO_CONFIRMACION,
  MENUS_BY_BOT,
  getMenuTitle,
  type InlineKeyboard,
} from './keyboards.js';

// ── Helpers de Telegram API ───────────────────────────────────────────────────

async function telegramPost(token: string, method: string, body: object): Promise<any> {
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

// ── Envío de mensaje con teclado opcional + Fallback sin Markdown ─────────────
async function sendSingleTelegramMessage(
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
    console.error('[Webhook] Error enviando mensaje a Telegram:', err);
  }
}

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
    console.error('[Webhook] Error enviando foto a Telegram:', err);
  }
}

// ── Responder a un callback_query (requerido por la API de Telegram) ──────────
async function answerCallbackQuery(
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
async function editMessageReplyMarkup(
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
function isDuplicateUpdate(updateId?: number): boolean {
  if (!updateId) return false;
  if (seenUpdateIds.has(updateId)) return true;
  seenUpdateIds.add(updateId);
  if (seenUpdateIds.size > 2000) {
    const firstItem = seenUpdateIds.values().next().value;
    if (firstItem !== undefined) seenUpdateIds.delete(firstItem);
  }
  return false;
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function handleTelegramWebhook(
  update: any,
  botIdentity: BotIdentity,
  botToken: string,
): Promise<void> {

  // Anti-retries: ignorar si el update_id ya fue procesado o está en curso
  if (isDuplicateUpdate(update?.update_id)) {
    console.warn(`[Webhook Anti-Retry] update_id=${update?.update_id} ya en curso o procesado (${botIdentity}). Ignorando.`);
    return;
  }

  // ── RAMA 1: Callback Query (botón inline pulsado) ──────────────────────────
  // Se trata como mensaje de texto semántico. Stateless: callback_data ES el texto.
  if (update?.callback_query) {
    const cq        = update.callback_query;
    const chatId    = cq.message?.chat?.id as number;
    const messageId = cq.message?.message_id as number;
    const data      = (cq.data || '').trim();
    const cqId      = cq.id;

    if (!chatId || !data) {
      await answerCallbackQuery(botToken, cqId);
      return;
    }

    // Botón deshabilitado durante ejecución
    if (data === 'disabled' || data === 'noop') {
      await answerCallbackQuery(botToken, cqId, '⏳ La tarea ya está en proceso...', false);
      return;
    }

    console.log(`[Webhook CB] chat_id=${chatId} bot=${botIdentity} callback_data="${data}"`);

    // 1. Determinar cartel Toast de devolución
    let toastText = '⚡ Procesando...';
    if (data === 'ok') {
      toastText = '⏳ ¡Confirmado! Generando ensayo y multimedia...';
    } else if (data === '/cancel' || data === 'cancel') {
      toastText = '❌ Operación cancelada.';
    } else if (data === '/nuevo' || data === '/reset') {
      toastText = '🔄 Reiniciando sesión...';
    } else if (data.includes('modificar')) {
      toastText = '✏️ Ajustando parámetros...';
    }

    // Enviar cartel Toast inmediato (< 10s requerido por Telegram)
    await answerCallbackQuery(botToken, cqId, toastText, false);

    // 2. Si pulsaron Confirmar, congelar el teclado del mensaje para evitar doble clic y errores
    if (data === 'ok' && messageId) {
      await editMessageReplyMarkup(botToken, chatId, messageId, [
        [{ text: '⏳ Procesando publicación...', callback_data: 'disabled' }],
      ]);
    }

    // Comandos especiales dentro de callbacks
    if (data === '/nuevo' || data === '/cancel' || data === '/reset') {
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId);
      }
      await clearChatHistory(chatId, botIdentity);
      await sendTelegramMessage(chatId, botToken, '🔄 Sesión reiniciada. ¿En qué te ayudo?');
      return;
    }

    if (data === '/menu' || data === 'menu') {
      await sendTelegramMessage(
        chatId, botToken,
        getMenuTitle(botIdentity),
        MENUS_BY_BOT[botIdentity],
      );
      return;
    }

    // Tratar callback_data como texto semántico → Gemini
    try {

      const responseText = await processTelegramMessage(chatId, data, botIdentity);
      if (responseText) {
        if (data === 'ok' && messageId) {
          await editMessageReplyMarkup(botToken, chatId, messageId, [
            [{ text: '✅ Confirmado y procesado', callback_data: 'disabled' }],
          ]);
        }
        const keyboard = esFichaVisual(responseText) ? TECLADO_CONFIRMACION : undefined;
        await sendTelegramMessage(chatId, botToken, responseText, keyboard);
      } else {
        if (data === 'ok' && messageId) {
          await editMessageReplyMarkup(botToken, chatId, messageId, [
            [{ text: '⚠️ Sin respuesta', callback_data: 'disabled' }],
          ]);
        }
        await sendTelegramMessage(chatId, botToken, '⚠️ No se obtuvo respuesta del sistema. Por favor intentá nuevamente con /nuevo.');
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[Webhook CB] ❌ CRASH — chat_id=${chatId}: ${errMsg}`);
      console.error(err);
      try { (await import('node:fs')).appendFileSync('../scratch/bot_error.log', new Date().toISOString() + ' CB Error: ' + (err?.stack || errMsg) + '\n'); } catch (e) {}
      if (data === 'ok' && messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '⚠️ Error en la generación', callback_data: 'disabled' }],
        ]);
      }
      await sendTelegramMessage(chatId, botToken, '⚠️ Hubo un error al procesar la confirmación. Por favor intentá de nuevo.');
    }
    return;
  }

  // ── RAMA 2: Mensaje normal (texto / foto / caption) ───────────────────────
  const msg = update?.message || update?.edited_message;
  if (!msg) return;

  const chatId: number = msg.chat.id;

  // Extraer texto: msg.text (mensaje plano) o msg.caption (pie de foto)
  // CRÍTICO: ambas fuentes son mutuamente excluyentes en la API de Telegram.
  const rawText    = typeof msg.text    === 'string' ? msg.text.trim()    : '';
  const rawCaption = typeof msg.caption === 'string' ? msg.caption.trim() : '';
  const text       = rawText || rawCaption;
  const textSource = rawText ? 'text' : rawCaption ? 'caption' : 'none';

  const photos    = msg.photo as Array<{ file_id: string; width: number; height: number }> | undefined;
  const hasPhotos = Array.isArray(photos) && photos.length > 0;

  console.log(`[Webhook] chat_id=${chatId} bot=${botIdentity} src=${textSource} photo=${hasPhotos} text="${text.slice(0, 80)}"`);

  // ── Comandos de control ──────────────────────────────────────────────────
  if (text === '/menu' || text === '/tools') {
    await sendTelegramMessage(
      chatId, botToken,
      getMenuTitle(botIdentity),
      MENUS_BY_BOT[botIdentity],
    );
    return;
  }

  if (text.startsWith('/nuevo') || text.startsWith('/cancel') || text.startsWith('/reset')) {
    await clearChatHistory(chatId, botIdentity);
    await sendTelegramMessage(chatId, botToken, '🔄 Sesión reiniciada. ¿En qué te ayudo?');
    return;
  }

  // ── ESCUDO R2: Interceptar foto ANTES de hablar con Gemini ────────────────
  // Turno D1 fusionado: [contexto R2 URL] + [caption del usuario]
  let imageContextPrefix = '';
  let fotoGuardadaEnD1   = false;

  if (hasPhotos) {
    const bestPhoto = photos!.reduce((a, b) => (a.width > b.width ? a : b));

    try {
      console.log(`[Webhook R2] Subiendo foto file_id=${bestPhoto.file_id} (chat_id=${chatId})...`);
      const { url: r2Url } = await procesarFotoTelegramAR2(bestPhoto.file_id, 'telegram', botToken);
      console.log(`[Webhook R2] ✅ Imagen en R2: ${r2Url}`);

      imageContextPrefix = `[Sistema: Imagen recibida. URL permanente en R2: ${r2Url}. Usa esta URL como url_imagen en la Ficha Visual y en la Tool publish_social.]`;

      const partsD1: Array<{ text: string }> = [{ text: imageContextPrefix }];
      if (text) partsD1.push({ text: `Caption del usuario: ${text}` });

      await appendTurn(chatId, 'user', partsD1, botIdentity);
      fotoGuardadaEnD1 = true;

    } catch (err: any) {
      const errMsg    = err?.message || String(err);
      const errStatus = err?.status  || err?.statusCode || 'N/A';
      const errBody   = err?.body    || err?.data       || '';
      console.error(`[Webhook R2] ❌ CRASH — chat_id=${chatId} file_id=${bestPhoto.file_id}`);
      console.error(`[Webhook R2] Error: ${errMsg} | HTTP: ${errStatus}`);
      if (errBody) console.error(`[Webhook R2] Body: ${JSON.stringify(errBody).slice(0, 500)}`);
      console.error(`[Webhook R2] Stack:`, err?.stack || '(sin stack)');

      imageContextPrefix = `[Sistema: El usuario envió una foto pero falló la subida a R2 (error: ${errMsg}). No hay URL disponible. Informa al usuario y pide que reenvíe la imagen.]`;
      const partsD1: Array<{ text: string }> = [{ text: imageContextPrefix }];
      if (text) partsD1.push({ text: `Caption del usuario: ${text}` });
      await appendTurn(chatId, 'user', partsD1, botIdentity);
      fotoGuardadaEnD1 = true;
    }
  }

  // ── Sanity check ──────────────────────────────────────────────────────────
  const userTextForAgent = text || (hasPhotos ? '(imagen adjunta sin caption)' : '');
  if (!userTextForAgent && !fotoGuardadaEnD1) {
    console.warn(`[Webhook] Mensaje vacío ignorado para chat_id=${chatId}`);
    return;
  }

  // ── Llamada al Agente Orquestador ─────────────────────────────────────────
  try {
    // Si la foto + caption ya se guardaron en D1 como turno fusionado (fotoGuardadaEnD1),
    // pasamos textParaAgente='' para que agent.ts no duplique el guardado.
    const textParaAgente = fotoGuardadaEnD1 ? '' : userTextForAgent;

    // ── MODO HITL PARA ERUDITO SDK (TEST LIMINAL — 100% CONVERSACIONAL) ──
    if (botIdentity === 'liminal') {
      const erudito = new EruditoAgent(process.env.GEMINI_API_KEY || '');
      const cleanUserText = textParaAgente.trim();
      const lowerText = cleanUserText.toLowerCase();

      // 1. Revisar si hay un estado HITL pendiente en Cloudflare D1
      const hitlState: any = await getHITLState(chatId, botIdentity);

      const isApproval = /^(adelante|ok|proceed|proceder|dale|s[ií]|hazlo|hacelo|contin[uú]a|avanza|ejecutar|confirmo|metele)/i.test(lowerText);
      const wantsPro = lowerText.includes('usá pro') || lowerText.includes('usa pro') || lowerText.includes('modo pro') || (lowerText === 'pro') || Boolean(hitlState?.wantsPro);

      let response: any;

      if (hitlState?.pendingToolCall && isApproval) {
        // Aprobación confirmada por el usuario
        const pending = hitlState.pendingToolCall;
        const toolName = pending.name;
        const toolArgs = pending.args || {};
        const originalPrompt = hitlState.originalPrompt || cleanUserText;
        const useProModel = wantsPro || Boolean(hitlState.wantsPro);

        await clearHITLState(chatId, botIdentity);
        await sendTelegramMessage(chatId, botToken, `⚡ *[HITL]* Aprobado. Generando recursos y redactando ensayo...`);

        let toolResult: any;
        let generatedPhotoUrl: string | null = null;

        try {
          if (toolName === 'search_wikimedia_photo') {
            toolResult = await wikimediaTool.execute(toolArgs);
            if (toolResult?.results?.[0]?.url) {
              generatedPhotoUrl = toolResult.results[0].url;
            }
          } else if (toolName === 'generate_nano_banana_cover') {
            toolResult = await nanoBananaTool.execute(toolArgs);
            if (toolResult?.imageUrl) {
              generatedPhotoUrl = toolResult.imageUrl;
            }
          } else {
            toolResult = { error: `Herramienta ${toolName} no reconocida.` };
          }
        } catch (toolErr: any) {
          toolResult = { error: toolErr.message };
        }

        // Si se generó o encontró foto con URL permanente, enviarla al chat
        if (generatedPhotoUrl && !generatedPhotoUrl.startsWith('data:')) {
          await sendTelegramPhoto(chatId, botToken, generatedPhotoUrl, `🎨 *Portada generada:* "${toolArgs?.title || originalPrompt}"`);
        }

        // Reanudar con Erudito:
        // Reconstruimos el historial con el turno del modelo que invocó la tool para que Gemini SDK no arroje error
        const baseHistory = await getConversationHistory(chatId, 12, botIdentity);
        const reconstructedHistory = [
          ...baseHistory,
          {
            role: 'model',
            parts: [{ functionCall: { name: toolName, args: toolArgs } }]
          }
        ];

        response = await erudito.resumeAfterApproval(
          toolName,
          toolResult,
          reconstructedHistory,
          useProModel
        );

      } else if (hitlState?.pendingToolCall && !isApproval) {
        // El usuario respondió una corrección conceptual o cambió de opinión
        await clearHITLState(chatId, botIdentity);
        await appendTurn(chatId, 'user', [{ text: cleanUserText }], botIdentity);
        const updatedHistory = await getConversationHistory(chatId, 12, botIdentity);
        response = await erudito.generateEssay('', cleanUserText, 'divulgativo', updatedHistory, wantsPro);

      } else {
        // Flujo inicial normal
        await appendTurn(chatId, 'user', [{ text: cleanUserText }], botIdentity);
        const updatedHistory = await getConversationHistory(chatId, 12, botIdentity);
        response = await erudito.generateEssay('', cleanUserText, 'divulgativo', updatedHistory, wantsPro);
      }

      if (response.status === 'COMPLETED') {
        const textToSend = response.content || '';
        // 100% Conversacional: CERO teclados inline
        await sendTelegramMessage(chatId, botToken, textToSend);
        await appendTurn(chatId, 'model', [{ text: textToSend }], botIdentity);

      } else if (response.status === 'REQUIRES_ACTION') {
        const tc = response.toolCall;
        let promptText = '';
        if (tc?.name === 'search_wikimedia_photo') {
          promptText = `🔧 *[HITL — Aprobación Requerida]*\n\nErudito propone buscar una fotografía histórica en Wikimedia Commons:\n👉 *"${tc.args?.query || 'consulta'}"*\n\n¿Procedemos? Respondé *"adelante"* o *"ok"* para ejecutar, o indicame si querés ajustar la búsqueda.`;
        } else if (tc?.name === 'generate_nano_banana_cover') {
          promptText = `🎨 *[HITL — Aprobación Requerida]*\n\nErudito propone generar una portada cinematográfica:\n🎬 **Título:** "${tc.args?.title || 'Sin título'}"\n📌 **Concepto:** ${tc.args?.concept || 'Arte conceptual'}\n\n¿Procedemos? Respondé *"adelante"* o *"ok"* para generar la imagen, o indicame si querés corregir algún detalle del concepto visual.`;
        } else {
          promptText = `🔧 *[HITL — Aprobación Requerida]*\n\nErudito propone ejecutar la herramienta: *${tc?.name}*.\n\n¿Procedemos? Respondé *"adelante"* o *"ok"*.`;
        }

        // Persistir en Cloudflare D1 hitl_sessions para que sobreviva llamadas HTTP
        await setHITLState(chatId, {
          step: 'awaiting_tool_approval',
          pendingToolCall: tc,
          originalPrompt: cleanUserText,
          wantsPro,
        } as any, botIdentity);

        await sendTelegramMessage(chatId, botToken, promptText);
        await appendTurn(chatId, 'model', [{ text: promptText }], botIdentity);

      } else if (response.status === 'ERROR') {
        await sendTelegramMessage(chatId, botToken, `⚠️ Error en Erudito: ${response.error || 'Desconocido'}`);
      }
      return;
    }


    const responseText = await processTelegramMessage(
      chatId,
      textParaAgente,
      botIdentity,
      fotoGuardadaEnD1 ? imageContextPrefix : undefined,
    );

    if (responseText) {
      // Detectar Ficha Visual → adjuntar teclado de confirmación
      const keyboard = esFichaVisual(responseText) ? TECLADO_CONFIRMACION : undefined;
      await sendTelegramMessage(chatId, botToken, responseText, keyboard);
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[Webhook] ❌ CRASH en processTelegramMessage — chat_id=${chatId}: ${errMsg}`);
    console.error('[Webhook] Stack:', err?.stack || '(sin stack)');
    console.error(err);
    try { (await import('node:fs')).appendFileSync('../scratch/bot_error.log', new Date().toISOString() + ' MSG Error: ' + (err?.stack || errMsg) + '\n'); } catch (e) {}
    await sendTelegramMessage(
      chatId,
      botToken,
      '⚠️ Hubo un error al procesar tu solicitud. Intenta de nuevo.',
    );
  }
}
