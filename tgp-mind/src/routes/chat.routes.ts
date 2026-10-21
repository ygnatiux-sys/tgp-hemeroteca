// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Rutas de Google Chat y Dialogflow CX Webhooks
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { wikimediaTool } from '../core/tools/wikimediaTool.js';
import { runChatOrchestrator } from '../chat/orchestrator.js';
import { buildGoogleChatCardV2 } from '../chat/cards-v2-builder.js';
import { detectarAdjuntoImagen, procesarImagenGoogleChatAR2 } from '../chat/chat-attachment-service.js';
import { sendAsyncGoogleChatCard } from '../chat/async-chat-notifier.js';

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
