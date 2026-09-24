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
import {
  appendTurn,
  clearChatHistory,
  getConversationHistory,
  getHITLState,
  setHITLState,
  clearHITLState,
  registrarResguardoD1,
  generarYGuardarAudioTTS,
} from '../storage/d1.js';
import { processTelegramMessage, BotIdentity } from '../ia/agent.js';
import { EruditoAgent } from '../core/agents/EruditoAgent.js';
import { wikimediaTool } from '../core/tools/wikimediaTool.js';
import { nanoBananaTool } from '../core/tools/nanoBananaTool.js';
import { generarMarkdoc, publicarEntradaKeystaticGitHub } from '../servicios/publicacion.js';
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

    // ── FLUJO CONTINUO Y ZERO FRICCIÓN (ERUDITO AGENT) ────────────────────────
    if (botIdentity === 'liminal') {
      const erudito = new EruditoAgent(process.env.GEMINI_API_KEY || '');

      // 1. Extraer prompt del usuario y foto permanente en R2 (si se envió)
      let userPrompt = text;
      let attachedPhotoUrl: string | null = null;
      if (hasPhotos && imageContextPrefix) {
        const match = imageContextPrefix.match(/https:\/\/[^\s\]]+/);
        if (match) attachedPhotoUrl = match[0];
      }

      if (!userPrompt && attachedPhotoUrl) {
        userPrompt = 'Analiza esta imagen y redacta un ensayo erudito magistral sobre su contexto histórico, arqueológico o simbólico.';
      }

      const lowerText = userPrompt.toLowerCase().trim();

      // 2. Comandos de Post-Producción y Utilidades (Keystatic GitOps y Audio TTS)
      if (lowerText.startsWith('/publicar') || lowerText.startsWith('/publica')) {
        const history = await getConversationHistory(chatId, 6, botIdentity);
        const lastModelTurn = [...history].reverse().find(t => t.role === 'model');
        const essayContent = lastModelTurn?.parts?.map((p: any) => p.text).join('\n') || '';

        if (!essayContent) {
          await sendTelegramMessage(chatId, botToken, '⚠️ No encontré un ensayo reciente en la memoria para publicar. Generá uno primero.');
          return;
        }

        await sendTelegramMessage(chatId, botToken, '⏳ Publicando ensayo en GitHub Keystatic...');
        try {
          const ghToken = process.env.GITHUB_TOKEN_HEMEROTECA || process.env.GITHUB_TOKEN || '';
          const ghRepo  = process.env.GITHUB_REPO_HEMEROTECA || 'ygnatiux-sys/tgp-hemeroteca';
          const tituloMatch = essayContent.match(/^#+\s*(.+)$/m);
          const titulo = tituloMatch ? tituloMatch[1].replace(/[*_#]/g, '').trim() : 'Ensayo Erudito TGP';
          const { slug, contenidoMdoc } = generarMarkdoc({
            titulo,
            secciones: [{ parrafo: essayContent }],
          });

          // Detectar imagen existente en el texto o enlaces
          const imgMatch = essayContent.match(/https:\/\/storage\.thegreatpuzzleproject\.com\/[^\s\)\"]+/i) ||
                           essayContent.match(/https:\/\/upload\.wikimedia\.org\/[^\s\)\"]+/i);
          const coverUrl = imgMatch ? imgMatch[0] : '';

          const commitSha = await publicarEntradaKeystaticGitHub({
            coleccion: 'ensayos-cinematicos',
            slug,
            indexJson: {
              title: titulo,
              coverImage: coverUrl,
              generadorTexto: JSON.stringify({ text: contenidoMdoc, image: coverUrl }),
            },
            contentMdoc: contenidoMdoc,
            token: ghToken,
            repoFull: ghRepo,
            mensajeCommit: `docs(hemeroteca): publicar ensayo "${titulo}" vía Erudito Telegram`,
          });

          const commitUrl = `https://github.com/${ghRepo}/commit/${commitSha}`;
          const hemerotecaUrl = `https://thegreatpuzzleproject.com/ensayos-cinematicos/${slug}`;

          const msgPublicado = [
            `✅ *¡Publicado con éxito en TGP Hemeroteca!*`,
            ``,
            `🏛️ **Hemeroteca Web:** [Abrir Ensayo en Hemeroteca](${hemerotecaUrl})`,
            `📦 **Commit GitHub:** [Ver Commit ${commitSha.slice(0, 7)} en GitHub](${commitUrl})`,
            coverUrl ? `🖼️ **Storage R2:** [Ver Portada en Storage R2](${coverUrl})` : '',
            `📁 **Ruta del Archivo:** \`src/content/ensayos-cinematicos/${slug}\``,
          ].filter(Boolean).join('\n');

          await sendTelegramMessage(chatId, botToken, msgPublicado);

          // Registro atómico de resguardo con traza completa en Cloudflare D1
          await registrarResguardoD1({
            origen: `telegram-${botIdentity}-publicacion`,
            destino: 'hemeroteca',
            tema: titulo,
            textoGenerado: essayContent,
            metadatos: {
              slug,
              commitSha,
              commitUrl,
              hemerotecaUrl,
              coverUrl,
            },
            imagenR2Url: coverUrl || undefined,
            chatId: chatId,
          });
        } catch (pubErr: any) {
          console.error('[Publicar Error]:', pubErr);
          await sendTelegramMessage(chatId, botToken, `⚠️ Error en la publicación: ${pubErr?.message || pubErr}`);
        }
        return;
      }

      if (lowerText.startsWith('/audio')) {
        const history = await getConversationHistory(chatId, 6, botIdentity);
        const lastModelTurn = [...history].reverse().find(t => t.role === 'model');
        const essayContent = lastModelTurn?.parts?.map((p: any) => p.text).join('\n') || '';

        if (!essayContent) {
          await sendTelegramMessage(chatId, botToken, '⚠️ No hay un ensayo reciente para generar audio.');
          return;
        }

        await sendTelegramMessage(chatId, botToken, '🎙️ Sintetizando audio documental con voz neuronal...');
        try {
          const audioId = `tgp-${chatId}-${Date.now()}`;
          const audioUrl = await generarYGuardarAudioTTS(audioId, essayContent);
          if (audioUrl) {
            await sendTelegramMessage(
              chatId,
              botToken,
              `🎧 *Audio Documental Generado con Éxito*\n\n🔊 **Storage R2:** [Escuchar / Descargar Audio](${audioUrl})\n📁 **Key:** \`audios/${audioId}.mp3\``
            );

            await registrarResguardoD1({
              origen: `telegram-${botIdentity}-audio`,
              destino: 'datalake',
              tema: 'Audio TTS Documental',
              textoGenerado: essayContent.slice(0, 500),
              metadatos: { audioUrl, audioId },
              chatId: chatId,
            });
          } else {
            await sendTelegramMessage(chatId, botToken, '⚠️ No se pudo sintetizar el audio en este momento.');
          }
        } catch (audioErr: any) {
          console.error('[Audio Error]:', audioErr);
          await sendTelegramMessage(chatId, botToken, `⚠️ Error generando audio: ${audioErr?.message || audioErr}`);
        }
        return;
      }

      // 3. Mapeo Estricto de Perfiles de Ejecución (Zero Fricción)
      const isProBreve   = /^\/pro_breve\b/i.test(userPrompt);
      const isProMedio   = /^\/pro_medio\b/i.test(userPrompt);
      const isProPremium = /^\/pro_premium\b/i.test(userPrompt);
      const isProGeneric = /^\/pro\b/i.test(userPrompt);

      const wantsPro = isProBreve || isProMedio || isProPremium || isProGeneric ||
                       /modo pro|us[aá] pro/i.test(userPrompt);

      const cleanPrompt = userPrompt
        .replace(/^\/(pro_breve|pro_medio|pro_premium|pro|flash)\s*/i, '')
        .trim();

      // Guardar el turno del usuario en D1
      await appendTurn(chatId, 'user', [{ text: userPrompt }], botIdentity);
      const baseHistory = await getConversationHistory(chatId, 10, botIdentity);

      // Si viene con foto adjunta desde Telegram (Escudo R2), inyectarla directo
      let initialPrompt = cleanPrompt;
      if (attachedPhotoUrl) {
        initialPrompt = [
          `El usuario ha enviado una imagen propia (alojada permanentemente en R2): ${attachedPhotoUrl}`,
          `NO busques imágenes ni llames a herramientas de generación de portada. Usa esta imagen como referencia visual central.`,
          `Redacta el ensayo erudito magistral sobre: "${cleanPrompt || 'esta imagen'}"`,
        ].join('\n');
      }

      // Ejecutar Erudito Agent
      let generatedPhotoUrl: string | null = null;
      let response = await erudito.generateEssay('', initialPrompt, 'divulgativo', baseHistory, wantsPro);

      // 4. Bucle Flujo Continuo: Si el modelo pide una herramienta visual, ejecutarla de inmediato
      if (response.status === 'REQUIRES_ACTION') {
        const tc = response.toolCall;
        const toolName = tc?.name;
        const toolArgs = tc?.args || {};

        console.log(`[Flujo Continuo] Auto-ejecutando herramienta ${toolName}:`, toolArgs);

        let toolResult: any;

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
          console.error(`[Flujo Continuo Tool Error]:`, toolErr);
          toolResult = { error: toolErr.message };
        }

        // Si se obtuvo imagen (Wikimedia o Nano Banana), enviar foto de inmediato al chat
        if (generatedPhotoUrl && !generatedPhotoUrl.startsWith('data:')) {
          const photoCaption = toolName === 'search_wikimedia_photo'
            ? `🏛️ *Fotografía Histórica (Wikimedia Commons)*\n📌 *${toolArgs?.query || cleanPrompt}*`
            : `🎨 *Portada Cinematográfica TGP*\n🎬 *"${toolArgs?.title || cleanPrompt}"*`;
          await sendTelegramPhoto(chatId, botToken, generatedPhotoUrl, photoCaption);
        }

        // Redactar de inmediato el ensayo completo incorporando la imagen obtenida
        const essayPrompt = [
          `Se ha completado el recurso visual para este ensayo:`,
          `- Referencia: "${toolArgs?.title || toolArgs?.query || cleanPrompt}"`,
          toolArgs?.concept ? `- Concepto visual: "${toolArgs.concept}"` : '',
          generatedPhotoUrl ? `- URL de imagen: ${generatedPhotoUrl}` : '',
          `\nLa imagen ya fue generada y enviada al lector. NO vuelvas a llamar a herramientas de imagen.`,
          `Redacta el ensayo magistral completo sobre "${cleanPrompt}".`,
          `Cumple con todos los estándares: formato Markdown impecable para TGP Hemeroteca, fuentes de autoridad, estructura divulgativo-erudita y profundidad analítica.`
        ].filter(Boolean).join('\n');

        response = await erudito.generateEssay(
          toolArgs?.title || cleanPrompt,
          essayPrompt,
          'divulgativo',
          baseHistory,
          wantsPro
        );
      }

      // 5. Entrega del ensayo terminado + Resguardo Documental en D1
      if (response.status === 'COMPLETED') {
        let textToSend = response.content || '';
        const finalImageUrl = attachedPhotoUrl || generatedPhotoUrl;

        // Traza permanente y visible al pie del ensayo
        const trazaFooter: string[] = ['\n\n---'];
        if (finalImageUrl) {
          trazaFooter.push(`🖼️ **Storage R2:** [Ver Imagen Original en Storage R2](${finalImageUrl})`);
        }
        trazaFooter.push(`🏛️ **Hemeroteca:** Envía \`/publicar\` para comitear este ensayo a [TGP Hemeroteca](https://thegreatpuzzleproject.com)`);
        textToSend += trazaFooter.join('\n');

        await sendTelegramMessage(chatId, botToken, textToSend);
        await appendTurn(chatId, 'model', [{ text: textToSend }], botIdentity);

        // Registro atómico de resguardo documental en Cloudflare D1
        await registrarResguardoD1({
          origen: `telegram-${botIdentity}`,
          destino: 'hemeroteca',
          tema: cleanPrompt,
          textoGenerado: textToSend,
          metadatos: {
            prompt: cleanPrompt,
            wantsPro,
            imagenR2Url: finalImageUrl || null,
            storageUrl: finalImageUrl || null,
          },
          imagenR2Url: finalImageUrl || undefined,
          chatId: chatId,
        });
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
