// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// TGP MIND Ã¢â‚¬â€ Orquestador IA con Hono + Gemini + Inline Keyboard Wizard
// Autor: TGP / Xavier BenÃƒÂ­tez
// Deploy: Google Cloud Run
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
// Ã¢â€â‚¬Ã¢â€â‚¬ Gemini (ver src/ia/gemini.ts) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
import {
  GEMINI_API_KEY,
  genai,
  googleAI,
  callGemini,
  crearModeloEnsayo,
} from './src/ia/gemini.js';
// Ã¢â€â‚¬Ã¢â€â‚¬ Telegram Bot Principal (ver src/telegram/helpers.ts) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
import {
  initTelegramHelpers,
  SesionConfig,
  sesiones,
  pendingTextQueries,
  buildInlineKeyboard,
  sendTelegram,
  answerCallbackQuery,
  editMessageReplyMarkup,
  editMessageText,
} from './src/telegram/helpers.js';
// Ã¢â€â‚¬Ã¢â€â‚¬ Telegram Bot Social + Zernio (ver src/telegram/social.ts) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
import {
  initSocialBot,
  SesionSocialConfig,
  sesionesSocial,
  buildSocialInlineKeyboard,
  sendTelegramSocial,
  answerCallbackQuerySocial,
  editMessageReplyMarkupSocial,
  editMessageTextSocial,
  publicarEnZernio,
} from './src/telegram/social.js';
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

// Ã¢â€â‚¬Ã¢â€â‚¬ ConfiguraciÃƒÂ³n Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
const TELEGRAM_SOCIAL_TOKEN     = process.env.REDES_TOKEN || process.env.TELEGRAM_SOCIAL_TOKEN || '';
const TELEGRAM_TGP_CLOUD_TOKEN  = process.env.ASSISTANT_TOKEN || process.env.TELEGRAM_TGP_CLOUD_TOKEN || '';
const TELEGRAM_DEV_TOKEN        = process.env.TELEGRAM_DEV_BOT_TOKEN   || '';
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Inicializar mÃƒÂ³dulos de Telegram/Social con la config del entorno Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
initTelegramHelpers(TELEGRAM_API, XAVIER_CHAT_ID);
initSocialBot({
  telegramSocialApi: TELEGRAM_SOCIAL_API,
  zernioApiKey:      ZERNIO_API_KEY,
  zernioFbId:        ZERNIO_FB_ID,
  zernioTiktokId:    ZERNIO_TIKTOK_ID,
});

// TGP_SYSTEM_PROMPT, genai, googleAI, callGemini, crearModeloEnsayo
// Ã¢â€ â€™ importados desde ./src/ia/gemini.js

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
// Ã¢â€ â€™ importados desde ./src/telegram/helpers.js

import { devBotApp } from './src/devBot.js';

// Ã¢â€â‚¬Ã¢â€â‚¬ Hono App Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const app = new Hono();

// ── CORS global (permite x-api-key, x-api-token y x-mini-app desde los orígenes del proyecto) ──
app.use('*', cors({
  origin: [
    'https://thegreatpuzzleproject.com',
    'https://www.thegreatpuzzleproject.com',
    'http://localhost:4321',
    'http://127.0.0.1:4321',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-api-token', 'x-mini-app', 'X-Mini-App'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}));

app.get('/', (c) => c.json({ status: 'TGP Mind activo', ts: new Date().toISOString() }));

// Ã¢â€â‚¬Ã¢â€â‚¬ RUTA AISLADA DE DESARROLLO (@UXliminal_bot) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.route('/webhook-dev', devBotApp);

// -- Nuevo Webhook Unificado Multi-Bot -----------------------------------------
import { handleTelegramWebhook } from './src/telegram/webhook.js';

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

// Rutas de Webhook Multi-Bot
app.post(`/bot${TELEGRAM_TOKEN}`, async (c) => {
  const update = await c.req.json();
  await handleTelegramWebhook(update, 'omni', TELEGRAM_TOKEN);
  return c.text('OK');
});

app.post(`/bot${TELEGRAM_SOCIAL_TOKEN}`, async (c) => {
  const update = await c.req.json();
  await handleTelegramWebhook(update, 'redes', TELEGRAM_SOCIAL_TOKEN);
  return c.text('OK');
});

app.post(`/bot${TELEGRAM_TGP_CLOUD_TOKEN}`, async (c) => {
  const update = await c.req.json();
  await handleTelegramWebhook(update, 'assistant', TELEGRAM_TGP_CLOUD_TOKEN);
  return c.text('OK');
});

app.post(`/bot${TELEGRAM_DEV_TOKEN}`, async (c) => {
  const update = await c.req.json();
  await handleTelegramWebhook(update, 'liminal', TELEGRAM_DEV_TOKEN);
  return c.text('OK');
});

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// RUTA: /process-image -- TransformaciÃƒÂ³n Estructural & Deriva EstÃƒÂ©tica (Laboratorio Visual)
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post('/process-image', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File | undefined;
    const mode = (formData['mode'] as string) || 'opencv';

    if (!file) {
      return c.json({ error: 'No se enviÃƒÂ³ ningÃƒÂºn archivo de imagen.' }, 400);
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
    return c.json({ error: 'No autorizado: API Key invÃƒÂ¡lida.' }, 401);
  }

  let body: { imageBase64?: string; mimeType?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Payload JSON malformado.' }, 400); }

  const { imageBase64, mimeType = 'image/webp' } = body;
  if (!imageBase64) return c.json({ error: 'Se requiere el parÃƒÂ¡metro "imageBase64".' }, 400);

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
      console.warn('[Vision-Exhaustivo] FallÃƒÂ³ subida a R2, continuando pipeline:', errR2?.message);
    }

    // 2. ExtracciÃƒÂ³n con Google Cloud Vision
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
        titulo: p.pageTitle || 'Sin tÃƒÂ­tulo',
      }));

    const landmarks = landmarkResult[0]?.landmarkAnnotations || [];
    const coords = landmarks.map((l) => ({
      nombre: l.description || 'Punto de InterÃƒÂ©s Desconocido',
      score: Number((l.score || 0).toFixed(3)),
      lat: l.locations?.[0]?.latLng?.latitude || null,
      lng: l.locations?.[0]?.latLng?.longitude || null,
    }));

    const metadatos = { entidades, urls, coords };

    // 3. ExpansiÃƒÂ³n Cognitiva con Gemini 1.5 Flash (~3000 tokens)
    console.log('[Vision-Exhaustivo] Generando monografÃƒÂ­a en Gemini 1.5 Flash...');
    const promptOSINT = `ActÃƒÂºa como un investigador de OSINT y arqueologÃƒÂ­a. Usa estas etiquetas, coordenadas y URLs para elaborar un informe enciclopÃƒÂ©dico exhaustivo y estructurado (alrededor de 3000 tokens). Detalla: historia, geologÃƒÂ­a, descubrimientos, referencias a Wikipedia y anÃƒÂ¡lisis de las fuentes web. MantÃƒÂ©n un tono neutro y descriptivo (Data Lake), sin conclusiones ensayÃƒÂ­sticas.

URL PÃƒÅ¡BLICA DE LA IMAGEN EN R2: ${imagenPublicUrl}

[COORDENADAS Y MONUMENTOS DETECTADOS]:
${coords.length > 0 ? JSON.stringify(coords, null, 2) : 'No se identificaron monumentos conocidos ni coordenadas GPS directas.'}

[ENTIDADES WEB IDENTIFICADAS]:
${entidades.length > 0 ? entidades.map((e) => `- ${e.descripcion} (Confianza: ${e.score})`).join('\n') : 'Sin entidades web detectadas.'}

[FUENTES WEB COINCIDENTES]:
${urls.length > 0 ? urls.map((u) => `- [${u.titulo}](${u.url})`).join('\n') : 'Sin pÃƒÂ¡ginas indexadas coincidentes.'}

ESTRUCTURA OBLIGATORIA DEL INFORME:
# INFORME TÃƒâ€°CNICO DE INGESTA VISUAL (DATA LAKE ARCHIVO TGP)
## 1. IDENTIFICACIÃƒâ€œN CANÃƒâ€œNICA Y TOPONIMIA
## 2. GEORREFERENCIACIÃƒâ€œN Y CONTEXTO ESPACIAL
## 3. HISTORIA DOCUMENTAL Y REGISTRO ARQUEOLÃƒâ€œGICO
## 4. CONSTITUCIÃƒâ€œN GEOLÃƒâ€œGICA / MATERIAL
## 5. HISTORIOGRAFÃƒÂA Y DESCUBRIMIENTOS CLAVE
## 6. MAPEO DE FUENTES WEB Y REFERENCIAS ACADÃƒâ€°MICAS
## 7. DISCREPANCIAS, DUDAS ABIERTAS Y ANÃƒÂLISIS OSINT`;

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
// RUTA 3C: /api/redaccion-premium -- Fase de ProducciÃƒÂ³n Literaria TGP
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post('/api/redaccion-premium', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (TGP_MIND_API_KEY && apiKey !== TGP_MIND_API_KEY) {
    return c.json({ error: 'No autorizado: API Key invÃƒÂ¡lida.' }, 401);
  }

  let body: { id?: string; informe_directo?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Payload JSON invÃƒÂ¡lido.' }, 400); }

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
      return c.json({ error: 'No se encontrÃƒÂ³ el informe OSINT para redactar el ensayo.' }, 400);
    }

    console.log(`[RedacciÃƒÂ³n Premium] Redactando ensayo con Gemini 1.5 Pro + Grounding (ID: ${id})...`);
    const SYSTEM_PROMPT_PREMIUM = `ActÃƒÂºa en Modo TGP. Eres un ensayista y crÃƒÂ­tico cultural contemporÃƒÂ¡neo de alto nivel.
Usa este informe tÃƒÂ©cnico para redactar un ensayo cultural y filosÃƒÂ³fico breve, profundo y crÃƒÂ­tico.
Estructura rigurosa TGP:
1) Gancho visual evocador y misterioso
2) Contexto histÃƒÂ³rico y arqueolÃƒÂ³gico preciso
3) Concepto filosÃƒÂ³fico o tÃƒÂ©cnico nuclear
4) Cierre existencial y universal sobre la condiciÃƒÂ³n humana.
Estilo: Ensayo argentino contemporÃƒÂ¡neo. Denso, sin introducciones vacÃƒÂ­as, con ritmo narrativo y elegancia Dark Academia.`;

    const responseGemini = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ text: `INFORME TÃƒâ€°CNICO (DATA LAKE):\n\n${informeTexto}\n\nEscribe el ensayo definitivo TGP.` }],
      config: {
        systemInstruction: SYSTEM_PROMPT_PREMIUM,
        temperature: 0.75,
        maxOutputTokens: 2500,
        tools: [{ googleSearch: {} }],
      },
    });

    const ensayoFinal = responseGemini.text || 'Error al generar el ensayo.';

    console.log('[RedacciÃƒÂ³n Premium] Sintetizando audio narrativo en R2...');
    const audioUrl = await generarYGuardarAudioTTS(id, ensayoFinal);

    try {
      await actualizarRegistroD1(id, ensayoFinal, audioUrl);
    } catch (errD1) {
      console.warn('[RedacciÃƒÂ³n Premium] Aviso actualizando D1:', errD1);
    }

    return c.json({
      id,
      ensayo: ensayoFinal,
      audio_url: audioUrl,
      imagen_url: imagenUrl,
    });
  } catch (err: any) {
    console.error('[RedacciÃƒÂ³n Premium Error]:', err);
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
