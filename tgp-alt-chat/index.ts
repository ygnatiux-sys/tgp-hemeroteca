// ─────────────────────────────────────────────────────────────────────────────
// TGP ALT CHAT — Dispatcher Exclusivo de Google Chat Add-on (TGP-Alternative)
// Autor: TGP / Xavier Benítez
// Deploy: Google Cloud Run · Proyecto tgp-paralelo-alternativo
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { PORT } from './src/config/env.js';
import { corsMiddleware } from './src/middleware/cors.js';
import { masterAuthMiddleware } from './src/middleware/auth.js';
import { chatRoutes } from './src/routes/chat.routes.js';
import { autoInitR2 } from './src/storage/r2.js';

// Inicialización de Storage R2
autoInitR2();

const app = new Hono();

// 1. Health Check Raíz Inmediato
app.get('/', (c) =>
  c.json({
    status: 'TGP Alternative Chat activo',
    service: 'tgp-alt-chat',
    ts: new Date().toISOString(),
  })
);

// 2. Middlewares de Transporte y Seguridad
app.use('*', corsMiddleware);
app.options('*', (c) => c.body(null, 204));
app.use('*', masterAuthMiddleware);

// 3. Montaje Exclusivo del Motor de Google Chat Workspace Add-on
app.route('/', chatRoutes);

// 4. Arranque del Servidor
if (process.env.NODE_ENV !== 'test' && !process.env.NO_SERVE) {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[TGP Alt Chat] Puerto ${PORT} — Listo para atender Google Workspace Add-on.`);
  });
}

export default app;
