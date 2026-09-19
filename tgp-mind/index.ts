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
import vision from '@google-cloud/vision';
import crypto from 'node:crypto';
import 'dotenv/config';

// ── Configuración ─────────────────────────────────────────────────────────────
const PORT               = parseInt(process.env.PORT || '3001');
const TELEGRAM_TOKEN     = (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').replace(/['"]/g, '').trim();
const TELEGRAM_BOT_NAME  = (process.env.TELEGRAM_BOT_NAME || 'Analista_IMG_bot').replace(/['"]/g, '').trim();
const GEMINI_API_KEY     = (process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();
const TGP_MIND_API_KEY   = (process.env.TGP_MIND_API_KEY || '').replace(/['"]/g, '').trim();
const XAVIER_CHAT_ID     = 7886507052;
const DIALOGFLOW_PROJECT  = process.env.DIALOGFLOW_PROJECT  || '';
const DIALOGFLOW_LOCATION = process.env.DIALOGFLOW_LOCATION || 'us-central1';
const DIALOGFLOW_AGENT_ID = process.env.DIALOGFLOW_AGENT_ID || '';
const TELEGRAM_API        = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const TELEGRAM_SOCIAL_TOKEN     = process.env.TELEGRAM_SOCIAL_TOKEN || '';
const TELEGRAM_TGP_CLOUD_TOKEN  = process.env.TELEGRAM_TGP_CLOUD_TOKEN || '';
const TELEGRAM_DEV_TOKEN        = process.env.TELEGRAM_DEV_BOT_TOKEN   || '';
const ZERNIO_API_KEY        = process.env.ZERNIO_API_KEY || '';
const ZERNIO_FB_ID          = process.env.ZERNIO_FB_ID || '';
const ZERNIO_TIKTOK_ID      = process.env.ZERNIO_TIKTOK_ID || '';
const TELEGRAM_SOCIAL_API   = `https://api.telegram.org/bot${TELEGRAM_SOCIAL_TOKEN}`;

// ── Cloudflare R2 & D1 ────────────────────────────────────────────────────────
const CLOUDFLARE_ACCOUNT_ID    = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
const CLOUDFLARE_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '';
const CLOUDFLARE_API_TOKEN     = process.env.CLOUDFLARE_API_TOKEN     || '';
const R2_ACCESS_KEY_ID         = process.env.R2_ACCESS_KEY_ID         || '';
const R2_SECRET_ACCESS_KEY     = process.env.R2_SECRET_ACCESS_KEY     || '';
const R2_BUCKET_NAME           = process.env.R2_BUCKET_NAME           || 'tgp-storage';
const R2_PUBLIC_DOMAIN         = process.env.R2_PUBLIC_DOMAIN         || 'https://assets.thegreatpuzzleproject.com';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── Google Cloud Vision Client ────────────────────────────────────────────────
const visionClient = new vision.ImageAnnotatorClient();

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

// ── ANTI-DRIFT: Pipeline de Resolución de Entidad y Búsqueda Curada ──────────
interface EntidadVisualCanonica {
  wikiEn: string;
  wikiEs: string;
  categoriaCommons: string;
  keywords: string[];
}

async function resolverEntidadCanonica(tema: string): Promise<EntidadVisualCanonica> {
  const prompt = `Actúa como especialista enciclopédico de Wikipedia y Wikimedia Commons.
Analiza este tema o búsqueda histórica/geológica/cultural (que puede tener errores tipográficos o nombres informales): "${tema}".
Devuelve ÚNICAMENTE un objeto JSON sin formato markdown con esta estructura exacta:
{
  "wikiEn": "Título exacto del artículo principal en Wikipedia en inglés (ej: 'Klerksdorp sphere')",
  "wikiEs": "Título exacto del artículo principal en Wikipedia en español (ej: 'Esferas de Klerksdorp')",
  "categoriaCommons": "Nombre de la categoría más específica en Wikimedia Commons si existe, sin 'Category:' (ej: 'Klerksdorp spheres')",
  "keywords": ["2 a 4 palabras clave esenciales en inglés o español sin stopwords"]
}`;

  try {
    const resp = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ text: prompt }],
      config: { responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse(resp.text || '{}');
    return {
      wikiEn: parsed.wikiEn || tema,
      wikiEs: parsed.wikiEs || tema,
      categoriaCommons: parsed.categoriaCommons || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((k: string) => k.toLowerCase()) : [],
    };
  } catch (err) {
    console.warn('[Anti-Drift] Falló resolución con Gemini, usando término directo:', err);
    return {
      wikiEn: tema,
      wikiEs: tema,
      categoriaCommons: '',
      keywords: tema.toLowerCase().split(/\s+/).filter(w => w.length > 3),
    };
  }
}

// Búsqueda curada de imagen principal vía módulo PageImages de Wikipedia
async function buscarPageImageWikipedia(titulo: string, lang: 'en' | 'es'): Promise<string> {
  if (!titulo) return '';
  const ua = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const url = `${base}?action=query&titles=${encodeURIComponent(titulo)}&prop=pageimages|original&format=json&pithumbsize=1200&redirects=1`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': ua } });
    if (!res.ok) return '';
    const data = await res.json() as any;
    const pages = data?.query?.pages;
    if (!pages) return '';

    for (const id in pages) {
      if (id === '-1') continue;
      const page = pages[id];
      const src = page?.original?.source || page?.thumbnail?.source;
      if (src && /\.(jpe?g|png|webp)$/i.test(src)) {
        // Filtrar banderas, mapas genéricos, escudos o íconos
        if (!/(flag|bandera|mapa|map|escudo|coat_of_arms|icon|disambig|symbol)/i.test(src)) {
          return src;
        }
      }
    }
  } catch (err) {
    console.warn(`[PageImage] Error en Wikipedia ${lang} para "${titulo}":`, err);
  }
  return '';
}

// Búsqueda restringida en Wikimedia Commons con filtrado de metadatos y categorías
async function buscarCommonsEstricto(categoria: string, keywords: string[]): Promise<string> {
  const ua = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const base = 'https://commons.wikimedia.org/w/api.php';

  // 1. Si existe categoría exacta en Commons, extraer imágenes miembros de esa categoría (namespace 6 = File)
  if (categoria) {
    try {
      const catUrl = `${base}?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent('Category:' + categoria)}&gcmnamespace=6&gcmlimit=8&prop=imageinfo&iiprop=url|size&format=json`;
      const res = await fetch(catUrl, { headers: { 'User-Agent': ua } });
      const data = await res.json() as any;
      const pages = data?.query?.pages;
      if (pages) {
        for (const id in pages) {
          const info = pages[id]?.imageinfo?.[0];
          const imgUrl = info?.url;
          if (imgUrl && /\.(jpe?g|png|webp)$/i.test(imgUrl)) {
            // Descartar mapas, diagramas e íconos pequeños
            if (!/(map|flag|diagram|icon|locator)/i.test(imgUrl) && (!info.width || info.width >= 500)) {
              return imgUrl;
            }
          }
        }
      }
    } catch {}
  }

  // 2. Si no hay categoría o no arrojó resultados, buscar por keywords con exclusión estricta
  if (keywords.length > 0) {
    try {
      const queryStr = keywords.join(' ') + ' -map -flag -icon -diagram';
      const searchUrl = `${base}?action=query&generator=search&gsrsearch=${encodeURIComponent(queryStr)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size&format=json`;
      const res = await fetch(searchUrl, { headers: { 'User-Agent': ua } });
      const data = await res.json() as any;
      const pages = data?.query?.pages;
      if (pages) {
        for (const id in pages) {
          const title = (pages[id]?.title || '').toLowerCase();
          const info = pages[id]?.imageinfo?.[0];
          const imgUrl = info?.url;
          if (!imgUrl || !/\.(jpe?g|png|webp)$/i.test(imgUrl)) continue;

          // Validar que el archivo contenga al menos una de las keywords principales
          const matchKw = keywords.some(k => title.includes(k));
          if (matchKw && !/(map|flag|diagram|icon|locator)/i.test(title)) {
            return imgUrl;
          }
        }
      }
    } catch {}
  }

  return '';
}

async function buscarImagenWikipediaFallback(termino: string, lang: 'es' | 'en'): Promise<string> {
  const ua = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const url = `${base}?action=query&generator=search&gsrsearch=${encodeURIComponent(termino)}&gsrlimit=3&prop=pageimages&format=json&pithumbsize=1000`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': ua } });
    const d = await res.json() as any;
    if (d?.query?.pages) {
      for (const id in d.query.pages) {
        const src = d.query.pages[id]?.thumbnail?.source;
        if (src) return src;
      }
    }
  } catch {}
  return '';
}

// Helper: Subir Buffer binario a Cloudflare R2
async function subirBufferAR2(buffer: Buffer, key: string, contentType = 'image/jpeg'): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  const publicUrl = `https://storage.thegreatpuzzleproject.com/${key}`;
  console.log(`[R2] Buffer subido exitosamente: ${publicUrl}`);
  return publicUrl;
}

// Helper: Descargar foto desde Telegram Bot API por file_id y subirla directo a R2
async function procesarFotoTelegramAR2(fileId: string, customSlug = 'telegram'): Promise<{ url: string; mimeType: string; fileName: string }> {
  // 1. Obtener file_path de Telegram
  const fileInfoRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  if (!fileInfoRes.ok) throw new Error(`Error en getFile de Telegram: ${fileInfoRes.statusText}`);
  const fileInfo = await fileInfoRes.json() as any;
  const filePath = fileInfo?.result?.file_path;
  if (!filePath) throw new Error('Telegram no devolvió file_path');

  // 2. Descargar binario
  const fileDownloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
  const imgRes = await fetch(fileDownloadUrl);
  if (!imgRes.ok) throw new Error(`Error descargando imagen de Telegram: ${imgRes.statusText}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  // 3. Determinar extensión y content-type
  const ext = filePath.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const fileName = `${customSlug}-${Date.now()}.${ext}`;
  const r2Key = `telegram/${fileName}`;

  // 4. Subir a R2
  const url = await subirBufferAR2(buffer, r2Key, mimeType);
  return { url, mimeType, fileName };
}

async function subirImagenAR2(imageUrl: string): Promise<string> {
  const ua     = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': ua } });
  if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status} al descargar imagen`);
  const buffer   = Buffer.from(await imgRes.arrayBuffer());
  const archivo  = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.jpg`;
  return await subirBufferAR2(buffer, archivo, 'image/jpeg');
}

async function procesarImagen(terminoBusqueda: string): Promise<string> {
  console.log(`[Anti-Drift Imagen] Iniciando búsqueda verificada para: "${terminoBusqueda}"`);
  try {
    // 1. Resolver entidad canónica con Gemini (corrige typos y mapea títulos exactos)
    const entidad = await resolverEntidadCanonica(terminoBusqueda);
    console.log(`[Anti-Drift] Entidad: WikiEN="${entidad.wikiEn}", WikiES="${entidad.wikiEs}", CatCommons="${entidad.categoriaCommons}"`);

    // 2. Prioridad A: PageImage curada de Wikipedia en inglés (máxima resolución y relevancia)
    let raw = await buscarPageImageWikipedia(entidad.wikiEn, 'en');

    // 3. Prioridad B: PageImage curada de Wikipedia en español
    if (!raw) raw = await buscarPageImageWikipedia(entidad.wikiEs, 'es');

    // 4. Prioridad C: Commons estricto por categoría específica (Category:...) o keywords validadas
    if (!raw) raw = await buscarCommonsEstricto(entidad.categoriaCommons, entidad.keywords);

    // 5. Prioridad D: Respaldo en Wikipedia
    if (!raw) raw = await buscarImagenWikipediaFallback(entidad.wikiEs, 'es') || await buscarImagenWikipediaFallback(entidad.wikiEn, 'en');

    if (!raw) {
      console.warn(`[Anti-Drift] Sin resultados verificados para: "${terminoBusqueda}"`);
      return '';
    }

    console.log(`[Anti-Drift] Imagen seleccionada con éxito: ${raw}`);
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

// ── Publicación Atómica en GitHub respetando el Sistema de Colecciones de Keystatic ──
async function publicarEntradaKeystaticGitHub({
  coleccion = 'ensayos-cinematicos',
  slug,
  indexJson,
  contentMdoc,
  token,
  repoFull,
  mensajeCommit,
}: {
  coleccion?: 'ensayos-cinematicos' | 'ensayos' | 'georreferencias';
  slug: string;
  indexJson: Record<string, any>;
  contentMdoc: string;
  token: string;
  repoFull: string;
  mensajeCommit?: string;
}): Promise<string> {
  const octokitDynamic = new Octokit({ auth: token });
  const parts  = repoFull.includes('/') ? repoFull.split('/') : ['ygnatiux-sys', repoFull];
  const owner  = parts[0] || 'ygnatiux-sys';
  const repo   = parts[1];
  const branch = process.env.GITHUB_BRANCH || 'main';

  // 1. Obtener SHA del commit actual en la rama
  const refRes = await octokitDynamic.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refRes.data.object.sha;
  const latestCommit = await octokitDynamic.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  const baseTreeSha = latestCommit.data.tree.sha;

  // 2. Ruta exacta según el sistema de colecciones Keystatic
  const basePath = `src/content/${coleccion}/${slug}`;

  // 3. Crear árbol atómico con index.json y content.mdoc
  const treeEntries = [
    {
      path: `${basePath}/index.json`,
      mode: '100644' as const,
      type: 'blob' as const,
      content: JSON.stringify(indexJson, null, 2),
    },
    {
      path: `${basePath}/content.mdoc`,
      mode: '100644' as const,
      type: 'blob' as const,
      content: contentMdoc,
    },
  ];

  const newTree = await octokitDynamic.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeEntries,
  });

  // 4. Crear commit
  const commitMsg = mensajeCommit || `TGP Mind: Entrada Keystatic [${coleccion}] -- ${slug}`;
  const newCommit = await octokitDynamic.git.createCommit({
    owner,
    repo,
    message: commitMsg,
    tree: newTree.data.sha,
    parents: [latestCommitSha],
  });

  // 5. Actualizar la rama principal
  await octokitDynamic.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.data.sha,
  });

  const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommit.data.sha}`;
  console.log(`[GitHub Keystatic Commit] ${basePath} publicado exitosamente: ${commitUrl}`);
  return commitUrl;
}

// Compatibilidad retroactiva con repositorios legacy (Alternative)
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

  console.log(`[GitHub Commit Legacy] ${path} -> commit ${commitRes.data.commit?.sha}`);
  return commitRes.data.content?.html_url || `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
}

// ── Gestor de Estado de Sesiones (Inline Keyboard Wizard) ────────────────────
interface SesionConfig {
  tema: string;
  destino:    'social' | 'hemeroteca' | 'alternative';
  modelo:     'flash'  | 'pro';
  fuenteImg:  'none'   | 'wiki' | 'imagen3' | 'telegram';
  cantidadImg: 1 | 3 | 5;
  imagenTelegramUrl?: string;
  coleccion?: 'ensayos-cinematicos' | 'ensayos';
}
const sesiones = new Map<number, SesionConfig>();
const pendingTextQueries = new Map<string, string>();

// ── Inline Keyboard Builder ───────────────────────────────────────────────────
// ── Inline Keyboard Builder ───────────────────────────────────────────────────
function buildInlineKeyboard(cfg: SesionConfig) {
  const mark = (active: boolean, label: string) => (active ? `✅ ${label}` : label);
  const filaImagenes = [
    { text: mark(cfg.fuenteImg === 'none',    'Sin imagen'), callback_data: 'img_none'    },
    { text: mark(cfg.fuenteImg === 'wiki',    'Wiki'),       callback_data: 'img_wiki'    },
    { text: mark(cfg.fuenteImg === 'imagen3', 'Imagen 3'),   callback_data: 'img_imagen3' },
  ];
  if (cfg.imagenTelegramUrl) {
    filaImagenes.push({ text: mark(cfg.fuenteImg === 'telegram', '📷 Foto R2'), callback_data: 'img_telegram' });
  }

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
      filaImagenes,
      [
        { text: mark(cfg.cantidadImg === 1, '1 secc'),  callback_data: 'cant_1' },
        { text: mark(cfg.cantidadImg === 3, '3 secc'),  callback_data: 'cant_3' },
        { text: mark(cfg.cantidadImg === 5, '5 secc'),  callback_data: 'cant_5' },
      ],
      [
        { text: '🚀 GENERAR ENSAYO', callback_data: 'generar_ok' },
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

import { devBotApp } from './src/devBot.js';

// ── Hono App ──────────────────────────────────────────────────────────────────
const app = new Hono();
app.get('/', (c) => c.json({ status: 'TGP Mind activo', ts: new Date().toISOString() }));

// ── RUTA AISLADA DE DESARROLLO (@UXliminal_bot) ──────────────────────────────
app.route('/webhook-dev', devBotApp);

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 1: Webhook Telegram -- Wizard con Inline Keyboards
// ─────────────────────────────────────────────────────────────────────────────
app.post('/webhook/telegram', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

  // ── RAMA A: Mensaje de texto o foto (nuevo pedido) ─────────────────────────
  const message = body?.message;
  if (message) {
    const chatId: number | undefined = message?.chat?.id;
    const hasPhoto = Array.isArray(message?.photo) && message.photo.length > 0;
    const text: string = message?.text ?? message?.caption ?? '';
    if (!chatId || (!text && !hasPhoto)) return c.json({ ok: true });

    if (chatId !== XAVIER_CHAT_ID) {
      console.warn(`[Telegram] Acceso bloqueado para chatId: ${chatId}`);
      await sendTelegram(chatId, 'Acceso denegado. Nodo privado TGP.');
      return c.json({ ok: true });
    }

    if (text.trim() === '/start') {
      await sendTelegram(chatId, 'TGP Mind en línea.\n\nEscribime cualquier tema o envíame una foto con pie de foto para publicarla en Keystatic/Hemeroteca.');
      return c.json({ ok: true });
    }

    // Si viene foto adjunta de Telegram, descargarla y subirla directo a Cloudflare R2
    let imagenR2Url = '';
    if (hasPhoto) {
      const bestPhoto = message.photo[message.photo.length - 1];
      const baseSlug = generarSlug(text ? text.slice(0, 30) : 'foto-telegram');
      try {
        await sendTelegram(chatId, '📷 Descargando imagen de Telegram y subiendo a Cloudflare R2...');
        const r2Res = await procesarFotoTelegramAR2(bestPhoto.file_id, baseSlug);
        imagenR2Url = r2Res.url;
        await sendTelegram(chatId, `✅ Imagen alojada en Cloudflare R2:\n${imagenR2Url}`);
      } catch (errUpload: any) {
        console.error('[Telegram Photo Upload Error]:', errUpload);
        await sendTelegram(chatId, `⚠️ Error subiendo imagen a R2: ${errUpload?.message || 'Error'}`);
      }
    }

    const temaFinal = text.trim() || (imagenR2Url ? 'Ensayo Visual de Archivo' : '');
    if (!temaFinal) return c.json({ ok: true });

    const sesion: SesionConfig = {
      tema: temaFinal,
      destino: 'hemeroteca',
      modelo: 'flash',
      fuenteImg: imagenR2Url ? 'telegram' : 'wiki',
      cantidadImg: imagenR2Url ? 1 : 3,
      imagenTelegramUrl: imagenR2Url || undefined,
      coleccion: 'ensayos-cinematicos',
    };
    sesiones.set(chatId, sesion);

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Configura tu publicación sobre:\n"${sesion.tema}"${imagenR2Url ? '\n\n📷 Portada vinculada a tu imagen de R2.' : ''}`,
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
    if      (data === 'dest_social')   sesion.destino     = 'social';
    else if (data === 'dest_hem')      sesion.destino     = 'hemeroteca';
    else if (data === 'dest_alt')      sesion.destino     = 'alternative';
    else if (data === 'mod_flash')     sesion.modelo      = 'flash';
    else if (data === 'mod_pro')       sesion.modelo      = 'pro';
    else if (data === 'img_none')      sesion.fuenteImg   = 'none';
    else if (data === 'img_wiki')      sesion.fuenteImg   = 'wiki';
    else if (data === 'img_imagen3')   sesion.fuenteImg   = 'imagen3';
    else if (data === 'img_telegram')  sesion.fuenteImg   = 'telegram';
    else if (data === 'cant_1')        sesion.cantidadImg = 1;
    else if (data === 'cant_3')        sesion.cantidadImg = 3;
    else if (data === 'cant_5')        sesion.cantidadImg = 5;
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

        if (sesion.fuenteImg === 'telegram' && sesion.imagenTelegramUrl && Array.isArray(parsed.secciones)) {
          if (parsed.secciones.length > 0) {
            parsed.secciones[0].imagen_url = sesion.imagenTelegramUrl;
          }
        } else if (sesion.fuenteImg === 'wiki' && Array.isArray(parsed.secciones)) {
          for (const seccion of parsed.secciones) {
            if (seccion.busqueda_wikimedia) {
              const r2Url = await procesarImagen(seccion.busqueda_wikimedia);
              if (r2Url) seccion.imagen_url = r2Url;
            }
          }
        } else if (sesion.fuenteImg === 'imagen3' && Array.isArray(parsed.secciones)) {
          for (const seccion of parsed.secciones) seccion.imagen_url = 'PENDIENTE_IMAGEN3';
        }

        await sendTelegram(chatId, `Compilando estructura Keystatic y publicando en GitHub...`);
        const { slug, contenidoMdoc } = generarMarkdoc(parsed);

        const token    = sesion.destino === 'hemeroteca' ? GITHUB_TOKEN_HEMEROTECA  : GITHUB_TOKEN_ALTERNATIVE;
        const repoFull = sesion.destino === 'hemeroteca' ? GITHUB_REPO_HEMEROTECA   : GITHUB_REPO_ALTERNATIVE;

        let githubUrl = '';
        if (sesion.destino === 'hemeroteca') {
          // Publicación respetando la estructura dual de Keystatic: index.json + content.mdoc
          const coverUrl = sesion.imagenTelegramUrl || parsed.secciones?.[0]?.imagen_url || '';
          const primerParrafo = parsed.secciones?.[0]?.parrafo || '';

          const indexJson = {
            title: parsed.titulo,
            generadorTexto: JSON.stringify({
              text: contenidoMdoc,
              image: coverUrl,
            }),
            atmosfera: {
              discriminant: 'obsidiana',
            },
            gallery: [],
            dek: primerParrafo ? primerParrafo.slice(0, 110) + '...' : '',
            coverImage: coverUrl,
            date: new Date().toISOString().slice(0, 10),
            excerpt: primerParrafo ? primerParrafo.slice(0, 180) + '...' : '',
          };

          // Cuerpo Markdoc puro sin frontmatter para que Keystatic lo edite limpiamente
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
        } else {
          githubUrl = await publicarEnGitHub(slug, contenidoMdoc, token, repoFull);
        }

        const webUrl = sesion.destino === 'hemeroteca'
          ? `https://thegreatpuzzleproject.com/ensayos-cinematicos/${slug}`
          : `https://alternative.thegreatpuzzleproject.com/ensayos/${slug}`;

        await sendTelegram(chatId, `"${parsed.titulo}" publicado en ${destinoLabel}.\n\n🔗 Ver en la Web:\n${webUrl}\n\n📦 Commit en GitHub:\n${githubUrl}\n\n⚡ Cloudflare Pages procesando el nuevo despliegue.`);
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
const isAllowedOrigin = (origin: string) => {
  if (!origin) return true;
  return (
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.endsWith('.thegreatpuzzleproject.com') ||
    origin === 'https://thegreatpuzzleproject.com' ||
    origin.endsWith('.pages.dev')
  );
};

app.use('/api/*', cors({
  origin: (origin) => isAllowedOrigin(origin) ? origin : null,
  allowHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Api-Key'],
  allowMethods: ['POST', 'OPTIONS'],
}));

app.post('/api/mind', async (c) => {
  const auth = (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!TGP_MIND_API_KEY || auth !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  const origin = c.req.header('Origin') ?? '';
  if (origin && !isAllowedOrigin(origin)) return c.json({ error: 'Origen no permitido.' }, 403);

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
// RUTA: /process-image -- Transformación Estructural & Deriva Estética (Laboratorio Visual)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/process-image', async (c) => {
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

    console.log(`[Process-Image] Procesando modo: ${mode} para archivo: ${file.name}`);

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

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 3: /api/vision -- Ingesta Multimodal Scriptorium
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/vision', async (c) => {
  const apiKey = c.req.header('x-api-key');
  if (!TGP_MIND_API_KEY || apiKey !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  const origin = c.req.header('Origin') ?? '';
  if (origin && !isAllowedOrigin(origin)) return c.json({ error: 'Origen no permitido.' }, 403);

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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PARA DATA LAKE OSINT (R2 + CLOUDFLARE D1 + TTS)
// ─────────────────────────────────────────────────────────────────────────────
async function subirBufferOsintAR2(imageBuffer: Buffer, id: string, mimeType = 'image/webp'): Promise<string> {
  const fileKey = `osint/${id}.webp`;
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      Body: imageBuffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return `${R2_PUBLIC_DOMAIN}/${fileKey}`;
}

async function asegurarTablaD1(): Promise<void> {
  if (!CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN) return;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;
  const schemaQuery = `
    CREATE TABLE IF NOT EXISTS data_lake_vision (
      id TEXT PRIMARY KEY,
      imagen_url TEXT,
      metadatos_vision TEXT,
      informe_osint TEXT,
      ensayo_premium TEXT,
      audio_url TEXT,
      fecha_ingesta TEXT
    );
  `;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: schemaQuery }),
    });
  } catch (err) {
    console.warn('[D1 Schema Warning]:', err);
  }
}

async function guardarEnCloudflareD1(registro: {
  id: string;
  imagen_url: string;
  metadatos_vision: object;
  informe_osint: string;
  fecha_ingesta: string;
}): Promise<void> {
  if (!CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN) {
    console.warn('[D1 Storage] Omitiendo guardado en D1 (variables CLOUDFLARE_D1_DATABASE_ID o CLOUDFLARE_API_TOKEN no configuradas).');
    return;
  }
  await asegurarTablaD1();
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;
  const query = `
    INSERT INTO data_lake_vision (id, imagen_url, metadatos_vision, informe_osint, fecha_ingesta)
    VALUES (?, ?, ?, ?, ?)
  `;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: query,
      params: [
        registro.id,
        registro.imagen_url,
        JSON.stringify(registro.metadatos_vision),
        registro.informe_osint,
        registro.fecha_ingesta,
      ],
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`[D1 Storage Warning] (${response.status}): ${errorText}`);
  } else {
    console.log(`[D1 Storage] Registro persistido exitosamente con ID: ${registro.id}`);
  }
}

async function obtenerInformeD1(id: string): Promise<{ informe_osint: string; imagen_url: string; ensayo_premium?: string } | null> {
  if (!CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN) return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: 'SELECT informe_osint, imagen_url, ensayo_premium FROM data_lake_vision WHERE id = ? LIMIT 1',
      params: [id],
    }),
  });
  const data: any = await res.json();
  const rows = data?.result?.[0]?.results;
  return rows && rows.length > 0 ? rows[0] : null;
}

async function actualizarRegistroD1(id: string, ensayo: string, audioUrl: string | null): Promise<void> {
  if (!CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN) return;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: 'UPDATE data_lake_vision SET ensayo_premium = ?, audio_url = ? WHERE id = ?',
      params: [ensayo, audioUrl, id],
    }),
  });
  console.log(`[D1 Storage] Ensayo Premium y Audio persistidos para ID: ${id}`);
}

async function generarYGuardarAudioTTS(id: string, texto: string): Promise<string | null> {
  try {
    const textoLimpio = texto
      .replace(/[#*_`>\-\[\]\(\)]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 4500);

    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GEMINI_API_KEY}`;
    const ttsRes = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: textoLimpio },
        voice: {
          languageCode: 'es-AR',
          name: 'es-AR-Neural2-A',
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.96,
          pitch: -1.0,
        },
      }),
    });

    if (!ttsRes.ok) {
      console.warn('[TTS] Aviso en Google TTS:', await ttsRes.text());
      return null;
    }

    const ttsData: any = await ttsRes.json();
    if (!ttsData.audioContent) return null;

    const audioBuffer = Buffer.from(ttsData.audioContent, 'base64');
    const audioKey = `audios/${id}.mp3`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: audioKey,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return `${R2_PUBLIC_DOMAIN}/${audioKey}`;
  } catch (err) {
    console.error('[TTS Error]:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 3B: /api/vision-exhaustivo -- Ingesta Exhaustiva (Data Lake OSINT)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/vision-exhaustivo', async (c) => {
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
    // 1. Guardado de imagen en R2
    console.log(`[Vision-Exhaustivo] Subiendo imagen a R2 (ID: ${recordId})...`);
    let imagenPublicUrl = `${R2_PUBLIC_DOMAIN}/osint/${recordId}.webp`;
    try {
      imagenPublicUrl = await subirBufferOsintAR2(imageBuffer, recordId, mimeType);
    } catch (errR2: any) {
      console.warn('[Vision-Exhaustivo] Falló subida a R2, continuando pipeline:', errR2?.message);
    }

    // 2. Extracción con Google Cloud Vision
    console.log('[Vision-Exhaustivo] Extrayendo datos con Cloud Vision...');
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

    // 3. Expansión Cognitiva con Gemini 1.5 Flash (~3000 tokens)
    console.log('[Vision-Exhaustivo] Generando monografía en Gemini 1.5 Flash...');
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

    // 4. Persistencia en Cloudflare D1
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

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 3C: /api/redaccion-premium -- Fase de Producción Literaria TGP
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/redaccion-premium', async (c) => {
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

    console.log(`[Redacción Premium] Redactando ensayo con Gemini 1.5 Pro + Grounding (ID: ${id})...`);
    const SYSTEM_PROMPT_PREMIUM = `Actúa en Modo TGP. Eres un ensayista y crítico cultural contemporáneo de alto nivel.
Usa este informe técnico para redactar un ensayo cultural y filosófico breve, profundo y crítico.
Estructura rigurosa TGP:
1) Gancho visual evocador y misterioso
2) Contexto histórico y arqueológico preciso
3) Concepto filosófico o técnico nuclear
4) Cierre existencial y universal sobre la condición humana.
Estilo: Ensayo argentino contemporáneo. Denso, sin introducciones vacías, con ritmo narrativo y elegancia Dark Academia.`;

    const responseGemini = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ text: `INFORME TÉCNICO (DATA LAKE):\n\n${informeTexto}\n\nEscribe el ensayo definitivo TGP.` }],
      config: {
        systemInstruction: SYSTEM_PROMPT_PREMIUM,
        temperature: 0.75,
        maxOutputTokens: 2500,
        tools: [{ googleSearch: {} }],
      },
    });

    const ensayoFinal = responseGemini.text || 'Error al generar el ensayo.';

    console.log('[Redacción Premium] Sintetizando audio narrativo en R2...');
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

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 4: /api/telegram/upload-media -- Ingesta programable directa de Telegram a R2
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/telegram/upload-media', async (c) => {
  const apiKey = c.req.header('x-api-key') || (c.req.header('Authorization') ?? '').replace('Bearer ', '').trim();
  if (TGP_MIND_API_KEY && apiKey !== TGP_MIND_API_KEY) return c.json({ error: 'No autorizado.' }, 401);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON invalido' }, 400); }

  const fileId: string = body?.fileId ?? '';
  const slug: string = body?.slug ?? 'telegram-media';
  if (!fileId) return c.json({ error: 'Falta parametro fileId' }, 400);

  try {
    const result = await procesarFotoTelegramAR2(fileId, slug);
    return c.json({ success: true, url: result.url, fileName: result.fileName, mimeType: result.mimeType });
  } catch (err: any) {
    console.error('[API Telegram Upload Media Error]:', err);
    return c.json({ success: false, error: err?.message || 'Error al procesar y subir imagen a R2' }, 500);
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

    // Mensaje 1: inline keyboard clásico
    await fetch(`${TELEGRAM_SOCIAL_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚙️ Configura tu publicacion sobre:\n"${sesion.tema}"`,
        reply_markup: buildSocialInlineKeyboard(sesion),
      }),
    });

    // Mensaje 2: botón Mini App
    const temaEncodedSocial = encodeURIComponent(sesion.tema);
    await fetch(`${TELEGRAM_SOCIAL_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '📱 *O usa la interfaz visual:*',
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '⚙️ Configurar publicación', web_app: { url: `${MINI_APP_URL}?bot=social&tema=${temaEncodedSocial}` } }]],
          resize_keyboard: true, one_time_keyboard: true,
        },
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

// ─────────────────────────────────────────────────────────────────────────────
// RUTA 5: /telegram-webhook -- Omni-Bot @Analista_IMG_bot (Data Lake + Cortafuegos)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/telegram-webhook', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: true }); }

  const message = body?.message;
  if (message) {
    const chatId = message.chat?.id;
    console.log(`[Omni-Bot Webhook] Mensaje recibido de chatId: ${chatId} | texto: "${message.text || ''}"`);
    if (XAVIER_CHAT_ID && chatId !== XAVIER_CHAT_ID) {
      console.warn(`[Omni-Bot Webhook] Chat ID no coincide: recibido ${chatId}, esperado ${XAVIER_CHAT_ID}`);
      try {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `⛔ Acceso restringido.\n\nTu Telegram Chat ID es: \`${chatId}\`.\nActualiza XAVIER_CHAT_ID con este número para autorizarte.`,
            parse_mode: 'Markdown',
          }),
        });
      } catch (errSend) {
        console.error('[Omni-Bot Webhook] Error al enviar mensaje de chatId:', errSend);
      }
      return c.json({ ok: true });
    }

    // Regla extra: /resumir sobre reply_to_message
    const text: string = message.text || '';
    if (text.startsWith('/resumir') && message.reply_to_message) {
      const quoted = message.reply_to_message.text || message.reply_to_message.caption || '';
      if (!quoted) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: '⚠️ El mensaje citado no contiene texto.' }),
        });
        return c.json({ ok: true });
      }

      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: '⚡ Sintetizando con Gemini Flash...' }),
      });

      const summaryResp = await genai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ text: `Resume de forma analítica, densa y en viñetas este texto:\n\n${quoted}` }],
        config: { systemInstruction: 'Eres un analista de TGP. Tono sobrio, preciso y directo.' },
      });

      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `📋 Resumen Ejecutivo:\n\n${summaryResp.text}` }),
      });
      return c.json({ ok: true });
    }

    // FASE 1: Ingestión de Imagen a Data Lake
    const photos = message.photo;
    if (Array.isArray(photos) && photos.length > 0) {
      const id = crypto.randomUUID();
      const bestPhoto = photos[photos.length - 1];

      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: '⏳ Ingestando imagen en Data Lake (Vision + Flash + R2)...' }),
      });

      try {
        const fileInfoRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${bestPhoto.file_id}`);
        const fileInfo: any = await fileInfoRes.json();
        const filePath = fileInfo.result?.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
        const imgBuffer = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());

        // Cloud Vision (Web Detection + Landmarks)
        const [webResult, landmarkResult] = await Promise.all([
          visionClient.webDetection({ image: { content: imgBuffer } }),
          visionClient.landmarkDetection({ image: { content: imgBuffer } }),
        ]);

        const webDetection = webResult[0]?.webDetection;
        const entidades = (webDetection?.webEntities || [])
          .filter((e) => (e.score || 0) >= 0.6 && e.description)
          .map((e) => ({ entidad: e.description, score: Number((e.score || 0).toFixed(2)) }));

        const landmarks = (landmarkResult[0]?.landmarkAnnotations || []).map((l) => ({
          nombre: l.description,
          lat: l.locations?.[0]?.latLng?.latitude,
          lng: l.locations?.[0]?.latLng?.longitude,
        }));

        const metadatosVision = { entidades, landmarks };

        // Subida a Cloudflare R2
        const imagenUrl = await subirBufferOsintAR2(imgBuffer, id, 'image/webp');

        // Expansión OSINT con Gemini 1.5 Flash
        const promptOSINT = `Actúa como investigador OSINT y arqueólogo de TGP. Elabora un informe enciclopédico factual exhaustivo sobre esta imagen usando los metadatos:
[METADATOS VISION]:
${JSON.stringify(metadatosVision, null, 2)}
Detalla: toponimia, coordenadas, historia, geología, fuentes y contexto académico. Tono neutro de Data Lake.`;

        const osintResp = await genai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ text: promptOSINT }],
          config: { maxOutputTokens: 3000, temperature: 0.2 },
        });
        const informeOSINT = osintResp.text || 'Sin informe.';

        // Persistencia en Cloudflare D1
        await guardarEnCloudflareD1({
          id,
          imagen_url: imagenUrl,
          metadatos_vision: metadatosVision,
          informe_osint: informeOSINT,
          fecha_ingesta: new Date().toISOString(),
        });

        // Respuesta Telegram con Teclado Nivel 1
        const entStr = entidades.map((e) => `• ${e.entidad}`).slice(0, 5).join('\n') || 'Sin entidades con score > 0.6';
        const landStr = landmarks[0] ? `📍 ${landmarks[0].nombre}` : '📍 Sin landmark directo';

        const summaryText = `✅ Ingesta Data Lake Completada\n\nID: \`${id}\`\n${landStr}\n\nEntidades detectadas:\n${entStr}\n\nSelecciona el destino:`;

        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: summaryText,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 Destino: Web (TGP)', callback_data: `dest_web:${id}` }],
                [{ text: '📱 Hilo para X / Zernio', callback_data: `dest_zernio:${id}` }],
                [{ text: '📸 Guion TikTok / Reels', callback_data: `dest_tiktok:${id}` }],
              ],
            },
          }),
        });
      } catch (err: any) {
        console.error('[Omni-Bot Ingesta Error]:', err);
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: `❌ Error en ingesta: ${err.message}` }),
        });
      }
      return c.json({ ok: true });
    }

    // Manejo de /start
    if (text.trim() === '/start') {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🏛️ *TGP Assistant en línea (@${TELEGRAM_BOT_NAME})*\n\n📸 *Envía una fotografía* para iniciar la ingesta exhaustiva al Data Lake (Cloud Vision + Gemini + R2 + D1).\n\n✍️ O escribe cualquier tema o pregunta (ej: *el cosmos vs el caos*) para elegir entre Flash o Pro y generar un análisis conceptual inmediato.\n\n💬 También puedes usar \`/resumir\` respondiendo a cualquier mensaje.`,
          parse_mode: 'Markdown',
        }),
      });
      return c.json({ ok: true });
    }

    // Manejo de Texto Libre: inline Flash/Pro + botón Mini App
    if (text.trim()) {
      const queryId = crypto.randomUUID().slice(0, 8);
      pendingTextQueries.set(queryId, text.trim());
      const temaEncoded = encodeURIComponent(text.trim());
      const miniAppFullUrl = `${MINI_APP_URL}?bot=omni&tema=${temaEncoded}`;

      // Mensaje 1: análisis directo (inline keyboard Flash/Pro)
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🏛️ *TGP Cognition (@${TELEGRAM_BOT_NAME})*\n\nTema: *"${text.trim()}"*\n\n*Análisis directo:*`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⚡ Gemini Flash (Ágil)', callback_data: `redact_flash:${queryId}` },
                { text: '🧠 Gemini Pro (Profundo)', callback_data: `redact_pro:${queryId}` },
              ],
            ],
          },
        }),
      });

      // Mensaje 2: botón Mini App para publicación en redes
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '📱 *Publicar en redes sociales:*',
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '⚙️ Configurar publicación', web_app: { url: miniAppFullUrl } }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }),
      });

      return c.json({ ok: true });
    }
  }

  // FASE 2 & 3: Callback Queries y Cortafuegos Financiero
  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const callbackId = callbackQuery.id;
    const data: string = callbackQuery.data || '';
    const chatId = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;

    if (!data || data === 'fin') {
      await answerCallbackQuery(callbackId, 'Sesión terminada.');
      await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: '🏁 Sesión editorial completada.' }),
      });
      return c.json({ ok: true });
    }

    const [action, id] = data.split(':');
    await answerCallbackQuery(callbackId, 'Procesando...');

    // Callback para Redacción Interactiva Flash vs Pro
    if (action === 'redact_flash' || action === 'redact_pro') {
      const isPro = action === 'redact_pro';
      const modelName = isPro ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
      const modelLabel = isPro ? 'Gemini 2.5 Pro (Máxima Densidad)' : 'Gemini 3.8 Flash (Modo Ágil)';
      const tema = pendingTextQueries.get(id) || 'el tema solicitado';

      await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `⚡ Invocando *${modelLabel}* para redactar sobre:\n*"${tema}"*...`,
          parse_mode: 'Markdown',
        }),
      });

      try {
        const resp = await genai.models.generateContent({
          model: modelName,
          contents: [{ text: `Escribe un análisis histórico, filosófico y conceptual denso en Modo TGP sobre: "${tema}". Máximo 3 párrafos de alto impacto.` }],
          config: { systemInstruction: 'Eres el motor cognitivo de TGP. Tono sobrio, Dark Academia accesible y densidad analítica.' },
        });

        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: resp.text || 'Sin respuesta generada.',
          }),
        });
      } catch (errGen: any) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: `⚠️ Error al generar respuesta con ${modelLabel}: ${errGen?.message}` }),
        });
      }
      return c.json({ ok: true });
    }

    const registro = await obtenerInformeD1(id);

    // Hilo para X / Zernio
    if (action === 'dest_zernio') {
      await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: '⏳ Redactando hilo para X / Zernio con Flash...' }),
      });
      const res = await genai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ text: `Redacta un hilo de X (Twitter) incisivo, con gancho visual, basado en este informe:\n\n${registro?.informe_osint || ''}` }],
      });
      await sendTelegram(chatId, `📱 Hilo X / Zernio:\n\n${res.text}`);
      return c.json({ ok: true });
    }

    // Guion TikTok / Reels
    if (action === 'dest_tiktok') {
      await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: '⏳ Creando guion TikTok/Reels con Flash...' }),
      });
      const res = await genai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ text: `Escribe un guion corto para TikTok/Reels (Voz en off + Indicaciones visuales [Visual]) sobre:\n\n${registro?.informe_osint || ''}` }],
      });
      await sendTelegram(chatId, `🎬 Guion Audiovisual:\n\n${res.text}`);
      return c.json({ ok: true });
    }

    // Producción Pro (Con o Sin Grounding)
    if (action === 'web_normal' || action === 'web_pro') {
      const useGrounding = action === 'web_pro';
      await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `⚡ Invocando Gemini 1.5 Pro ${useGrounding ? '(con Google Search Grounding)' : '(Modo Estándar)'}...`,
        }),
      });

      const systemPrompt = `Actúa en Modo TGP. Eres un ensayista filosófico y crítico cultural de alto nivel.
Redacta un ensayo denso, sobrio y cinematográfico basado en el informe técnico.
Estructura:
1) Gancho visual evocador
2) Contexto arqueológico e histórico
3) Núcleo conceptual filosófico
4) Cierre existencial sobre la condición humana.`;

      const genConfig: any = {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 2500,
      };
      if (useGrounding) {
        genConfig.tools = [{ googleSearch: {} }];
      }

      const proResp = await genai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ text: `INFORME BASE:\n\n${registro?.informe_osint || ''}` }],
        config: genConfig,
      });

      const ensayoTexto = proResp.text || 'Sin texto generado.';
      await actualizarRegistroD1(id, ensayoTexto, null);

      await sendTelegram(chatId, `🏛 Ensayo Editorial TGP:\n\n${ensayoTexto}`);
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🎧 ¿Deseas generar la locución neural de este ensayo?',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎙️ Generar Audio TTS (es-AR)', callback_data: `tts:${id}` }],
              [{ text: '❌ Terminar Sesión', callback_data: 'fin' }],
            ],
          },
        }),
      });
      return c.json({ ok: true });
    }

    // Audio TTS (es-AR)
    if (action === 'tts') {
      await fetch(`${TELEGRAM_API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: '🎙️ Sintetizando locución es-AR y subiendo a R2...' }),
      });

      const textoEnsayo = registro?.ensayo_premium || registro?.informe_osint || '';
      const audioUrl = await generarYGuardarAudioTTS(id, textoEnsayo);

      if (audioUrl) {
        await actualizarRegistroD1(id, textoEnsayo, audioUrl);
        await fetch(`${TELEGRAM_API}/sendAudio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, audio: audioUrl, caption: '🎙 Locución Oficial TGP (es-AR)' }),
        });
        await fetch(`${TELEGRAM_API}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: '✅ Audio generado y catalogado en Cloudflare R2.' }),
        });
      } else {
        await sendTelegram(chatId, '⚠️ No se pudo generar el audio TTS.');
      }
      return c.json({ ok: true });
    }
  }

  return c.json({ ok: true });
});

// â”€â”€ Arranque â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ── MINI APP: /api/bot/generate ───────────────────────────────────────────────
// Endpoint llamado desde la Telegram Mini App (BotSelector.svelte).
// Verifica initData con HMAC-SHA256, extrae el chat_id y despacha a Gemini.
// ─────────────────────────────────────────────────────────────────────────────

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://thegreatpuzzleproject.com/bot-selector';

/** Verifica el initData de Telegram con HMAC-SHA256 */
function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    if (!initData) return false;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return computedHash === hash;
  } catch {
    return false;
  }
}

/** Extrae el chat_id del user dentro del initData */
function extractChatIdFromInitData(initData: string): number | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (userStr) {
      const user = JSON.parse(decodeURIComponent(userStr));
      return user?.id ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

// ── Routing multi-bot: tokens/APIs por botId ──────────────────────────────────
function getBotApi(botId?: string): { api: string; token: string } {
  switch (botId) {
    case 'social':    return { api: TELEGRAM_SOCIAL_API,  token: TELEGRAM_SOCIAL_TOKEN };
    case 'assistant': return { api: `https://api.telegram.org/bot${TELEGRAM_TGP_CLOUD_TOKEN}`, token: TELEGRAM_TGP_CLOUD_TOKEN };
    case 'liminal':   return { api: `https://api.telegram.org/bot${TELEGRAM_DEV_TOKEN}`, token: TELEGRAM_DEV_TOKEN };
    default:          return { api: TELEGRAM_API, token: TELEGRAM_TOKEN };
  }
}

app.post('/api/bot/generate', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON invalido' }, 400); }

  const { bot, tema, red, modelo, imagen, formato, photoUrl, initData } = body as {
    bot?: string;
    tema?: string;
    red?: 'facebook' | 'instagram' | 'tiktok';
    modelo?: 'flash' | 'pro';
    imagen?: 'wikimedia' | 'photos' | 'no';
    formato?: 'tgp' | 'libre';
    photoUrl?: string | null;
    initData?: string;
  };

  if (!tema) return c.json({ error: 'Falta el campo "tema"' }, 400);

  // Routing por bot
  const { api: BOT_API, token: BOT_TOKEN } = getBotApi(bot);

  // Verificar initData (omitir en dev si esta vacio)
  let chatId: number = XAVIER_CHAT_ID;
  if (initData && initData.length > 0) {
    const isValid = verifyTelegramInitData(initData, BOT_TOKEN || TELEGRAM_TOKEN);
    if (!isValid) return c.json({ error: 'initData invalido' }, 401);
    chatId = extractChatIdFromInitData(initData) ?? XAVIER_CHAT_ID;
  }

  const redLabel  = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' }[red ?? 'facebook'] || 'Editorial';
  const modelName = modelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
  const modLabel  = modelo === 'pro' ? 'Gemini Pro' : 'Gemini Flash';

  const systemInst = formato === 'tgp'
    ? `Actua en Modo TGP. Eres ensayista filosofico y critico cultural. Tono Dark Academia: sobrio, denso, cinematografico. Estructura: 1) Gancho visual evocador 2) Contexto historico/filosofico 3) Nucleo conceptual 4) Cierre existencial universal`
    : `Eres un redactor editorial directo y claro. Sin formulas. Ve al nucleo inmediatamente.`;

  const userPrompt = `Redacta una publicacion editorial para ${redLabel} sobre el siguiente tema: "${tema}". Formato: publicacion de red social con alto impacto intelectual. Sin hashtags genericos. Maximo 3 parrafos.`;

  // Notificar inicio
  await fetch(`${BOT_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Generando con ${modLabel} para ${redLabel}...\n\nTema: ${tema}`,
    }),
  });

  try {
    const resp = await genai.models.generateContent({
      model: modelName,
      contents: [{ text: userPrompt }],
      config: { systemInstruction: systemInst, temperature: modelo === 'pro' ? 0.72 : 0.85, maxOutputTokens: 1200 },
    });

    const textoGenerado = resp.text || 'Sin contenido generado.';

    // Resolver imagen: Google Photos > Wikimedia > sin imagen
    let imagenUrl = photoUrl || '';
    if (!imagenUrl && imagen === 'wikimedia') {
      try {
        const entidad = await resolverEntidadCanonica(tema);
        imagenUrl = await buscarPageImageWikipedia(entidad.wikiEn, 'en') || await buscarPageImageWikipedia(entidad.wikiEs, 'es') || '';
      } catch { /* imagen es opcional */ }
    }

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

    return c.json({ ok: true });
  } catch (err: any) {
    console.error('[Mini App Generate Error]:', err);
    await fetch(`${BOT_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `Error al generar: ${err?.message}` }),
    });
    return c.json({ error: err?.message || 'Error interno' }, 500);
  }
});

app.get('/api/bot/miniapp-url', (c) => c.json({ url: MINI_APP_URL }));

// ── Google Photos Picker: /api/my-photos ──────────────────────────────────────
// Headless: usa GOOGLE_REFRESH_TOKEN en .env (OAuth flow una sola vez).
// Devuelve fotos recientes sin CORS issues para la Mini App Svelte.
app.get('/api/my-photos', async (c) => {
  const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || process.env.PUBLIC_GOOGLE_CLIENT_ID || '';
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
  const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';

  if (!GOOGLE_REFRESH_TOKEN) {
    return c.json({ error: 'GOOGLE_REFRESH_TOKEN no configurado. Genera uno con el script OAuth.' }, 503);
  }

  try {
    // 1. Obtener access_token fresco
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type:    'refresh_token',
      }).toString(),
    });
    const { access_token } = await tokenRes.json() as any;
    if (!access_token) throw new Error('No se pudo obtener access_token de Google.');

    // 2. Listar fotos recientes
    const photosRes = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=30', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const data = await photosRes.json() as any;
    const photos = (data.mediaItems || []).map((item: any) => ({
      id:       item.id,
      url:      `${item.baseUrl}=w600-h600-c`,
      filename: item.filename,
    }));

    return c.json({ photos });
  } catch (err: any) {
    console.error('[Google Photos] Error:', err);
    return c.json({ error: err?.message || 'Error al obtener fotos.' }, 500);
  }
});

// ── Proxy Wikimedia CORS-free: /api/proxy/wikimedia?q=... ────────────────────
// La Mini App Svelte llama aqui en lugar de a Wikimedia directamente.
app.get('/api/proxy/wikimedia', async (c) => {
  const q = c.req.query('q') || '';
  if (!q) return c.json({ imageUrl: '' });
  try {
    const entidad = await resolverEntidadCanonica(q);
    const imageUrl = await buscarPageImageWikipedia(entidad.wikiEn, 'en')
      || await buscarPageImageWikipedia(entidad.wikiEs, 'es')
      || '';
    return c.json({ imageUrl, query: { wikiEn: entidad.wikiEn, wikiEs: entidad.wikiEs } });
  } catch (err: any) {
    return c.json({ imageUrl: '', error: err?.message });
  }
});
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[TGP Mind] Puerto ${PORT} -- Listo.`);
});
