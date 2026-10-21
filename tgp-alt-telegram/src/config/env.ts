// ─────────────────────────────────────────────────────────────────────────────
// TGP ALT TELEGRAM — Configuración Centralizada de Entorno (Docker B)
// Bot Oficial: @tgpAlternative_bot
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';

export const PORT = parseInt(process.env.PORT || '8080', 10);

// Token Único del Bot Telegram (@tgpAlternative_bot)
export const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').replace(/['"]/g, '').trim();
export const TELEGRAM_TOKEN = TELEGRAM_BOT_TOKEN;
export const TELEGRAM_BOT_NAME = (process.env.TELEGRAM_BOT_NAME || 'tgpAlternative_bot').replace(/['"]/g, '').trim();

// Aliases mapeados al mismo bot para compatibilidad total con handlers de media y keyboards
export const TELEGRAM_SOCIAL_TOKEN = TELEGRAM_BOT_TOKEN;
export const TELEGRAM_TGP_CLOUD_TOKEN = TELEGRAM_BOT_TOKEN;
export const TELEGRAM_DEV_TOKEN = TELEGRAM_BOT_TOKEN;
export const TELEGRAM_PREMIUM_TOKEN = TELEGRAM_BOT_TOKEN;

// APIs y Autenticación
export const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();
export const TGP_MIND_API_KEY = (process.env.TGP_MIND_API_KEY || '').replace(/['"]/g, '').trim();
export const XAVIER_CHAT_ID = 7886507052;

// Cloudflare R2 (Almacenamiento de Portadas, Fotos y Audio)
export const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tgp-storage';
export const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || 'https://storage.thegreatpuzzleproject.com').replace(/\/$/, '');

// Telegram Base URL
export const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
export const TELEGRAM_SOCIAL_API = TELEGRAM_API;

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
