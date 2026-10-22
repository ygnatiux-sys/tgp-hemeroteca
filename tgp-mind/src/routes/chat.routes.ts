// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Rutas de Google Chat y Dialogflow CX Webhooks
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { wikimediaTool } from '../core/tools/wikimediaTool.js';
import { runChatOrchestrator } from '../chat/orchestrator.js';
import { buildGoogleChatCardV2 } from '../chat/cards-v2-builder.js';
import { detectarAdjuntoImagen, procesarImagenGoogleChatAR2 } from '../chat/chat-attachment-service.js';
import { sendAsyncGoogleChatCard, setLastKnownChatSpace } from '../chat/async-chat-notifier.js';
import { estandarizarYSubirImagenAR2 } from '../storage/r2.js';
import { generarSlug, publicarEntradaKeystaticGitHub } from '../servicios/publicacion.js';
import { SITE_ID, IS_ALTERNATIVE, GITHUB_REPO, GITHUB_TOKEN, SITE_DOMAIN } from '../config/site.js';

export const chatRoutes = new Hono();

// ── Dialogflow CX Custom Tool: Wikimedia Commons ─────────────────────────────
chatRoutes.post('/cx-tool-wikimedia', async (c) => {
  try {
    const body = await c.req.json();
    const query = body.query;
    console.log('[CX-Wikimedia] Query recibida:', query);

    if (!query) {
      return c.json({ success: false, error: 'Query is required' }, 400);
    }

    const toolResult = await wikimediaTool.execute({ query });
    console.log('[CX-Wikimedia] Resultado:', JSON.stringify(toolResult));

    return c.json({
      images: toolResult.results || [],
      message: toolResult.success ? 'Imágenes encontradas' : 'Sin resultados',
    });
  } catch (error: any) {
    console.error('[CX Tool Error] Wikimedia:', error);
    return c.json({ success: false, error: error?.message || 'Error interno en la búsqueda' }, 500);
  }
});

// ── Dialogflow CX Custom Tool: Panlingua D1 ───────────────────────────────────
chatRoutes.post('/cx-tool-panlingua', async (c) => {
  try {
    const body = await c.req.json();
    const { intent, language, concept, macroarea, limit } = body;
    console.log('[CX-Panlingua] Query recibida:', JSON.stringify({ intent, language, concept, macroarea }));

    if (!intent) {
      return c.json({ success: false, error: '"intent" is required' }, 400);
    }

    const { ejecutarQueryPanlingua } = await import('../ia/tools/tool-panlingua.js');
    const result = await ejecutarQueryPanlingua({ intent, language, concept, macroarea, limit });

    return c.json({ success: true, result });
  } catch (error: any) {
    console.error('[CX Tool Error] Panlingua:', error);
    return c.json({ success: false, error: error?.message || 'Error interno Panlingua' }, 500);
  }
});

// ── Helper de formateo estricto para Google Workspace Add-ons (DataActions) ──
const formatGSuiteAddonResponse = (text: string, cardsV2?: any[]) => ({
  hostAppDataAction: {
    chatDataAction: {
      createMessageAction: {
        message: {
          text,
          ...(cardsV2 && cardsV2.length > 0 ? { cardsV2 } : {}),
        },
      },
    },
  },
});

// ── Handler de Webhook Google Chat & Dialogflow CX ───────────────────────────
const handleChatWebhook = async (c: any) => {
  let cleanText = '';
  let userName = 'Director';
  let isGSuiteAddon = false;
  let isGoogleChat = false;

  try {
    const body = await c.req.json().catch(() => ({}));
    const userAgent = String(c.req.header('user-agent') || '');

    // Detección precisa del cliente emisor
    isGSuiteAddon =
      userAgent.includes('Google-gsuiteaddons') ||
      !!body.commonEventObject ||
      !!body.chat;

    isGoogleChat =
      isGSuiteAddon ||
      userAgent.includes('Google-Chat') ||
      !!c.req.header('x-goog-chat-app-id') ||
      !!body.space ||
      !!body.message;

    // 0. Detección de acción interactiva de botones en Google Chat (Cards V2 DataActions)
    const invokedFunction =
      body.commonEventObject?.invokedFunction ||
      body.action?.actionMethodName ||
      '';

    if (invokedFunction === 'publish_draft_now') {
      const rawParams = body.commonEventObject?.parameters || body.action?.parameters || {};
      const params: Record<string, string> = {};
      if (Array.isArray(rawParams)) {
        for (const p of rawParams) {
          if (p.key) params[p.key] = p.value;
        }
      } else if (typeof rawParams === 'object') {
        Object.assign(params, rawParams);
      }

      const pTitle = params.title || 'Ensayo TGP';
      const pSlug = params.slug || generarSlug(pTitle);
      const pSilo: 'alternative' | 'hemeroteca' = params.silo === 'hemeroteca' ? 'hemeroteca' : (IS_ALTERNATIVE ? 'alternative' : 'hemeroteca');
      const pHero = params.heroImageUrl || '';
      const pContent = params.content || 'Ensayo forjado desde Dialogflow / Google Chat.';

      console.log(`[Chat Action] 🚀 Confirmada publicación interactiva para "${pTitle}" (${pSilo})...`);

      const isAlt = pSilo === 'alternative' || IS_ALTERNATIVE;
      const targetRepo = isAlt
        ? (IS_ALTERNATIVE ? GITHUB_REPO : (process.env.GITHUB_REPO_ALTERNATIVE || 'ygnatiux-sys/tgp-webfinal2026'))
        : GITHUB_REPO;

      const githubToken = isAlt
        ? (process.env.GITHUB_TOKEN_ALTERNATIVE || GITHUB_TOKEN)
        : GITHUB_TOKEN;

      const fechaHoy = new Date().toISOString().split('T')[0];
      const indexJson = {
        title: pTitle,
        date: fechaHoy,
        coverImage: pHero,
        excerpt: pContent.slice(0, 200),
        author: 'Xavier Benítez',
      };

      const contentMdoc = `---
title: "${pTitle.replace(/"/g, '\\"')}"
date: "${fechaHoy}"
coverImage: "${pHero}"
excerpt: "${pContent.slice(0, 200).replace(/"/g, '\\"')}"
---

${pHero ? `![${pTitle}](${pHero})\n\n` : ''}${pContent}
`;

      let commitUrl = '';
      let pubError = '';
      try {
        commitUrl = await publicarEntradaKeystaticGitHub({
          coleccion: isAlt ? 'ensayos' : 'ensayos-cinematicos',
          slug: pSlug,
          indexJson,
          contentMdoc,
          token: githubToken,
          repoFull: targetRepo,
          mensajeCommit: `TGP Mind: Entrada ${pTitle} aprobada desde Google Chat`,
        });
      } catch (e: any) {
        pubError = e?.message || String(e);
      }

      const isPublished = !!commitUrl && !pubError;
      const successCard = buildGoogleChatCardV2({
        status: isPublished ? 'published' : 'error',
        title: pTitle,
        subtitle: `Publicación confirmada por Xavier en ${pSilo.toUpperCase()}`,
        silo: pSilo,
        excerpt: pContent.slice(0, 280),
        heroImageUrl: pHero,
        slug: pSlug,
        publicUrl: isAlt
          ? `https://alternative.thegreatpuzzleproject.com/ensayos/${pSlug}`
          : `https://thegreatpuzzleproject.com/hemeroteca/${pSlug}`,
        r2Url: pHero,
        githubUrl: commitUrl || `https://github.com/${targetRepo}`,
        errorMessage: pubError || undefined,
      });

      const ackText = isPublished
        ? `✅ ¡Publicado con éxito en ${pSilo.toUpperCase()}!`
        : `❌ Error al publicar: ${pubError}`;

      if (isGSuiteAddon) {
        return c.json(formatGSuiteAddonResponse(ackText, successCard.cardsV2));
      }
      return c.json({ text: ackText, cardsV2: successCard.cardsV2 });
    }

    const rawText =
      body.chat?.messagePayload?.message?.text ||
      body.tema ||
      body.texto ||
      body.comando ||
      body.prompt ||
      body.query ||
      body.text ||
      body.transcript ||
      body.message?.text ||
      body.message ||
      '';

    userName =
      body.chat?.messagePayload?.message?.sender?.displayName ||
      body.user?.displayName ||
      body.message?.sender?.displayName ||
      'Director';

    cleanText = String(rawText)
      .replace(/<users\/[^>]+>\s*/g, '')
      .replace(/^@tgp\s+mind\s+as[eé]sor\s+for\s+XB\s*/gi, '')
      .replace(/^@[\w\s.-]+?\s+(?=(?:me|como|hace|hola|que|quien|cuando|che|por|sube|crea|publica|brief|[a-z0-9]))/i, '')
      .replace(/^@\S+\s+/, '')
      .trim();

    if (!cleanText) {
      const emptyMsg =
        '¡Hola, Xavier! Soy el asistente orquestador de TGP Mind. Puedes pedirme en lenguaje natural briefs sobre arqueología alternativa, procesar imágenes a WebP en R2 o redactar publicaciones para Alternative o Hemeroteca.';
      if (body.intentInfo || body.fulfillmentInfo || body.sessionInfo) {
        return c.json({ fulfillmentResponse: { messages: [{ text: { text: [emptyMsg] } }] } });
      }
      if (isGSuiteAddon) {
        return c.json(formatGSuiteAddonResponse(emptyMsg));
      }
      return c.json({ text: emptyMsg });
    }

    // 1. Detección y procesamiento de imágenes adjuntas en Google Chat
    const adjuntoDetectado = detectarAdjuntoImagen(body, String(rawText));
    let attachedImageUrl: string | undefined;

    if (adjuntoDetectado.tipo) {
      console.log(`[Chat Webhook] Imagen adjunta detectada (${adjuntoDetectado.tipo}). Procesando a R2...`);
      try {
        const r2Url = await procesarImagenGoogleChatAR2(adjuntoDetectado, cleanText || 'post-cover');
        if (r2Url) {
          attachedImageUrl = r2Url;
          console.log(`[Chat Webhook] ✅ Portada adjunta subida a R2: ${attachedImageUrl}`);
        }
      } catch (attErr: any) {
        console.warn('[Chat Webhook] Error procesando imagen adjunta a R2:', attErr?.message);
      }
    }

    const sessionId =
      body.chat?.messagePayload?.message?.space?.name ||
      body.space?.name ||
      body.chat?.messagePayload?.message?.thread?.name ||
      body.message?.thread?.name ||
      body.sessionInfo?.session ||
      'googlechat_space';

    const spaceName =
      body.chat?.messagePayload?.message?.space?.name ||
      body.space?.name ||
      body.message?.space?.name;

    if (spaceName) {
      setLastKnownChatSpace(spaceName);
    }

    const threadName =
      body.chat?.messagePayload?.message?.thread?.name ||
      body.message?.thread?.name;

    console.log(`[Chat Webhook] Recibido mensaje de ${userName} (${sessionId}): "${cleanText.slice(0, 80)}"`);

    // 2. Ejecutar el orquestador (con la portada adjunta inyectada para omitir tools lentas de IA)
    const orchestration = await runChatOrchestrator(cleanText, {
      user: userName,
      channel: 'google-chat',
      sessionId,
      attachedImageUrl,
    });
    const responseText = orchestration.text;

    // 3. Respaldo asíncrono anti-timeout: enviar la Card V2 vía REST API en background
    if (spaceName && orchestration.cardV2) {
      sendAsyncGoogleChatCard({
        spaceName,
        threadName,
        cardV2: orchestration.cardV2,
        fallbackText: responseText,
      }).catch((asyncErr) => console.warn('[AsyncNotifier] Aviso en respaldo asíncrono:', asyncErr?.message));
    }

    // 4. Formato de respuesta estricto según el cliente emisor:
    // A. Para Google Workspace Add-ons (estricto DataActions para Protobuf)
    if (isGSuiteAddon) {
      return c.json(formatGSuiteAddonResponse(responseText, orchestration.cardV2?.cardsV2));
    }

    // B. Para Google Chat directo clásico (sin wrapper de Add-on)
    if (isGoogleChat) {
      const chatResponse: any = {
        text: responseText,
      };
      if (orchestration.cardV2?.cardsV2) {
        chatResponse.cardsV2 = orchestration.cardV2.cardsV2;
      }
      return c.json(chatResponse);
    }

    // C. Para Dialogflow CX (OpenAPI Tool + Fulfillment):
    const dfResponse: any = {
      ok: true,
      titulo: orchestration.editorialBrief?.cleanTitle || 'Entrega TGP Mind',
      url: orchestration.metadata?.publicUrl || '',
      imageUrl: orchestration.metadata?.heroImageUrl || attachedImageUrl || '',
      imageSource: attachedImageUrl ? 'adjunto_usuario' : 'generada_ia',
      githubUrl: orchestration.metadata?.githubUrl || '',
      mensaje: responseText,
      text: responseText,
    };

    if (orchestration.cardV2) {
      dfResponse.fulfillmentResponse = {
        messages: [
          { text: { text: [responseText] } },
          { payload: orchestration.cardV2 },
        ],
      };
    } else {
      dfResponse.fulfillmentResponse = {
        messages: [{ text: { text: [responseText] } }],
      };
    }

    return c.json(dfResponse);
  } catch (err: any) {
    console.error('[Chat Webhook Error]:', err);

    // En caso de error, Google Chat recibe una Card V2 diagnóstica para NUNCA quedar en silencio
    const errorCard = buildGoogleChatCardV2({
      status: 'error',
      title: 'Incidencia en Proceso Editorial',
      subtitle: cleanText ? `Prompt: "${cleanText.slice(0, 60)}..."` : 'Solicitud no procesada',
      errorMessage: err?.message || 'Error inesperado durante la ejecución en TGP Mind.',
    });

    const errorMsg = `⚠️ Ocurrió una incidencia al procesar tu solicitud: ${err?.message || err}`;

    if (isGSuiteAddon) {
      return c.json(formatGSuiteAddonResponse(errorMsg, errorCard.cardsV2));
    }

    if (isGoogleChat) {
      return c.json({
        text: errorMsg,
        cardsV2: errorCard.cardsV2,
      });
    }

    return c.json({
      ok: false,
      mensaje: errorMsg,
      text: errorMsg,
      cardsV2: errorCard.cardsV2,
      fulfillmentResponse: {
        messages: [
          { text: { text: [errorMsg] } },
          { payload: errorCard },
        ],
      },
    });
  }
};

chatRoutes.post('/api/chat/webhook', handleChatWebhook);
chatRoutes.post('/webhook/chat', handleChatWebhook);
chatRoutes.post('/google-chat-webhook', handleChatWebhook);
chatRoutes.post('/webhook', handleChatWebhook);

// Respuestas GET para inspección de salud
const handleGetHealth = (c: any) =>
  c.json({
    status: 'online',
    service: 'tgp-mind-chat',
    siteId: SITE_ID,
    role: 'Google Workspace Add-on & Chat Webhook',
    methodExpected: 'POST',
    description: 'Endpoint receptor de eventos y tarjetas interactivas de Google Chat.',
    ts: new Date().toISOString(),
  });

chatRoutes.get('/webhook', handleGetHealth);
chatRoutes.get('/webhook/chat', handleGetHealth);
chatRoutes.get('/google-chat-webhook', handleGetHealth);
chatRoutes.get('/api/chat/webhook', handleGetHealth);

// ── Ingesta desde Dialogflow CX Messenger (Mesa de Redacción) ─────────────────
const handleCxSubmitDraft = async (c: any) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const isCxWebhook = !!body.sessionInfo || !!body.fulfillmentInfo;

    const params = body.sessionInfo?.parameters || {};
    const title = String(params.title || params.titulo || body.title || body.titulo || '').trim();
    const content = String(params.content || params.contenido || params.texto || body.content || body.contenido || body.texto || '').trim();
    const author = String(params.author || params.autor || body.author || body.autor || 'Xavier Benítez').trim();
    const targetProject = String(params.target_project || params.proyecto || body.target_project || body.targetProject || '').trim();
    const queryImagen = String(params.query_imagen || params.imagen || body.query_imagen || body.queryImagen || title).trim();

    if (!title && !content) {
      const errTxt = 'Faltan campos requeridos (title y content) para procesar el ensayo.';
      if (isCxWebhook) {
        return c.json({
          fulfillmentResponse: {
            messages: [{ text: { text: [errTxt] } }],
          },
        });
      }
      return c.json({ error: errTxt }, 400);
    }

    const postTitle = title || 'Ensayo TGP sin título';
    const slug = generarSlug(postTitle);
    const isAlt = targetProject.toLowerCase().includes('alternative') || IS_ALTERNATIVE;
    const silo: 'alternative' | 'hemeroteca' = isAlt ? 'alternative' : 'hemeroteca';

    console.log(`[CX Submit Draft] Ingesta recibida: "${postTitle}" por ${author} (Destino: ${silo})`);

    // 1. Buscar imagen en Wikimedia Commons y subirla en WebP a Cloudflare R2
    let heroImageUrl: string | undefined;
    if (queryImagen) {
      try {
        let wikiUrl: string | undefined;
        if (queryImagen.startsWith('http://') || queryImagen.startsWith('https://')) {
          wikiUrl = queryImagen;
          console.log(`[CX Submit Draft] URL de imagen provista directamente: ${wikiUrl}. Subiendo a R2...`);
        } else {
          console.log(`[CX Submit Draft] Buscando imagen en Wikimedia para "${queryImagen}"...`);
          const wikiRes = await wikimediaTool.execute({ query: queryImagen });
          if (wikiRes.success && Array.isArray(wikiRes.results) && wikiRes.results.length > 0) {
            wikiUrl = wikiRes.results[0].url;
            console.log(`[CX Submit Draft] Imagen encontrada en Wikimedia: ${wikiUrl}. Subiendo a R2...`);
          }
        }

        if (wikiUrl) {
          heroImageUrl = await estandarizarYSubirImagenAR2(wikiUrl, `portadas/${slug}`);
          console.log(`[CX Submit Draft] ✅ Portada WebP lista en R2: ${heroImageUrl}`);
        }
      } catch (imgErr: any) {
        console.warn('[CX Submit Draft] Aviso al buscar/subir imagen de Wikimedia:', imgErr?.message);
      }
    }

    // 2. Construir la tarjeta Card V2 interactiva de confirmación
    const cardV2 = buildGoogleChatCardV2({
      status: 'draft_proposal',
      title: postTitle,
      subtitle: `Mesa de Redacción Dialogflow • Autor: ${author}`,
      silo,
      excerpt: content.slice(0, 320),
      heroImageUrl,
      slug,
      r2Url: heroImageUrl,
      rawContent: content,
    });

    // 3. Notificación asíncrona a Google Chat
    const alertText = `🏛️ **Mesa de Redacción TGP:** Xavier, ha llegado una propuesta de ensayo: "${postTitle}". ¿Deseas publicarlo en ${silo.toUpperCase()}?`;
    await sendAsyncGoogleChatCard({
      cardV2,
      fallbackText: alertText,
    });

    // 4. Devolver confirmación a Dialogflow CX
    const confirmMessage = `¡Listo, Xavier! Recibí el ensayo "${postTitle}". ${
      heroImageUrl ? 'Busqué una imagen en Wikimedia y la procesé en WebP a Cloudflare R2.' : 'Generé la ficha editorial.'
    } Te envié la tarjeta interactiva a tu Google Chat para que confirmes la publicación en ${silo.toUpperCase()} con un solo clic.`;

    if (isCxWebhook) {
      return c.json({
        fulfillmentResponse: {
          messages: [{ text: { text: [confirmMessage] } }],
        },
        sessionInfo: {
          parameters: {
            draft_status: 'notified_chat',
            draft_title: postTitle,
            draft_slug: slug,
            hero_image_url: heroImageUrl || '',
          },
        },
      });
    }

    return c.json({
      success: true,
      title: postTitle,
      slug,
      silo,
      heroImageUrl,
      message: confirmMessage,
    });
  } catch (err: any) {
    console.error('[CX Submit Draft Error]:', err);
    return c.json({ success: false, error: err?.message || String(err) }, 500);
  }
};

chatRoutes.post('/api/cx/submit-draft', handleCxSubmitDraft);
chatRoutes.post('/cx/submit-draft', handleCxSubmitDraft);

const handleGetCxHealth = (c: any) =>
  c.json({
    status: 'online',
    service: 'tgp-mind-chat',
    endpoint: '/api/cx/submit-draft',
    methodExpected: 'POST',
    description: 'Puente de Ingesta Dialogflow CX -> TGP Mind -> Google Chat (Cards V2)',
    ts: new Date().toISOString(),
  });

chatRoutes.get('/api/cx/submit-draft', handleGetCxHealth);
chatRoutes.get('/cx/submit-draft', handleGetCxHealth);
