// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Dev Bot Handler (Entorno Aislado de Pruebas)
// Bot Name: @UXliminal_bot
// Endpoint Webhook: POST /webhook-dev
// Totalmente desacoplado de la lógica y tokens del bot de producción.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { routeIncomingMessage } from './ia/semantic-router.js';
import { ejecutarDecisionAssistant } from './telegram/router.js';

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

// ── Helper aislado para comunicación con Telegram API ──────────────────────────
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

// ── GET /status — Healthcheck exclusivo de DevBot ─────────────────────────────
devBotApp.get('/status', (c) => {
  const token = getDevToken();
  const maskedToken = token ? `${token.slice(0, 8)}...${token.slice(-6)}` : 'NO_CONFIGURADO';
  return c.json({
    bot: getDevBotName(),
    environment: 'development',
    status: 'online',
    masked_token: maskedToken,
    webhook_endpoint: '/webhook-dev',
    timestamp: new Date().toISOString(),
  });
});

// ── POST / — Webhook Handler principal para Telegram Dev ───────────────────────
devBotApp.post('/', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: true });
  }

  console.log(`[DevBot @${getDevBotName()}] Webhook update recibido:`, JSON.stringify(body).slice(0, 200));

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
        `🧪 *¡Hola, ${senderName}!* Bienvenido al entorno aislado de *@${getDevBotName()}*.\n\n` +
          `Este bot opera en un canal de desarrollo independiente sin alterar la producción.\n\n` +
          `📌 *Comandos de prueba disponibles:*\n` +
          `• \`/start\` — Muestra este mensaje informativo\n` +
          `• \`/ping\` — Prueba de latencia y estado de API Dev\n` +
          `• \`/status\` — Muestra el estado del entorno de desarrollo\n` +
          `• \`/echo <texto>\` — Repite un mensaje de prueba\n\n` +
          `💬 Enviar cualquier otro texto ejecutará un análisis de prueba aislado.`
      );
      return c.json({ ok: true });
    }

    // Comando /ping
    if (text.trim().startsWith('/ping')) {
      const now = new Date().toISOString();
      await sendDevTelegramMessage(chatId, `⚡ *Pong!* Bot de desarrollo en línea.\n📅 \`${now}\``);
      return c.json({ ok: true });
    }

    // Comando /status
    if (text.trim().startsWith('/status')) {
      const token = getDevToken();
      const masked = token ? `${token.slice(0, 10)}...${token.slice(-5)}` : 'Sin token';
      await sendDevTelegramMessage(
        chatId,
        `🛠️ *Estado del Bot Dev (@${getDevBotName()}):*\n\n` +
          `• *Entorno:* Isolation / Dev\n` +
          `• *Bot Name:* \`${getDevBotName()}\`\n` +
          `• *Token Activo:* \`${masked}\`\n` +
          `• *Status:* Operativo 🚀`
      );
      return c.json({ ok: true });
    }

    // Comando /echo
    if (text.trim().startsWith('/echo')) {
      const echoContent = text.replace(/^\/echo\s*/, '') || '(Mensaje vacío)';
      await sendDevTelegramMessage(chatId, `🔁 *[Dev Echo]:* ${echoContent}`);
      return c.json({ ok: true });
    }

    // Redacción HITL con Semantic Router (Igual que Assistant)
    if (text.trim() || message.photo) {
      const decision = await routeIncomingMessage({
        chatId,
        text,
        hasPhoto: !!message.photo,
        photoUrl: undefined, // En DevBot aislado no procesamos la foto hacia R2 antes del router, simplificado
        botContext: 'hemeroteca',
      });
      const apiOverride = getTelegramDevApiUrl();
      await ejecutarDecisionAssistant(chatId, decision, apiOverride);
      return c.json({ ok: true });
    }
  }

  // Soporte para Callback Queries aislados
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data;

    if (chatId && data) {
      // Simular text input con el dato del callback para avanzar el HITL
      const decision = await routeIncomingMessage({
        chatId,
        text: data,
        hasPhoto: false,
        botContext: 'hemeroteca',
      });
      const apiOverride = getTelegramDevApiUrl();
      await ejecutarDecisionAssistant(chatId, decision, apiOverride);
    }
    return c.json({ ok: true });
  }

  return c.json({ ok: true });
});
