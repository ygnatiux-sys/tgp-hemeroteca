// ─────────────────────────────────────────────────────────────────────────────
// TGP ALT TELEGRAM — Dispatcher Exclusivo de Telegram Multimodal (Docker B)
// Autor: TGP / Xavier Benítez
// Deploy: Google Cloud Run · Proyecto tgp-paralelo-alternativo
// Bot Oficial: @tgpAlternative_bot
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { PORT, TELEGRAM_BOT_NAME } from './src/config/env.js';
import { corsMiddleware } from './src/middleware/cors.js';
import { masterAuthMiddleware } from './src/middleware/auth.js';
import { telegramRoutes } from './src/routes/telegram.routes.js';

const app = new Hono();

// 1. Health Check Raíz Inmediato
app.get('/', (c) =>
  c.json({
    status: 'TGP Alternative Telegram activo',
    service: 'tgp-alt-telegram',
    bot: TELEGRAM_BOT_NAME,
    ts: new Date().toISOString(),
  })
);

// 2. Middlewares de Transporte y Seguridad
app.use('*', corsMiddleware);
app.options('*', (c) => c.body(null, 204));
app.use('*', masterAuthMiddleware);

// 3. Montaje Exclusivo del Motor de Telegram
app.route('/', telegramRoutes);

// 4. Arranque del Servidor
if (process.env.NODE_ENV !== 'test' && !process.env.NO_SERVE) {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[TGP Alt Telegram] Puerto ${PORT} — Listo para atender @${TELEGRAM_BOT_NAME}.`);
  });
}

export default app;
