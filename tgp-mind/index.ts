// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Dispatcher Central ("El Cartero")
// Autor: TGP / Xavier Benítez
// Deploy: Google Cloud Run (Servicio Oficial tgp-mind · Hemeroteca .md)
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { PORT } from './src/config/env.js';
import { corsMiddleware } from './src/middleware/cors.js';
import { masterAuthMiddleware, initAuthorizedChatIdsFromFirestore } from './src/middleware/auth.js';

const app = new Hono();
const ROLE = (process.env.SERVICE_ROLE || 'all').toLowerCase();

// 1. Health Check Raíz Inmediato con Diagnóstico de Rol
app.get('/', (c) => c.json({ status: 'TGP Mind activo', role: ROLE, ts: new Date().toISOString() }));

// 2. Middlewares de Transporte y Seguridad
app.use('*', corsMiddleware);
app.options('*', (c) => c.body(null, 204));

initAuthorizedChatIdsFromFirestore().catch(() => {});
app.use('*', masterAuthMiddleware);

// 3. Montaje Modular y Aislado por SERVICE_ROLE
if (ROLE === 'all' || ROLE === 'telegram') {
  const { telegramRoutes } = await import('./src/routes/telegram.routes.js');
  app.route('/', telegramRoutes);
}
if (ROLE === 'all' || ROLE === 'gchat' || ROLE === 'chat') {
  const { chatRoutes } = await import('./src/routes/chat.routes.js');
  app.route('/', chatRoutes);
}
if (ROLE === 'all' || ROLE === 'core' || ROLE === 'cognitive') {
  const { cognitiveRoutes } = await import('./src/routes/cognitive.routes.js');
  const { pickerRoutes } = await import('./src/routes/picker.routes.js');
  app.route('/', cognitiveRoutes);
  app.route('/', pickerRoutes);
}

// 4. Arranque del Servidor (omitido en tests para app.fetch directo)
if (process.env.NODE_ENV !== 'test' && !process.env.NO_SERVE) {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[TGP Mind Dispatcher] Rol: [${ROLE}] | Puerto ${PORT} — Listo para producción.`);
  });
}

export default app;
