// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Orquestador IA con Hono + Gemini + Inline Keyboard Wizard
// Autor: TGP / Xavier Benítez
// Deploy: Google Cloud Run
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
// ── Gemini (ver src/ia/gemini.ts) ─────────────────────────────────────────────────────────────────────────────
import {
  GEMINI_API_KEY,
  genai,
  googleAI,
  callGemini,
  crearModeloEnsayo,
  SYSTEM_PROMPT_NATGEO_GROUNDED,
  TGP_SYSTEM_PROMPT,
  buildDensityInstruction,
} from './src/ia/gemini.js';
// -- Telegram Webhook Unificado Multi-Bot (ver src/telegram/webhook.ts) --------
import { handleTelegramWebhook } from './src/telegram/webhook.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
// -- Storage: R2 (ver src/storage/r2.ts) ----------------------------------------
import {
  initR2,
  subirBufferAR2,
  subirBufferOsintAR2,
  subirImagenAR2,
  procesarFotoTelegramAR2,
  listarImagenesRecientesR2,
  estandarizarYSubirImagenAR2,
} from './src/storage/r2.js';
// -- Storage: D1 + HITL (ver src/storage/d1.ts) ----------------------------------
import {
  initD1,
  guardarEnCloudflareD1,
  obtenerInformeD1,
  actualizarRegistroD1,
  generarYGuardarAudioTTS,
  getHITLState,
  setHITLState,
  clearHITLState,
  registrarResguardoD1,
} from './src/storage/d1.js';
// -- Vision: Wikimedia Anti-Drift (ver src/vision/wikimedia.ts) ------------------
import { procesarImagen, resolverEntidadCanonica, buscarPageImageWikipedia } from './src/vision/wikimedia.js';
// -- Servicios: Publicacion GitOps (ver src/servicios/publicacion.ts) -------------
import {
  initPublicacion,
  generarSlug,
  generarMarkdoc,
  publicarEntradaKeystaticGitHub,
  publicarEnGitHub,
} from './src/servicios/publicacion.js';
import { Octokit } from '@octokit/rest';
import vision from '@google-cloud/vision';
import crypto from 'node:crypto';
import 'dotenv/config';
// Ã¢â€â‚¬Ã¢â€â‚¬ Configuración Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const PORT               = parseInt(process.env.PORT || '3001');
const TELEGRAM_TOKEN     = (process.env.OMNI_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').replace(/['"]/g, '').trim();
const TELEGRAM_BOT_NAME  = (process.env.TELEGRAM_BOT_NAME || 'Analista_IMG_bot').replace(/['"]/g, '').trim();
// GEMINI_API_KEY importada desde ./src/ia/gemini.js
const TGP_MIND_API_KEY   = (process.env.TGP_MIND_API_KEY || '').replace(/['"]/g, '').trim();
const XAVIER_CHAT_ID     = 7886507052;
const DIALOGFLOW_PROJECT  = process.env.DIALOGFLOW_PROJECT  || '';
const DIALOGFLOW_LOCATION = process.env.DIALOGFLOW_LOCATION || 'us-central1';
const DIALOGFLOW_AGENT_ID = process.env.DIALOGFLOW_AGENT_ID || '';
const TELEGRAM_API        = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const TELEGRAM_SOCIAL_TOKEN     = (process.env.REDES_TOKEN || process.env.TELEGRAM_SOCIAL_TOKEN || '').replace(/['"]/g, '').trim();
const TELEGRAM_TGP_CLOUD_TOKEN  = (process.env.ASSISTANT_TOKEN || process.env.TELEGRAM_TGP_CLOUD_TOKEN || '').replace(/['"]/g, '').trim();
const TELEGRAM_DEV_TOKEN = (process.env.TELEGRAM_DEV_BOT_TOKEN || process.env.LIMINAL_TOKEN || '').replace(/['"]/g, '').trim();
const ZERNIO_API_KEY        = process.env.ZERNIO_API_KEY || '';
const ZERNIO_FB_ID          = process.env.ZERNIO_FB_ID || '';
const ZERNIO_TIKTOK_ID      = process.env.ZERNIO_TIKTOK_ID || '';
const TELEGRAM_SOCIAL_API   = `https://api.telegram.org/bot${TELEGRAM_SOCIAL_TOKEN}`;
const TELEGRAM_ASSISTANT_API= `https://api.telegram.org/bot${TELEGRAM_TGP_CLOUD_TOKEN}`;
const MINI_APP_URL          = (process.env.MINI_APP_URL || 'https://thegreatpuzzleproject.com/bot-selector').trim();

// Ã¢â€â‚¬Ã¢â€â‚¬ Cloudflare R2 & D1 Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const CLOUDFLARE_ACCOUNT_ID    = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '';
const CLOUDFLARE_API_TOKEN     = process.env.CLOUDFLARE_API_TOKEN     || '';
const R2_ACCESS_KEY_ID         = process.env.R2_ACCESS_KEY_ID         || '';
const R2_SECRET_ACCESS_KEY     = process.env.R2_SECRET_ACCESS_KEY     || '';
const R2_BUCKET_NAME           = process.env.R2_BUCKET_NAME           || 'tgp-storage';
const R2_PUBLIC_DOMAIN         = process.env.R2_PUBLIC_DOMAIN         || 'https://storage.thegreatpuzzleproject.com';


// Ã¢â€â‚¬Ã¢â€â‚¬ Google Cloud Vision Client Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const visionClient = new vision.ImageAnnotatorClient();

// Ã¢â€â‚¬Ã¢â€â‚¬ GitHub / Octokit Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const GITHUB_TOKEN             = process.env.GITHUB_TOKEN             || '';
const GITHUB_TOKEN_HEMEROTECA  = process.env.GITHUB_TOKEN_HEMEROTECA  || GITHUB_TOKEN;
const GITHUB_REPO_HEMEROTECA   = process.env.GITHUB_REPO_HEMEROTECA   || 'ygnatiux-sys/tgp-hemeroteca';
const GITHUB_TOKEN_ALTERNATIVE = process.env.GITHUB_TOKEN_ALTERNATIVE || GITHUB_TOKEN;
const GITHUB_REPO_ALTERNATIVE  = process.env.GITHUB_REPO              || 'ygnatiux-sys/tgp-webfinal2026';
// Singleton solo para rutas no-webhook
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Ã¢â€â‚¬Ã¢â€â‚¬ Inicializar módulos de Telegram/Social con la config del entorno Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// [Legacy archive] initTelegramHelpers / initSocialBot — eliminados en Migración v2


// TGP_SYSTEM_PROMPT, genai, googleAI, callGemini, crearModeloEnsayo
// → importados desde ./src/ia/gemini.js

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ URL de imagen de reserva alojada en R2 (usada cuando ninguna busqueda da resultado) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const FALLBACK_IMAGE_URL = 'https://storage.thegreatpuzzleproject.com/tgp-fallback.jpg';


// -- Inicializar mÃ³dulos Storage y Servicios -------------------------------------
initR2({
  accountId:    CLOUDFLARE_ACCOUNT_ID,
  accessKeyId:  R2_ACCESS_KEY_ID,
  secretKey:    R2_SECRET_ACCESS_KEY,
  bucketName:   R2_BUCKET_NAME,
  publicDomain: R2_PUBLIC_DOMAIN,
  telegramToken: TELEGRAM_TOKEN,
  telegramApi:   TELEGRAM_API,
});
initD1({
  accountId:    CLOUDFLARE_ACCOUNT_ID,
  databaseId:   CLOUDFLARE_D1_DATABASE_ID,
  apiToken:     CLOUDFLARE_API_TOKEN,
  geminiApiKey: GEMINI_API_KEY,
});
initPublicacion();
// SesionConfig, sesiones, pendingTextQueries, buildInlineKeyboard,
// sendTelegram, answerCallbackQuery, editMessageReplyMarkup, editMessageText
// → importados desde ./src/telegram/helpers.js


// Ã¢â€â‚¬Ã¢â€â‚¬ Hono App Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const app = new Hono();

// ── CORS global (permite x-api-key, x-api-token y x-mini-app desde los orígenes del proyecto) ──
app.get('/', (c) => c.json({ status: 'TGP Mind activo', ts: new Date().toISOString() }));
// Las rutas se registrarán más abajo.
const isAllowedOrigin = (origin: string) => {
  if (!origin) return true;
  return (
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.endsWith('.thegreatpuzzleproject.com') ||
    origin === 'https://thegreatpuzzleproject.com' ||
    origin.endsWith('.pages.dev')
  );
};

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    if (isAllowedOrigin(origin)) return origin;
    return null;
  },
  allowHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Api-Key', 'X-Mini-App', 'x-mini-app'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}));

app.options('*', (c) => c.body(null, 204));

// ── Rutas de Webhook Multi-Bot (Desacopladas / No Bloqueantes) ─────────────────
// Devuelven HTTP 200 OK inmediatamente (<50ms) para evitar timeouts y retries de Telegram.
// El procesamiento real corre en segundo plano (Background Execution).
function handleWebhookRoute(botType: 'redes' | 'omni' | 'assistant' | 'liminal', token: string) {
  return async (c: any) => {
    try {
      const update = await c.req.json();
      const task = handleTelegramWebhook(update, botType, token).catch((err: any) => {
        console.error(`[Background Webhook Error - ${botType}]:`, err);
      });
      // Soporte para Cloudflare Workers / Serverless execution context si existe
      if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
        c.executionCtx.waitUntil(task);
      }
    } catch (parseErr: any) {
      console.error(`[Webhook Parse Error - ${botType}]:`, parseErr?.message);
    }
    return c.text('OK');
  };
}

// Endpoints específicos registrados en Telegram Bot API:
app.post('/webhook/telegram-social', handleWebhookRoute('redes', TELEGRAM_SOCIAL_TOKEN));
app.post('/telegram-webhook',        handleWebhookRoute('omni', TELEGRAM_TOKEN));
app.post('/webhook/telegram-omni',   handleWebhookRoute('omni', TELEGRAM_TOKEN));
app.post('/webhook/telegram',        handleWebhookRoute('assistant', TELEGRAM_TGP_CLOUD_TOKEN));
app.post('/webhook-dev',             handleWebhookRoute('liminal', TELEGRAM_DEV_TOKEN));

// Rutas secundarias /bot<TOKEN>:
if (TELEGRAM_TOKEN) {
  app.post(`/bot${TELEGRAM_TOKEN}`, handleWebhookRoute('omni', TELEGRAM_TOKEN));
}

if (TELEGRAM_SOCIAL_TOKEN) {
  app.post(`/bot${TELEGRAM_SOCIAL_TOKEN}`, handleWebhookRoute('redes', TELEGRAM_SOCIAL_TOKEN));
}

if (TELEGRAM_TGP_CLOUD_TOKEN) {
  app.post(`/bot${TELEGRAM_TGP_CLOUD_TOKEN}`, handleWebhookRoute('assistant', TELEGRAM_TGP_CLOUD_TOKEN));
}

if (TELEGRAM_DEV_TOKEN) {
  app.post(`/bot${TELEGRAM_DEV_TOKEN}`, handleWebhookRoute('liminal', TELEGRAM_DEV_TOKEN));
}

// -- Google Photos Picker API -- CORS-safe, credenciales en server -----------
import {
  createPickerSession,
  pollPickerSession,
  getPickerItems,
  listMyPhotos,
} from './src/servicios/google-photos.js';

app.post('/api/picker/session', async (c) => {
  try { return c.json(await createPickerSession()); }
  catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get('/api/picker/poll/:sessionId', async (c) => {
  try { return c.json(await pollPickerSession(c.req.param('sessionId'))); }
  catch { return c.json({ ready: false }); }
});

app.get('/api/picker/items/:sessionId', async (c) => {
  try { return c.json({ items: await getPickerItems(c.req.param('sessionId')) }); }
  catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.get('/api/my-photos', async (c) => {
  try { return c.json({ photos: await listMyPhotos(24) }); }
  catch { return c.json({ photos: [] }); }
});
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// RUTA 2: /api/mind -- Sidebar local
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬


app.post('/api/mind', async (c) => {
  const auth = (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!TGP_MIND_API_KEY || auth !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  const origin = c.req.header('Origin') ?? '';
  if (origin && !isAllowedOrigin(origin)) return c.json({ error: 'Origen no permitido.' }, 403);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON invalido.' }, 400); }

  const rawMessage: string = body?.message   ?? '';
  const sessionId: string  = body?.sessionId ?? 'sidebar-default';
  const usePro  = body?.usePro === true || /^\/(pro|deep)\s+/i.test(rawMessage);
  const cleanMessage = rawMessage.replace(/^\/(pro|deep)\s+/i, '').trim();
  if (!cleanMessage) return c.json({ error: 'Mensaje vacio.' }, 400);

  const model        = usePro ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
  const responseText = await callGemini(sessionId, cleanMessage, model);
  return c.json({ response: responseText, model, sessionId });
});

// ── RUTA: /api/bot/generate -- Puesto de Mando (Scriptorium) & Telegram Mini App ──
app.post('/api/bot/generate', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  const isMiniAppHeader = c.req.header('X-Mini-App') === 'true' || c.req.header('x-mini-app') === 'true';
  const origin = c.req.header('Origin') ?? '';

  if (origin && !isAllowedOrigin(origin) && !isMiniAppHeader) {
    return c.json({ error: 'Origen no permitido.' }, 403);
  }

  if (TGP_MIND_API_KEY && apiKey && apiKey !== TGP_MIND_API_KEY && !isMiniAppHeader) {
    return c.json({ error: 'No autorizado: API Key inválida.' }, 401);
  }

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido.' }, 400); }

  const {
    initData,
    tema,
    red = 'facebook',
    modelo = 'flash',
    densidad = 'profundo_breve',
    modoLibrePrompt = '',
    imagen = 'wikimedia',
    destino = 'ensayosCinematicos',
    photoUrl = '',
    bot = 'omni',
    formato = 'tgp',
  } = body;

  if (!tema || typeof tema !== 'string' || !tema.trim()) {
    return c.json({ error: 'El campo "tema" es obligatorio.' }, 400);
  }

  let botToken = TELEGRAM_TOKEN;
  if (bot === 'assistant') botToken = TELEGRAM_TGP_CLOUD_TOKEN || TELEGRAM_TOKEN;
  else if (bot === 'redes') botToken = TELEGRAM_SOCIAL_TOKEN || TELEGRAM_TOKEN;
  else if (bot === 'liminal') botToken = TELEGRAM_DEV_TOKEN || TELEGRAM_TOKEN;

  let chatId: number = XAVIER_CHAT_ID;
  if (initData) {
    try {
      const params = new URLSearchParams(initData);
      const userStr = params.get('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.id) chatId = user.id;
      }
    } catch {}
  }

  try {
    const modelName = modelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
    const modLabel = modelo === 'pro' ? 'Gemini Pro' : 'Gemini Flash';
    const redLabel = red === 'facebook' ? 'Facebook' : 'TikTok';

    const isHemeroteca = destino !== 'social' && destino !== 'facebook' && destino !== 'tiktok';
    const targetLabel = isHemeroteca ? `Hemeroteca (${destino})` : redLabel;

    if (botToken && chatId) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⏳ Generando para ${targetLabel} con ${modLabel}...` }),
      }).catch(() => {});
    }

    const directivaDensidad = buildDensityInstruction(densidad, densidad === 'premium');
    const modoLibre = modoLibrePrompt?.trim()
      ? `\n\nDIRECTIVA PERSONALIZADA DEL AUTOR (MODO LIBRE):\n${modoLibrePrompt.trim()}`
      : '';

    let textoGenerado = '';
    if (isHemeroteca) {
      const userPrompt = `Escribe un ensayo reflexivo, denso y profundo para Hemeroteca TGP sobre: "${tema.trim()}". Estilo ensayo argentino contemporáneo. ${directivaDensidad}${modoLibre}`;
      textoGenerado = await callGemini(`desk-${chatId}`, userPrompt, modelName, TGP_SYSTEM_PROMPT, 8192);
    } else {
      const userPrompt = `Genera un texto magnético y reflexivo para redes sociales (${red}) sobre: ${tema.trim()}. ${directivaDensidad}${modoLibre}`;
      const SOCIAL_PROMPT = 'Eres un redactor cultural y turístico experto. Crea descripciones grounded basadas en hechos. Tono: Informativo, directo y claro.';
      textoGenerado = await callGemini(`desk-${chatId}`, userPrompt, modelName, SOCIAL_PROMPT, 8192);
    }

    let imagenUrl = photoUrl || '';
    if (!imagenUrl && imagen === 'wikimedia') {
      try {
        const entidad = await resolverEntidadCanonica(tema);
        imagenUrl = (await buscarPageImageWikipedia(entidad.wikiEn, 'en')) || (await buscarPageImageWikipedia(entidad.wikiEs, 'es')) || '';
      } catch (errWiki) {
        console.warn('[bot/generate] Error buscando imagen Wikipedia:', errWiki);
      }
    }

    if (imagenUrl && (imagenUrl.startsWith('http://') || imagenUrl.startsWith('https://')) && !imagenUrl.includes('thegreatpuzzleproject.com')) {
      try {
        imagenUrl = await estandarizarYSubirImagenAR2(imagenUrl, 'miniapp');
      } catch (errImg: any) {
        console.warn('[bot/generate] Falló estandarización WebP R2, usando URL original:', errImg?.message);
      }
    }

    try {
      await registrarResguardoD1({
        id: crypto.randomUUID(),
        origen: isMiniAppHeader ? 'miniapp-svelte' : 'scriptorium-desk',
        destino,
        tema: tema.trim(),
        textoGenerado,
        metadatos: { bot, red, modelo, densidad, imagen, formato, isMiniAppHeader },
        imagenR2Url: imagenUrl,
        chatId,
      });
    } catch (d1Err: any) {
      console.warn('[bot/generate] Error registrando en D1:', d1Err?.message);
    }

    if (botToken && chatId) {
      const headerText = isHemeroteca
        ? `📚 Hemeroteca TGP (${modLabel}):\n\n${textoGenerado}`
        : `${redLabel} via TGP Mind (${modLabel}):\n\n${textoGenerado}`;

      if (imagenUrl) {
        fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: imagenUrl,
            caption: headerText.slice(0, 1024),
          }),
        }).catch(() => {});
      } else {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: headerText.slice(0, 4000) }),
        }).catch(() => {});
      }
    }

    return c.json({ ok: true, texto: textoGenerado, response: textoGenerado, imagenUrl });
  } catch (err: any) {
    console.error('[bot/generate Error]:', err);
    return c.json({ error: err?.message || 'Error interno al generar' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTA: /process-image -- Transformación Estructural & Deriva Estética (Laboratorio Visual)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/process-image', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File | undefined;
    const mode = (formData['mode'] as string) || 'opencv';

    if (!file) {
      return c.json({ error: 'No se envió ningún archivo de imagen.' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/png';
    const dataUri = `data:${mimeType};base64,${base64}`;

    console.log(`[Process-Image] Procesando modo: ${mode} para archivo: ${file.name}`);

    return c.json({
      success: true,
      mode,
      data_uri: dataUri,
    });
  } catch (err: any) {
    console.error('[Process-Image Error]:', err);
    return c.json({ error: err?.message || 'Error al procesar la imagen.' }, 500);
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RUTA: /api/upload-r2 -- Ingesta Universal a Cloudflare R2 + Registro en D1
// Unifica el pipeline del Laboratorio Visual, Scriptorium y Bots de Telegram.
// Convierte a WebP con Sharp, aloja en R2 y audita en D1.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/upload-r2', async (c) => {
  try {
    let rawBuffer: Buffer | null = null;
    let folder = 'laboratorio-visual';
    let filename = '';
    let tema = '';
    let metadatos: any = {};
    let origen = 'laboratorio-visual';

    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      const dataUri = body.dataUri || body.image || '';
      folder = (body.folder || 'laboratorio-visual').replace(/[^a-z0-9\-_/]/gi, '');
      filename = body.filename || '';
      tema = body.tema || '';
      metadatos = body.metadatos || {};
      origen = body.origen || 'laboratorio-visual';

      if (!dataUri) {
        return c.json({ error: 'Se requiere dataUri o image en formato Base64 o URL.' }, 400);
      }

      if (dataUri.startsWith('http://') || dataUri.startsWith('https://')) {
        const ua = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
        const res = await fetch(dataUri, { headers: { 'User-Agent': ua } });
        if (!res.ok) throw new Error(`Error ${res.status} al descargar imagen desde URL remota`);
        rawBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
        const base64Data = match ? match[2] : dataUri;
        rawBuffer = Buffer.from(base64Data, 'base64');
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.parseBody();
      const file = formData['file'] as File | undefined;
      folder = ((formData['folder'] as string) || 'laboratorio-visual').replace(/[^a-z0-9\-_/]/gi, '');
      filename = (formData['filename'] as string) || '';
      tema = (formData['tema'] as string) || '';
      origen = (formData['origen'] as string) || 'laboratorio-visual';

      if (!file) {
        return c.json({ error: 'Se requiere archivo en FormData (campo "file").' }, 400);
      }
      const arrayBuffer = await file.arrayBuffer();
      rawBuffer = Buffer.from(arrayBuffer);
    } else {
      return c.json({ error: 'Content-Type no soportado. Usa application/json o multipart/form-data.' }, 400);
    }

    if (!rawBuffer || rawBuffer.length === 0) {
      return c.json({ error: 'Buffer de imagen vacÃ­o o invÃ¡lido.' }, 400);
    }

    // 1. ConversiÃ³n y subida a R2 vÃ­a pipeline estandarizado WebP
    const publicUrl = await estandarizarYSubirImagenAR2(rawBuffer, folder, filename);

    // 2. Registro obligatorio de resguardo documental en Cloudflare D1
    const d1Id = crypto.randomUUID();
    let d1Guardado = false;
    try {
      await registrarResguardoD1({
        id: d1Id,
        origen,
        destino: 'r2',
        tema: tema || filename || 'Asset Visual Curado',
        textoGenerado: `Asset visual procesado y alojado en R2 CDN (${folder})`,
        metadatos: {
          ...metadatos,
          publicUrl,
          folder,
          filename,
          sizeBytes: rawBuffer.length,
          timestamp: new Date().toISOString(),
        },
        imagenR2Url: publicUrl,
      });
      d1Guardado = true;
    } catch (d1Err: any) {
      console.warn('[API /upload-r2] Advertencia al registrar en D1:', d1Err?.message);
    }

    console.log(`[API /upload-r2] Ã‰xito: ${publicUrl} (D1: ${d1Id})`);

    return c.json({
      success: true,
      url: publicUrl,
      d1_id: d1Id,
      d1_guardado: d1Guardado,
      sizeBytes: rawBuffer.length,
    });
  } catch (err: any) {
    console.error('[API /upload-r2 Error]:', err);
    return c.json({ error: err?.message || 'Error al procesar y subir a Cloudflare R2' }, 500);
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// RUTA 3: /api/vision -- Ingesta Multimodal Scriptorium
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post('/api/vision', async (c) => {
  const apiKey = c.req.header('x-api-key');
  if (!TGP_MIND_API_KEY || apiKey !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  const origin = c.req.header('Origin') ?? '';
  if (origin && !isAllowedOrigin(origin)) return c.json({ error: 'Origen no permitido.' }, 403);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON invalido.' }, 400); }

  const prompt:     string = body?.prompt   ?? '';
  const base64Data: string = body?.base64   ?? '';
  const mimeType:   string = body?.mimeType ?? 'image/jpeg';
  if (!prompt || !base64Data) return c.json({ error: 'Faltan campos requeridos (prompt o base64).' }, 400);

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ text: prompt }, { inlineData: { data: base64Data, mimeType } }]
    });
    return c.json({ response: response.text, model: 'gemini-3.8-flash' });
  } catch (error: any) {
    console.error('[Vision API] Error:', error);
    return c.json({ error: 'Error procesando la imagen.' }, 500);
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// HELPERS PARA DATA LAKE OSINT (R2 + CLOUDFLARE D1 + TTS)
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// RUTA 3B: /api/vision-exhaustivo -- Ingesta Exhaustiva (Data Lake OSINT)
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post('/api/vision-exhaustivo', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (TGP_MIND_API_KEY && apiKey !== TGP_MIND_API_KEY) {
    return c.json({ error: 'No autorizado: API Key inválida.' }, 401);
  }

  let body: { imageBase64?: string; mimeType?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Payload JSON malformado.' }, 400); }

  const { imageBase64, mimeType = 'image/webp' } = body;
  if (!imageBase64) return c.json({ error: 'Se requiere el parámetro "imageBase64".' }, 400);

  const rawBase64 = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
  const imageBuffer = Buffer.from(rawBase64, 'base64');
  const recordId = crypto.randomUUID();

  try {
    // 1. Guardado de imagen en R2
    console.log(`[Vision-Exhaustivo] Subiendo imagen a R2 (ID: ${recordId})...`);
    let imagenPublicUrl = `${R2_PUBLIC_DOMAIN}/osint/${recordId}.webp`;
    try {
      imagenPublicUrl = await subirBufferOsintAR2(imageBuffer, recordId, mimeType);
    } catch (errR2: any) {
      console.warn('[Vision-Exhaustivo] Falló subida a R2, continuando pipeline:', errR2?.message);
    }

    // 2. Extracción con Google Cloud Vision
    console.log('[Vision-Exhaustivo] Extrayendo datos con Cloud Vision...');
    const [webResult, landmarkResult] = await Promise.all([
      visionClient.webDetection({ image: { content: imageBuffer } }),
      visionClient.landmarkDetection({ image: { content: imageBuffer } }),
    ]);

    const webDetection = webResult[0]?.webDetection;
    const entidades = (webDetection?.webEntities || [])
      .filter((e) => e.description)
      .map((e) => ({
        descripcion: e.description || '',
        score: Number((e.score || 0).toFixed(3)),
      }));

    const urls = (webDetection?.pagesWithMatchingImages || [])
      .filter((p) => p.url)
      .map((p) => ({
        url: p.url || '',
        titulo: p.pageTitle || 'Sin título',
      }));

    const landmarks = landmarkResult[0]?.landmarkAnnotations || [];
    const coords = landmarks.map((l) => ({
      nombre: l.description || 'Punto de Interés Desconocido',
      score: Number((l.score || 0).toFixed(3)),
      lat: l.locations?.[0]?.latLng?.latitude || null,
      lng: l.locations?.[0]?.latLng?.longitude || null,
    }));

    const metadatos = { entidades, urls, coords };

    // 3. Expansión Cognitiva con Gemini 1.5 Flash (~3000 tokens)
    console.log('[Vision-Exhaustivo] Generando monografía en Gemini 1.5 Flash...');
    const promptOSINT = `Actúa como un investigador de OSINT y arqueología. Usa estas etiquetas, coordenadas y URLs para elaborar un informe enciclopédico exhaustivo y estructurado (alrededor de 3000 tokens). Detalla: historia, geología, descubrimientos, referencias a Wikipedia y análisis de las fuentes web. Mantén un tono neutro y descriptivo (Data Lake), sin conclusiones ensayísticas.

URL PÃƒÅ¡BLICA DE LA IMAGEN EN R2: ${imagenPublicUrl}

[COORDENADAS Y MONUMENTOS DETECTADOS]:
${coords.length > 0 ? JSON.stringify(coords, null, 2) : 'No se identificaron monumentos conocidos ni coordenadas GPS directas.'}

[ENTIDADES WEB IDENTIFICADAS]:
${entidades.length > 0 ? entidades.map((e) => `- ${e.descripcion} (Confianza: ${e.score})`).join('\n') : 'Sin entidades web detectadas.'}

[FUENTES WEB COINCIDENTES]:
${urls.length > 0 ? urls.map((u) => `- [${u.titulo}](${u.url})`).join('\n') : 'Sin páginas indexadas coincidentes.'}

ESTRUCTURA OBLIGATORIA DEL INFORME:
# INFORME TÉCNICO DE INGESTA VISUAL (DATA LAKE ARCHIVO TGP)
## 1. IDENTIFICACIÃƒâ€œN CANÃƒâ€œNICA Y TOPONIMIA
## 2. GEORREFERENCIACIÃƒâ€œN Y CONTEXTO ESPACIAL
## 3. HISTORIA DOCUMENTAL Y REGISTRO ARQUEOLÃƒâ€œGICO
## 4. CONSTITUCIÃƒâ€œN GEOLÃƒâ€œGICA / MATERIAL
## 5. HISTORIOGRAFíA Y DESCUBRIMIENTOS CLAVE
## 6. MAPEO DE FUENTES WEB Y REFERENCIAS ACADÉMICAS
## 7. DISCREPANCIAS, DUDAS ABIERTAS Y ANíLISIS OSINT`;

    const responseGemini = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ text: promptOSINT }],
      config: {
        maxOutputTokens: 4000,
        temperature: 0.2,
      },
    });

    const informeOSINT = responseGemini.text || 'No se pudo generar el cuerpo del informe.';
    const fechaIngesta = new Date().toISOString();

    // 4. Persistencia en Cloudflare D1
    try {
      await guardarEnCloudflareD1({
        id: recordId,
        imagen_url: imagenPublicUrl,
        metadatos_vision: metadatos,
        informe_osint: informeOSINT,
        fecha_ingesta: fechaIngesta,
      });
    } catch (errD1) {
      console.warn('[Vision-Exhaustivo] Aviso en D1:', errD1);
    }

    return c.json({
      id: recordId,
      imagen_url: imagenPublicUrl,
      informe: informeOSINT,
      metadatos,
      fecha_ingesta: fechaIngesta,
    });
  } catch (err: any) {
    console.error('[Vision-Exhaustivo Error]:', err);
    return c.json({ error: 'Fallo en la ingesta exhaustiva.', detalles: err?.message }, 500);
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// RUTA 3C: /api/redaccion-premium -- Fase de Producción Literaria TGP
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post('/api/redaccion-premium', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (TGP_MIND_API_KEY && apiKey !== TGP_MIND_API_KEY) {
    return c.json({ error: 'No autorizado: API Key inválida.' }, 401);
  }

  let body: { id?: string; informe_directo?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Payload JSON inválido.' }, 400); }

  const id = body?.id || crypto.randomUUID();
  let informeTexto = body?.informe_directo || '';
  let imagenUrl = '';

  try {
    if (!informeTexto && body?.id) {
      const registro = await obtenerInformeD1(body.id);
      if (registro) {
        informeTexto = registro.informe_osint;
        imagenUrl = registro.imagen_url;
      }
    }

    if (!informeTexto) {
      return c.json({ error: 'No se encontró el informe OSINT para redactar el ensayo.' }, 400);
    }

    console.log(`[RedacciÃ³n Documental NatGeo] Redactando artÃ­culo forense/arqueolÃ³gico con Gemini Flash (Temp: 0.2) (ID: ${id})...`);
    
    // Super Prompt Granular (Estilo NatGeo / BrÃºjula Verde Â· Modo Grounded Â· Temp 0.2)
    const promptUsuario = `${SYSTEM_PROMPT_NATGEO_GROUNDED}\n\n[INFORME TÃ‰CNICO Y CONTEXTO]:\n${informeTexto}`;

    const responseGemini = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ text: promptUsuario }],
      config: {
        systemInstruction: SYSTEM_PROMPT_NATGEO_GROUNDED,
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const ensayoFinal = responseGemini.text || 'Error al generar el ensayo.';

    console.log('[Redacción Premium] Sintetizando audio narrativo en R2...');
    const audioUrl = await generarYGuardarAudioTTS(id, ensayoFinal);

    try {
      await actualizarRegistroD1(id, ensayoFinal, audioUrl);
    } catch (errD1) {
      console.warn('[Redacción Premium] Aviso actualizando D1:', errD1);
    }

    return c.json({
      id,
      ensayo: ensayoFinal,
      audio_url: audioUrl,
      imagen_url: imagenUrl,
    });
  } catch (err: any) {
    console.error('[Redacción Premium Error]:', err);
    return c.json({ error: 'Fallo al procesar el ensayo premium.', detalles: err?.message }, 500);
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// RUTA 4: /api/telegram/upload-media -- Ingesta programable directa de Telegram a R2
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post('/api/telegram/upload-media', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (TGP_MIND_API_KEY && apiKey !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON invalido' }, 400); }

  const fileId: string = body?.fileId ?? '';
  const slug: string = body?.slug ?? 'telegram-media';
  if (!fileId) return c.json({ error: 'Falta parametro fileId' }, 400);

  try {
    const result = await procesarFotoTelegramAR2(fileId, slug);
    return c.json({ success: true, url: result.url, fileName: result.fileName, mimeType: result.mimeType });
  } catch (err: any) {
    console.error('[API Telegram Upload Media Error]:', err);
    return c.json({ success: false, error: err?.message || 'Error al procesar y subir imagen a R2' }, 500);
  }
});

// ── Google Photos Picker API v1 ──────────────────────────────────────────────
// Flujo session-based (nueva API obligatoria desde 31/03/2025).
// Scope: https://www.googleapis.com/auth/photospicker.mediaitems.readonly
// El backend maneja auth headless, descarga binaria y conversion a Base64.
// El frontend NO descarga nada - recibe data:image/... listo para ingestar.

/** Obtiene un access_token fresco desde el refresh_token del entorno */
async function getGoogleAccessToken(): Promise<string> {
  const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
  const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Faltan credenciales Google OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }).toString(),
  });

  const data = await res.json() as any;
  if (!data.access_token) {
    throw new Error(`Error al refrescar token Google: ${data.error || JSON.stringify(data)}`);
  }
  return data.access_token;
}

// 1. POST /api/picker/session — Crea sesion Picker y devuelve { sessionId, pickerUri }
app.post('/api/picker/session', async (c) => {
  try {
    const accessToken = await getGoogleAccessToken();

    const res = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Picker Session Error]:', res.status, errBody);
      return c.json({ error: `Error al crear sesion Picker: ${res.status}` }, 500);
    }

    const session = await res.json() as any;
    const sessionId: string = session.id || '';
    const rawUri: string   = session.pickerUri || '';
    // autoclose=true cierra la pestana automaticamente tras la seleccion del usuario
    const pickerUri = rawUri
      ? `${rawUri}${rawUri.includes('?') ? '&' : '?'}autoclose=true`
      : null;

    if (!sessionId || !pickerUri) {
      return c.json({ error: 'Respuesta inesperada de la API de Google Picker' }, 500);
    }

    console.log('[Picker] Sesion creada: ' + sessionId);
    return c.json({ sessionId, pickerUri });
  } catch (err: any) {
    console.error('[Picker Session Error]:', err);
    return c.json({ error: err?.message || 'Error al iniciar sesion de Picker' }, 500);
  }
});

// 2. GET /api/picker/poll/:sessionId — Consulta si el usuario ya selecciono fotos
app.get('/api/picker/poll/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  if (!sessionId) return c.json({ error: 'sessionId requerido' }, 400);

  try {
    const accessToken = await getGoogleAccessToken();

    const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Picker Poll Error]:', res.status, errBody);
      // Sesion expirada o invalida
      if (res.status === 404 || res.status === 410) {
        return c.json({ ready: false, expired: true });
      }
      return c.json({ error: `Error al consultar sesion: ${res.status}` }, 500);
    }

    const data = await res.json() as any;
    return c.json({
      ready: !!data.mediaItemsSet,
      pollingInterval: data.pollingConfig?.pollInterval || 3,
    });
  } catch (err: any) {
    console.error('[Picker Poll Error]:', err);
    return c.json({ error: err?.message || 'Error en polling de sesion' }, 500);
  }
});

// 3. GET /api/picker/items/:sessionId — Descarga binario en backend y devuelve Base64
app.get('/api/picker/items/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  if (!sessionId) return c.json({ error: 'sessionId requerido' }, 400);

  let accessToken = '';
  try {
    accessToken = await getGoogleAccessToken();

    const listRes = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}/mediaItems`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const errBody = await listRes.text();
      console.error('[Picker Items Error]:', listRes.status, errBody);
      return c.json({ error: `Error al obtener items: ${listRes.status}` }, 500);
    }

    const listData = await listRes.json() as any;
    const rawItems: any[] = listData.mediaItems || [];

    if (rawItems.length === 0) {
      return c.json({ items: [], message: 'No hay fotos seleccionadas en esta sesion' });
    }

    // Descargar binario en el backend — evita CORS en el frontend
    // Sufijo =d para obtener el archivo original completo sin recorte ni compresion
    const items = await Promise.all(
      rawItems.map(async (item: any) => {
        const baseUrl: string  = item.mediaFile?.baseUrl || item.baseUrl || '';
        const mimeType: string = item.mediaFile?.mimeType || item.mimeType || 'image/jpeg';
        const filename: string = item.filename || `google-photo-${Date.now()}.jpg`;

        if (!baseUrl) {
          console.warn('[Picker Items] Item sin baseUrl:', item.id);
          return null;
        }

        try {
          // =d fuerza la descarga del archivo original (bytes completos sin recorte)
          const downloadUrl = `${baseUrl}=d`;
          const imgRes = await fetch(downloadUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (!imgRes.ok) {
            console.warn(`[Picker Items] Error descargando ${filename}: ${imgRes.status}`);
            return null;
          }

          const buffer  = await imgRes.arrayBuffer();
          const base64  = Buffer.from(buffer).toString('base64');
          const dataUri = `data:${mimeType};base64,${base64}`;

          return { id: item.id, filename, mimeType, base64: dataUri };
        } catch (dlErr: any) {
          console.warn(`[Picker Items] Error procesando ${filename}:`, dlErr.message);
          return null;
        }
      })
    );

    const validItems = items.filter(Boolean);
    console.log(`[Picker] ${validItems.length}/${rawItems.length} items convertidos a Base64`);
    return c.json({ items: validItems });
  } catch (err: any) {
    console.error('[Picker Items Error]:', err);
    return c.json({ error: err?.message || 'Error al procesar items del Picker' }, 500);
  } finally {
    // Limpiar sesion siempre en finally — evita sesiones zombie que consumen cuota
    if (sessionId && accessToken) {
      fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }).catch((e: any) => console.warn('[Picker] Error limpiando sesion:', e.message));
    }
  }
});


// Ã¢â€â‚¬Ã¢â€â‚¬ Proxy Wikimedia CORS-free: /api/proxy/wikimedia?q=... Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// La Mini App Svelte llama aqui en lugar de a Wikimedia directamente.
app.get('/api/proxy/wikimedia', async (c) => {
  const q = c.req.query('q') || '';
  if (!q) return c.json({ imageUrl: '' });
  try {
    const entidad = await resolverEntidadCanonica(q);
    const imageUrl = await buscarPageImageWikipedia(entidad.wikiEn, 'en')
      || await buscarPageImageWikipedia(entidad.wikiEs, 'es')
      || '';
    return c.json({ imageUrl, query: { wikiEn: entidad.wikiEn, wikiEs: entidad.wikiEs } });
  } catch (err: any) {
    return c.json({ imageUrl: '', error: err?.message });
  }
});

// ── POST /api/consolidate-magazine — Procesa array de imágenes Wikimedia a WebP en R2 ────────
app.post('/api/consolidate-magazine', async (c) => {
  try {
    const body = await c.req.json() as { images: { url: string; title: string; author: string; licenseShortName: string }[] };
    const { images } = body;

    if (!Array.isArray(images) || images.length === 0) {
      return c.json({ error: 'El array de imágenes es requerido y no puede estar vacío.' }, 400);
    }
    if (images.length > 30) {
      return c.json({ error: 'Máximo 30 imágenes por consolidación.' }, 400);
    }

    console.log(`[Consolidate Magazine] Iniciando procesamiento secuencial de ${images.length} imágenes...`);
    const results: { title: string; author: string; licenseShortName: string; r2Url: string; originalUrl: string }[] = [];

    // PROCESAMIENTO SECUENCIAL (for...of) — Prohibido Promise.all para evitar OOM en Cloud Run
    for (const img of images) {
      try {
        console.log(`[Consolidate Magazine] Procesando: ${img.title}`);
        // estandarizarYSubirImagenAR2 descarga, convierte a WebP con sharp y sube a R2
        const r2Url = await estandarizarYSubirImagenAR2(img.url, 'bookzine');
        results.push({
          title: img.title,
          author: img.author,
          licenseShortName: img.licenseShortName,
          r2Url,
          originalUrl: img.url,
        });
        console.log(`[Consolidate Magazine] OK -> ${r2Url}`);
      } catch (imgErr: any) {
        console.warn(`[Consolidate Magazine] Error en "${img.title}":`, imgErr.message);
        // Incluir el item fallido con la URL original para que el frontend lo sepa
        results.push({
          title: img.title,
          author: img.author,
          licenseShortName: img.licenseShortName,
          r2Url: img.url, // Fallback: usar URL original si falla
          originalUrl: img.url,
        });
      }
    }

    console.log(`[Consolidate Magazine] Completado: ${results.length} imágenes procesadas.`);
    return c.json({ success: true, results });

  } catch (err: any) {
    console.error('[Consolidate Magazine Error]:', err);
    return c.json({ error: err?.message || 'Error al consolidar la revista en R2.' }, 500);
  }
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[TGP Mind] Puerto ${PORT} -- Listo.`);
});
