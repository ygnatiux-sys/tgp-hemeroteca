// ─────────────────────────────────────────────────────────────────────────────
// TGP ALT TELEGRAM — Rutas y Webhook Exclusivo para @tgpAlternative_bot
// Deploy: Google Cloud Run · Proyecto tgp-paralelo-alternativo
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_BOT_NAME,
} from '../config/env.js';
import { handleTelegramWebhook, sendChatAction } from '../telegram/webhook.js';

export const telegramRoutes = new Hono();

// Handler de Webhook para el bot único multimodal (@tgpAlternative_bot)
const handleWebhook = async (c: any) => {
  try {
    const update = await c.req.json().catch(() => ({}));
    const chatId = update?.message?.chat?.id || update?.callback_query?.message?.chat?.id;

    if (chatId && TELEGRAM_BOT_TOKEN) {
      sendChatAction(chatId, TELEGRAM_BOT_TOKEN, 'typing').catch(() => {});
    }

    // Procesa el update con el bot multimodal
    await handleTelegramWebhook(update, 'assistant', TELEGRAM_BOT_TOKEN);
  } catch (err: any) {
    console.error(`[Webhook Error - ${TELEGRAM_BOT_NAME}]:`, err?.message || err);
  } finally {
    return c.text('OK', 200);
  }
};

// ── Registro de Webhooks (POST) ─────────────────────────────────────────────
telegramRoutes.post('/webhook/telegram', handleWebhook);
telegramRoutes.post('/telegram-webhook', handleWebhook);
telegramRoutes.post('/webhook', handleWebhook);

if (TELEGRAM_BOT_TOKEN) {
  telegramRoutes.post(`/bot${TELEGRAM_BOT_TOKEN}`, handleWebhook);
}

// ── Sondas de Salud y Diagnóstico (GET) ─────────────────────────────────────
telegramRoutes.get('/webhook/telegram', (c) =>
  c.json({
    status: 'TGP Alternative Telegram Webhook activo',
    bot: TELEGRAM_BOT_NAME,
    method: 'GET',
    ts: new Date().toISOString(),
  })
);

telegramRoutes.get('/telegram-webhook', (c) =>
  c.json({
    status: 'TGP Alternative Telegram Webhook activo',
    bot: TELEGRAM_BOT_NAME,
    method: 'GET',
    ts: new Date().toISOString(),
  })
);

// ── Configuración y Sincronización Automática del Webhook Oficial de Telegram ─
telegramRoutes.get('/api/telegram/setup-webhook', async (c) => {
  const host = c.req.header('host') || 'tgp-alt-telegram-258556802672.us-central1.run.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const webhookUrl = `${protocol}://${host}/webhook/telegram`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true,
        allowed_updates: ['message', 'callback_query'],
      }),
    });
    const data = await response.json();
    return c.json({
      success: data.ok,
      webhookUrl,
      telegramResponse: data,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err?.message || err }, 500);
  }
});

telegramRoutes.get('/api/telegram/info', async (c) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();
    return c.json({ success: true, webhookInfo: data });
  } catch (err: any) {
    return c.json({ success: false, error: err?.message || err }, 500);
  }
});
