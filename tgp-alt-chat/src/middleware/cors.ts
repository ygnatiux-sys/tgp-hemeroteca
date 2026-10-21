// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Middleware de CORS Global
// ─────────────────────────────────────────────────────────────────────────────
import { cors } from 'hono/cors';
import { isAllowedOrigin } from '../config/env.js';

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return '*';
    if (isAllowedOrigin(origin)) return origin;
    return null;
  },
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'X-Api-Key',
    'x-tgp-master-key',
    'X-Tgp-Master-Key',
    'X-Mini-App',
    'x-mini-app',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
});
