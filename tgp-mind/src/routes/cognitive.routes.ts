// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Rutas Cognitivas, Visión y Magazine (Contratos Compartidos)
// ─────────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import crypto from 'node:crypto';
import vision from '@google-cloud/vision';
import {
  isAllowedOrigin,
  TGP_MIND_API_KEY,
  XAVIER_CHAT_ID,
  TELEGRAM_TOKEN,
  TELEGRAM_TGP_CLOUD_TOKEN,
  TELEGRAM_SOCIAL_TOKEN,
  TELEGRAM_DEV_TOKEN,
  R2_PUBLIC_DOMAIN,
} from '../config/env.js';
import {
  callGemini,
  genai,
  TGP_SYSTEM_PROMPT,
  SYSTEM_PROMPT_NATGEO_GROUNDED,
  buildDensityInstruction,
} from '../ia/gemini.js';
import {
  estandarizarYSubirImagenAR2,
  subirBufferOsintAR2,
} from '../storage/r2.js';
import {
  registrarResguardoD1,
  guardarEnCloudflareD1,
  obtenerInformeD1,
  actualizarRegistroD1,
  generarYGuardarAudioTTS,
} from '../storage/d1.js';
import {
  resolverEntidadCanonica,
  buscarPageImageWikipedia,
} from '../vision/wikimedia.js';

export const cognitiveRoutes = new Hono();
const visionClient = new vision.ImageAnnotatorClient();

// ── RUTA 1: /api/mind — Sidebar Local & VaultEngine /tgpmind ─────────────────
cognitiveRoutes.post('/api/mind', async (c) => {
  const auth = (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!TGP_MIND_API_KEY || auth !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  const origin = c.req.header('Origin') ?? '';
  if (origin && !isAllowedOrigin(origin)) return c.json({ error: 'Origen no permitido.' }, 403);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido.' }, 400); }

  const rawMessage: string = body?.message ?? '';
  const sessionId: string = body?.sessionId ?? 'sidebar-default';
  const usePro = body?.usePro === true || /^\/(pro|deep)\s+/i.test(rawMessage);
  const cleanMessage = rawMessage.replace(/^\/(pro|deep)\s+/i, '').trim();
  if (!cleanMessage) return c.json({ error: 'Mensaje vacío.' }, 400);

  const model = usePro ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
  const responseText = await callGemini(sessionId, cleanMessage, model);
  return c.json({ response: responseText, model, sessionId });
});

// ── RUTA 2: /api/bot/generate — Scriptorium & Telegram Mini App ─────────────
cognitiveRoutes.post('/api/bot/generate', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  const isMiniAppHeader = c.req.header('X-Mini-App') === 'true' || c.req.header('x-mini-app') === 'true';
  const origin = c.req.header('Origin') ?? '';

  if (origin && !isAllowedOrigin(origin) && !isMiniAppHeader) {
    return c.json({ error: 'Origen no permitido.' }, 403);
  }

  if (TGP_MIND_API_KEY && apiKey && apiKey !== TGP_MIND_API_KEY && !isMiniAppHeader) {
    return c.json({ error: 'No autorizado: API Key inválida.' }, 401);
  }

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido.' }, 400); }

  const {
    initData,
    tema,
    red = 'facebook',
    modelo = 'flash',
    densidad = 'profundo_breve',
    modoLibrePrompt = '',
    photoUrl = '',
    bot = 'omni',
    destino = 'ensayosCinematicos',
  } = body;

  if (!tema || typeof tema !== 'string' || !tema.trim()) {
    return c.json({ error: 'El campo "tema" es obligatorio.' }, 400);
  }

  let botToken = TELEGRAM_TOKEN;
  if (bot === 'assistant') botToken = TELEGRAM_TGP_CLOUD_TOKEN || TELEGRAM_TOKEN;
  else if (bot === 'redes') botToken = TELEGRAM_SOCIAL_TOKEN || TELEGRAM_TOKEN;
  else if (bot === 'liminal') botToken = TELEGRAM_DEV_TOKEN || TELEGRAM_TOKEN;

  let chatId: number = XAVIER_CHAT_ID;
  if (initData) {
    try {
      const params = new URLSearchParams(initData);
      const userStr = params.get('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.id) chatId = user.id;
      }
    } catch {}
  }

  try {
    const modelName = modelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
    const modLabel = modelo === 'pro' ? 'Gemini Pro' : 'Gemini Flash';
    const redLabel = red === 'facebook' ? 'Facebook' : 'TikTok';
    const isHemeroteca = destino !== 'social' && destino !== 'facebook' && destino !== 'tiktok';
    const targetLabel = isHemeroteca ? `Hemeroteca (${destino})` : redLabel;

    if (botToken && chatId) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⏳ Generando para ${targetLabel} con ${modLabel}...` }),
      }).catch(() => {});
    }

    const directivaDensidad = buildDensityInstruction(densidad, densidad === 'premium');
    const modoLibre = modoLibrePrompt?.trim()
      ? `\n\nDIRECTIVA PERSONALIZADA DEL AUTOR (MODO LIBRE):\n${modoLibrePrompt.trim()}`
      : '';

    let textoGenerado = '';
    if (isHemeroteca) {
      const userPrompt = `Escribe un ensayo reflexivo, denso y profundo para Hemeroteca TGP sobre: "${tema.trim()}". Estilo ensayo argentino contemporáneo. ${directivaDensidad}${modoLibre}`;
      textoGenerado = await callGemini(`desk-${chatId}`, userPrompt, modelName, TGP_SYSTEM_PROMPT, 8192);
    } else {
      const userPrompt = `Genera un texto magnético y reflexivo para redes sociales (${red}) sobre: ${tema.trim()}. ${directivaDensidad}${modoLibre}`;
      const SOCIAL_PROMPT = 'Eres un redactor cultural y turístico experto. Crea descripciones grounded basadas en hechos. Tono: Informativo, directo y claro.';
      textoGenerado = await callGemini(`desk-${chatId}`, userPrompt, modelName, SOCIAL_PROMPT, 8192);
    }

    const imagenUrl = photoUrl || '';
    return c.json({
      success: true,
      texto: textoGenerado,
      imagenUrl,
      destino,
      modelo: modelName,
    });
  } catch (err: any) {
    console.error('[/api/bot/generate Error]:', err);
    return c.json({ error: err?.message || 'Error al generar contenido.' }, 500);
  }
});

// ── RUTA 3: /process-image — Laboratorio Visual ──────────────────────────────
cognitiveRoutes.post('/process-image', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File | undefined;
    const mode = (formData['mode'] as string) || 'opencv';

    if (!file) {
      return c.json({ error: 'No se envió ningún archivo de imagen.' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/png';
    const dataUri = `data:${mimeType};base64,${base64}`;

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

// ── RUTA 4: /api/upload-r2 — Ingesta Universal a Cloudflare R2 + D1 ──────────
cognitiveRoutes.post('/api/upload-r2', async (c) => {
  try {
    let rawBuffer: Buffer | null = null;
    let folder = 'laboratorio-visual';
    let filename = '';
    let tema = '';
    let metadatos: any = {};
    let origen = 'laboratorio-visual';

    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      const dataUri = body.dataUri || body.image || '';
      folder = (body.folder || 'laboratorio-visual').replace(/[^a-z0-9\-_/]/gi, '');
      filename = body.filename || '';
      tema = body.tema || '';
      metadatos = body.metadatos || {};
      origen = body.origen || 'laboratorio-visual';

      if (!dataUri) {
        return c.json({ error: 'Se requiere dataUri o image en formato Base64 o URL.' }, 400);
      }

      if (dataUri.startsWith('http://') || dataUri.startsWith('https://')) {
        const ua = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
        const res = await fetch(dataUri, { headers: { 'User-Agent': ua } });
        if (!res.ok) throw new Error(`Error ${res.status} al descargar imagen desde URL remota`);
        rawBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
        const base64Data = match ? match[2] : dataUri;
        rawBuffer = Buffer.from(base64Data, 'base64');
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.parseBody();
      const file = formData['file'] as File | undefined;
      folder = ((formData['folder'] as string) || 'laboratorio-visual').replace(/[^a-z0-9\-_/]/gi, '');
      filename = (formData['filename'] as string) || '';
      tema = (formData['tema'] as string) || '';
      origen = (formData['origen'] as string) || 'laboratorio-visual';

      if (!file) {
        return c.json({ error: 'Se requiere archivo en FormData (campo "file").' }, 400);
      }
      const arrayBuffer = await file.arrayBuffer();
      rawBuffer = Buffer.from(arrayBuffer);
    } else {
      return c.json({ error: 'Content-Type no soportado. Usa application/json o multipart/form-data.' }, 400);
    }

    if (!rawBuffer || rawBuffer.length === 0) {
      return c.json({ error: 'Buffer de imagen vacío o inválido.' }, 400);
    }

    const publicUrl = await estandarizarYSubirImagenAR2(rawBuffer, folder, filename);
    const d1Id = crypto.randomUUID();
    let d1Guardado = false;
    try {
      await registrarResguardoD1({
        id: d1Id,
        origen,
        destino: 'r2',
        tema: tema || filename || 'Asset Visual Curado',
        textoGenerado: `Asset visual procesado y alojado en R2 CDN (${folder})`,
        metadatos: {
          ...metadatos,
          publicUrl,
          folder,
          filename,
          sizeBytes: rawBuffer.length,
          timestamp: new Date().toISOString(),
        },
        imagenR2Url: publicUrl,
      });
      d1Guardado = true;
    } catch (d1Err: any) {
      console.warn('[API /upload-r2] Advertencia al registrar en D1:', d1Err?.message);
    }

    return c.json({
      success: true,
      url: publicUrl,
      d1_id: d1Id,
      d1_guardado: d1Guardado,
      sizeBytes: rawBuffer.length,
    });
  } catch (err: any) {
    console.error('[API /upload-r2 Error]:', err);
    return c.json({ error: err?.message || 'Error al procesar y subir a Cloudflare R2' }, 500);
  }
});

// ── RUTA 5: /api/vision — Ingesta Multimodal Scriptorium ─────────────────────
cognitiveRoutes.post('/api/vision', async (c) => {
  const apiKey = c.req.header('x-api-key');
  if (!TGP_MIND_API_KEY || apiKey !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  const origin = c.req.header('Origin') ?? '';
  if (origin && !isAllowedOrigin(origin)) return c.json({ error: 'Origen no permitido.' }, 403);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido.' }, 400); }

  const prompt: string = body?.prompt ?? '';
  const base64Data: string = body?.base64 ?? '';
  const mimeType: string = body?.mimeType ?? 'image/jpeg';
  if (!prompt || !base64Data) return c.json({ error: 'Faltan campos requeridos (prompt o base64).' }, 400);

  try {
    const targetModel = body?.model || 'gemini-3.8-flash';
    const response = await genai.models.generateContent({
      model: targetModel,
      contents: [{ text: prompt }, { inlineData: { data: base64Data, mimeType } }],
    });
    return c.json({
      response: response.text,
      model: targetModel,
      usage: response.usageMetadata,
    });
  } catch (error: any) {
    console.error('[Vision API] Error:', error);
    return c.json({ error: 'Error procesando la imagen.' }, 500);
  }
});

// ── RUTA 6: /api/vision-exhaustivo — Data Lake OSINT ─────────────────────────
cognitiveRoutes.post('/api/vision-exhaustivo', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (TGP_MIND_API_KEY && apiKey !== TGP_MIND_API_KEY) {
    return c.json({ error: 'No autorizado: API Key inválida.' }, 401);
  }

  let body: { imageBase64?: string; mimeType?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Payload JSON malformado.' }, 400); }

  const { imageBase64, mimeType = 'image/webp' } = body;
  if (!imageBase64) return c.json({ error: 'Se requiere el parámetro "imageBase64".' }, 400);

  const rawBase64 = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
  const imageBuffer = Buffer.from(rawBase64, 'base64');
  const recordId = crypto.randomUUID();

  try {
    let imagenPublicUrl = `${R2_PUBLIC_DOMAIN}/osint/${recordId}.webp`;
    try {
      imagenPublicUrl = await subirBufferOsintAR2(imageBuffer, recordId, mimeType);
    } catch (errR2: any) {
      console.warn('[Vision-Exhaustivo] Falló subida a R2, continuando pipeline:', errR2?.message);
    }

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
        titulo: p.pageTitle || 'Sin título',
      }));

    const landmarks = landmarkResult[0]?.landmarkAnnotations || [];
    const coords = landmarks.map((l) => ({
      nombre: l.description || 'Punto de Interés Desconocido',
      score: Number((l.score || 0).toFixed(3)),
      lat: l.locations?.[0]?.latLng?.latitude || null,
      lng: l.locations?.[0]?.latLng?.longitude || null,
    }));

    const metadatos = { entidades, urls, coords };

    const promptOSINT = `Actúa como un investigador de OSINT y arqueología. Usa estas etiquetas, coordenadas y URLs para elaborar un informe enciclopédico exhaustivo y estructurado (alrededor de 3000 tokens). Detalla: historia, geología, descubrimientos, referencias a Wikipedia y análisis de las fuentes web. Mantén un tono neutro y descriptivo (Data Lake), sin conclusiones ensayísticas.

URL PÚBLICA DE LA IMAGEN EN R2: ${imagenPublicUrl}

[COORDENADAS Y MONUMENTOS DETECTADOS]:
${coords.length > 0 ? JSON.stringify(coords, null, 2) : 'No se identificaron monumentos conocidos ni coordenadas GPS directas.'}

[ENTIDADES WEB IDENTIFICADAS]:
${entidades.length > 0 ? entidades.map((e) => `- ${e.descripcion} (Confianza: ${e.score})`).join('\n') : 'Sin entidades web detectadas.'}

[FUENTES WEB COINCIDENTES]:
${urls.length > 0 ? urls.map((u) => `- [${u.titulo}](${u.url})`).join('\n') : 'Sin páginas indexadas coincidentes.'}

ESTRUCTURA OBLIGATORIA DEL INFORME:
# INFORME TÉCNICO DE INGESTA VISUAL (DATA LAKE ARCHIVO TGP)
## 1. IDENTIFICACIÓN CANÓNICA Y TOPONIMIA
## 2. GEORREFERENCIACIÓN Y CONTEXTO ESPACIAL
## 3. HISTORIA DOCUMENTAL Y REGISTRO ARQUEOLÓGICO
## 4. CONSTITUCIÓN GEOLÓGICA / MATERIAL
## 5. HISTORIOGRAFÍA Y DESCUBRIMIENTOS CLAVE
## 6. MAPEO DE FUENTES WEB Y REFERENCIAS ACADÉMICAS
## 7. DISCREPANCIAS, DUDAS ABIERTAS Y ANÁLISIS OSINT`;

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

// ── RUTA 7: /api/redaccion-premium — Redacción Documental Grounded ───────────
cognitiveRoutes.post('/api/redaccion-premium', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (TGP_MIND_API_KEY && apiKey !== TGP_MIND_API_KEY) {
    return c.json({ error: 'No autorizado: API Key inválida.' }, 401);
  }

  let body: { id?: string; informe_directo?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Payload JSON inválido.' }, 400); }

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
      return c.json({ error: 'No se encontró el informe OSINT para redactar el ensayo.' }, 400);
    }

    const promptUsuario = `${SYSTEM_PROMPT_NATGEO_GROUNDED}\n\n[INFORME TÉCNICO Y CONTEXTO]:\n${informeTexto}`;

    const responseGemini = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ text: promptUsuario }],
      config: {
        systemInstruction: SYSTEM_PROMPT_NATGEO_GROUNDED,
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const ensayoFinal = responseGemini.text || 'Error al generar el ensayo.';
    const audioUrl = await generarYGuardarAudioTTS(id, ensayoFinal);

    try {
      await actualizarRegistroD1(id, ensayoFinal, audioUrl);
    } catch (errD1) {
      console.warn('[Redacción Premium] Aviso actualizando D1:', errD1);
    }

    return c.json({
      id,
      ensayo: ensayoFinal,
      audio_url: audioUrl,
      imagen_url: imagenUrl,
    });
  } catch (err: any) {
    console.error('[Redacción Premium Error]:', err);
    return c.json({ error: 'Fallo al procesar el ensayo premium.', detalles: err?.message }, 500);
  }
});

// ── RUTA 8: /api/proxy/wikimedia — Proxy Wikimedia para /wikiforge ───────────
cognitiveRoutes.get('/api/proxy/wikimedia', async (c) => {
  const q = c.req.query('q') || '';
  if (!q) return c.json({ imageUrl: '' });
  try {
    const entidad = await resolverEntidadCanonica(q);
    const imageUrl =
      (await buscarPageImageWikipedia(entidad.wikiEn, 'en')) ||
      (await buscarPageImageWikipedia(entidad.wikiEs, 'es')) ||
      '';
    return c.json({ imageUrl, query: { wikiEn: entidad.wikiEn, wikiEs: entidad.wikiEs } });
  } catch (err: any) {
    return c.json({ imageUrl: '', error: err?.message });
  }
});

// ── RUTA 9: /api/consolidate-magazine — Magazine 60/40 Secuencial a R2 ───────
cognitiveRoutes.post('/api/consolidate-magazine', async (c) => {
  try {
    const body = (await c.req.json()) as {
      images: { url: string; title: string; author: string; licenseShortName: string }[];
    };
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
        const r2Url = await estandarizarYSubirImagenAR2(img.url, 'bookzine');
        results.push({
          title: img.title,
          author: img.author,
          licenseShortName: img.licenseShortName,
          r2Url,
          originalUrl: img.url,
        });
      } catch (imgErr: any) {
        console.warn(`[Consolidate Magazine] Error en "${img.title}":`, imgErr?.message);
        results.push({
          title: img.title,
          author: img.author,
          licenseShortName: img.licenseShortName,
          r2Url: img.url,
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
