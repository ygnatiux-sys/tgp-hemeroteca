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

// Rutas Modulares
import { telegramRoutes } from './src/routes/telegram.routes.js';
import { cognitiveRoutes } from './src/routes/cognitive.routes.js';
import { chatRoutes } from './src/routes/chat.routes.js';
import { pickerRoutes } from './src/routes/picker.routes.js';

// Instancia Hono
const app = new Hono();

// 1. Health Check Raíz (Inmediato)
app.get('/', (c) => c.json({ status: 'TGP Mind activo', ts: new Date().toISOString() }));

// 2. Middlewares de Transporte y Seguridad
app.use('*', corsMiddleware);
app.options('*', (c) => c.body(null, 204));

initAuthorizedChatIdsFromFirestore().catch(() => {});
app.use('*', masterAuthMiddleware);

// 3. Montaje de Routers Modulares
app.route('/', telegramRoutes);
app.route('/', cognitiveRoutes);
app.route('/', chatRoutes);
app.route('/', pickerRoutes);

// 4. Arranque del Servidor
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[TGP Mind Dispatcher] Puerto ${PORT} — Listo para producción.`);
});

export default app;
