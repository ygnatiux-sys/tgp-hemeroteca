// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Handler de Callbacks Inline (Action Bento, Submenús & RAG)
// ─────────────────────────────────────────────────────────────────────────────
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  sendTelegramMessage,
  sendTelegramPhoto,
  telegramPost,
} from '../telegram-client.js';
import {
  buildPeloteoKeyboard,
  buildSubmenuTallerDesk,
  buildBotoneraAccionesEnsayo,
  BOTONERA_ACCIONES_REDES,
  BOTONERA_ACCIONES_ENSAYO,
  TECLADO_CONFIRMACION,
  MENUS_BY_BOT,
  getMenuTitle,
  esFichaVisual,
  type InlineKeyboard,
} from '../keyboards.js';
import { consultarSilosRAG } from '../../services/archive-rag.service.js';
import { crearBorradorKeystatic } from '../../services/github-keystatic.service.js';
import { generateProductionEssay } from '../../services/gemini.service.js';
import { guardarRespaldoMarkdownEnR2 } from '../../services/media.service.js';
import {
  getCompanionSession,
  updateWorkingState,
  resetCompanionSession,
} from '../../storage/companion-memory.js';
import { obtenerResguardoPorIdD1 } from '../../storage/d1.js';
import { generarAudioDocumentalR2, sendTelegramNativeAudio } from '../telegram-tts.js';
import { generarMarkdoc, publicarEntradaKeystaticGitHub } from '../../servicios/publicacion.js';
import { ejecutarPublishSocial } from '../../ia/tools/tool-publish-social.js';
import { nanoBananaTool } from '../../core/tools/nanoBananaTool.js';
import { processTelegramMessage, type BotIdentity } from '../../ia/agent.js';
import { isAuthorizedChatId } from '../../security/master-auth.js';

export async function handleCallbackQuery(
  cq: any,
  botIdentity: BotIdentity,
  botToken: string,
): Promise<void> {
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
    console.warn(`[Callback Handler] Usuario no autorizado: ${userId}.`);
    await answerCallbackQuery(botToken, cqId, '⛔ Acceso restringido.', true);
    return;
  }

  // Botón deshabilitado durante ejecución
  if (data === 'disabled' || data === 'noop') {
    await answerCallbackQuery(botToken, cqId, '⏳ La tarea ya está en proceso...', false);
    return;
  }

  console.log(`[Callback Handler] chat_id=${chatId} bot=${botIdentity} callback_data="${data}"`);

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
  } else if (data.startsWith('action:rag_firebase')) {
    toastText = '📚 Consultando Firestore RAG y biblioteca de archivo...';
  } else if (data.startsWith('action:escalate_pro')) {
    toastText = '🧠 Consolidando ensayo con Gemini 2.5 Pro...';
  } else if (data.startsWith('action:commit_keystatic')) {
    toastText = '📝 Creando borrador en Keystatic (GitHub GitOps)...';
  }

  // Enviar cartel Toast inmediato (< 10s requerido por Telegram) para evitar el spinner infinito
  await answerCallbackQuery(botToken, cqId, toastText, false);

  // ── SUBMENÚ DESPLEGABLE INLINE ARROWS (TALLER DESK) ─────────────────────
  // Usa la propiedad `url` nativa de la API de Telegram para navegar a la web
  if (data === 'menu:taller_desk' || data.startsWith('menu:taller_desk:')) {
    const backupId = data.startsWith('menu:taller_desk:')
      ? data.slice('menu:taller_desk:'.length)
      : ((await getCompanionSession(chatId, botIdentity)).working_state?.lastBackupId || 'draft');
    await telegramPost(botToken, 'editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: buildSubmenuTallerDesk(backupId) },
    });
    return;
  }
  if (data === 'menu:collapse_taller' || data.startsWith('menu:collapse_taller:')) {
    const backupId = data.startsWith('menu:collapse_taller:')
      ? data.slice('menu:collapse_taller:'.length)
      : ((await getCompanionSession(chatId, botIdentity)).working_state?.lastBackupId || 'draft');
    const keyboard = buildPeloteoKeyboard(backupId);
    await telegramPost(botToken, 'editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    });
    return;
  }

  // ── ACCIÓN 1: RAG DE FIREBASE Y BIBLIOTECA ALTERNATIVA ───────────────────
  if (data === 'action:rag_firebase') {
    if (messageId) {
      await editMessageReplyMarkup(botToken, chatId, messageId, [
        [{ text: '⏳ Cruzando fuentes con Firestore RAG y Biblioteca Alternativa...', callback_data: 'disabled' }],
      ]);
    }

    const session = await getCompanionSession(chatId, botIdentity);
    const query = session.working_state.lastTitle ||
      session.working_state.lastDraft?.slice(0, 80) ||
      'Arqueología Heterodoxa y Anomalías';

    await sendTelegramMessage(chatId, botToken, `📚 *Crucero RAG en marcha:* Buscando en silos Firestore y biblioteca alternativa para "${query}"...`);

    const ragRes = await consultarSilosRAG(query);
    const ragPrompt = `Cruce RAG para enriquecer y confrontar la hipótesis:
Tema: "${query}"
Fuentes de archivo: ${ragRes.fuentes.join(', ')}

[Silos de Archivo Consultados]:
${ragRes.silosXML}

Integra estos datos en el peloteo dialéctico con Xavier Benítez: contrasta la evidencia empírica con la hipótesis alternativa, manteniendo el filo analítico somático.`;

    const responseText = await processTelegramMessage(chatId, ragPrompt, botIdentity);

    let backupId = session.working_state.lastBackupId || 'draft';
    try {
      const slug = query.slice(0, 30).replace(/[^a-z0-9]/gi, '-');
      const r2Res = await guardarRespaldoMarkdownEnR2(slug, responseText);
      backupId = r2Res.backupId;
      await updateWorkingState(chatId, botIdentity, {
        lastDraft: responseText,
        lastTitle: query,
        lastBackupId: backupId,
      });
    } catch (err: any) {
      console.warn('[R2 Peloteo] Error en respaldo efímero RAG:', err?.message);
    }

    await sendTelegramMessage(chatId, botToken, responseText, buildPeloteoKeyboard(backupId, { tema: query }));
    return;
  }

  // ── ACCIÓN 2: ESCALAR A GEMINI 2.5 PRO (CONSOLIDACIÓN DE ENSAYO) ────────
  if (data === 'action:escalate_pro') {
    if (messageId) {
      await editMessageReplyMarkup(botToken, chatId, messageId, [
        [{ text: '⏳ Consolidando ensayo con Gemini 2.5 Pro (Razonamiento Profundo)...', callback_data: 'disabled' }],
      ]);
    }

    const session = await getCompanionSession(chatId, botIdentity);
    const draftBase = session.working_state.lastDraft ||
      session.recent_turns.filter(t => t.role === 'model').pop()?.parts?.map((p: any) => p.text).join('\n') || '';
    const titulo = session.working_state.lastTitle || 'Ensayo Pro TGP';

    if (!draftBase) {
      await sendTelegramMessage(chatId, botToken, '⚠️ No encontré un borrador o peloteo previo para consolidar.');
      return;
    }

    await sendTelegramMessage(chatId, botToken, `🧠 *Consolidando ensayo en Gemini 2.5 Pro:* Procesando "${titulo}" con arquitectura en 7 pasos y rigor estratigráfico...`);

    try {
      const essayPro = await generateProductionEssay(
        titulo,
        `Consolida este peloteo dialéctico en un ensayo formal de alta divulgación para TGP Hemeroteca:\n\n${draftBase}`
      );

      // Guardar invisiblemente el estado en Cloudflare R2
      const slug = titulo.slice(0, 30).replace(/[^a-z0-9]/gi, '-');
      const { backupId, url: r2Url } = await guardarRespaldoMarkdownEnR2(slug, essayPro);

      await updateWorkingState(chatId, botIdentity, {
        lastDraft: essayPro,
        lastTitle: titulo,
        lastBackupId: backupId,
      });

      const footer = `\n\n---\n🏛️ **TGP Hemeroteca — Ensayo Consolidado 2.5 Pro**\n💾 **Respaldo R2:** [Ver .bak.md en R2](${r2Url})`;
      const fullText = essayPro + footer;

      // Envío con validación de Chunking Anti-Colapso (>4000 caracteres se divide por párrafos)
      await sendTelegramMessage(chatId, botToken, fullText, buildBotoneraAccionesEnsayo(backupId));
    } catch (proErr: any) {
      console.error('[Escalate Pro Error]:', proErr);
      await sendTelegramMessage(chatId, botToken, `⚠️ Error consolidando ensayo con 2.5 Pro: ${proErr?.message || proErr}`);
    }
    return;
  }

  // ── ACCIÓN 3: GUARDAR BORRADOR EN KEYSTATIC VIA GITOPS ──────────────────
  if (data === 'action:commit_keystatic') {
    if (messageId) {
      await editMessageReplyMarkup(botToken, chatId, messageId, [
        [{ text: '⏳ Creando borrador en Keystatic (GitHub GitOps)...', callback_data: 'disabled' }],
      ]);
    }

    const session = await getCompanionSession(chatId, botIdentity);
    const draftBase = session.working_state.lastDraft ||
      session.recent_turns.filter(t => t.role === 'model').pop()?.parts?.map((p: any) => p.text).join('\n') || '';
    const titulo = session.working_state.lastTitle || 'Borrador TGP ' + new Date().toISOString().slice(0, 10);
    const coverUrl = session.working_state.lastImageUrl || null;

    if (!draftBase) {
      await sendTelegramMessage(chatId, botToken, '⚠️ No hay borrador en la memoria para enviar a Keystatic.');
      return;
    }

    await sendTelegramMessage(chatId, botToken, `📝 *Creando borrador tipado para Keystatic en GitHub...*`);

    try {
      const commitRes = await crearBorradorKeystatic({
        titulo,
        contenido: draftBase,
        categoria: session.working_state.lastCollection || 'Arqueosemiótica',
        coverImage: coverUrl,
        coleccion: 'ensayos',
      });

      const msgKeystatic = [
        `✅ *¡Borrador guardado con éxito en Keystatic!*`,
        ``,
        `📝 **Título:** "${titulo}"`,
        `📁 **Colección:** \`src/content/ensayos/${commitRes.slug}\``,
        `📦 **Commit GitHub:** [Ver Commit ${commitRes.commitSha.slice(0, 7)}](${commitRes.commitUrl})`,
        `🏛️ **CMS Keystatic:** [Abrir Borrador en Keystatic Admin](${commitRes.keystaticUrl})`,
        ``,
        `_El archivo fue tipado estrictamente (date: YYYY-MM-DD, draft: true) para que Keystatic lo cargue de inmediato._`,
      ].join('\n');

      await sendTelegramMessage(chatId, botToken, msgKeystatic);
    } catch (ghErr: any) {
      console.error('[Keystatic Commit Error]:', ghErr);
      await sendTelegramMessage(chatId, botToken, `⚠️ Error al crear borrador en Keystatic: ${ghErr?.message || ghErr}`);
    }
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
    await sendTelegramMessage(chatId, botToken, responseText, BOTONERA_ACCIONES_REDES);
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
      }
    } catch (nanoErr: any) {
      await sendTelegramMessage(chatId, botToken, `⚠️ Error en Nano Banana: ${nanoErr?.message || nanoErr}`);
    }
    return;
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
    console.error(`[Callback Handler] ❌ CRASH — chat_id=${chatId}: ${errMsg}`);
    if (data === 'ok' && messageId) {
      await editMessageReplyMarkup(botToken, chatId, messageId, [
        [{ text: '⚠️ Error en la generación', callback_data: 'disabled' }],
      ]);
    }
    await sendTelegramMessage(chatId, botToken, '⚠️ Hubo un error al procesar la confirmación. Por favor intentá de nuevo.');
  }
}
