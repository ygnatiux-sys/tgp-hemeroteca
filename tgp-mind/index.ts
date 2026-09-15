// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Orquestador IA con Hono + Gemini + Dialogflow CX
// Autor: TGP / Xavier Benítez
// Deploy: Google Cloud Run
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// ── Configuración ─────────────────────────────────────────────────────────────
const PORT                = parseInt(process.env.PORT || '3001');
const TELEGRAM_TOKEN      = process.env.TELEGRAM_TOKEN || '';
const GEMINI_API_KEY      = process.env.GEMINI_API_KEY || '';
const TGP_MIND_API_KEY    = process.env.TGP_MIND_API_KEY || '';
const XAVIER_CHAT_ID      = 7886507052;
const DIALOGFLOW_PROJECT  = process.env.DIALOGFLOW_PROJECT || '';
const DIALOGFLOW_LOCATION = process.env.DIALOGFLOW_LOCATION || 'us-central1';
const DIALOGFLOW_AGENT_ID = process.env.DIALOGFLOW_AGENT_ID || '';
const TELEGRAM_API        = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ── System Prompt TGP ─────────────────────────────────────────────────────────
const TGP_SYSTEM_PROMPT = `Eres el motor cognitivo de TGP Project y el socio analítico de Xavier Benítez. Tu función es reinterpretar la historia y la complejidad para comprender la condición humana, con un enfoque filosófico, histórico y crítico.

REGLAS DE INTERACCIÓN:

Identidad implícita: Nunca declares tu rol ni uses fórmulas autorreferenciales (ej: 'Como IA...').

Tono: Dark Academia accesible. Preciso, sobrio, agudo, con calidez humanista. Cero estéticas superficiales, 'hippies' o mecánicas.

Rigor dialéctico: Cuestiona premisas con respeto y curiosidad para elevar el nivel del análisis.

Modo por defecto: Directo, sin introducciones ni redundancias. Ve al núcleo conceptual inmediatamente.

Estilo de escritura: Ensayo argentino contemporáneo. Combina claridad, densidad conceptual y ritmo narrativo.

Cuando se te solicite explícitamente el 'Modo TGP', estructura tu respuesta así:
1) Gancho visual
2) Contexto claro
3) Concepto técnico clave
4) Cierre humano y universal

Si no se solicita el Modo TGP, responde en tu tono directo habitual.

En respuestas para el sidebar web, usá estas etiquetas cuando sea pertinente:
- <Analisis>contenido</Analisis> para bloques de análisis profundo
- <Codigo>bloque de código</Codigo> para ejemplos técnicos
- <Cita>texto</Cita> para citas o referencias clave`;

// ── Gemini Client ─────────────────────────────────────────────────────────────
const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ── Historial de conversación en memoria ──────────────────────────────────────
type HistoryEntry = { role: 'user' | 'model'; parts: Array<{ text: string }> };
const conversationHistory = new Map<string, HistoryEntry[]>();
const MAX_TURNS = 20;

function getHistory(sessionId: string): HistoryEntry[] {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, []);
  }
  return conversationHistory.get(sessionId)!;
}

function pushToHistory(sessionId: string, role: 'user' | 'model', text: string) {
  const history = getHistory(sessionId);
  history.push({ role, parts: [{ text }] });
  if (history.length > MAX_TURNS * 2) {
    history.splice(0, 2);
  }
}

// ── Llamada a Gemini con contexto ─────────────────────────────────────────────
async function callGemini(
  sessionId: string,
  userMessage: string,
  model: 'gemini-1.5-flash-latest' | 'gemini-1.5-pro-latest' = 'gemini-1.5-flash-latest'
): Promise<string> {
  const history = getHistory(sessionId);

  const chat = genai.chats.create({
    model,
    config: {
      systemInstruction: TGP_SYSTEM_PROMPT,
      temperature: 0.82,
      maxOutputTokens: 2048,
    },
    history: history.length > 0 ? history : undefined,
  });

  pushToHistory(sessionId, 'user', userMessage);
  const response = await chat.sendMessage({ message: userMessage });
  const responseText = response.text ?? '';
  pushToHistory(sessionId, 'model', responseText);

  return responseText;
}

// ── Comandos de Sistema (Fallback local, futuro Dialogflow CX) ────────────────
async function handleSystemCommand(sessionId: string, text: string): Promise<string> {
  // TODO: Conectar con @google-cloud/dialogflow-cx en el futuro.
  // Por ahora, manejamos un diccionario simple local.
  const command = text.trim().toLowerCase();
  
  const commands: Record<string, string> = {
    '/start': 'Sistema TGP Mind inicializado. Nodo cognitivo en línea.',
    '/status': 'TGP Mind operativo. Enrutamiento local activo.',
    '/help': 'Comandos disponibles:\n- /status\n- /pro [texto] o [Deep] [texto] para Gemini Pro\n- Texto libre para Gemini Flash.'
  };

  if (commands[command]) {
    return commands[command];
  }
  
  return `Comando no reconocido: ${command}. Usá /help para ver las opciones, o escribí texto normal para conversar.`;
}

// ── Telegram helper ───────────────────────────────────────────────────────────
async function sendTelegram(chatId: number, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

// ── Hono App ──────────────────────────────────────────────────────────────────
const app = new Hono();

// Health check — Cloud Run lo necesita
app.get('/', (c) => c.json({ status: 'TGP Mind activo', ts: new Date().toISOString() }));

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 1: Webhook privado de Telegram
// ─────────────────────────────────────────────────────────────────────────────
app.post('/webhook/telegram', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

  const message = body?.message;
  const chatId: number | undefined = message?.chat?.id;
  const text: string = message?.text ?? '';

  if (!chatId || !text) return c.json({ ok: true });

  // Guard: solo Xavier
  if (chatId !== XAVIER_CHAT_ID) {
    await sendTelegram(chatId, 'Acceso denegado. Nodo privado TGP.');
    return c.json({ ok: true });
  }

  const sessionId = `tg-${chatId}`;
  let response: string;

  if (text.startsWith('/') && !/^\/(pro|deep)\s/i.test(text)) {
    // Comando → Fallback local (futuro Dialogflow CX)
    response = await handleSystemCommand(sessionId, text);
  } else if (/^\/(pro|deep)\s+/i.test(text)) {
    // /pro o /deep → Gemini Pro
    const query = text.replace(/^\/(pro|deep)\s+/i, '');
    response = await callGemini(sessionId, query, 'gemini-1.5-pro-latest');
  } else if (/^\[deep\]/i.test(text)) {
    // [Deep] → Gemini Pro
    const query = text.replace(/^\[deep\]\s*/i, '');
    response = await callGemini(sessionId, query, 'gemini-1.5-pro-latest');
  } else {
    // Texto normal → Flash
    response = await callGemini(sessionId, text, 'gemini-1.5-flash-latest');
  }

  await sendTelegram(chatId, response);
  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 2: /api/mind — Sidebar local
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/*', cors({
  origin: (origin) => {
    // Permitir CORS solo para entornos locales
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return origin;
    }
    return null;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'OPTIONS'],
}));

app.post('/api/mind', async (c) => {
  // Guard: API Key
  const auth = (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!TGP_MIND_API_KEY || auth !== TGP_MIND_API_KEY) {
    return c.json({ error: 'No autorizado.' }, 401);
  }

  // El middleware CORS de Hono ya manejó los headers y el origen,
  // pero podemos re-verificar si queremos ser estrictos:
  const origin = c.req.header('Origin') ?? '';
  const isLocal = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  if (origin && !isLocal) {
    return c.json({ error: 'Origen no permitido.' }, 403);
  }

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido.' }, 400); }

  const rawMessage: string = body?.message ?? '';
  const sessionId: string = body?.sessionId ?? 'sidebar-default';
  const usePro = body?.usePro === true || /^\/(pro|deep)\s+/i.test(rawMessage);
  const cleanMessage = rawMessage.replace(/^\/(pro|deep)\s+/i, '').trim();

  if (!cleanMessage) return c.json({ error: 'Mensaje vacío.' }, 400);

  const model = usePro ? 'gemini-1.5-pro-latest' : 'gemini-1.5-flash-latest';
  const responseText = await callGemini(sessionId, cleanMessage, model);

  return c.json({ response: responseText, model, sessionId });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[TGP Mind] Puerto ${PORT} — Listo.`);
});
