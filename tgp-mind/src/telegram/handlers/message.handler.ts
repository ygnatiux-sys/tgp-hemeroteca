// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Handler de Mensajes Entrantes (Escudo R2, Peloteo & Erudito)
// ─────────────────────────────────────────────────────────────────────────────
import {
  procesarFotoTelegramMultimodal,
  guardarRespaldoMarkdownEnR2,
} from '../../services/media.service.js';
import {
  appendTurn,
  getConversationHistory,
  registrarResguardoD1,
} from '../../storage/d1.js';
import { processTelegramMessage, type BotIdentity } from '../../ia/agent.js';
import { EruditoAgent } from '../../core/agents/EruditoAgent.js';
import { wikimediaTool } from '../../core/tools/wikimediaTool.js';
import { nanoBananaTool } from '../../core/tools/nanoBananaTool.js';
import { updateWorkingState } from '../../storage/companion-memory.js';
import {
  sendTelegramMessage,
  sendTelegramPhoto,
} from '../telegram-client.js';
import {
  esFichaVisual,
  esEnsayoGenerado,
  TECLADO_CONFIRMACION_WEB,
  TECLADO_CONFIRMACION_REDES,
  BOTONERA_ACCIONES_REDES,
  buildPeloteoKeyboard,
  buildBotoneraAccionesEnsayo,
  type InlineKeyboard,
} from '../keyboards.js';

export async function handleIncomingMessage(
  msg: any,
  botIdentity: BotIdentity,
  botToken: string,
): Promise<void> {
  const chatId: number = msg.chat.id;

  // Extraer texto: msg.text o msg.caption
  const rawText    = typeof msg.text    === 'string' ? msg.text.trim()    : '';
  const rawCaption = typeof msg.caption === 'string' ? msg.caption.trim() : '';
  const text       = rawText || rawCaption;
  const textSource = rawText ? 'text' : rawCaption ? 'caption' : 'none';

  const photos    = msg.photo as Array<{ file_id: string; width: number; height: number }> | undefined;
  const hasPhotos = Array.isArray(photos) && photos.length > 0;

  console.log(`[Message Handler] chat_id=${chatId} bot=${botIdentity} src=${textSource} photo=${hasPhotos} text="${text.slice(0, 80)}"`);

  // ── ESCUDO R2: Interceptar foto ANTES de hablar con Gemini ────────────────
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
    console.warn(`[Message Handler] Mensaje vacío ignorado para chat_id=${chatId}`);
    return;
  }

  // ── Ejecución de IA / Peloteo / Erudito ────────────────────────────────────
  try {
    const textParaAgente = fotoGuardadaEnD1 ? '' : userTextForAgent;

    // ── FLUJO CONTINUO (ERUDITO AGENT PARA ENSAYOS / MULTIMEDIA) ──────────────
    const isEnsayoExplicit = /^\/(ensayo|pro_breve|pro_medio|pro_premium|pro|flash)\b/i.test(text || '') ||
                             /modo pro|us[aá] pro|redacta un ensayo/i.test(text || '');

    if (botIdentity === 'liminal' && (hasPhotos || isEnsayoExplicit)) {
      const erudito = new EruditoAgent(process.env.GEMINI_API_KEY || '');

      let userPrompt = text;
      let attachedPhotoUrl: string | null = null;
      if (hasPhotos && imageContextPrefix) {
        const match = imageContextPrefix.match(/https:\/\/[^\s\]]+/);
        if (match) attachedPhotoUrl = match[0];
      }

      if (!userPrompt && attachedPhotoUrl) {
        userPrompt = 'Analiza esta imagen y redacta un ensayo erudito magistral sobre su contexto histórico, arqueológico o simbólico.';
      }

      // Mapeo Estricto de Perfiles de Ejecución
      const isProBreve   = /^\/pro_breve\b/i.test(userPrompt);
      const isProMedio   = /^\/pro_medio\b/i.test(userPrompt);
      const isProPremium = /^\/pro_premium\b/i.test(userPrompt);
      const isProGeneric = /^\/pro\b/i.test(userPrompt);

      const wantsPro = isProBreve || isProMedio || isProPremium || isProGeneric ||
                       /modo pro|us[aá] pro/i.test(userPrompt);

      const cleanPrompt = userPrompt
        .replace(/^\/(pro_breve|pro_medio|pro_premium|pro|flash)\s*/i, '')
        .trim();

      if (!wantsPro) {
        // MODO "PELOTEO" PREVIO DIALÉCTICO (Flash @ 0.3)
        await appendTurn(chatId, 'user', [{ text: userPrompt }], botIdentity);

        const responseText = await processTelegramMessage(
          chatId,
          textParaAgente,
          botIdentity,
          fotoGuardadaEnD1 ? imageContextPrefix : undefined,
        );

        if (responseText) {
          let backupId = 'draft';
          try {
            const slugBackup = cleanPrompt
              ? cleanPrompt.slice(0, 30).replace(/[^a-z0-9]/gi, '-')
              : 'peloteo';
            const r2Res = await guardarRespaldoMarkdownEnR2(slugBackup, responseText);
            backupId = r2Res.backupId;
            await updateWorkingState(chatId, botIdentity, {
              lastDraft: responseText,
              lastTitle: cleanPrompt || 'Peloteo TGP',
              lastBackupId: backupId,
            });
          } catch (bakErr: any) {
            console.warn('[Auto-Respaldo R2] Aviso en backup efímero de peloteo:', bakErr?.message);
          }

          let keyboard: InlineKeyboard | undefined;
          if (esFichaVisual(responseText)) {
            keyboard = TECLADO_CONFIRMACION_WEB;
          } else if (esEnsayoGenerado(responseText)) {
            keyboard = buildBotoneraAccionesEnsayo(backupId);
          } else {
            keyboard = buildPeloteoKeyboard(backupId, { tema: cleanPrompt });
          }

          await sendTelegramMessage(chatId, botToken, responseText, keyboard);
        }
        return;
      }

      // Guardar el turno del usuario en D1
      await appendTurn(chatId, 'user', [{ text: userPrompt }], botIdentity);
      const baseHistory = await getConversationHistory(chatId, 10, botIdentity);

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

      // Bucle Flujo Continuo: Ejecutar herramienta visual de inmediato
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

        if (generatedPhotoUrl && !generatedPhotoUrl.startsWith('data:')) {
          const photoCaption = toolName === 'search_wikimedia_photo'
            ? `🏛️ *Fotografía Histórica (Wikimedia Commons)*\n📌 *${toolArgs?.query || cleanPrompt}*`
            : `🎨 *Portada Cinematográfica TGP*\n🎬 *"${toolArgs?.title || cleanPrompt}"*`;
          await sendTelegramPhoto(chatId, botToken, generatedPhotoUrl, photoCaption);
        }

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

      // Entrega del ensayo terminado + Resguardo Documental en D1
      if (response.status === 'COMPLETED') {
        let textToSend = response.content || '';
        const finalImageUrl = attachedPhotoUrl || generatedPhotoUrl;

        const trazaFooter: string[] = ['\n\n---'];
        if (finalImageUrl) {
          trazaFooter.push(`🖼️ **Storage R2:** [Ver Imagen Original en Storage R2](${finalImageUrl})`);
        }
        trazaFooter.push(`🏛️ **Hemeroteca:** Usá la botonera de abajo para publicar o escuchar este ensayo.`);
        textToSend += trazaFooter.join('\n');

        let backupId = 'ensayo-pro';
        try {
          const slugBackup = cleanPrompt ? cleanPrompt.slice(0, 40).replace(/[^a-z0-9]/gi, '-') : 'ensayo-tgp';
          const r2Res = await guardarRespaldoMarkdownEnR2(slugBackup, textToSend);
          backupId = r2Res.backupId;
          await updateWorkingState(chatId, botIdentity, {
            lastDraft: textToSend,
            lastTitle: cleanPrompt,
            lastBackupId: backupId,
          });
        } catch (bakErr: any) {
          console.warn('[Auto-Respaldo R2] Aviso en backup .bak.md:', bakErr?.message);
        }

        await sendTelegramMessage(chatId, botToken, textToSend, buildBotoneraAccionesEnsayo(backupId));
        await appendTurn(chatId, 'model', [{ text: textToSend }], botIdentity);

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

    // ── FLUJO CONVERSACIONAL GENERAL (OMNI, ASSISTANT, REDES, LIMINAL GENERAL) ─
    const responseText = await processTelegramMessage(
      chatId,
      textParaAgente,
      botIdentity,
      fotoGuardadaEnD1 ? imageContextPrefix : undefined,
    );

    if (responseText) {
      let backupId = 'draft';
      try {
        const slugBackup = userTextForAgent
          ? userTextForAgent.slice(0, 30).replace(/[^a-z0-9]/gi, '-')
          : 'peloteo';
        const r2Res = await guardarRespaldoMarkdownEnR2(slugBackup, responseText);
        backupId = r2Res.backupId;
        await updateWorkingState(chatId, botIdentity, {
          lastDraft: responseText,
          lastTitle: userTextForAgent || 'Peloteo TGP',
          lastBackupId: backupId,
        });
      } catch (bakErr: any) {
        console.warn('[Auto-Respaldo R2] Aviso en backup efímero general:', bakErr?.message);
      }

      let keyboard: InlineKeyboard | undefined;
      if (esFichaVisual(responseText)) {
        keyboard = botIdentity === 'redes' ? TECLADO_CONFIRMACION_REDES : TECLADO_CONFIRMACION_WEB;
      } else if (esEnsayoGenerado(responseText)) {
        keyboard = botIdentity === 'redes' ? BOTONERA_ACCIONES_REDES : buildBotoneraAccionesEnsayo(backupId);
      } else {
        keyboard = buildPeloteoKeyboard(backupId, { tema: userTextForAgent });
      }
      await sendTelegramMessage(chatId, botToken, responseText, keyboard);
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[Message Handler] ❌ CRASH — chat_id=${chatId}: ${errMsg}`);
    console.error('[Message Handler] Stack:', err?.stack || '(sin stack)');
    try {
      (await import('node:fs')).appendFileSync('../scratch/bot_error.log', new Date().toISOString() + ' MSG Error: ' + (err?.stack || errMsg) + '\n');
    } catch (e) {}
    await sendTelegramMessage(
      chatId,
      botToken,
      '⚠️ Hubo un error al procesar tu solicitud. Intenta de nuevo.',
    );
  }
}
