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
import { procesarFotoTelegramMultimodal, guardarRespaldoMarkdownEnR2 } from '../services/media.service.js';
import {
  appendTurn,
  clearChatHistory,
  getConversationHistory,
  getHITLState,
  setHITLState,
  clearHITLState,
  registrarResguardoD1,
  generarYGuardarAudioTTS,
  obtenerUltimosResguardosD1,
  obtenerResguardoPorIdD1,
} from '../storage/d1.js';
import { processTelegramMessage, BotIdentity } from '../ia/agent.js';
import { EruditoAgent } from '../core/agents/EruditoAgent.js';
import { wikimediaTool } from '../core/tools/wikimediaTool.js';
import { nanoBananaTool } from '../core/tools/nanoBananaTool.js';
import { generarMarkdoc, publicarEntradaKeystaticGitHub } from '../servicios/publicacion.js';
import {
  getCompanionSession,
  updateWorkingState,
  resetCompanionSession,
} from '../storage/companion-memory.js';
import {
  generarAudioDocumentalR2,
  sendTelegramNativeAudio,
} from './telegram-tts.js';
import { ejecutarPublishSocial } from '../ia/tools/tool-publish-social.js';
import {
  esFichaVisual,
  esEnsayoGenerado,
  TECLADO_CONFIRMACION,
  TECLADO_CONFIRMACION_WEB,
  TECLADO_CONFIRMACION_REDES,
  BOTONERA_ACCIONES_ENSAYO,
  BOTONERA_ACCIONES_REDES,
  SUBMENU_TALLER_DESK,
  MENUS_BY_BOT,
  getMenuTitle,
  type InlineKeyboard,
} from './keyboards.js';
import {
  isAuthorizedChatId,
  authorizeChatWithKey,
  deleteTelegramMessage,
} from '../security/master-auth.js';

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

// ── Módulo Bóveda y Rescate de Posts de Cloudflare D1 ───────────────────────
export async function handleRecuperarBoveda(
  chatId: number,
  botToken: string,
  botIdentity: BotIdentity,
): Promise<void> {
  await sendTelegramMessage(chatId, botToken, '🗄️ *Buscando en la Bóveda de Resguardo Documental (Cloudflare D1)...*');

  const registros = await obtenerUltimosResguardosD1(5);

  if (!registros || registros.length === 0) {
    await sendTelegramMessage(
      chatId,
      botToken,
      '🗄️ *Bóveda vacía:* Todavía no hay publicaciones o ensayos archivados en Cloudflare D1.',
    );
    return;
  }

  const lineas: string[] = [
    `🏛️ *BÓVEDA DOCUMENTAL TGP — RESGUARDO EN CLOUDFLARE D1*`,
    `_Encontré los últimos ${registros.length} posteos preservados. Tocá los botones para ver el texto, reciclar para redes o escuchar el audio:_`,
    ``,
  ];

  const teclado: InlineKeyboard = [];

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];
    const num = i + 1;
    const fecha = r.fecha_creacion ? r.fecha_creacion.slice(0, 10) : 'Reciente';
    const titulo = r.tema || 'Ensayo sin título';
    const destinoLabel = r.destino === 'alternative'
      ? '📜 TGP Alternative'
      : r.destino === 'hemeroteca'
      ? '🏛️ TGP Hemeroteca'
      : `🌐 ${r.destino}`;

    lineas.push(`*${num}. ${titulo}*`);
    lineas.push(`   • Destino: \`${destinoLabel}\` | Fecha: \`${fecha}\``);
    if (r.imagen_r2_url) {
      lineas.push(`   • 🖼️ [Ver Imagen en Storage R2](${r.imagen_r2_url})`);
    }
    lineas.push(``);

    teclado.push([
      { text: `📋 #${num} Ver Texto`, callback_data: `boveda:ver:${r.id}` },
      { text: `🔁 #${num} Reciclar Redes`, callback_data: `boveda:redes:${r.id}` },
      { text: `🎙️ #${num} Audio`, callback_data: `boveda:audio:${r.id}` },
    ]);
  }

  await sendTelegramMessage(chatId, botToken, lineas.join('\n'), teclado);
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

    const userId = (cq.from?.id || chatId) as number;
    if (!isAuthorizedChatId(userId)) {
      console.warn(`[Webhook Seguridad] Callback de usuario no autorizado: ${userId}. Ignorado.`);
      await answerCallbackQuery(botToken, cqId, '⛔ Acceso restringido.', true);
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
    if (data.startsWith('action:audio')) {
      toastText = '🎙️ Sintetizando audio documental...';
    } else if (data.includes('publicar_hemeroteca') || data === 'ok_hemeroteca') {
      toastText = '🏛️ Publicando en TGP Hemeroteca...';
    } else if (data.includes('publicar_alternative') || data === 'ok_alternative') {
      toastText = '📜 Publicando en TGP Alternative...';
    } else if (data.includes('facebook') || data === 'ok_facebook') {
      toastText = '📘 Publicando en Facebook vía Zernio...';
    } else if (data.includes('tiktok') || data === 'ok_tiktok') {
      toastText = '🎵 Publicando en TikTok vía Zernio...';
    } else if (data.startsWith('action:nanobanana')) {
      toastText = '🎨 Generando portada cinematográfica con Nano Banana...';
    } else if (data === 'ok') {
      toastText = '⏳ ¡Confirmado! Generando ensayo y multimedia...';
    } else if (data === '/cancel' || data === 'cancel') {
      toastText = '❌ Operación cancelada.';
    } else if (data === '/nuevo' || data === '/reset') {
      toastText = '🔄 Reiniciando sesión...';
    } else if (data.includes('modificar')) {
      toastText = '✏️ Ajustando parámetros...';
    } else if (data.startsWith('boveda:ver:')) {
      toastText = '📜 Recuperando texto de la Bóveda D1...';
    } else if (data.startsWith('boveda:redes:')) {
      toastText = '🔁 Preparando reciclado para redes...';
    } else if (data.startsWith('boveda:audio:')) {
      toastText = '🎙️ Sintetizando audio documental...';
    }

    // Enviar cartel Toast inmediato (< 10s requerido por Telegram)
    await answerCallbackQuery(botToken, cqId, toastText, false);

    // ── SUBMENÚ DESPLEGABLE INLINE ARROWS (TALLER DESK) ─────────────────────
    if (data === 'menu:taller_desk') {
      await telegramPost(botToken, 'editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: SUBMENU_TALLER_DESK },
      });
      return;
    }
    if (data === 'menu:collapse_taller') {
      const defaultKeyboard = botIdentity === 'redes' ? BOTONERA_ACCIONES_REDES : BOTONERA_ACCIONES_ENSAYO;
      await telegramPost(botToken, 'editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: defaultKeyboard },
      });
      return;
    }

    // ── GESTIÓN DE ACCIONES DE LA BÓVEDA DOCUMENTAL D1 ──────────────────────
    if (data.startsWith('boveda:ver:')) {
      const id = data.replace('boveda:ver:', '').trim();
      const record = await obtenerResguardoPorIdD1(id);
      if (!record || !record.texto_generado) {
        await sendTelegramMessage(chatId, botToken, '⚠️ No se encontró el texto completo de este post en la Bóveda D1.');
        return;
      }

      const msg = [
        `📜 *${record.tema || 'Ensayo TGP'}*`,
        `🏛️ *Destino:* \`${record.destino}\` | 📅 *Fecha:* \`${record.fecha_creacion ? record.fecha_creacion.slice(0, 10) : 'Reciente'}\``,
        record.imagen_r2_url ? `🖼️ [Ver Imagen en Storage R2](${record.imagen_r2_url})` : '',
        `\n${record.texto_generado}`,
      ].filter(Boolean).join('\n');

      const tecladoAcciones: InlineKeyboard = [
        [
          { text: '🔁 Reciclar para Redes', callback_data: `boveda:redes:${id}` },
          { text: '🎙️ Sintetizar Audio', callback_data: `boveda:audio:${id}` },
        ],
      ];

      await sendTelegramMessage(chatId, botToken, msg, tecladoAcciones);
      return;
    }

    if (data.startsWith('boveda:redes:')) {
      const id = data.replace('boveda:redes:', '').trim();
      const record = await obtenerResguardoPorIdD1(id);
      if (!record || !record.texto_generado) {
        await sendTelegramMessage(chatId, botToken, '⚠️ No encontré el contenido del post para reciclar.');
        return;
      }

      await sendTelegramMessage(chatId, botToken, `⏳ *Reciclando ensayo:* "${record.tema || 'Sin título'}" para redes sociales...`);

      await updateWorkingState(chatId, botIdentity, {
        lastDraft: record.texto_generado,
        lastTitle: record.tema,
        lastImageUrl: record.imagen_r2_url || '',
        lastAction: 'reciclar_redes',
      });

      const promptReciclado = `Che, toma como base este ensayo previo de la Bóveda: "${record.tema}".
Texto base:
${record.texto_generado.slice(0, 2000)}

Arma un copy de alto impacto para redes sociales (ritmo flash, gancho somático directo, sin clichés, doctrina Xavier Benítez).`;

      const responseText = await processTelegramMessage(chatId, promptReciclado, 'redes');
      await sendTelegramMessage(chatId, botToken, responseText, TECLADO_CONFIRMACION_REDES);
      return;
    }

    if (data.startsWith('boveda:audio:')) {
      const id = data.replace('boveda:audio:', '').trim();
      const record = await obtenerResguardoPorIdD1(id);
      if (!record || !record.texto_generado) {
        await sendTelegramMessage(chatId, botToken, '⚠️ No se encontró el texto del ensayo para generar el audio.');
        return;
      }

      const titulo = record.tema || 'Ensayo Documental TGP';
      await sendTelegramMessage(chatId, botToken, `🎙️ *Sintetizando audio documental para:* "${titulo}"...`);

      const audioRes = await generarAudioDocumentalR2(record.texto_generado, titulo, chatId);
      if (audioRes.success && audioRes.audioUrl) {
        await sendTelegramNativeAudio({
          chatId,
          botToken,
          audioUrl: audioRes.audioUrl,
          title: titulo,
          performer: 'TGP Hemeroteca',
          caption: `🎧 **${titulo}**\n\n🔊 Reproductor nativo TGP\n🔗 [Descargar MP3 en Storage R2](${audioRes.audioUrl})`,
        });
      } else {
        await sendTelegramMessage(chatId, botToken, `⚠️ Error generando audio: ${audioRes.error || 'Desconocido'}`);
      }
      return;
    }

    // ── GESTIÓN DE ACCIONES RÁPIDAS DE LA BOTONERA ACTION BENTO ─────────────
    if (data === 'action:audio') {
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '⏳ Sintetizando audio con voz neuronal...', callback_data: 'disabled' }],
        ]);
      }

      const session = await getCompanionSession(chatId, botIdentity);
      const essayContent = session.working_state.lastDraft ||
        session.recent_turns.filter(t => t.role === 'model').pop()?.parts?.map((p: any) => p.text).join('\n') || '';
      const essayTitle = session.working_state.lastTitle || 'Ensayo Documental TGP';

      if (!essayContent) {
        await sendTelegramMessage(chatId, botToken, '⚠️ No encontré un ensayo en la memoria reciente para sintetizar.');
        return;
      }

      await sendTelegramMessage(chatId, botToken, '🎙️ *Iniciando síntesis documental con chunking y voz neuronal...*');
      const audioRes = await generarAudioDocumentalR2(essayContent, essayTitle, chatId);

      if (audioRes.success && audioRes.audioUrl) {
        await sendTelegramNativeAudio({
          chatId,
          botToken,
          audioUrl: audioRes.audioUrl,
          title: essayTitle,
          performer: 'TGP Hemeroteca',
          caption: `🎧 **${essayTitle}**\n\n🔊 Reproductor nativo TGP\n🔗 [Descargar MP3 en Storage R2](${audioRes.audioUrl})`,
        });

        if (messageId) {
          await editMessageReplyMarkup(botToken, chatId, messageId, [
            [{ text: '🎧 Audio sintetizado con éxito', callback_data: 'disabled' }],
          ]);
        }
      } else {
        await sendTelegramMessage(chatId, botToken, `⚠️ Error generando audio: ${audioRes.error || 'Desconocido'}`);
      }
      return;
    }

    if (data === 'action:publicar_hemeroteca' || data === 'ok_hemeroteca') {
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '⏳ Publicando en Hemeroteca...', callback_data: 'disabled' }],
        ]);
      }

      const session = await getCompanionSession(chatId, botIdentity);
      const essayContent = session.working_state.lastDraft ||
        session.recent_turns.filter(t => t.role === 'model').pop()?.parts?.map((p: any) => p.text).join('\n') || '';
      const titulo = session.working_state.lastTitle || 'Ensayo Cinemático TGP';
      const coverUrl = session.working_state.lastImageUrl || 'https://storage.thegreatpuzzleproject.com/tgp-fallback.jpg';
      const categoria = session.working_state.lastCollection || 'misterios-arqueologia';

      if (!essayContent) {
        await sendTelegramMessage(chatId, botToken, '⚠️ No encontré un ensayo para publicar.');
        return;
      }

      const { slug, contenidoMdoc } = generarMarkdoc({
        titulo,
        secciones: [{ parrafo: essayContent }],
      });

      const ghToken = process.env.GITHUB_TOKEN_HEMEROTECA || process.env.GITHUB_TOKEN || '';
      const ghRepo = process.env.GITHUB_REPO_HEMEROTECA || 'ygnatiux-sys/tgp-hemeroteca';

      try {
        const commitSha = await publicarEntradaKeystaticGitHub({
          coleccion: 'ensayos-cinematicos',
          slug,
          indexJson: {
            title: titulo,
            coverImage: coverUrl,
            category: categoria,
            generadorTexto: JSON.stringify({ text: contenidoMdoc, image: coverUrl }),
          },
          contentMdoc: contenidoMdoc,
          token: ghToken,
          repoFull: ghRepo,
          mensajeCommit: `docs(hemeroteca): publicar ensayo "${titulo}" vía Compagnon Telegram`,
        });

        const commitUrl = `https://github.com/${ghRepo}/commit/${commitSha}`;
        const postUrl = `https://thegreatpuzzleproject.com/ensayos-cinematicos/${slug}`;
        const coleccionUrl = `https://thegreatpuzzleproject.com/colecciones/${categoria}`;

        const msgPublicado = [
          `✅ *¡Publicado con éxito en TGP Hemeroteca!*`,
          ``,
          `🏛️ **Ensayo Web:** [Abrir Ensayo en Hemeroteca](${postUrl})`,
          coverUrl ? `🖼️ **Storage R2:** [Ver Portada en Storage R2](${coverUrl})` : '',
          `📂 **Colección Destacada:** [Ver Colección](${coleccionUrl})`,
          `📦 **Commit GitHub:** [Ver Commit ${commitSha.slice(0, 7)}](${commitUrl})`,
          `📁 **Ruta:** \`src/content/ensayos-cinematicos/${slug}\``,
        ].filter(Boolean).join('\n');

        await sendTelegramMessage(chatId, botToken, msgPublicado);

        if (messageId) {
          await editMessageReplyMarkup(botToken, chatId, messageId, [
            [{ text: '✅ Publicado en Hemeroteca', callback_data: 'disabled' }],
          ]);
        }
      } catch (pubErr: any) {
        await sendTelegramMessage(chatId, botToken, `⚠️ Error en la publicación: ${pubErr?.message || pubErr}`);
      }
      return;
    }

    if (data === 'action:publicar_alternative' || data === 'ok_alternative') {
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '⏳ Publicando en Alternative...', callback_data: 'disabled' }],
        ]);
      }

      const session = await getCompanionSession(chatId, botIdentity);
      const essayContent = session.working_state.lastDraft ||
        session.recent_turns.filter(t => t.role === 'model').pop()?.parts?.map((p: any) => p.text).join('\n') || '';
      const titulo = session.working_state.lastTitle || 'Ensayo Alternative TGP';
      const coverUrl = session.working_state.lastImageUrl || 'https://storage.thegreatpuzzleproject.com/tgp-fallback.jpg';

      if (!essayContent) {
        await sendTelegramMessage(chatId, botToken, '⚠️ No encontré un ensayo para publicar.');
        return;
      }

      const { slug, contenidoMdoc } = generarMarkdoc({
        titulo,
        secciones: [{ parrafo: essayContent }],
      });

      const ghToken = process.env.GITHUB_TOKEN_ALTERNATIVE || process.env.GITHUB_TOKEN || '';
      const ghRepo = process.env.GITHUB_REPO || 'ygnatiux-sys/tgp-webfinal2026';

      try {
        const commitSha = await publicarEntradaKeystaticGitHub({
          coleccion: 'ensayos',
          slug,
          indexJson: {
            title: titulo,
            coverImage: coverUrl,
            category: 'historia-alternativa',
            generadorTexto: JSON.stringify({ text: contenidoMdoc, image: coverUrl }),
          },
          contentMdoc: contenidoMdoc,
          token: ghToken,
          repoFull: ghRepo,
          mensajeCommit: `docs(alternative): publicar ensayo "${titulo}" vía Compagnon Telegram`,
        });

        const commitUrl = `https://github.com/${ghRepo}/commit/${commitSha}`;
        const postUrl = `https://alternative.thegreatpuzzleproject.com/ensayos/${slug}`;
        const coleccionUrl = `https://thegreatpuzzleproject.com/historia-alternativa`;

        const msgPublicado = [
          `✅ *¡Publicado con éxito en TGP Alternative!*`,
          ``,
          `🏛️ **Ensayo Web:** [Abrir Ensayo en Alternative](${postUrl})`,
          coverUrl ? `🖼️ **Storage R2:** [Ver Portada en Storage R2](${coverUrl})` : '',
          `📂 **Colección Destacada:** [Ver Colección Alternative](${coleccionUrl})`,
          `📦 **Commit GitHub:** [Ver Commit ${commitSha.slice(0, 7)}](${commitUrl})`,
        ].filter(Boolean).join('\n');

        await sendTelegramMessage(chatId, botToken, msgPublicado);

        if (messageId) {
          await editMessageReplyMarkup(botToken, chatId, messageId, [
            [{ text: '✅ Publicado en Alternative', callback_data: 'disabled' }],
          ]);
        }
      } catch (pubErr: any) {
        await sendTelegramMessage(chatId, botToken, `⚠️ Error en la publicación: ${pubErr?.message || pubErr}`);
      }
      return;
    }

    if (data === 'action:post_facebook' || data === 'ok_facebook') {
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '⏳ Publicando en Facebook...', callback_data: 'disabled' }],
        ]);
      }

      const session = await getCompanionSession(chatId, botIdentity);
      const postText = session.working_state.lastDraft ||
        session.recent_turns.filter(t => t.role === 'model').pop()?.parts?.map((p: any) => p.text).join('\n') || '';
      const coverUrl = session.working_state.lastImageUrl || '';

      const resSocial = await ejecutarPublishSocial({
        tema: postText,
        red: 'facebook',
        motor: 'flash',
        url_imagen: coverUrl,
        chatId,
      });

      await sendTelegramMessage(chatId, botToken, resSocial);
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '✅ Publicado en Facebook', callback_data: 'disabled' }],
        ]);
      }
      return;
    }

    if (data === 'action:post_tiktok' || data === 'ok_tiktok') {
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '⏳ Publicando en TikTok...', callback_data: 'disabled' }],
        ]);
      }

      const session = await getCompanionSession(chatId, botIdentity);
      const postText = session.working_state.lastDraft ||
        session.recent_turns.filter(t => t.role === 'model').pop()?.parts?.map((p: any) => p.text).join('\n') || '';
      const coverUrl = session.working_state.lastImageUrl || '';

      const resSocial = await ejecutarPublishSocial({
        tema: postText,
        red: 'tiktok',
        motor: 'flash',
        url_imagen: coverUrl,
        chatId,
      });

      await sendTelegramMessage(chatId, botToken, resSocial);
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '✅ Publicado en TikTok', callback_data: 'disabled' }],
        ]);
      }
      return;
    }

    if (data === 'action:nanobanana') {
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId, [
          [{ text: '⏳ Generando portada Nano Banana...', callback_data: 'disabled' }],
        ]);
      }

      const session = await getCompanionSession(chatId, botIdentity);
      const title = session.working_state.lastTitle || 'Ensayo Cinemático TGP';

      try {
        const nanoRes = await nanoBananaTool.execute({
          title,
          concept: title,
          visualSensitivity: 'avant-garde',
          narrativeMode: 'historical-epic',
          historicalRigor: 'editorial',
          visualRisk: 'bold',
        });

        if (nanoRes?.imageUrl) {
          await updateWorkingState(chatId, botIdentity, { lastImageUrl: nanoRes.imageUrl });
          await sendTelegramPhoto(chatId, botToken, nanoRes.imageUrl, `🎨 *Portada Cinematográfica TGP*\n🎬 *"${title}"*\n🖼️ **Storage R2:** [Ver en R2](${nanoRes.imageUrl})`);
          if (messageId) {
            await editMessageReplyMarkup(botToken, chatId, messageId, [
              [{ text: '🎨 Portada generada', callback_data: 'disabled' }],
            ]);
          }
        } else {
          await sendTelegramMessage(chatId, botToken, '⚠️ No se pudo generar la imagen con Nano Banana.');
        }
      } catch (err: any) {
        await sendTelegramMessage(chatId, botToken, `⚠️ Error en Nano Banana: ${err?.message || err}`);
      }
      return;
    }

    // 2. Si pulsaron Confirmar genérico, congelar teclado
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
      await resetCompanionSession(chatId, botIdentity);
      await sendTelegramMessage(chatId, botToken, '🔄 Sesión reiniciada con éxito, che. ¿Qué investigamos o creamos hoy?');
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

  // ── Candado de Seguridad de Xavier Benítez ───────────────────────────────
  const userId: number = (msg.from?.id || chatId) as number;
  if (!isAuthorizedChatId(userId)) {
    // Si intenta autenticarse con la Clave Master Personal
    if (text.startsWith('/auth')) {
      const parts = text.split(/\s+/);
      const keyAttempt = parts[1] || '';
      const success = await authorizeChatWithKey(userId, keyAttempt);

      // Borrar el mensaje que contiene la clave inmediatamente por seguridad
      if (msg.message_id) {
        await deleteTelegramMessage(botToken, chatId, msg.message_id);
      }

      if (success) {
        await sendTelegramMessage(
          chatId,
          botToken,
          `🛡️ *Identidad Confirmada.*\n\nChat ID \`${userId}\` registrado como único dueño autorizado de TGP Mind. Todos los sistemas y herramientas han sido desbloqueados para vos.`
        );
      } else {
        console.warn(`[Webhook Seguridad] Intento fallido de /auth desde chat_id=${userId}`);
      }
      return;
    }

    // Usuario desconocido: ignorar silenciosamente en < 1ms para $0 costo y 0 llamadas a IA
    console.warn(`[Webhook Seguridad] Mensaje de usuario no autorizado (${userId}). Ignorando silenciosamente.`);
    return;
  }

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

  // ── Módulo Bóveda y Rescate de Posts (Comando y Lenguaje Natural) ──────────
  const isRecuperarIntent =
    /^\/(recuperar|historial|recientes|boveda)\b/i.test(text) ||
    /(recuperar|rescatar|mostrar|ver)\s+(mis\s+)?(posts|posteos|ensayos|historial|boveda|publicaciones)/i.test(text) ||
    /(que\s+posts\s+tengo|ultimos\s+posts|ultimos\s+ensayos)/i.test(text);

  if (isRecuperarIntent) {
    await handleRecuperarBoveda(chatId, botToken, botIdentity);
    return;
  }

  // ── ESCUDO R2: Interceptar foto ANTES de hablar con Gemini ────────────────
  // Turno D1 fusionado: [contexto R2 URL] + [caption del usuario]
  let imageContextPrefix = '';
  let fotoGuardadaEnD1   = false;
  let imageInlineData: { mimeType: string; data: string } | undefined;

  if (hasPhotos) {
    const bestPhoto = photos!.reduce((a, b) => (a.width > b.width ? a : b));

    try {
      console.log(`[Webhook R2] Subiendo foto file_id=${bestPhoto.file_id} (chat_id=${chatId})...`);
      const { url: r2Url, base64 } = await procesarFotoTelegramMultimodal(bestPhoto.file_id, 'telegram', botToken);
      console.log(`[Webhook R2] ✅ Imagen en R2: ${r2Url}`);

      imageContextPrefix = `[Sistema: Imagen recibida. URL permanente en R2: ${r2Url}. Usa esta URL como url_imagen en la Ficha Visual y en la Tool publish_social.]`;
      if (base64) {
        imageInlineData = { mimeType: 'image/webp', data: base64 };
      }

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

    // ── FLUJO CONTINUO (ERUDITO AGENT PARA ENSAYOS / MULTIMEDIA) ──────────────
    // Liminal deriva a EruditoAgent solo si se solicita explícitamente un ensayo (/ensayo, /pro, fotos, /publicar, /audio).
    // Para preguntas y respuestas, Panlingua o chat interactivo, fluye a processTelegramMessage.
    const isEnsayoExplicit = /^\/(ensayo|pro_breve|pro_medio|pro_premium|pro|flash)\b/i.test(text || '') ||
                             /modo pro|us[aá] pro|redacta un ensayo/i.test(text || '');
    const isPostProd = /^\/(publicar|publica|audio)\b/i.test(text || '');

    if (botIdentity === 'liminal' && (hasPhotos || isEnsayoExplicit || isPostProd)) {
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

        await sendTelegramMessage(chatId, botToken, '🎙️ Sintetizando audio documental con voz neuronal y chunking...');
        try {
          const audioRes = await generarAudioDocumentalR2(essayContent, 'Ensayo Documental TGP', chatId);
          if (audioRes.success && audioRes.audioUrl) {
            await sendTelegramNativeAudio({
              chatId,
              botToken,
              audioUrl: audioRes.audioUrl,
              title: 'Ensayo Documental TGP',
              performer: 'TGP Hemeroteca',
              caption: `🎧 **Ensayo Documental TGP**\n\n🔊 Reproductor nativo TGP\n🔗 [Descargar MP3 en Storage R2](${audioRes.audioUrl})`,
            });
          } else {
            await sendTelegramMessage(chatId, botToken, `⚠️ No se pudo sintetizar el audio: ${audioRes.error || 'Desconocido'}`);
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
        trazaFooter.push(`🏛️ **Hemeroteca:** Usá la botonera de abajo para publicar o escuchar este ensayo.`);
        textToSend += trazaFooter.join('\n');

        await sendTelegramMessage(chatId, botToken, textToSend, BOTONERA_ACCIONES_ENSAYO);
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

        // Auto-respaldo .bak.md en Cloudflare R2
        try {
          const slugBackup = cleanPrompt ? cleanPrompt.slice(0, 40).replace(/[^a-z0-9]/gi, '-') : 'ensayo-tgp';
          await guardarRespaldoMarkdownEnR2(slugBackup, textToSend);
        } catch (bakErr: any) {
          console.warn('[Auto-Respaldo R2] Aviso en backup .bak.md:', bakErr?.message);
        }
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
      let keyboard: InlineKeyboard | undefined;
      if (esFichaVisual(responseText)) {
        keyboard = botIdentity === 'redes' ? TECLADO_CONFIRMACION_REDES : TECLADO_CONFIRMACION_WEB;
      } else if (esEnsayoGenerado(responseText)) {
        keyboard = botIdentity === 'redes' ? BOTONERA_ACCIONES_REDES : BOTONERA_ACCIONES_ENSAYO;
        const slugBackup = userTextForAgent ? userTextForAgent.slice(0, 40).replace(/[^a-z0-9]/gi, '-') : 'ensayo-tgp';
        guardarRespaldoMarkdownEnR2(slugBackup, responseText).catch(() => {});
      }
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
