// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Handler de Comandos Telegram (/menu, /nuevo, /auth, /boveda, etc.)
// ─────────────────────────────────────────────────────────────────────────────
import { sendTelegramMessage } from '../telegram-client.js';
import {
  obtenerUltimosResguardosD1,
  clearChatHistory,
  getConversationHistory,
  registrarResguardoD1,
} from '../../storage/d1.js';
import {
  isAuthorizedChatId,
  authorizeChatWithKey,
  deleteTelegramMessage,
} from '../../security/master-auth.js';
import {
  MENUS_BY_BOT,
  getMenuTitle,
  type InlineKeyboard,
} from '../keyboards.js';
import { type BotIdentity } from '../../ia/agent.js';
import { generarMarkdoc, publicarEntradaKeystaticGitHub } from '../../servicios/publicacion.js';
import { generarAudioDocumentalR2, sendTelegramNativeAudio } from '../telegram-tts.js';

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

// ── Despachador de Comandos ──────────────────────────────────────────────────
export async function handleCommand(
  msg: any,
  botIdentity: BotIdentity,
  botToken: string,
): Promise<boolean> {
  const chatId: number = msg.chat.id;
  const rawText    = typeof msg.text    === 'string' ? msg.text.trim()    : '';
  const rawCaption = typeof msg.caption === 'string' ? msg.caption.trim() : '';
  const text       = rawText || rawCaption;
  const userId: number = (msg.from?.id || chatId) as number;

  // 1. Candado de Seguridad de Xavier Benítez
  if (!isAuthorizedChatId(userId)) {
    if (text.startsWith('/auth')) {
      const parts = text.split(/\s+/);
      const keyAttempt = parts[1] || '';
      const success = await authorizeChatWithKey(userId, keyAttempt);

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
      return true;
    }

    console.warn(`[Webhook Seguridad] Mensaje de usuario no autorizado (${userId}). Ignorando silenciosamente.`);
    return true; // Bloqueado, no continuar
  }

  // 2. Comandos de menú y herramientas
  if (text === '/menu' || text === '/tools') {
    await sendTelegramMessage(
      chatId, botToken,
      getMenuTitle(botIdentity),
      MENUS_BY_BOT[botIdentity],
    );
    return true;
  }

  // 3. Comandos de reinicio de sesión
  if (text.startsWith('/nuevo') || text.startsWith('/cancel') || text.startsWith('/reset')) {
    await clearChatHistory(chatId, botIdentity);
    await sendTelegramMessage(chatId, botToken, '🔄 Sesión reiniciada. ¿En qué te ayudo?');
    return true;
  }

  // 4. Módulo Bóveda y Rescate de Posts
  const isRecuperarIntent =
    /^\/(recuperar|historial|recientes|boveda)\b/i.test(text) ||
    /(recuperar|rescatar|mostrar|ver)\s+(mis\s+)?(posts|posteos|ensayos|historial|boveda|publicaciones)/i.test(text) ||
    /(que\s+posts\s+tengo|ultimos\s+posts|ultimos\s+ensayos)/i.test(text);

  if (isRecuperarIntent) {
    await handleRecuperarBoveda(chatId, botToken, botIdentity);
    return true;
  }

  // 5. Comandos de Post-Producción (/publicar y /audio) para Liminal
  const lowerText = text.toLowerCase().trim();
  if (botIdentity === 'liminal') {
    if (lowerText.startsWith('/publicar') || lowerText.startsWith('/publica')) {
      const history = await getConversationHistory(chatId, 6, botIdentity);
      const lastModelTurn = [...history].reverse().find(t => t.role === 'model');
      const essayContent = lastModelTurn?.parts?.map((p: any) => p.text).join('\n') || '';

      if (!essayContent) {
        await sendTelegramMessage(chatId, botToken, '⚠️ No encontré un ensayo reciente en la memoria para publicar. Generá uno primero.');
        return true;
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
      return true;
    }

    if (lowerText.startsWith('/audio')) {
      const history = await getConversationHistory(chatId, 6, botIdentity);
      const lastModelTurn = [...history].reverse().find(t => t.role === 'model');
      const essayContent = lastModelTurn?.parts?.map((p: any) => p.text).join('\n') || '';

      if (!essayContent) {
        await sendTelegramMessage(chatId, botToken, '⚠️ No hay un ensayo reciente para generar audio.');
        return true;
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
      return true;
    }
  }

  return false;
}
