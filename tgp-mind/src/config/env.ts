// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Configuración Centralizada de Entorno
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';

export const PORT = parseInt(process.env.PORT || '3001', 10);

// Tokens de Telegram (unificación de alias con fallback total para Cloud Run)
export const TELEGRAM_TOKEN = (process.env.OMNI_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').replace(/['"]/g, '').trim();
export const TELEGRAM_BOT_NAME = (process.env.TELEGRAM_BOT_NAME || 'Analista_IMG_bot').replace(/['"]/g, '').trim();
export const TELEGRAM_SOCIAL_TOKEN = (process.env.REDES_TOKEN || process.env.TELEGRAM_SOCIAL_TOKEN || process.env.TELEGRAM_BOT_TOKEN_SOCIAL || '').replace(/['"]/g, '').trim();
export const TELEGRAM_TGP_CLOUD_TOKEN = (process.env.ASSISTANT_TOKEN || process.env.TELEGRAM_TGP_CLOUD_TOKEN || process.env.TELEGRAM_BOT_TOKEN_ASSISTANT || '').replace(/['"]/g, '').trim();
export const TELEGRAM_DEV_TOKEN = (process.env.TELEGRAM_DEV_TOKEN || process.env.TELEGRAM_DEV_BOT_TOKEN || process.env.LIMINAL_TOKEN || '').replace(/['"]/g, '').trim();
export const TELEGRAM_PREMIUM_TOKEN = (process.env.TELEGRAM_PREMIUM_TOKEN || process.env.TELEGRAM_BOT_TOKEN_PREMIUM || '').replace(/['"]/g, '').trim();

// APIs y Autenticación
export const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();
export const TGP_MIND_API_KEY = (process.env.TGP_MIND_API_KEY || '').replace(/['"]/g, '').trim();
export const XAVIER_CHAT_ID = 7886507052;

// Dialogflow CX
export const DIALOGFLOW_PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID || process.env.DIALOGFLOW_PROJECT || 'tgp-mind';
export const DIALOGFLOW_LOCATION = process.env.DIALOGFLOW_LOCATION || 'us-central1';
export const DIALOGFLOW_AGENT_ID = process.env.DIALOGFLOW_AGENT_ID || '7cf1a08f-1b45-48f4-be5f-155eb3ee2848';

// Cloudflare R2
export const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tgp-storage';
export const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || 'https://storage.thegreatpuzzleproject.com').replace(/\/$/, '');

// Telegram Base URL
export const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
export const TELEGRAM_SOCIAL_API = `https://api.telegram.org/bot${TELEGRAM_SOCIAL_TOKEN}`;

// Twilio WhatsApp (Fase 3)
export const TWILIO_AUTH_TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').replace(/['"]/g, '').trim();
export const TWILIO_ACCOUNT_SID = (process.env.TWILIO_ACCOUNT_SID || '').replace(/['"]/g, '').trim();
export const TWILIO_PHONE_NUMBER = (process.env.TWILIO_PHONE_NUMBER || '').replace(/['"]/g, '').trim();

// Helper de Orígenes Permitidos
export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true;
  return (
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.endsWith('.thegreatpuzzleproject.com') ||
    origin === 'https://thegreatpuzzleproject.com' ||
    origin.endsWith('.pages.dev')
  );
}
