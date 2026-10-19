// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Rutas y Webhooks de Telegram Multi-Bot
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import {
  TELEGRAM_TOKEN,
  TELEGRAM_SOCIAL_TOKEN,
  TELEGRAM_TGP_CLOUD_TOKEN,
  TELEGRAM_DEV_TOKEN,
  TELEGRAM_PREMIUM_TOKEN,
  TGP_MIND_API_KEY,
} from '../config/env.js';
import { handleTelegramWebhook, sendChatAction } from '../telegram/webhook.js';
import { procesarFotoTelegramMultimodal } from '../services/media.service.js';

export const telegramRoutes = new Hono();

// Handler de Webhook Multi-Bot No Bloqueante con await garantizado antes del cierre
function handleWebhookRoute(botType: 'redes' | 'omni' | 'assistant' | 'liminal', token: string) {
  return async (c: any) => {
    try {
      const update = await c.req.json().catch(() => ({}));
      const chatId = update?.message?.chat?.id || update?.callback_query?.message?.chat?.id;
      if (chatId && token) {
        sendChatAction(chatId, token, 'typing').catch(() => {});
      }
      // Se espera con await para completar la ejecución antes del retorno HTTP
      await handleTelegramWebhook(update, botType, token);
    } catch (err: any) {
      console.error(`[Webhook Error - ${botType}]:`, err?.message || err);
    } finally {
      return c.text('OK', 200);
    }
  };
}

// ── Registro de Webhooks Oficiales ───────────────────────────────────────────
telegramRoutes.post('/webhook/telegram-social', handleWebhookRoute('redes', TELEGRAM_SOCIAL_TOKEN));
telegramRoutes.post('/telegram-webhook', handleWebhookRoute('omni', TELEGRAM_TOKEN));
telegramRoutes.post('/webhook/telegram-omni', handleWebhookRoute('omni', TELEGRAM_TOKEN));
telegramRoutes.post('/webhook/telegram', handleWebhookRoute('assistant', TELEGRAM_TGP_CLOUD_TOKEN));
telegramRoutes.post('/webhook-dev', handleWebhookRoute('liminal', TELEGRAM_DEV_TOKEN));
telegramRoutes.post('/webhook/telegram-premium', handleWebhookRoute('liminal', TELEGRAM_PREMIUM_TOKEN));

// Rutas secundarias /bot<TOKEN> requeridas por Cloud Run
if (TELEGRAM_TOKEN) {
  telegramRoutes.post(`/bot${TELEGRAM_TOKEN}`, handleWebhookRoute('omni', TELEGRAM_TOKEN));
}
if (TELEGRAM_SOCIAL_TOKEN) {
  telegramRoutes.post(`/bot${TELEGRAM_SOCIAL_TOKEN}`, handleWebhookRoute('redes', TELEGRAM_SOCIAL_TOKEN));
}
if (TELEGRAM_TGP_CLOUD_TOKEN) {
  telegramRoutes.post(`/bot${TELEGRAM_TGP_CLOUD_TOKEN}`, handleWebhookRoute('assistant', TELEGRAM_TGP_CLOUD_TOKEN));
}
if (TELEGRAM_DEV_TOKEN) {
  telegramRoutes.post(`/bot${TELEGRAM_DEV_TOKEN}`, handleWebhookRoute('liminal', TELEGRAM_DEV_TOKEN));
}
if (TELEGRAM_PREMIUM_TOKEN) {
  telegramRoutes.post(`/bot${TELEGRAM_PREMIUM_TOKEN}`, handleWebhookRoute('liminal', TELEGRAM_PREMIUM_TOKEN));
}

// ── Saneamiento y Reenganche de Webhooks ─────────────────────────────────────
telegramRoutes.get('/api/telegram/drop-pending', async (c) => {
  const baseUrl = 'https://tgp-mind-713934653057.us-central1.run.app';
  const bots = [
    { name: 'omni', token: TELEGRAM_TOKEN, path: '/telegram-webhook' },
    { name: 'redes', token: TELEGRAM_SOCIAL_TOKEN, path: '/webhook/telegram-social' },
    { name: 'assistant', token: TELEGRAM_TGP_CLOUD_TOKEN, path: '/webhook/telegram' },
    { name: 'liminal', token: TELEGRAM_DEV_TOKEN, path: '/webhook-dev' },
    { name: 'premium', token: TELEGRAM_PREMIUM_TOKEN, path: '/webhook/telegram-premium' },
  ];

  const results: any[] = [];
  for (const b of bots) {
    if (!b.token) continue;
    try {
      const res = await fetch(`https://api.telegram.org/bot${b.token}/deleteWebhook?drop_pending_updates=true`);
      const dropData = await res.json().catch(() => ({}));
      const webhookUrl = baseUrl + b.path;
      const setRes = await fetch(`https://api.telegram.org/bot${b.token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const setData = await setRes.json().catch(() => ({}));

      results.push({
        bot: b.name,
        success: true,
        purged: dropData,
        reconnected: setData,
        webhookUrl,
      });
    } catch (err: any) {
      results.push({ bot: b.name, success: false, error: err?.message || err });
    }
  }
  return c.json({ status: 'Saneamiento y reenganche de webhooks completado con éxito', results });
});

// ── Ingesta Directa de Media Telegram a R2 ───────────────────────────────────
telegramRoutes.post('/api/telegram/upload-media', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (TGP_MIND_API_KEY && apiKey !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido' }, 400); }

  const fileId: string = body?.fileId ?? '';
  const slug: string = body?.slug ?? 'telegram-media';
  if (!fileId) return c.json({ error: 'Falta parámetro fileId' }, 400);

  try {
    const result = await procesarFotoTelegramMultimodal(fileId, slug);
    return c.json({ success: true, url: result.url, fileName: result.fileName, mimeType: result.mimeType });
  } catch (err: any) {
    console.error('[API Telegram Upload Media Error]:', err);
    return c.json({ success: false, error: err?.message || 'Error al procesar y subir imagen a R2' }, 500);
  }
});
