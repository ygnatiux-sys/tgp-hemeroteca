// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Telegram Webhook Router Modular
// Maneja los webhooks de Telegram de los 3 bots (Hemeroteca, Social y Omni-Bot),
// integrando el Semantic Router (HITL) y la Mini App.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import crypto from 'node:crypto';
import { routeIncomingMessage } from '../ia/semantic-router.js';
import { callGemini, crearModeloEnsayo, genai, TGP_SYSTEM_PROMPT } from '../ia/gemini.js';
import {
  sendTelegram,
  editMessageText,
  editMessageReplyMarkup,
  answerCallbackQuery,
  buildInlineKeyboard,
  sesiones,
  pendingTextQueries,
  SesionConfig,
} from './helpers.js';
import {
  sendTelegramSocial,
  editMessageTextSocial,
  editMessageReplyMarkupSocial,
  answerCallbackQuerySocial,
  buildSocialInlineKeyboard,
  sesionesSocial,
  publicarEnZernio,
  SesionSocialConfig,
} from './social.js';
import { procesarFotoTelegramAR2, subirBufferOsintAR2, estandarizarYSubirImagenAR2 } from '../storage/r2.js';
import { guardarEnCloudflareD1, obtenerInformeD1, registrarResguardoD1 } from '../storage/d1.js';
import { procesarImagen, resolverEntidadCanonica, buscarPageImageWikipedia } from '../vision/wikimedia.js';
import {
  generarSlug,
  generarMarkdoc,
  publicarEntradaKeystaticGitHub,
  publicarEnGitHub,
} from '../servicios/publicacion.js';

export interface TelegramRouterConfig {
  telegramToken: string;
  telegramApi: string;
  telegramBotName: string;
  telegramSocialToken: string;
  telegramSocialApi: string;
  telegramTgpCloudToken: string;
  telegramAssistantApi: string;
  xavierChatId: number;
  miniAppUrl: string;
  githubTokenHemeroteca: string;
  githubRepoHemeroteca: string;
  githubTokenAlternative: string;
  githubRepoAlternative: string;
  zernioApiKey: string;
  zernioFbId: string;
  zernioTiktokId: string;
  fallbackImageUrl: string;
  visionClient?: any;
}

let cfg: TelegramRouterConfig = {
  telegramToken: '',
  telegramApi: '',
  telegramBotName: 'Analista_IMG_bot',
  telegramSocialToken: '',
  telegramSocialApi: '',
  telegramTgpCloudToken: '',
  telegramAssistantApi: '',
  xavierChatId: 7886507052,
  miniAppUrl: 'https://thegreatpuzzleproject.com/bot-selector',
  githubTokenHemeroteca: '',
  githubRepoHemeroteca: 'ygnatiux-sys/tgp-hemeroteca',
  githubTokenAlternative: '',
  githubRepoAlternative: 'ygnatiux-sys/tgp-webfinal2026',
  zernioApiKey: '',
  zernioFbId: '',
  zernioTiktokId: '',
  fallbackImageUrl: 'https://storage.thegreatpuzzleproject.com/tgp-fallback.jpg',
};

export function initTelegramRouter(config: Partial<TelegramRouterConfig>) {
  cfg = { ...cfg, ...config };
}

// ── Helpers Mini App & Autenticación ──────────────────────────────────────────
export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return calculatedHash === hash;
  } catch {
    return false;
  }
}

export function extractChatIdFromInitData(initData: string): number | null {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return typeof user.id === 'number' ? user.id : null;
  } catch {
    return null;
  }
}

export function getBotApi(botId?: string): { api: string; token: string } {
  if (botId === 'social') {
    return { api: cfg.telegramSocialApi, token: cfg.telegramSocialToken };
  }
  if (botId === 'assistant') {
    return { api: cfg.telegramAssistantApi, token: cfg.telegramTgpCloudToken };
  }
  // Omni Bot (@Analista_IMG_bot) y por defecto
  return { api: cfg.telegramApi, token: cfg.telegramToken };
}

// ── Router Hono ──────────────────────────────────────────────────────────────
export const telegramRouter = new Hono();

// ── RUTA 1: /webhook/telegram (Hemeroteca / Xavier-Assistant @tgp_cloud_bot) ──
async function sendTelegramAssistant(chatId: number, text: string, replyMarkup?: any): Promise<void> {
  const api = cfg.telegramAssistantApi || cfg.telegramApi;
  try {
    const MAX_CHUNK = 4000;
    if (text.length > MAX_CHUNK) {
      for (let i = 0; i < text.length; i += MAX_CHUNK) await sendTelegramAssistant(chatId, text.slice(i, i + MAX_CHUNK), replyMarkup);
      return;
    }
    const res = await fetch(`${api}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
    });
    if (!res.ok) console.warn(`[Telegram Assistant] sendMessage error: ${await res.text()}`);
  } catch (err) { console.error('[Telegram Assistant] fatal:', err); }
}

telegramRouter.post('/webhook/telegram', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

  const message = body?.message;
  if (message) {
    const chatId: number | undefined = message?.chat?.id;
    const hasPhoto = Array.isArray(message?.photo) && message.photo.length > 0;
    const text: string = message?.text ?? message?.caption ?? '';
    if (!chatId || (!text && !hasPhoto)) return c.json({ ok: true });

    if (cfg.xavierChatId && chatId !== cfg.xavierChatId) {
      await sendTelegramAssistant(chatId, 'Acceso denegado. Nodo privado TGP.');
      return c.json({ ok: true });
    }

    if (text.trim() === '/start') {
      await sendTelegramAssistant(chatId, 'TGP Mind en línea (Xavier-Assistant).\n\nEscribime cualquier tema o envíame una foto con pie de foto para publicarla en Keystatic/Hemeroteca.');
      return c.json({ ok: true });
    }

    let imagenR2Url = '';
    if (hasPhoto) {
      const bestPhoto = message.photo[message.photo.length - 1];
      const baseSlug = generarSlug(text ? text.slice(0, 30) : 'foto-telegram');
      try {
        await sendTelegramAssistant(chatId, '📷 Descargando imagen y subiendo a Cloudflare R2...');
        const r2Res = await procesarFotoTelegramAR2(bestPhoto.file_id, baseSlug, cfg.telegramTgpCloudToken);
        imagenR2Url = r2Res.url;
        await sendTelegramAssistant(chatId, `✅ Imagen alojada en Cloudflare R2:\n${imagenR2Url}`);
      } catch (errUpload: any) {
        await sendTelegramAssistant(chatId, `⚠️ Error subiendo imagen: ${errUpload?.message || 'Error'}`);
      }
    }

    // Clasificación Semántica Agéntica (HITL)
    const decision = await routeIncomingMessage({
      chatId,
      text,
      hasPhoto,
      photoUrl: imagenR2Url || undefined,
      botContext: 'hemeroteca',
    });

    if (decision.type === 'micro_prompt') {
      await sendTelegramAssistant(chatId, decision.text);
      return c.json({ ok: true });
    }

    if (decision.type === 'direct_answer') {
      await sendTelegramAssistant(chatId, decision.text);
      return c.json({ ok: true });
    }

    // Ejecución de publicación directa (Bypass o Tool Call)
    const params = decision.params;
    const modeloLabel = params.modelo === 'pro' ? 'Pro' : 'Flash';
    const modelName = params.modelo === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
    const cantSecciones = params.cantidadSecciones || 3;

    await sendTelegramAssistant(chatId, `⚡ Agente TGP: Redactando ensayo sobre "${params.tema}" (${modeloLabel}, ${cantSecciones} secciones)...`);

    try {
      const modeloEnsayo = crearModeloEnsayo(cantSecciones, modelName);
      const promptGitops = `Desarrolla un ensayo cinemático sobre: "${params.tema}". Genera exactamente ${cantSecciones} secciones con rigor histórico, filosófico y narrativo.`;
      const result = await modeloEnsayo.generateContent(promptGitops);
      const parsed = JSON.parse(result.response.text());

      await sendTelegramAssistant(chatId, `Ensayo: "${parsed.titulo}". Procesando imágenes...`);

      if (params.fuenteImg === 'telegram' && params.photoUrl && Array.isArray(parsed.secciones)) {
        if (parsed.secciones.length > 0) parsed.secciones[0].imagen_url = params.photoUrl;
      } else if (params.fuenteImg === 'wiki' && Array.isArray(parsed.secciones)) {
        for (const seccion of parsed.secciones) {
          if (seccion.busqueda_wikimedia) {
            const r2Url = await procesarImagen(seccion.busqueda_wikimedia);
            if (r2Url) seccion.imagen_url = r2Url;
          }
        }
      }

      await sendTelegramAssistant(chatId, 'Compilando estructura Keystatic y publicando en GitHub...');
      const { slug, contenidoMdoc } = generarMarkdoc(parsed);
      const token = params.destino === 'hemeroteca' ? cfg.githubTokenHemeroteca : cfg.githubTokenAlternative;
      const repoFull = params.destino === 'hemeroteca' ? cfg.githubRepoHemeroteca : cfg.githubRepoAlternative;

      let githubUrl = '';
      if (params.destino === 'hemeroteca') {
        let coverUrl = params.photoUrl || parsed.secciones?.[0]?.imagen_url || '';
        if (coverUrl) {
          try { coverUrl = await estandarizarYSubirImagenAR2(coverUrl, 'portadas'); } catch {}
        }
        const primerParrafo = parsed.secciones?.[0]?.parrafo || '';

        const indexJson = {
          title: parsed.titulo,
          generadorTexto: JSON.stringify({ text: contenidoMdoc, image: coverUrl }),
          atmosfera: { discriminant: 'obsidiana' },
          gallery: [],
          dek: primerParrafo ? primerParrafo.slice(0, 110) + '...' : '',
          coverImage: coverUrl,
          date: new Date().toISOString().slice(0, 10),
          excerpt: primerParrafo ? primerParrafo.slice(0, 180) + '...' : '',
        };

        let bodyMdoc = '';
        if (Array.isArray(parsed.secciones)) {
          parsed.secciones.forEach((sec: any, idx: number) => {
            if (sec.imagen_url) bodyMdoc += `![${parsed.titulo} -- Sección ${idx + 1}](${sec.imagen_url})\n\n`;
            if (sec.parrafo) bodyMdoc += `${sec.parrafo.trim()}\n\n`;
          });
        }

        githubUrl = await publicarEntradaKeystaticGitHub({
          coleccion: 'ensayos-cinematicos',
          slug,
          indexJson,
          contentMdoc: bodyMdoc.trim() + '\n',
          token,
          repoFull,
          mensajeCommit: `TGP Mind: Ensayo cinemático Keystatic -- ${parsed.titulo}`,
        });

        // Resguardo Documental Universal en Cloudflare D1
        await registrarResguardoD1({
          origen: 'telegram-hemeroteca',
          destino: 'hemeroteca',
          tema: params.tema,
          textoGenerado: bodyMdoc.trim() || contenidoMdoc,
          metadatos: { titulo: parsed.titulo, slug, modelo: params.modelo, githubUrl },
          imagenR2Url: coverUrl,
          chatId,
        });
      } else {
        githubUrl = await publicarEnGitHub(slug, contenidoMdoc, token, repoFull);

        await registrarResguardoD1({
          origen: 'telegram-hemeroteca',
          destino: params.destino,
          tema: params.tema,
          textoGenerado: contenidoMdoc,
          metadatos: { titulo: parsed.titulo, slug, modelo: params.modelo, githubUrl },
          imagenR2Url: params.photoUrl || '',
          chatId,
        });
      }

      const webUrl = params.destino === 'hemeroteca'
        ? `https://thegreatpuzzleproject.com/ensayos-cinematicos/${slug}`
        : `https://alternative.thegreatpuzzleproject.com/ensayos/${slug}`;

      await sendTelegramAssistant(chatId, `"${parsed.titulo}" publicado en ${params.destino}.\n\n🔗 Ver en la Web:\n${webUrl}\n\n📦 Commit en GitHub:\n${githubUrl}`);
    } catch (err: any) {
      console.error('[Telegram Agéntico Error]:', err);
      await sendTelegramAssistant(chatId, `⚠️ Error en TGP Mind: ${err?.message || 'Fallo desconocido'}`);
    }

    return c.json({ ok: true });
  }

  // Respaldo de Callback Queries
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const chatId: number = callbackQuery?.message?.chat?.id;
    const messageId: number = callbackQuery?.message?.message_id;
    const callbackId: string = callbackQuery?.id ?? '';
    const data: string = callbackQuery?.data ?? '';

    if (cfg.xavierChatId && chatId !== cfg.xavierChatId) {
      await answerCallbackQuery(callbackId, 'Acceso denegado.');
      return c.json({ ok: true });
    }

    const sesion = sesiones.get(chatId);
    if (!sesion) {
      await answerCallbackQuery(callbackId, 'Sesión expirada.');
      return c.json({ ok: true });
    }

    if (data === 'dest_social') sesion.destino = 'social';
    else if (data === 'dest_hem') sesion.destino = 'hemeroteca';
    else if (data === 'dest_alt') sesion.destino = 'alternative';
    else if (data === 'mod_flash') sesion.modelo = 'flash';
    else if (data === 'mod_pro') sesion.modelo = 'pro';
    sesiones.set(chatId, sesion);

    await editMessageReplyMarkup(chatId, messageId, buildInlineKeyboard(sesion));
    await answerCallbackQuery(callbackId);
    return c.json({ ok: true });
  }

  return c.json({ ok: true });
});

// ── RUTA 2: /webhook/telegram-social (Bot Social / Zernio) ───────────────────
telegramRouter.post('/webhook/telegram-social', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

  const message = body?.message;
  if (message) {
    const chatId: number | undefined = message?.chat?.id;
    const text: string = message?.text ?? '';
    if (!chatId || !text) return c.json({ ok: true });
    if (cfg.xavierChatId && chatId !== cfg.xavierChatId) {
      await sendTelegramSocial(chatId, 'Acceso denegado.');
      return c.json({ ok: true });
    }

    // Clasificación Semántica Agéntica (HITL)
    const decision = await routeIncomingMessage({
      chatId,
      text,
      hasPhoto: false,
      botContext: 'social',
    });

    if (decision.type === 'micro_prompt') {
      await sendTelegramSocial(chatId, decision.text);
      return c.json({ ok: true });
    }

    if (decision.type === 'direct_answer') {
      await sendTelegramSocial(chatId, decision.text);
      return c.json({ ok: true });
    }

    // Publicación Directa en Zernio
    const params = decision.params;
    const red = params.red || 'facebook';
    const modelo = params.modelo || 'flash';
    const modelName = modelo === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';

    await sendTelegramSocial(chatId, `⏳ Redactando y publicando en ${red === 'facebook' ? 'Facebook 🔵' : 'TikTok ⚫'}...`);

    try {
      const userPrompt = `Genera un texto magnético y reflexivo para redes sociales sobre: ${params.tema}. Estilo directo, sobrio y atrapante. Máximo 2 párrafos cortos y 3 hashtags.`;
      const SOCIAL_PROMPT = 'Eres un redactor cultural y turístico experto. Crea descripciones grounded basadas en hechos. Tono: Informativo, directo y claro.';
      const textoGenerado = await callGemini(`social-${chatId}`, userPrompt, modelName, SOCIAL_PROMPT);

      let urlR2 = params.photoUrl || '';
      if (!urlR2 && params.fuenteImg !== 'none') {
        urlR2 = (await procesarImagen(params.tema)) || (red === 'tiktok' ? cfg.fallbackImageUrl : '');
      }
      if (urlR2) {
        try { urlR2 = await estandarizarYSubirImagenAR2(urlR2, 'social'); } catch {}
      }

      // Resguardo Documental Previo en Cloudflare D1
      await registrarResguardoD1({
        origen: 'telegram-social',
        destino: 'social',
        tema: params.tema,
        textoGenerado,
        metadatos: { red, modelo: params.modelo },
        imagenR2Url: urlR2,
        chatId,
      });

      const resZernio = await publicarEnZernio({
        redes: red,
        texto: textoGenerado,
        urlImagen: urlR2 || undefined,
      });

      const urlLine = resZernio.postUrl ? `\n\n🔗 Enlace: ${resZernio.postUrl}` : '';
      const imgLine = urlR2 ? `\n🖼 Imagen: ${urlR2}` : '';
      await sendTelegramSocial(chatId, `✅ Publicación enviada con éxito.\n\n${textoGenerado}${urlLine}${imgLine}`);
    } catch (err: any) {
      console.error('[Social Router Error]:', err);
      await sendTelegramSocial(chatId, `⚠️ Error al publicar: ${err?.message || 'Fallo'}`);
    }

    return c.json({ ok: true });
  }

  return c.json({ ok: true });
});

// ── Generador de Inline Keyboards Dinámicos para Micro-Prompts HITL ──────────
function generarTecladoParaPrompt(texto: string): any {
  const lower = texto.toLowerCase();
  if (lower.includes('hemeroteca') && (lower.includes('redes') || lower.includes('social') || lower.includes('post'))) {
    return {
      inline_keyboard: [
        [
          { text: '📚 Hemeroteca (Web)', callback_data: 'Hemeroteca' },
          { text: '📡 Redes Sociales', callback_data: 'Redes Sociales' },
        ],
      ],
    };
  }
  if (lower.includes('facebook') || lower.includes('tiktok')) {
    return {
      inline_keyboard: [
        [
          { text: '🔵 Facebook', callback_data: 'Facebook' },
          { text: '⚫ TikTok', callback_data: 'TikTok' },
        ],
      ],
    };
  }
  if (lower.includes('flash') || lower.includes('pro')) {
    return {
      inline_keyboard: [
        [
          { text: '⚡ Flash (~2s)', callback_data: 'Flash' },
          { text: '🧠 Pro (~8s)', callback_data: 'Pro' },
        ],
      ],
    };
  }
  if (lower.includes('breve') || lower.includes('profundo') || lower.includes('densidad') || lower.includes('premium') || lower.includes('tratado')) {
    return {
      inline_keyboard: [
        [
          { text: '⚡ Breve (~800t)', callback_data: 'Breve' },
          { text: '🧠 Profundo (~1500t)', callback_data: 'Profundo breve' },
        ],
        [
          { text: '🏛️ Premium (+4500t Grounded)', callback_data: 'Tratado Premium' },
        ],
      ],
    };
  }
  return undefined;
}

// ── Ejecutor Agéntico Omni (HITL, Redes y Hemeroteca) ─────────────────────────
async function ejecutarDecisionOmni(chatId: number, decision: any) {
  if (decision.type === 'micro_prompt') {
    const replyMarkup = generarTecladoParaPrompt(decision.text);
    await fetch(`${cfg.telegramApi}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: decision.text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    return;
  }

  if (decision.type === 'direct_answer') {
    await fetch(`${cfg.telegramApi}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: decision.text }),
    });
    return;
  }

  // Publicación / Ejecución directa (Ensayo Hemeroteca o Post Redes)
  await fetch(`${cfg.telegramApi}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `⚡ Agente Omni procesando solicitud: "${decision.params.tema}"...`,
    }),
  });

  try {
    const params = decision.params;
    const tema = params.tema;
    const destino = params.destino || 'social';
    const red = params.red || 'facebook';
    const modelo = params.modelo || 'flash';
    const modelName = modelo === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
    const densidad = params.densidad || (destino === 'social' ? 'breve' : 'profundo_breve');
    const modoLibre = params.modoLibrePrompt ? `\n\nDIRECTIVA PERSONALIZADA DEL AUTOR (MODO LIBRE):\n${params.modoLibrePrompt}` : '';

    let directivaDensidad = '';
    let maxTokens = 2200;
    if (densidad === 'breve') {
      directivaDensidad = 'Extensión: Breve y ágil (máximo 800-1000 tokens). Directo al núcleo conceptual.';
      maxTokens = 1200;
    } else if (densidad === 'premium') {
      directivaDensidad = 'Extensión: Tratado de archivo exhaustivo (+4500 tokens). Desarrolla obligatoriamente entre 4 y 5 secciones temáticas extensas con subtítulos (##), citas históricas textuales originales en bloques (> "...") y al final una sección "## Fuentes Eruditas & Referencias Históricas".';
      maxTokens = 8192;
    } else {
      directivaDensidad = 'Extensión: Ensayo conceptual profundo pero condensado (~1500 tokens). Estructura TGP completa en formato ágil.';
      maxTokens = 2200;
    }

    if (destino === 'hemeroteca' || destino === 'alternative') {
      // ── 1. Generar Ensayo TGP ──────────────────────────────────────────
      const promptEnsayo = `Escribe un ensayo reflexivo, denso y profundo para Hemeroteca TGP sobre: "${tema}". Estilo ensayo argentino contemporáneo. ${directivaDensidad}${modoLibre}`;
      const ensayoTexto = await callGemini(`omni-ensayo-${chatId}`, promptEnsayo, 'gemini-3.1-pro-preview', TGP_SYSTEM_PROMPT, maxTokens);

      let imagenUrl = params.photoUrl || '';
      if (!imagenUrl) {
        try {
          const entidad = await resolverEntidadCanonica(tema);
          imagenUrl = (await buscarPageImageWikipedia(entidad.wikiEn, 'en')) || (await buscarPageImageWikipedia(entidad.wikiEs, 'es')) || '';
        } catch {}
      }

      if (imagenUrl) {
        try {
          imagenUrl = await estandarizarYSubirImagenAR2(imagenUrl, 'omni-hemeroteca');
        } catch {}
      }

      await registrarResguardoD1({
        origen: 'telegram-omni',
        destino,
        tema,
        textoGenerado: ensayoTexto,
        metadatos: { destino, formato: 'tgp', modelo: 'pro', densidad },
        imagenR2Url: imagenUrl,
        chatId,
      });

      const preview = ensayoTexto.slice(0, 900);
      await fetch(`${cfg.telegramApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📚 *Ensayo TGP Generado (${destino.toUpperCase()})*\n\n*Tema:* ${tema}\n*Densidad:* ${densidad.toUpperCase()}\n\n${preview}...\n\n_✅ Registrado en Bóveda D1 y listo en Hemeroteca._`,
          parse_mode: 'Markdown',
        }),
      });
    } else {
      // ── 2. Generar Redes Sociales (Facebook / TikTok via Zernio) ────────
      const userPrompt = `Genera un texto magnético y reflexivo para redes sociales (${red}) sobre: "${tema}". ${directivaDensidad}${modoLibre}`;
      const textoGenerado = await callGemini(`omni-${chatId}`, userPrompt, modelName);

      let imagenUrl = params.photoUrl || '';
      if (!imagenUrl) {
        try {
          const entidad = await resolverEntidadCanonica(tema);
          imagenUrl = (await buscarPageImageWikipedia(entidad.wikiEn, 'en')) || (await buscarPageImageWikipedia(entidad.wikiEs, 'es')) || '';
        } catch {}
      }

      if (imagenUrl) {
        try {
          imagenUrl = await estandarizarYSubirImagenAR2(imagenUrl, 'omni-social');
        } catch {}
      }

      await registrarResguardoD1({
        origen: 'telegram-omni',
        destino: 'social',
        tema,
        textoGenerado,
        metadatos: { red, modelo, densidad },
        imagenR2Url: imagenUrl,
        chatId,
      });

      let postUrl = '';
      try {
        const resZernio = await publicarEnZernio({
          redes: red === 'tiktok' ? 'tiktok' : 'facebook',
          texto: textoGenerado,
          urlImagen: imagenUrl || undefined,
        });
        postUrl = resZernio.postUrl || '';
      } catch (zErr: any) {
        console.warn('[Omni Zernio Warning]:', zErr?.message);
      }

      const urlLine = postUrl ? `\n\n🔗 Enlace: ${postUrl}` : '';
      if (imagenUrl) {
        await fetch(`${cfg.telegramApi}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: imagenUrl,
            caption: `✅ *Publicación Lista (${red.toUpperCase()})*\n\n${textoGenerado}${urlLine}`.slice(0, 1024),
            parse_mode: 'Markdown',
          }),
        });
      } else {
        await fetch(`${cfg.telegramApi}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ *Publicación Lista (${red.toUpperCase()})*\n\n${textoGenerado}${urlLine}`,
            parse_mode: 'Markdown',
          }),
        });
      }
    }
  } catch (errExec: any) {
    console.error('[Omni Execution Error]:', errExec);
    await fetch(`${cfg.telegramApi}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ Error al procesar publicación: ${errExec?.message || 'Error desconocido'}`,
      }),
    });
  }
}

// ── RUTA 3: /telegram-webhook (Omni-Bot @Analista_IMG_bot) ───────────────────
telegramRouter.post('/telegram-webhook', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

  // 1. Manejo de Inline Buttons (Callback Queries)
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data;
    if (chatId) {
      await fetch(`${cfg.telegramApi}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      });
      const decision = await routeIncomingMessage({
        chatId,
        text: data,
        hasPhoto: false,
        botContext: 'omni',
      });
      await ejecutarDecisionOmni(chatId, decision);
    }
    return c.json({ ok: true });
  }

  // 2. Manejo de Mensajes Estándar
  const message = body?.message;
  if (message) {
    const chatId = message.chat?.id;
    if (cfg.xavierChatId && chatId !== cfg.xavierChatId) {
      await fetch(`${cfg.telegramApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⛔ Acceso restringido. Chat ID: ${chatId}` }),
      });
      return c.json({ ok: true });
    }

    const text: string = message.text || '';

    // Resumir reply_to_message
    if (text.startsWith('/resumir') && message.reply_to_message) {
      const quoted = message.reply_to_message.text || message.reply_to_message.caption || '';
      if (!quoted) return c.json({ ok: true });

      const summaryResp = await genai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ text: `Resume de forma analítica, densa y en viñetas este texto:\n\n${quoted}` }],
        config: { systemInstruction: 'Eres un analista de TGP. Tono sobrio, preciso y directo.' },
      });

      const resumenTexto = summaryResp.text || 'Sin resumen.';

      // Resguardo en D1
      await registrarResguardoD1({
        origen: 'telegram-omni',
        destino: 'resumen',
        tema: '/resumir',
        textoGenerado: resumenTexto,
        metadatos: { originalLength: quoted.length },
        chatId,
      });

      await fetch(`${cfg.telegramApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `📋 Resumen Ejecutivo:\n\n${resumenTexto}` }),
      });
      return c.json({ ok: true });
    }

    // Ingesta de Imagen a Data Lake
    const photos = message.photo;
    if (Array.isArray(photos) && photos.length > 0) {
      const id = crypto.randomUUID();
      const bestPhoto = photos[photos.length - 1];

      await fetch(`${cfg.telegramApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: '⏳ Ingestando imagen en Data Lake (Vision + Flash + R2)...' }),
      });

      try {
        const fileInfoRes = await fetch(`${cfg.telegramApi}/getFile?file_id=${bestPhoto.file_id}`);
        const fileInfo: any = await fileInfoRes.json();
        const filePath = fileInfo.result?.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${cfg.telegramToken}/${filePath}`;
        const imgBuffer = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());

        let metadatosVision: any = { entidades: [], landmarks: [] };
        if (cfg.visionClient) {
          const [webResult, landmarkResult] = await Promise.all([
            cfg.visionClient.webDetection({ image: { content: imgBuffer } }),
            cfg.visionClient.landmarkDetection({ image: { content: imgBuffer } }),
          ]);
          metadatosVision.entidades = (webResult[0]?.webDetection?.webEntities || [])
            .filter((e: any) => (e.score || 0) >= 0.6 && e.description)
            .map((e: any) => ({ entidad: e.description, score: Number((e.score || 0).toFixed(2)) }));
          metadatosVision.landmarks = (landmarkResult[0]?.landmarkAnnotations || []).map((l: any) => ({
            nombre: l.description,
            lat: l.locations?.[0]?.latLng?.latitude,
            lng: l.locations?.[0]?.latLng?.longitude,
          }));
        }

        const imagenUrl = await subirBufferOsintAR2(imgBuffer, id, 'image/webp');
        const promptOSINT = `Actúa como investigador OSINT y arqueólogo de TGP. Elabora un informe enciclopédico factual exhaustivo sobre esta imagen usando los metadatos:\n${JSON.stringify(metadatosVision, null, 2)}`;
        const osintResp = await genai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ text: promptOSINT }],
          config: { maxOutputTokens: 3000, temperature: 0.2 },
        });

        await guardarEnCloudflareD1({
          id,
          imagen_url: imagenUrl,
          metadatos_vision: metadatosVision,
          informe_osint: osintResp.text || 'Sin informe.',
          fecha_ingesta: new Date().toISOString(),
        });

        await fetch(`${cfg.telegramApi}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ Ingesta Data Lake Completada\nID: \`${id}\`\n\n${osintResp.text?.slice(0, 500)}...`,
          }),
        });
      } catch (err: any) {
        console.error('[Omni Ingesta Error]:', err);
      }
      return c.json({ ok: true });
    }

    if (text.trim() === '/start') {
      await fetch(`${cfg.telegramApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🏛️ *TGP Omni Bot en línea (@${cfg.telegramBotName})*\n\n📸 Envía una imagen para el Data Lake.\n✍️ Escribe cualquier tema o comando para iniciar el diálogo editorial agéntico.`,
          parse_mode: 'Markdown',
        }),
      });
      return c.json({ ok: true });
    }

    // Texto Libre: Enrutamiento Semántico Agéntico con HITL
    const decision = await routeIncomingMessage({
      chatId,
      text,
      hasPhoto: false,
      botContext: 'omni',
    });

    await ejecutarDecisionOmni(chatId, decision);
    return c.json({ ok: true });
  }

  return c.json({ ok: true });
});

// ── RUTA 4: /api/bot/generate (Telegram Mini App Svelte) ─────────────────────
telegramRouter.post('/api/bot/generate', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido' }, 400); }

  const {
    initData,
    tema,
    red = 'facebook',
    modelo = 'flash',
    densidad = 'profundo_breve',
    modoLibrePrompt = '',
    imagen = 'wikimedia',
    destino = 'social',
    photoUrl = '',
    bot = 'omni',
    formato = 'tgp',
  } = body;

  const isMiniAppHeader = c.req.header('X-Mini-App') === 'true';

  if (!tema || typeof tema !== 'string' || !tema.trim()) {
    return c.json({ error: 'El campo "tema" es obligatorio.' }, 400);
  }

  const { api: BOT_API, token: BOT_TOKEN } = getBotApi(bot);
  let chatId: number = cfg.xavierChatId;

  if (initData) {
    const isValid = verifyTelegramInitData(initData, BOT_TOKEN || cfg.telegramToken);
    if (!isValid) return c.json({ error: 'Firma de initData inválida.' }, 401);
    chatId = extractChatIdFromInitData(initData) ?? cfg.xavierChatId;
  }

  try {
    const modelName = modelo === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
    const modLabel = modelo === 'pro' ? 'Gemini Pro' : 'Gemini Flash';
    const redLabel = red === 'facebook' ? 'Facebook' : 'TikTok';

    const isHemeroteca = destino === 'hemeroteca' || destino === 'alternative';
    const targetLabel = isHemeroteca ? `Hemeroteca (${destino.toUpperCase()})` : redLabel;

    await fetch(`${BOT_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `⏳ Generando para ${targetLabel} con ${modLabel}...` }),
    });

    let directivaDensidad = '';
    let maxTokens = 2200;
    if (densidad === 'breve') {
      directivaDensidad = 'Extensión: Breve y ágil (~800-1000 tokens máximo). Directo al grano.';
      maxTokens = 1200;
    } else if (densidad === 'premium') {
      directivaDensidad = 'Extensión: Tratado de archivo exhaustivo (+4500 tokens). Desarrolla de 4 a 5 secciones temáticas extensas con subtítulos (##), citas históricas textuales originales en bloques (> "...") y al final una sección "## Fuentes Eruditas & Referencias Históricas".';
      maxTokens = 8192;
    } else {
      directivaDensidad = 'Extensión: Ensayo conceptual profundo pero condensado (~1500 tokens). Estructura TGP completa en formato ágil.';
      maxTokens = 2200;
    }

    const modoLibre = modoLibrePrompt?.trim()
      ? `\n\nDIRECTIVA PERSONALIZADA DEL AUTOR (MODO LIBRE):\n${modoLibrePrompt.trim()}`
      : '';

    let textoGenerado = '';
    if (isHemeroteca) {
      const userPrompt = `Escribe un ensayo reflexivo, denso y profundo para Hemeroteca TGP sobre: "${tema.trim()}". Estilo ensayo argentino contemporáneo. ${directivaDensidad}${modoLibre}`;
      textoGenerado = await callGemini(`miniapp-${chatId}`, userPrompt, 'gemini-3.1-pro-preview', TGP_SYSTEM_PROMPT, maxTokens);
    } else {
      const userPrompt = `Genera un texto magnético y reflexivo para redes sociales (${red}) sobre: ${tema.trim()}. ${directivaDensidad}${modoLibre}`;
      const SOCIAL_PROMPT = 'Eres un redactor cultural y turístico experto. Crea descripciones grounded basadas en hechos. Tono: Informativo, directo y claro.';
      textoGenerado = await callGemini(`miniapp-${chatId}`, userPrompt, modelName, SOCIAL_PROMPT, maxTokens);
    }

    let imagenUrl = photoUrl || '';
    if (!imagenUrl && imagen === 'wikimedia') {
      try {
        const entidad = await resolverEntidadCanonica(tema);
        imagenUrl = (await buscarPageImageWikipedia(entidad.wikiEn, 'en')) || (await buscarPageImageWikipedia(entidad.wikiEs, 'es')) || '';
      } catch {}
    }

    // Estandarización Universal de Imagen a WebP en R2
    if (imagenUrl) {
      try {
        imagenUrl = await estandarizarYSubirImagenAR2(imagenUrl, 'miniapp');
      } catch (errImg: any) {
        console.warn('[Mini App] Falló estandarización WebP R2, usando URL original:', errImg?.message);
      }
    }

    // Resguardo Documental Universal en Cloudflare D1
    await registrarResguardoD1({
      origen: 'miniapp-svelte',
      destino,
      tema: tema.trim(),
      textoGenerado,
      metadatos: { bot, red, modelo, densidad, imagen, formato, isMiniAppHeader },
      imagenR2Url: imagenUrl,
      chatId,
    });

    const headerText = isHemeroteca
      ? `📚 Hemeroteca TGP (${modLabel}):\n\n${textoGenerado}`
      : `${redLabel} via TGP Mind (${modLabel}):\n\n${textoGenerado}`;

    if (imagenUrl) {
      await fetch(`${BOT_API}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imagenUrl,
          caption: headerText.slice(0, 1024),
        }),
      });
    } else {
      await fetch(`${BOT_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: headerText }),
      });
    }

    return c.json({ ok: true, texto: textoGenerado, imagenUrl });
  } catch (err: any) {
    console.error('[Mini App Generate Error]:', err);
    return c.json({ error: err?.message || 'Error interno' }, 500);
  }
});

// ── RUTA 5: /api/bot/miniapp-url ─────────────────────────────────────────────
telegramRouter.get('/api/bot/miniapp-url', (c) => c.json({ url: cfg.miniAppUrl }));
