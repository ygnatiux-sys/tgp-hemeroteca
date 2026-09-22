// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Dev Bot Handler (Entorno Aislado de Pruebas / Liminal)
// Bot Name: @UXliminal_bot
// Endpoint Webhook: POST /webhook-dev
// Totalmente desacoplado de la lógica y tokens del bot de producción.
// D1 HITL activo: botContext 'liminal' → claves "chatId:liminal" en D1.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { routeIncomingMessage } from './ia/semantic-router.js';
import {
  ejecutarDecisionAssistant,
  ejecutarEnsayoAssistantDesdeD1,
} from './telegram/router.js';
import { getHITLState, clearHITLState } from './storage/d1.js';

export const devBotApp = new Hono();

// Obtención aislada de credenciales del bot de desarrollo
const getDevToken = () =>
  (process.env.TELEGRAM_DEV_BOT_TOKEN || '8981969434:AAG5KsziYoTCELD_euML7FKJVTYF3_SuyqY')
    .replace(/['"]/g, '')
    .trim();

const getDevBotName = () =>
  (process.env.TELEGRAM_DEV_BOT_NAME || 'UXliminal_bot')
    .replace(/['"]/g, '')
    .trim();

const getTelegramDevApiUrl = () => `https://api.telegram.org/bot${getDevToken()}`;

// ── Helper aislado para comunicación con Telegram API ────────────────────────
async function sendDevTelegramMessage(chatId: number | string, text: string, options: Record<string, any> = {}): Promise<any> {
  const token = getDevToken();
  if (!token) {
    console.error('[DevBot Error] TELEGRAM_DEV_BOT_TOKEN no configurado.');
    return null;
  }

  const url = `${getTelegramDevApiUrl()}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        ...options,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[DevBot Telegram Error] ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[DevBot Fatal Error]:', err);
    return null;
  }
}

// ── GET /status — Healthcheck exclusivo de DevBot ────────────────────────────
devBotApp.get('/status', (c) => {
  const token = getDevToken();
  const maskedToken = token ? `${token.slice(0, 8)}...${token.slice(-6)}` : 'NO_CONFIGURADO';
  return c.json({
    bot: getDevBotName(),
    environment: 'development',
    status: 'online',
    masked_token: maskedToken,
    webhook_endpoint: '/webhook-dev',
    hitl_d1_context: 'liminal',
    timestamp: new Date().toISOString(),
  });
});

// ── POST / — Webhook Handler principal para Telegram Dev (Liminal) ────────────
devBotApp.post('/', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: true });
  }

  console.log(`[DevBot @${getDevBotName()}] Webhook update recibido:`, JSON.stringify(body).slice(0, 200));

  // ── Callback Queries (D1 HITL para Liminal) ───────────────────────────────
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const chatId = callbackQuery.message?.chat?.id;
    const callbackId = callbackQuery.id;
    const data = callbackQuery.data || '';
    const apiOverride = getTelegramDevApiUrl();

    // Responder callback para quitar el spinner del botón
    await fetch(`${apiOverride}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId }),
    });

    if (chatId) {
      // ── liminal_action: interceptado antes del fallback ───────────────────
      if (data.startsWith('liminal_action:')) {
        if (data === 'liminal_action:confirm') {
          await sendDevTelegramMessage(chatId, '⚡ Confirmado. Iniciando redacción (Liminal)...');
          await ejecutarEnsayoAssistantDesdeD1(chatId, apiOverride, 'liminal');
        } else if (data === 'liminal_action:cancel') {
          await clearHITLState(chatId, 'liminal');
          await sendDevTelegramMessage(chatId, '🛑 Publicación cancelada. Escribí un nuevo tema.');
        }
        return c.json({ ok: true });
      }

      // Fallback: otros callbacks pasan por el semantic router (photo_action, etc.)
      const decision = await routeIncomingMessage({
        chatId,
        text: data,
        hasPhoto: false,
        botContext: 'hemeroteca',
      });
      await ejecutarDecisionAssistant(chatId, decision, apiOverride, 'liminal');
    }
    return c.json({ ok: true });
  }

  // ── Mensajes de texto ────────────────────────────────────────────────────
  const message = body?.message;
  if (message) {
    const chatId = message.chat?.id;
    const text: string = message.text || message.caption || '';
    const senderName = message.from?.first_name || 'Desarrollador';

    if (!chatId) return c.json({ ok: true });

    // Comando /start
    if (text.trim().startsWith('/start')) {
      await sendDevTelegramMessage(
        chatId,
        `🧪 *¡Hola, ${senderName}!* Bienvenido al entorno aislado de *@${getDevBotName()}* (Liminal).\n\n` +
          `Este bot opera en un canal de desarrollo independiente sin alterar la producción.\n\n` +
          `📌 *Comandos disponibles:*\n` +
          `• \`/start\` — Muestra este mensaje\n` +
          `• \`/ping\` — Prueba de latencia\n` +
          `• \`/status\` — Estado del entorno\n` +
          `• \`/nuevo\` — Reinicia la sesión y limpia el estado D1\n` +
          `• \`/echo <texto>\` — Repite un mensaje\n\n` +
          `💬 Cualquier texto ejecutará el flujo HITL de Hemeroteca en modo Liminal.`
      );
      return c.json({ ok: true });
    }

    // Comando /ping
    if (text.trim().startsWith('/ping')) {
      const now = new Date().toISOString();
      await sendDevTelegramMessage(chatId, `⚡ *Pong!* Liminal en línea.\n📅 \`${now}\``);
      return c.json({ ok: true });
    }

    // Comando /status
    if (text.trim().startsWith('/status')) {
      const token = getDevToken();
      const masked = token ? `${token.slice(0, 10)}...${token.slice(-5)}` : 'Sin token';
      const state = await getHITLState(chatId, 'liminal');
      await sendDevTelegramMessage(
        chatId,
        `🛠️ *Estado del Bot Dev (@${getDevBotName()}):*\n\n` +
          `• *Entorno:* Isolation / Dev\n` +
          `• *Bot Name:* \`${getDevBotName()}\`\n` +
          `• *Token Activo:* \`${masked}\`\n` +
          `• *D1 Context:* liminal\n` +
          `• *Sesión D1 activa:* ${state ? `✅ Tema: "${state.tema}"` : '❌ Sin sesión'}\n` +
          `• *Status:* Operativo 🚀`
      );
      return c.json({ ok: true });
    }

    // Comando /nuevo — limpia historial Gemini y estado D1 de Liminal
    if (text.trim() === '/nuevo') {
      await clearHITLState(chatId, 'liminal');
      await sendDevTelegramMessage(chatId, '✅ Sesión Liminal reiniciada. Comenzamos de cero. Escribí un nuevo tema.');
      return c.json({ ok: true });
    }

    // Comando /echo
    if (text.trim().startsWith('/echo')) {
      const echoContent = text.replace(/^\/echo\s*/, '') || '(Mensaje vacío)';
      await sendDevTelegramMessage(chatId, `🔁 *[Dev Echo]:* ${echoContent}`);
      return c.json({ ok: true });
    }

    // Redacción HITL con Semantic Router → D1 HITL Liminal
    if (text.trim() || message.photo) {
      const decision = await routeIncomingMessage({
        chatId,
        text,
        hasPhoto: !!message.photo,
        photoUrl: undefined,
        botContext: 'hemeroteca',
      });
      const apiOverride = getTelegramDevApiUrl();
      await ejecutarDecisionAssistant(chatId, decision, apiOverride, 'liminal');
      return c.json({ ok: true });
    }
  }

  return c.json({ ok: true });
});
