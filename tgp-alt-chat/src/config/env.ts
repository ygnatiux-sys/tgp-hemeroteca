// ─────────────────────────────────────────────────────────────────────────────
// TGP ALT CHAT — Configuración Centralizada de Entorno (Docker A)
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';

export const PORT = parseInt(process.env.PORT || '8080', 10);

// APIs y Autenticación
export const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();
export const TGP_MIND_API_KEY = (process.env.TGP_MIND_API_KEY || '').replace(/['"]/g, '').trim();
export const XAVIER_CHAT_ID = 7886507052;

// Cloudflare R2
export const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tgp-storage';
export const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || 'https://storage.thegreatpuzzleproject.com').replace(/\/$/, '');

// Fallbacks de Telegram inactivos para compatibilidad con helpers de storage
export const TELEGRAM_TOKEN = '';
export const TELEGRAM_BOT_NAME = '';
export const TELEGRAM_SOCIAL_TOKEN = '';
export const TELEGRAM_TGP_CLOUD_TOKEN = '';
export const TELEGRAM_DEV_TOKEN = '';
export const TELEGRAM_PREMIUM_TOKEN = '';
export const TELEGRAM_API = '';
export const TELEGRAM_SOCIAL_API = '';

// Google Chat Webhooks y Espacios
export const CHAT_SPACE_TECNICO = process.env.CHAT_SPACE_TECNICO || 'spaces/zQLnFqAAAAE';
export const CHAT_VIGIA_WEBHOOK_URL = process.env.CHAT_VIGIA_WEBHOOK_URL || process.env.GOOGLE_CHAT_WEBHOOK_URL || '';

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
