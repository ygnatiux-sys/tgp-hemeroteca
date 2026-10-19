// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Rutas de Google Chat y Dialogflow CX Webhooks
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { wikimediaTool } from '../core/tools/wikimediaTool.js';
import { runChatOrchestrator } from '../chat/orchestrator.js';

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

// ── Handler de Webhook Google Chat & Dialogflow CX ───────────────────────────
const handleChatWebhook = async (c: any) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const rawText =
      body.text ||
      body.transcript ||
      body.message?.text ||
      body.message ||
      body.prompt ||
      body.query ||
      '';

    const userName =
      body.user?.displayName ||
      body.message?.sender?.displayName ||
      'Director';

    const cleanText = String(rawText)
      .replace(/<users\/[^>]+>\s*/g, '')
      .replace(/^@tgp\s+mind\s+as[eé]sor\s+for\s+XB\s*/gi, '')
      .replace(/^@[\w\s.-]+?\s+(?=(?:me|como|hace|hola|que|quien|cuando|che|por|sube|crea|publica|brief|[a-z0-9]))/i, '')
      .replace(/^@\S+\s+/, '')
      .trim();

    if (!cleanText) {
      const emptyMsg =
        '¡Hola! Soy el asistente orquestador de TGP Mind. Puedes pedirme en lenguaje natural subir posts, convertir imágenes a WebP en R2, consultar Panlingua D1 o generar portadas cinematográficas.';
      if (body.intentInfo || body.fulfillmentInfo || body.sessionInfo) {
        return c.json({ fulfillmentResponse: { messages: [{ text: { text: [emptyMsg] } }] } });
      }
      return c.json({ text: emptyMsg });
    }

    const sessionId =
      body.space?.name ||
      body.message?.thread?.name ||
      body.sessionInfo?.session ||
      'googlechat_space';

    console.log(`[Chat Webhook] Recibido mensaje de ${userName} (${sessionId}): "${cleanText.slice(0, 80)}"`);

    const orchestration = await runChatOrchestrator(cleanText, {
      user: userName,
      channel: 'google-chat',
      sessionId,
    });
    const responseText = orchestration.text;

    if (body.intentInfo || body.fulfillmentInfo || body.sessionInfo) {
      return c.json({
        fulfillmentResponse: {
          messages: [{ text: { text: [responseText] } }],
        },
      });
    }

    return c.json({ text: responseText });
  } catch (err: any) {
    console.error('[Chat Webhook Error]:', err);
    return c.json({ text: `⚠️ Error procesando el mensaje: ${err?.message || err}` }, 500);
  }
};

chatRoutes.post('/api/chat/webhook', handleChatWebhook);
chatRoutes.post('/webhook/chat', handleChatWebhook);
chatRoutes.post('/google-chat-webhook', handleChatWebhook);
chatRoutes.post('/webhook', handleChatWebhook);
