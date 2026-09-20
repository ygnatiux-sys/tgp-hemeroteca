// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Telegram Webhook Router Modular
// Maneja los webhooks de Telegram de los 3 bots (Hemeroteca, Social y Omni-Bot),
// integrando el Semantic Router (HITL) y la Mini App.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import crypto from 'node:crypto';
import { routeIncomingMessage } from '../ia/semantic-router.js';
import { callGemini, crearModeloEnsayo, genai } from '../ia/gemini.js';
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
  if (botId === 'omni') {
    return { api: cfg.telegramAssistantApi, token: cfg.telegramTgpCloudToken };
  }
  return { api: cfg.telegramApi, token: cfg.telegramToken };
}

// ── Router Hono ──────────────────────────────────────────────────────────────
export const telegramRouter = new Hono();

// ── RUTA 1: /webhook/telegram (Hemeroteca / Principal) ────────────────────────
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
      await sendTelegram(chatId, 'Acceso denegado. Nodo privado TGP.');
      return c.json({ ok: true });
    }

    if (text.trim() === '/start') {
      await sendTelegram(chatId, 'TGP Mind en línea.\n\nEscribime cualquier tema o envíame una foto con pie de foto para publicarla en Keystatic/Hemeroteca.');
      return c.json({ ok: true });
    }

    let imagenR2Url = '';
    if (hasPhoto) {
      const bestPhoto = message.photo[message.photo.length - 1];
      const baseSlug = generarSlug(text ? text.slice(0, 30) : 'foto-telegram');
      try {
        await sendTelegram(chatId, '📷 Descargando imagen y subiendo a Cloudflare R2...');
        const r2Res = await procesarFotoTelegramAR2(bestPhoto.file_id, baseSlug);
        imagenR2Url = r2Res.url;
        await sendTelegram(chatId, `✅ Imagen alojada en Cloudflare R2:\n${imagenR2Url}`);
      } catch (errUpload: any) {
        await sendTelegram(chatId, `⚠️ Error subiendo imagen: ${errUpload?.message || 'Error'}`);
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
      await sendTelegram(chatId, decision.text);
      return c.json({ ok: true });
    }

    if (decision.type === 'direct_answer') {
      await sendTelegram(chatId, decision.text);
      return c.json({ ok: true });
    }

    // Ejecución de publicación directa (Bypass o Tool Call)
    const params = decision.params;
    const modeloLabel = params.modelo === 'pro' ? 'Pro' : 'Flash';
    const modelName = params.modelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
    const cantSecciones = params.cantidadSecciones || 3;

    await sendTelegram(chatId, `⚡ Agente TGP: Redactando ensayo sobre "${params.tema}" (${modeloLabel}, ${cantSecciones} secciones)...`);

    try {
      const modeloEnsayo = crearModeloEnsayo(cantSecciones, modelName);
      const promptGitops = `Desarrolla un ensayo cinemático sobre: "${params.tema}". Genera exactamente ${cantSecciones} secciones con rigor histórico, filosófico y narrativo.`;
      const result = await modeloEnsayo.generateContent(promptGitops);
      const parsed = JSON.parse(result.response.text());

      await sendTelegram(chatId, `Ensayo: "${parsed.titulo}". Procesando imágenes...`);

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

      await sendTelegram(chatId, 'Compilando estructura Keystatic y publicando en GitHub...');
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

      await sendTelegram(chatId, `"${parsed.titulo}" publicado en ${params.destino}.\n\n🔗 Ver en la Web:\n${webUrl}\n\n📦 Commit en GitHub:\n${githubUrl}`);
    } catch (err: any) {
      console.error('[Telegram Agéntico Error]:', err);
      await sendTelegram(chatId, `⚠️ Error en TGP Mind: ${err?.message || 'Fallo desconocido'}`);
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
    const modelName = modelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash';

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

// ── RUTA 3: /telegram-webhook (Omni-Bot @Analista_IMG_bot) ───────────────────
telegramRouter.post('/telegram-webhook', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

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
          text: `🏛️ *TGP Assistant en línea (@${cfg.telegramBotName})*\n\n📸 Envía una imagen para el Data Lake.\n✍️ O escribe cualquier consulta analítica o comando de publicación.`,
          parse_mode: 'Markdown',
        }),
      });
      return c.json({ ok: true });
    }

    // Texto Libre: Enrutamiento Semántico Agéntico
    const decision = await routeIncomingMessage({
      chatId,
      text,
      hasPhoto: false,
      botContext: 'omni',
    });

    if (decision.type === 'micro_prompt') {
      await fetch(`${cfg.telegramApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: decision.text }),
      });
      return c.json({ ok: true });
    }

    if (decision.type === 'direct_answer') {
      await fetch(`${cfg.telegramApi}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: decision.text }),
      });
      return c.json({ ok: true });
    }

    // Publicación / Ejecución directa
    await fetch(`${cfg.telegramApi}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚡ Agente Omni procesando solicitud: "${decision.params.tema}"`,
      }),
    });

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
    imagen = 'wikimedia',
    destino = 'social',
    photoUrl = '',
    bot = 'social',
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
    const modelName = modelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
    const modLabel = modelo === 'pro' ? 'Gemini Pro' : 'Gemini Flash';
    const redLabel = red === 'facebook' ? 'Facebook' : 'TikTok';

    await fetch(`${BOT_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `⏳ Generando para ${redLabel} con ${modLabel}...` }),
    });

    const userPrompt = `Genera un texto magnético y reflexivo para redes sociales sobre: ${tema.trim()}. Estilo directo, sobrio y atrapante. Máximo 2 párrafos cortos y 3 hashtags.`;
    const SOCIAL_PROMPT = 'Eres un redactor cultural y turístico experto. Crea descripciones grounded basadas en hechos. Tono: Informativo, directo y claro.';
    const textoGenerado = await callGemini(`miniapp-${chatId}`, userPrompt, modelName, SOCIAL_PROMPT);

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
      metadatos: { bot, red, modelo, imagen, formato, isMiniAppHeader },
      imagenR2Url: imagenUrl,
      chatId,
    });

    if (imagenUrl) {
      await fetch(`${BOT_API}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imagenUrl,
          caption: `${redLabel} via TGP Mind (${modLabel}):\n\n${textoGenerado}`.slice(0, 1024),
        }),
      });
    } else {
      await fetch(`${BOT_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `${redLabel} via TGP Mind (${modLabel}):\n\n${textoGenerado}` }),
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
