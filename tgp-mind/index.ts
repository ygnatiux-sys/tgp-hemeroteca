// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Orquestador IA con Hono + Gemini + Inline Keyboard Wizard
// Autor: TGP / Xavier Benítez
// Deploy: Google Cloud Run
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Octokit } from '@octokit/rest';
import 'dotenv/config';

// ── Configuración ─────────────────────────────────────────────────────────────
const PORT               = parseInt(process.env.PORT || '3001');
const TELEGRAM_TOKEN     = process.env.TELEGRAM_TOKEN || '';
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY || '';
const TGP_MIND_API_KEY   = process.env.TGP_MIND_API_KEY || '';
const XAVIER_CHAT_ID     = 7886507052;
const DIALOGFLOW_PROJECT  = process.env.DIALOGFLOW_PROJECT  || '';
const DIALOGFLOW_LOCATION = process.env.DIALOGFLOW_LOCATION || 'us-central1';
const DIALOGFLOW_AGENT_ID = process.env.DIALOGFLOW_AGENT_ID || '';
const TELEGRAM_API        = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const TELEGRAM_SOCIAL_TOKEN = process.env.TELEGRAM_SOCIAL_TOKEN || '';
const ZERNIO_API_KEY        = process.env.ZERNIO_API_KEY || '';
const ZERNIO_FB_ID          = process.env.ZERNIO_FB_ID || '';
const ZERNIO_TIKTOK_ID      = process.env.ZERNIO_TIKTOK_ID || '';
const TELEGRAM_SOCIAL_API   = `https://api.telegram.org/bot${TELEGRAM_SOCIAL_TOKEN}`;

// ── Cloudflare R2 ─────────────────────────────────────────────────────────────
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID      = process.env.R2_ACCESS_KEY_ID      || '';
const R2_SECRET_ACCESS_KEY  = process.env.R2_SECRET_ACCESS_KEY  || '';
const R2_BUCKET_NAME        = process.env.R2_BUCKET_NAME        || 'tgp-storage';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── GitHub / Octokit ──────────────────────────────────────────────────────────
const GITHUB_TOKEN             = process.env.GITHUB_TOKEN             || '';
const GITHUB_TOKEN_HEMEROTECA  = process.env.GITHUB_TOKEN_HEMEROTECA  || GITHUB_TOKEN;
const GITHUB_REPO_HEMEROTECA   = process.env.GITHUB_REPO_HEMEROTECA   || 'ygnatiux-sys/tgp-hemeroteca';
const GITHUB_TOKEN_ALTERNATIVE = process.env.GITHUB_TOKEN_ALTERNATIVE || GITHUB_TOKEN;
const GITHUB_REPO_ALTERNATIVE  = process.env.GITHUB_REPO              || 'ygnatiux-sys/tgp-webfinal2026';
// Singleton solo para rutas no-webhook
const octokit = new Octokit({ auth: GITHUB_TOKEN });

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

// ── Gemini Client (conversacional) ───────────────────────────────────────────
const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ── Historial de conversación en memoria ─────────────────────────────────────
type HistoryEntry = { role: 'user' | 'model'; parts: Array<{ text: string }> };
const conversationHistory = new Map<string, HistoryEntry[]>();
const MAX_TURNS = 20;

function getHistory(sessionId: string): HistoryEntry[] {
  if (!conversationHistory.has(sessionId)) conversationHistory.set(sessionId, []);
  return conversationHistory.get(sessionId)!;
}

function pushToHistory(sessionId: string, role: 'user' | 'model', text: string) {
  const history = getHistory(sessionId);
  history.push({ role, parts: [{ text }] });
  if (history.length > MAX_TURNS * 2) history.splice(0, 2);
}

// ── Llamada a Gemini con contexto ─────────────────────────────────────────────
async function callGemini(
  sessionId: string,
  userMessage: string,
  model: 'gemini-3.8-flash' | 'gemini-2.5-pro' = 'gemini-3.8-flash',
  overrideSystemPrompt?: string
): Promise<string> {
  const history = getHistory(sessionId);
  const chat = genai.chats.create({
    model,
    config: { systemInstruction: overrideSystemPrompt || TGP_SYSTEM_PROMPT, temperature: 0.82, maxOutputTokens: 2048 },
    history: history.length > 0 ? history : undefined,
  });
  pushToHistory(sessionId, 'user', userMessage);
  const response = await chat.sendMessage({ message: userMessage });
  const responseText = response.text ?? '';
  pushToHistory(sessionId, 'model', responseText);
  return responseText;
}

// ── Fábrica de Modelos con Structured Outputs (dinámica por secciones) ───────
const googleAI = new GoogleGenerativeAI(GEMINI_API_KEY);

function crearModeloEnsayo(
  cantidadImg: number,
  modelName: 'gemini-3.8-flash' | 'gemini-2.5-pro' = 'gemini-3.8-flash'
) {
  const esquema: ResponseSchema = {
    description: `Ensayo cinemático compuesto por exactamente ${cantidadImg} secciones.`,
    type: SchemaType.OBJECT,
    properties: {
      titulo: { type: SchemaType.STRING, description: 'Título del ensayo cinemático', nullable: false },
      secciones: {
        type: SchemaType.ARRAY,
        description: `Arreglo con exactamente ${cantidadImg} secciones del ensayo cinemático`,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            busqueda_wikimedia: {
              type: SchemaType.STRING,
              description: 'Término de búsqueda preciso en inglés o español para Wikimedia Commons',
              nullable: false,
            },
            parrafo: {
              type: SchemaType.STRING,
              description: 'Párrafo analítico y narrativo de la sección del ensayo',
              nullable: false,
            },
          },
          required: ['busqueda_wikimedia', 'parrafo'],
        },
      },
    },
    required: ['titulo', 'secciones'],
  };
  return googleAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json', responseSchema: esquema },
  });
}

// ─── URL de imagen de reserva alojada en R2 (usada cuando ninguna busqueda da resultado) ───
const FALLBACK_IMAGE_URL = 'https://storage.thegreatpuzzleproject.com/tgp-fallback.jpg';

// ── Procesamiento de Imágenes (Wikimedia ES/EN + Commons → Cloudflare R2) ─────
async function buscarImagenWikipedia(termino: string, lang: 'es' | 'en'): Promise<string> {
  const ua  = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const base = `https://${lang}.wikipedia.org/w/api.php`;

  // Paso 1: página directa
  const url1 = `${base}?action=query&titles=${encodeURIComponent(termino)}&prop=pageimages&format=json&pithumbsize=1000&redirects=1`;
  const d1   = await (await fetch(url1, { headers: { 'User-Agent': ua } })).json() as any;
  if (d1?.query?.pages) {
    for (const id in d1.query.pages) {
      const src = d1.query.pages[id]?.thumbnail?.source;
      if (src) return src;
    }
  }

  // Paso 2: búsqueda de texto completa
  const url2 = `${base}?action=query&generator=search&gsrsearch=${encodeURIComponent(termino)}&gsrlimit=5&prop=pageimages&format=json&pithumbsize=1000`;
  const d2   = await (await fetch(url2, { headers: { 'User-Agent': ua } })).json() as any;
  if (d2?.query?.pages) {
    for (const id in d2.query.pages) {
      const src = d2.query.pages[id]?.thumbnail?.source;
      if (src) return src;
    }
  }
  return '';
}

async function buscarImagenCommons(termino: string): Promise<string> {
  const ua  = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(termino)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&format=json`;
  try {
    const d = await (await fetch(url, { headers: { 'User-Agent': ua } })).json() as any;
    if (d?.query?.pages) {
      for (const id in d.query.pages) {
        const info = d.query.pages[id]?.imageinfo?.[0];
        if (info?.url && /\.(jpg|jpeg|png|webp)$/i.test(info.url)) return info.url;
      }
    }
  } catch {}
  return '';
}

async function generarTerminosAlternativos(tema: string): Promise<string[]> {
  try {
    const prompt = `Para buscar imágenes en Wikipedia de "${tema}", dame 4 términos de búsqueda alternativos en español e inglés, más amplios o más específicos, separados por coma. Solo los términos, sin explicación.`;
    const resp   = await genai.models.generateContent({ model: 'gemini-3.8-flash', contents: [{ text: prompt }] });
    return (resp.text || '')
      .split(',')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 2);
  } catch { return []; }
}

async function subirImagenAR2(imageUrl: string): Promise<string> {
  const ua     = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': ua } });
  if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status} al descargar imagen`);
  const buffer   = Buffer.from(await imgRes.arrayBuffer());
  const archivo  = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.jpg`;
  await r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: archivo, Body: buffer, ContentType: 'image/jpeg' }));
  const publicUrl = `https://storage.thegreatpuzzleproject.com/${archivo}`;
  console.log(`[R2] Subida: ${publicUrl}`);
  return publicUrl;
}

async function procesarImagen(terminoBusqueda: string): Promise<string> {
  console.log(`[Imagen] Buscando: "${terminoBusqueda}"`);
  try {
    // Estrategia 1: Wikipedia ES
    let raw = await buscarImagenWikipedia(terminoBusqueda, 'es');

    // Estrategia 2: Wikipedia EN
    if (!raw) raw = await buscarImagenWikipedia(terminoBusqueda, 'en');

    // Estrategia 3: términos alternativos generados por Gemini
    if (!raw) {
      const alternos = await generarTerminosAlternativos(terminoBusqueda);
      console.log(`[Imagen] Alternos Gemini: ${alternos.join(', ')}`);
      for (const alt of alternos) {
        raw = await buscarImagenWikipedia(alt, 'es') || await buscarImagenWikipedia(alt, 'en');
        if (raw) break;
      }
    }

    // Estrategia 4: Wikimedia Commons
    if (!raw) raw = await buscarImagenCommons(terminoBusqueda);

    if (!raw) { console.warn(`[Imagen] Sin resultados para: "${terminoBusqueda}"`); return ''; }

    return await subirImagenAR2(raw);
  } catch (err) {
    console.error(`[procesarImagen] Error para "${terminoBusqueda}":`, err);
    return '';
  }
}

// ── Fase 3: GitOps y Markdoc para Astro ──────────────────────────────────────
function generarSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generarMarkdoc(ensayo: {
  titulo: string;
  secciones: Array<{ busqueda_wikimedia?: string; imagen_url?: string; parrafo: string }>;
}): { slug: string; contenidoMdoc: string } {
  const slug       = generarSlug(ensayo.titulo || 'ensayo-cinematico');
  const fechaHoy   = new Date().toISOString().split('T')[0];
  const coverImage = ensayo.secciones?.[0]?.imagen_url || ensayo.secciones?.[0]?.busqueda_wikimedia || '';
  const excerpt    = ensayo.secciones?.[0]?.parrafo
    ? ensayo.secciones[0].parrafo.slice(0, 180) + '...'
    : '';

  let mdoc = `---
title: "${ensayo.titulo.replace(/"/g, '\\"')}"
date: "${fechaHoy}"
atmosfera: "obsidiana"
coverImage: "${coverImage}"
excerpt: "${excerpt.replace(/"/g, '\\"')}"
generador: "TGP Mind (Gemini + R2 + GitOps)"
---

`;

  if (Array.isArray(ensayo.secciones)) {
    ensayo.secciones.forEach((seccion, idx) => {
      const img = seccion.imagen_url || seccion.busqueda_wikimedia;
      if (img) mdoc += `![${ensayo.titulo} -- Seccion ${idx + 1}](${img})\n\n`;
      if (seccion.parrafo) mdoc += `${seccion.parrafo.trim()}\n\n`;
    });
  }

  return { slug, contenidoMdoc: mdoc.trim() + '\n' };
}

async function publicarEnGitHub(
  slug: string,
  contenidoMdoc: string,
  token: string,
  repoFull: string
): Promise<string> {
  const octokitDynamic = new Octokit({ auth: token });
  const parts  = repoFull.includes('/') ? repoFull.split('/') : ['ygnatiux-sys', repoFull];
  const owner  = parts[0] || 'ygnatiux-sys';
  const repo   = parts[1];
  const branch = process.env.GITHUB_BRANCH || 'main';
  const path   = `src/content/ensayosCinematicos/${slug}.mdoc`;

  let sha: string | undefined;
  try {
    const existing = await octokitDynamic.repos.getContent({ owner, repo, path, ref: branch });
    if ('sha' in existing.data) sha = existing.data.sha;
  } catch (err: any) {
    if (err.status !== 404) console.warn(`[GitHub] Consulta (${path}): ${err.message}`);
  }

  const contentBase64 = Buffer.from(contenidoMdoc, 'utf-8').toString('base64');
  const commitRes = await octokitDynamic.repos.createOrUpdateFileContents({
    owner, repo, path,
    message: `TGP Mind: Ensayo cinematico -- ${slug}`,
    content: contentBase64,
    branch,
    sha,
  });

  console.log(`[GitHub Commit] ${path} -> commit ${commitRes.data.commit?.sha}`);
  return commitRes.data.content?.html_url || `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
}

// ── Gestor de Estado de Sesiones (Inline Keyboard Wizard) ────────────────────
interface SesionConfig {
  tema: string;
  destino:    'social' | 'hemeroteca' | 'alternative';
  modelo:     'flash'  | 'pro';
  fuenteImg:  'none'   | 'wiki' | 'imagen3';
  cantidadImg: 1 | 3 | 5;
}
const sesiones = new Map<number, SesionConfig>();

// ── Inline Keyboard Builder ───────────────────────────────────────────────────
function buildInlineKeyboard(cfg: SesionConfig) {
  const mark = (active: boolean, label: string) => (active ? `✅ ${label}` : label);
  return {
    inline_keyboard: [
      [
        { text: mark(cfg.destino === 'social',      'Social'), callback_data: 'dest_social' },
        { text: mark(cfg.destino === 'hemeroteca',  'Hemeroteca'), callback_data: 'dest_hem'   },
        { text: mark(cfg.destino === 'alternative', 'Alternative'), callback_data: 'dest_alt'   },
      ],
      [
        { text: mark(cfg.modelo === 'flash', 'Flash'), callback_data: 'mod_flash' },
        { text: mark(cfg.modelo === 'pro',   'Pro'),   callback_data: 'mod_pro'   },
      ],
      [
        { text: mark(cfg.fuenteImg === 'none',    'Sin imagen'), callback_data: 'img_none'    },
        { text: mark(cfg.fuenteImg === 'wiki',    'Wiki'),       callback_data: 'img_wiki'    },
        { text: mark(cfg.fuenteImg === 'imagen3', 'Imagen 3'),   callback_data: 'img_imagen3' },
      ],
      [
        { text: mark(cfg.cantidadImg === 1, '1 secc'),  callback_data: 'cant_1' },
        { text: mark(cfg.cantidadImg === 3, '3 secc'),  callback_data: 'cant_3' },
        { text: mark(cfg.cantidadImg === 5, '5 secc'),  callback_data: 'cant_5' },
      ],
      [
        { text: 'GENERAR ENSAYO', callback_data: 'generar_ok' },
      ],
    ],
  };
}

// ── Telegram Helpers ──────────────────────────────────────────────────────────
async function sendTelegram(chatId: number, text: string): Promise<void> {
  try {
    const MAX_CHUNK = 4000;
    if (text.length > MAX_CHUNK) {
      for (let i = 0; i < text.length; i += MAX_CHUNK) await sendTelegram(chatId, text.slice(i, i + MAX_CHUNK));
      return;
    }
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.warn(`[Telegram] sendMessage error: ${await res.text()}`);
  } catch (err) { console.error('[Telegram] sendTelegram fatal:', err); }
}

async function answerCallbackQuery(callbackQueryId: string, text = ''): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) { console.error('[Telegram] answerCallbackQuery error:', err); }
}

async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup: object): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
    });
  } catch (err) { console.error('[Telegram] editMessageReplyMarkup error:', err); }
}

async function editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: object): Promise<void> {
  try {
    const payload: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) { console.error('[Telegram] editMessageText error:', err); }
}

// ── Hono App ──────────────────────────────────────────────────────────────────
const app = new Hono();
app.get('/', (c) => c.json({ status: 'TGP Mind activo', ts: new Date().toISOString() }));

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 1: Webhook Telegram -- Wizard con Inline Keyboards
// ─────────────────────────────────────────────────────────────────────────────
app.post('/webhook/telegram', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

  // ── RAMA A: Mensaje de texto (nuevo pedido) ─────────────────────────────────
  const message = body?.message;
  if (message) {
    const chatId: number | undefined = message?.chat?.id;
    const text: string = message?.text ?? '';
    if (!chatId || !text) return c.json({ ok: true });

    if (chatId !== XAVIER_CHAT_ID) {
      console.warn(`[Telegram] Acceso bloqueado para chatId: ${chatId}`);
      await sendTelegram(chatId, 'Acceso denegado. Nodo privado TGP.');
      return c.json({ ok: true });
    }

    if (text.trim() === '/start') {
      await sendTelegram(chatId, 'TGP Mind en linea.\n\nEscribime cualquier tema y te presentare un panel de control para configurar tu publicacion.');
      return c.json({ ok: true });
    }

    const sesion: SesionConfig = { tema: text.trim(), destino: 'hemeroteca', modelo: 'flash', fuenteImg: 'wiki', cantidadImg: 5 };
    sesiones.set(chatId, sesion);

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Configura tu publicacion sobre:\n${sesion.tema}`,
        reply_markup: buildInlineKeyboard(sesion),
      }),
    });

    return c.json({ ok: true });
  }

  // ── RAMA B: Callback Query (clic en boton) ──────────────────────────────────
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const chatId:     number = callbackQuery?.message?.chat?.id;
    const messageId:  number = callbackQuery?.message?.message_id;
    const callbackId: string = callbackQuery?.id ?? '';
    const data:       string = callbackQuery?.data ?? '';

    if (chatId !== XAVIER_CHAT_ID) {
      await answerCallbackQuery(callbackId, 'Acceso denegado.');
      return c.json({ ok: true });
    }

    let sesion = sesiones.get(chatId);
    if (!sesion) {
      await answerCallbackQuery(callbackId, 'Sesion expirada. Escribe un tema nuevo.');
      return c.json({ ok: true });
    }

    // Actualizar estado segun boton
    if      (data === 'dest_social')  sesion.destino     = 'social';
    else if (data === 'dest_hem')     sesion.destino     = 'hemeroteca';
    else if (data === 'dest_alt')     sesion.destino     = 'alternative';
    else if (data === 'mod_flash')    sesion.modelo      = 'flash';
    else if (data === 'mod_pro')      sesion.modelo      = 'pro';
    else if (data === 'img_none')     sesion.fuenteImg   = 'none';
    else if (data === 'img_wiki')     sesion.fuenteImg   = 'wiki';
    else if (data === 'img_imagen3')  sesion.fuenteImg   = 'imagen3';
    else if (data === 'cant_1')       sesion.cantidadImg = 1;
    else if (data === 'cant_3')       sesion.cantidadImg = 3;
    else if (data === 'cant_5')       sesion.cantidadImg = 5;
    sesiones.set(chatId, sesion);

    // ── GENERAR ──────────────────────────────────────────────────────────────
    if (data === 'generar_ok') {
      const destinoLabel = sesion.destino === 'social' ? 'Social' : sesion.destino === 'hemeroteca' ? 'Hemeroteca' : 'Alternative';
      const modeloLabel  = sesion.modelo === 'flash' ? 'Flash' : 'Pro';
      const modelName    = sesion.modelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash' as const;
      const sessionId    = `telegram-${chatId}`;

      await editMessageText(chatId, messageId, `Procesando...\n\n${sesion.tema}\nDestino: ${destinoLabel} | Modelo: ${modeloLabel} | ${sesion.cantidadImg} secc.`);
      await answerCallbackQuery(callbackId, 'Generando...');

      try {
        // FLUJO DIRECTO
        if (sesion.destino === 'social') {
          const SOCIAL_SYSTEM_PROMPT = "Eres un redactor cultural y turistico experto. Tu objetivo es crear resenas y descripciones 'grounded' (basadas en hechos, geografia, historia verificable y datos enciclopedicos) para Google Business Profile y redes sociales. Tono: Informativo, atractivo, directo y claro. PROHIBIDO: Usar lenguaje filosofico, abstracto, existencialista o denso. Centrate en lo que el lugar es, su importancia historica concreta y por que visitarlo.";
          const prompt = `Escribe una resena factual y atractiva sobre: ${sesion.tema}. Maximo 2 parrafos.`;
          const respuesta = await callGemini(sessionId, prompt, modelName, SOCIAL_SYSTEM_PROMPT);
          await sendTelegram(chatId, `Listo para Social:\n\n${respuesta}`);
          return c.json({ ok: true });
        }

        // FLUJO GITOPS
        const modeloEnsayo = crearModeloEnsayo(sesion.cantidadImg, modelName);
        const promptGitops = `Desarrolla un ensayo cinematico sobre: "${sesion.tema}". Genera exactamente ${sesion.cantidadImg} secciones con rigor historico, filosofico y narrativo.`;
        const result       = await modeloEnsayo.generateContent(promptGitops);
        const parsed       = JSON.parse(result.response.text());

        await sendTelegram(chatId, `Ensayo: "${parsed.titulo}". Procesando imagenes...`);

        if (sesion.fuenteImg === 'wiki' && Array.isArray(parsed.secciones)) {
          for (const seccion of parsed.secciones) {
            if (seccion.busqueda_wikimedia) {
              const r2Url = await procesarImagen(seccion.busqueda_wikimedia);
              if (r2Url) seccion.imagen_url = r2Url;
            }
          }
        } else if (sesion.fuenteImg === 'imagen3' && Array.isArray(parsed.secciones)) {
          for (const seccion of parsed.secciones) seccion.imagen_url = 'PENDIENTE_IMAGEN3';
        }

        await sendTelegram(chatId, `Compilando Markdoc y publicando en GitHub...`);
        const { slug, contenidoMdoc } = generarMarkdoc(parsed);

        const token    = sesion.destino === 'hemeroteca' ? GITHUB_TOKEN_HEMEROTECA  : GITHUB_TOKEN_ALTERNATIVE;
        const repoFull = sesion.destino === 'hemeroteca' ? GITHUB_REPO_HEMEROTECA   : GITHUB_REPO_ALTERNATIVE;

        const githubUrl = await publicarEnGitHub(slug, contenidoMdoc, token, repoFull);
        await sendTelegram(chatId, `"${parsed.titulo}" publicado en ${destinoLabel}.\n${githubUrl}\n\nCloudflare Pages renderizando.`);
      } catch (error: any) {
        console.error('[Telegram Webhook Error]:', error);
        await sendTelegram(chatId, `Error en TGP Mind: ${error?.message || 'Fallo desconocido'}`);
      }

      return c.json({ ok: true });
    }

    // Redibujar teclado con nuevo estado
    await editMessageReplyMarkup(chatId, messageId, buildInlineKeyboard(sesion));
    await answerCallbackQuery(callbackId);
    return c.json({ ok: true });
  }

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 2: /api/mind -- Sidebar local
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/*', cors({
  origin: (origin) => {
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return origin;
    return null;
  },
  allowHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Api-Key'],
  allowMethods: ['POST', 'OPTIONS'],
}));

app.post('/api/mind', async (c) => {
  const auth = (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!TGP_MIND_API_KEY || auth !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  const origin  = c.req.header('Origin') ?? '';
  const isLocal = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  if (origin && !isLocal) return c.json({ error: 'Origen no permitido.' }, 403);

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

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 3: /api/vision -- Ingesta Multimodal Scriptorium
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/vision', async (c) => {
  const apiKey = c.req.header('x-api-key');
  if (!TGP_MIND_API_KEY || apiKey !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  const origin  = c.req.header('Origin') ?? '';
  const isLocal = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  if (origin && !isLocal) return c.json({ error: 'Origen no permitido.' }, 403);

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BOT SOCIAL (ZERNIO)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface SesionSocialConfig {
  tema: string;
  redes: 'facebook' | 'tiktok';
  modelo: 'flash' | 'pro';
  imagen: 'si' | 'no';
}
const sesionesSocial = new Map<number, SesionSocialConfig>();

function buildSocialInlineKeyboard(cfg: SesionSocialConfig) {
  const mark = (active: boolean, label: string) => (active ? `âœ… ${label}` : label);
  return {
    inline_keyboard: [
      [
        { text: mark(cfg.redes === 'facebook', '🔵 Facebook'), callback_data: 'red_fb' },
        { text: mark(cfg.redes === 'tiktok', '⚫ TikTok'), callback_data: 'red_tiktok' },
      ],
      [
        { text: mark(cfg.modelo === 'flash', 'Flash'), callback_data: 'mod_flash' },
        { text: mark(cfg.modelo === 'pro', 'Pro'), callback_data: 'mod_pro' },
      ],
      [
        { text: mark(cfg.imagen === 'si', 'Con Imagen'), callback_data: 'img_si' },
        { text: mark(cfg.imagen === 'no', 'Sin Imagen'), callback_data: 'img_no' },
      ],
      [{ text: '🚀 GENERAR Y PUBLICAR', callback_data: 'generar_social' }],
    ],
  };
}

async function sendTelegramSocial(chatId: number, text: string): Promise<void> {
  try {
    const MAX_CHUNK = 4000;
    if (text.length > MAX_CHUNK) {
      for (let i = 0; i < text.length; i += MAX_CHUNK) await sendTelegramSocial(chatId, text.slice(i, i + MAX_CHUNK));
      return;
    }
    const res = await fetch(`${TELEGRAM_SOCIAL_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.warn(`[Telegram Social] sendMessage error: ${await res.text()}`);
  } catch (err) { console.error('[Telegram Social] sendTelegram fatal:', err); }
}

async function answerCallbackQuerySocial(callbackQueryId: string, text = ''): Promise<void> {
  try {
    await fetch(`${TELEGRAM_SOCIAL_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) { console.error('[Telegram Social] answerCallbackQuery error:', err); }
}

async function editMessageReplyMarkupSocial(chatId: number, messageId: number, replyMarkup: object): Promise<void> {
  try {
    await fetch(`${TELEGRAM_SOCIAL_API}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
    });
  } catch (err) { console.error('[Telegram Social] editMessageReplyMarkup error:', err); }
}

async function editMessageTextSocial(chatId: number, messageId: number, text: string, replyMarkup?: object): Promise<void> {
  try {
    const pl: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
    if (replyMarkup) pl.reply_markup = replyMarkup;
    await fetch(`${TELEGRAM_SOCIAL_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pl),
    });
  } catch (err) { console.error('[Telegram Social] editMessageText error:', err); }
}

app.post('/webhook/telegram-social', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

  const message = body?.message;
  if (message) {
    const chatId: number | undefined = message?.chat?.id;
    const text: string = message?.text ?? '';
    if (!chatId || !text) return c.json({ ok: true });
    if (chatId !== XAVIER_CHAT_ID) { await sendTelegramSocial(chatId, 'Acceso denegado.'); return c.json({ ok: true }); }
    const sesion: SesionSocialConfig = { tema: text.trim(), redes: 'facebook', modelo: 'flash', imagen: 'si' };
    sesionesSocial.set(chatId, sesion);
    await fetch(`${TELEGRAM_SOCIAL_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚙️ Configura tu publicacion sobre:\n"${sesion.tema}"`,
        reply_markup: buildSocialInlineKeyboard(sesion),
      }),
    });
    return c.json({ ok: true });
  }

  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const chatId:     number = callbackQuery?.message?.chat?.id;
    const messageId:  number = callbackQuery?.message?.message_id;
    const callbackId: string = callbackQuery?.id ?? '';
    const data:       string = callbackQuery?.data ?? '';

    if (chatId !== XAVIER_CHAT_ID) { await answerCallbackQuerySocial(callbackId, 'Acceso denegado.'); return c.json({ ok: true }); }
    const sesion = sesionesSocial.get(chatId);
    if (!sesion) { await answerCallbackQuerySocial(callbackId, 'Sesion expirada. Escribe un tema nuevo.'); return c.json({ ok: true }); }

    if      (data === 'red_fb')     sesion.redes  = 'facebook';
    else if (data === 'red_tiktok') sesion.redes  = 'tiktok';
    else if (data === 'mod_flash')  sesion.modelo = 'flash';
    else if (data === 'mod_pro')    sesion.modelo = 'pro';
    else if (data === 'img_si')     sesion.imagen = 'si';
    else if (data === 'img_no')     sesion.imagen = 'no';
    sesionesSocial.set(chatId, sesion);

    if (data === 'generar_social') {
      await editMessageTextSocial(chatId, messageId, `⏳ Generando texto para "${sesion.tema}"...`);
      await answerCallbackQuerySocial(callbackId, 'Generando...');
      try {
        const modelName    = sesion.modelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
        const userPrompt   = `Genera un texto magnetico y reflexivo para redes sociales sobre: ${sesion.tema}. Estilo directo, sobrio y atrapante. Maximo 2 parrafos cortos y 3 hashtags.`;
        const SOCIAL_PROMPT = "Eres un redactor cultural y turistico experto. Crea descripciones grounded basadas en hechos. Tono: Informativo, directo y claro.";
        const textoGenerado = await callGemini(`social-${chatId}`, userPrompt, modelName, SOCIAL_PROMPT);
        if (!textoGenerado || textoGenerado.trim() === '') throw new Error('Gemini no devolvio texto.');

        // Imagen Wikimedia -> R2 con multi-estrategia y red de seguridad para TikTok
        let urlR2 = '';
        if (sesion.imagen === 'si') {
          await editMessageTextSocial(chatId, messageId, `⏳ Buscando imagen para "${sesion.tema}"...`);
          urlR2 = await procesarImagen(sesion.tema);
          if (!urlR2) {
            // TikTok EXIGE media obligatoriamente — usar imagen de reserva
            if (sesion.redes === 'tiktok') {
              urlR2 = FALLBACK_IMAGE_URL;
              console.log(`[Social] TikTok: usando imagen de reserva: ${urlR2}`);
              await sendTelegramSocial(chatId, `⚠️ Sin imagen especifica para "${sesion.tema}". Usando imagen de reserva para TikTok.`);
            } else {
              await sendTelegramSocial(chatId, `⚠️ Sin imagen para "${sesion.tema}". Se publicara sin imagen.`);
            }
          } else {
            console.log(`[Social] Imagen R2: ${urlR2}`);
          }
        }

        const redLabel  = sesion.redes === 'facebook' ? 'Facebook 🔵' : 'TikTok ⚫';
        const platforms = sesion.redes === 'facebook'
          ? [{ platform: 'facebook', accountId: ZERNIO_FB_ID }]
          : [{ platform: 'tiktok',   accountId: ZERNIO_TIKTOK_ID }];
        const payload: any = { platforms, content: textoGenerado, publishNow: true };
        if (urlR2) payload.mediaItems = [{ type: 'image', url: urlR2 }];
        console.log('Payload hacia Zernio:', JSON.stringify(payload));

        await editMessageTextSocial(chatId, messageId, `⏳ Publicando en ${redLabel}...`);
        const zernioRes = await fetch('https://api.zernio.com/v1/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZERNIO_API_KEY}` },
          body: JSON.stringify(payload),
        });
        if (!zernioRes.ok) {
          const errText = await zernioRes.text();
          throw new Error(`Zernio API Error ${zernioRes.status}: ${errText}`);
        }

        const zernioData: any = await zernioRes.json();
        console.log('[Zernio] Respuesta:', JSON.stringify(zernioData));

        // La URL real del post publicado viene en platforms[0].platformPostUrl (solo disponible con publishNow:true)
        const postUrl: string =
          zernioData?.post?.platforms?.[0]?.platformPostUrl ||
          zernioData?.post?.platforms?.[0]?.postUrl         ||
          zernioData?.post?.platforms?.[0]?.url             ||
          zernioData?.post?.url                             ||
          zernioData?.post?.postUrl                         ||
          '';

        const urlLine = postUrl
          ? `\n\n🔗 Enlace de publicacion: ${postUrl}`
          : `\n\n📋 Post ID: ${zernioData?.post?._id || 'N/A'} (URL disponible cuando Zernio complete la publicacion)`;
        const imgLine = urlR2 ? `\n🖼 Imagen: ${urlR2}` : '';
        await sendTelegramSocial(chatId, `✅ Publicacion enviada a ${redLabel}.\n\n${textoGenerado}${urlLine}${imgLine}`);
      } catch (error: any) {
        console.error('[Social Webhook Error]:', error);
        await sendTelegramSocial(chatId, `⚠️ Error al publicar: ${error?.message || 'Fallo desconocido'}`);
      }
      return c.json({ ok: true });
    }

    await editMessageReplyMarkupSocial(chatId, messageId, buildSocialInlineKeyboard(sesion));
    await answerCallbackQuerySocial(callbackId);
    return c.json({ ok: true });
  }

  return c.json({ ok: true });
});

// â”€â”€ Arranque â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[TGP Mind] Puerto ${PORT} -- Listo.`);
});
