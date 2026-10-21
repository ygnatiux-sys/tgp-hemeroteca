// ═════════════════════════════════════════════════════════════════════════════
// TGP MIND — Enrutador Dual + Pipeline Cinemático
// Archivo: src/router/tgpRouter.ts
//
// FLUJO:
//   Usuario → /video [tema]      ── Fast Path → Gemini (texto puro) → Pipeline
//   Usuario → texto libre        ── Smart Path → Gemini Function Calling → Pipeline
//
// PIPELINE (ejecutarPipelineCinematico):
//   1. Wikimedia API  → URL imagen alta resolución
//   2. Fetch imagen   → Buffer crudo
//   3. Sharp          → Optimizar a JPEG 1080h, max 80 quality (nunca la URL original a Remotion)
//   4. R2             → Subir imagen optimizada → URL pública efímera
//   5. Remotion API   → POST render con datos limpios → URL video temporal
//   6. R2             → Subir .mp4 final → URL pública permanente
//   7. GitHub/Octokit → Crear entrada Keystatic (.mdx con videoUrl de R2)
//   8. finally        → fs.unlinkSync() de cualquier residuo en /tmp
//
// ═════════════════════════════════════════════════════════════════════════════

import { genai } from '../ia/gemini.js';
import {
  generarSlug,
  publicarEntradaKeystaticGitHub,
} from '../servicios/publicacion.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface RouterResult {
  /** 'dialog'    → respuesta conversacional sin publicación                  */
  /** 'published' → ensayo de texto publicado en GitHub                      */
  /** 'video'     → pipeline cinemático completado                           */
  type: 'dialog' | 'published' | 'video';
  message: string;
  resourceUrl?: string;
}

/** Datos generados por Gemini que alimentan el pipeline cinemático. */
interface DatosCinematicos {
  tema: string;
  titulo: string;
  forensicMeta: string; // ej: "INV-042 // SIGLO XI"
  cinematicScript: string; // max 350 chars
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN (inyectada vía initRouter)
// ─────────────────────────────────────────────────────────────────────────────

interface RouterConfig {
  githubToken: string;
  githubRepo: string;      // 'owner/repo'
  githubBranch?: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicDomain: string;
  remotionApiUrl: string;  // URL interna del Cloud Run remotion-engine
  geminiModel?: string;
}

let _cfg: RouterConfig | null = null;
let _s3: S3Client | null = null;

export function initRouter(cfg: RouterConfig): void {
  _cfg = cfg;
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.r2AccessKeyId,
      secretAccessKey: cfg.r2SecretAccessKey,
    },
  });
  console.log('[TGP Router] ✓ Inicializado.');
}

function requireConfig(): RouterConfig {
  if (!_cfg) throw new Error('[TGP Router] No inicializado. Llama a initRouter() primero.');
  return _cfg;
}

function requireS3(): S3Client {
  if (!_s3) throw new Error('[TGP Router] S3Client no inicializado.');
  return _s3;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enrutador dual TGP.
 * Decide entre Fast Path (slash commands) y Smart Path (Function Calling).
 */
export async function routePrompt(prompt: string): Promise<RouterResult> {
  requireConfig();
  const trimmed = prompt.trim();

  if (trimmed.startsWith('/')) return handleSlashCommand(trimmed);
  return handleAgentDirector(trimmed);
}

// ═════════════════════════════════════════════════════════════════════════════
// PASO 1 — FAST PATH: SLASH COMMAND ROUTER
// ═════════════════════════════════════════════════════════════════════════════

async function handleSlashCommand(prompt: string): Promise<RouterResult> {
  const [command, ...rest] = prompt.split(/\s+/);

  // ── /video [tema] ──────────────────────────────────────────────────────────
  if (command.toLowerCase() === '/video') {
    const tema = rest.join(' ').trim();
    if (!tema) return { type: 'dialog', message: '❌ Especificá el tema: /video [tema]' };

    console.log(`[FastPath /video] tema: "${tema}"`);

    // Gemini en modo texto puro — SIN tools, solo redacta JSON estructurado
    const geminiPrompt = `Redactá tres elementos para un video-ensayo cinemático sobre: "${tema}".
Responde ÚNICAMENTE con un JSON válido, sin bloques de código, con esta estructura exacta:
{
  "titulo": "Título elegante y sugestivo en español",
  "forensicMeta": "INV-XXX // [PERIODO HISTÓRICO RELEVANTE]",
  "cinematicScript": "Guion visual de máximo 350 caracteres. Tono Dark Academia. Sin citas ni encabezados."
}`;

    const rawJson = await callGeminiRawText(geminiPrompt);

    let datos: Omit<DatosCinematicos, 'tema'>;
    try {
      // Extrae JSON aunque Gemini añada texto extra alrededor
      const match = rawJson.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No se encontró JSON en la respuesta de Gemini.');
      datos = JSON.parse(match[0]);
    } catch (err) {
      console.error('[FastPath] Error parseando JSON de Gemini:', err);
      return { type: 'dialog', message: '❌ Error al generar el guion. Intentá de nuevo.' };
    }

    // Validar cinematicScript ≤ 350 chars
    if (datos.cinematicScript?.length > 350) {
      datos.cinematicScript = datos.cinematicScript.slice(0, 347) + '...';
    }

    return ejecutarPipelineCinematico({ tema, ...datos });
  }

  return {
    type: 'dialog',
    message: `❌ Comando no reconocido: "${command}". Disponibles: /video [tema]`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PASO 2 — SMART PATH: AGENTE DIRECTOR CON FUNCTION CALLING
// ═════════════════════════════════════════════════════════════════════════════

async function handleAgentDirector(prompt: string): Promise<RouterResult> {
  const cfg = requireConfig();
  const model = cfg.geminiModel || 'gemini-3.8-flash';

  console.log(`[SmartPath] Agente Director → "${prompt.slice(0, 60)}..."`);

  const tools: any[] = [
    {
      functionDeclarations: [
        {
          name: 'producir_ensayo_cinematico',
          description:
            'Produce un video-ensayo cinemático completo (Remotion + R2 + GitOps). ' +
            'Invocá SOLO cuando el usuario dé una orden clara de producción en lenguaje natural.',
          parameters: {
            type: 'OBJECT',
            properties: {
              tema: {
                type: 'STRING',
                description: 'Tema histórico o arqueosemiótico del ensayo.',
              },
              titulo: {
                type: 'STRING',
                description: 'Título elegante y sugestivo para el video.',
              },
              forensicMeta: {
                type: 'STRING',
                description: 'Metadatos forenses en formato: INV-XXX // PERIODO HISTÓRICO.',
              },
              cinematicScript: {
                type: 'STRING',
                description: 'Guion visual. Máximo 350 caracteres. Tono cinematográfico y Dark Academia.',
              },
            },
            required: ['tema', 'titulo', 'forensicMeta', 'cinematicScript'],
          },
        },
      ],
    },
  ];

  const systemInstruction = `Eres el motor cognitivo de TGP. Tu función es dialogar analíticamente sobre historia y arqueosemiótica, o ejecutar herramientas de producción cuando el usuario da una orden clara.

REGLAS:
- Si el usuario explora ideas o pregunta: respondé con texto sin invocar herramientas.
- Si el usuario da una orden de producción clara (ej: "genera un video sobre X", "producí un ensayo cinemático de Y"): invocá 'producir_ensayo_cinematico' con todos los campos completos.
- El 'cinematicScript' debe tener MÁXIMO 350 caracteres. Si necesitás más, condensá.
- Tono Dark Academia accesible. Preciso, sobrio, con calidez humanista.`;

  const response = await genai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      temperature: 0.35,
      tools,
    },
  });

  const functionCalls = response.functionCalls;

  if (functionCalls && functionCalls.length > 0) {
    const call = functionCalls[0];
    const args = (call.args as Record<string, any>) || {};

    console.log(`[SmartPath] Tool call → ${call.name}`, args);

    if (call.name === 'producir_ensayo_cinematico') {
      // Validar cinematicScript
      if (args.cinematicScript?.length > 350) {
        args.cinematicScript = args.cinematicScript.slice(0, 347) + '...';
      }
      return ejecutarPipelineCinematico({
        tema: args.tema,
        titulo: args.titulo,
        forensicMeta: args.forensicMeta,
        cinematicScript: args.cinematicScript,
      });
    }
  }

  // Sin tool call → modo diálogo
  const texto = (response.text || '').trim();
  console.log(`[SmartPath] Modo diálogo.`);
  return { type: 'dialog', message: texto };
}

// ═════════════════════════════════════════════════════════════════════════════
// PASO 3 — PIPELINE CINEMÁTICO
// Wikimedia → Sharp/R2 → Remotion → R2 → GitHub
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Orquesta la producción de un ensayo cinemático completo.
 * Gestiona limpieza de archivos temporales en el bloque finally.
 */
async function ejecutarPipelineCinematico(datos: DatosCinematicos): Promise<RouterResult> {
  const cfg = requireConfig();
  const slug = generarSlug(datos.titulo);
  const fechaHoy = new Date().toISOString().split('T')[0];

  // Archivos temporales en /tmp (memoria de Cloud Run)
  const tmpVideoPath = `/tmp/${slug}-${Date.now()}.mp4`;
  let tmpImagePath: string | null = null;

  console.log(`\n[Pipeline] ═══ Iniciando: "${datos.titulo}" ═══`);

  try {
    // ── 1. WIKIMEDIA: Buscar imagen en alta resolución ──────────────────────
    console.log(`[Pipeline 1/6] Buscando imagen Wikimedia: "${datos.tema}"...`);
    const rawImageUrl = await buscarImagenWikimedia(datos.tema);
    console.log(`[Pipeline 1/6] ✓ URL cruda: ${rawImageUrl}`);

    // ── 2. DOWNLOAD: Descargar imagen cruda ────────────────────────────────
    console.log(`[Pipeline 2/6] Descargando imagen...`);
    const rawImageBuffer = await downloadBuffer(rawImageUrl);
    console.log(`[Pipeline 2/6] ✓ Buffer descargado: ${(rawImageBuffer.length / 1024).toFixed(1)} KB`);

    // ── 3. SHARP: Optimizar imagen (NUNCA se pasa la URL original a Remotion)
    console.log(`[Pipeline 3/6] Optimizando con Sharp (JPEG 1080h, quality 80)...`);
    const optimizedBuffer = await sharp(rawImageBuffer)
      .resize({ height: 1080, withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();
    console.log(`[Pipeline 3/6] ✓ Optimizado: ${(optimizedBuffer.length / 1024).toFixed(1)} KB`);

    // ── 4. R2: Subir imagen optimizada → URL efímera para Remotion ─────────
    console.log(`[Pipeline 4/6] Subiendo imagen optimizada a R2...`);
    const imageR2Key = `tgp-media/ensayos-cinematicos/frames/${slug}-${Date.now()}.jpg`;
    const imageR2Url = await subirBufferAR2({
      key: imageR2Key,
      buffer: optimizedBuffer,
      contentType: 'image/jpeg',
    });
    console.log(`[Pipeline 4/6] ✓ Imagen en R2: ${imageR2Url}`);

    // ── 5. REMOTION: POST al motor de render ───────────────────────────────
    console.log(`[Pipeline 5/6] Llamando a remotion-engine...`);
    const remotionPayload = {
      title: datos.titulo,
      forensicMeta: datos.forensicMeta,
      cinematicScript: datos.cinematicScript,
      imageUrl: imageR2Url, // ← URL R2 optimizada, nunca la URL original de Wikipedia
    };

    const remotionRes = await fetch(`${cfg.remotionApiUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(remotionPayload),
      signal: AbortSignal.timeout(300_000), // 5 min timeout para render
    });

    if (!remotionRes.ok) {
      const errText = await remotionRes.text();
      throw new Error(`[Remotion] HTTP ${remotionRes.status}: ${errText}`);
    }

    const remotionData = (await remotionRes.json()) as { videoUrl?: string; url?: string };
    const remotionVideoUrl = remotionData.videoUrl || remotionData.url || '';
    if (!remotionVideoUrl) throw new Error('[Remotion] No se recibió videoUrl en la respuesta.');
    console.log(`[Pipeline 5/6] ✓ Render completado: ${remotionVideoUrl}`);

    // ── 6. R2: Descargar video de Remotion y subir al bucket permanente ────
    console.log(`[Pipeline 6/6] Subiendo video a R2 (bucket permanente)...`);
    const videoBuffer = await downloadBuffer(remotionVideoUrl);

    // Escribir a /tmp para manejo eficiente en memoria
    fs.writeFileSync(tmpVideoPath, videoBuffer);

    const videoR2Key = `tgp-media/ensayos-cinematicos/videos/${slug}.mp4`;
    const videoR2Url = await subirBufferAR2({
      key: videoR2Key,
      buffer: fs.readFileSync(tmpVideoPath),
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000',
    });
    console.log(`[Pipeline 6/6] ✓ Video en R2: ${videoR2Url}`);

    // ── 7. GITHUB: Crear entrada Keystatic con videoUrl de R2 ──────────────
    console.log(`[Pipeline 7/7] Publicando entrada Keystatic en GitHub...`);

    const indexJson = {
      title: datos.titulo,
      date: fechaHoy,
      slug,
      forensicMeta: datos.forensicMeta,
      cinematicScript: datos.cinematicScript,
      videoUrl: videoR2Url,      // ← URL R2 permanente, nunca binario en GitHub
      imageUrl: imageR2Url,
      generador: 'TGP Mind Router (Gemini + Remotion + R2 + GitOps)',
    };

    const contentMdoc = `---
title: "${datos.titulo.replace(/"/g, '\\"')}"
date: "${fechaHoy}"
videoUrl: "${videoR2Url}"
imageUrl: "${imageR2Url}"
forensicMeta: "${datos.forensicMeta}"
generador: "TGP Mind Router"
---

${datos.cinematicScript.trim()}
`;

    const commitUrl = await publicarEntradaKeystaticGitHub({
      coleccion: 'ensayos-cinematicos',
      slug,
      indexJson,
      contentMdoc,
      token: cfg.githubToken,
      repoFull: cfg.githubRepo,
      mensajeCommit: `TGP Router [cinemático]: ${datos.titulo}`,
    });

    console.log(`[Pipeline] ═══ Completado: ${commitUrl} ═══\n`);

    return {
      type: 'video',
      message: `🎬 *${datos.titulo}* renderizado y publicado en TGP.\n📼 Video: ${videoR2Url}\n📝 Commit: ${commitUrl}`,
      resourceUrl: commitUrl,
    };
  } catch (err) {
    console.error('[Pipeline] ✗ Error:', err);
    throw err;
  } finally {
    // ── CLEANUP OBLIGATORIO: Liberar memoria RAM de Cloud Run ───────────────
    // El contenedor usa memoria RAM como disco efímero. Nunca dejar residuos.
    for (const tmpPath of [tmpVideoPath, tmpImagePath].filter(Boolean) as string[]) {
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
          console.log(`[Cleanup] ✓ Eliminado: ${tmpPath}`);
        }
      } catch (cleanErr) {
        // No relanzar — el cleanup nunca debe bloquear la respuesta
        console.warn(`[Cleanup] No se pudo eliminar ${tmpPath}:`, cleanErr);
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SERVICIOS EXTERNOS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Busca una imagen en Wikimedia Commons usando la API de MediaWiki.
 * Retorna la URL de la imagen en alta resolución (dominio público).
 */
async function buscarImagenWikimedia(tema: string): Promise<string> {
  // API de búsqueda de archivos en Wikimedia Commons
  const query = encodeURIComponent(tema);
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php` +
    `?action=query&list=search&srsearch=${query}&srnamespace=6&srlimit=5&format=json&origin=*`;

  const searchRes = await fetch(apiUrl);
  if (!searchRes.ok) throw new Error(`[Wikimedia] Error en búsqueda: ${searchRes.status}`);

  const searchData = (await searchRes.json()) as {
    query: { search: Array<{ title: string }> };
  };

  const resultados = searchData.query?.search || [];
  if (resultados.length === 0) {
    throw new Error(`[Wikimedia] No se encontraron imágenes para: "${tema}"`);
  }

  // Tomar el primer resultado y obtener su URL directa
  const fileTitle = resultados[0].title; // ej: "File:Scarab_amulet.jpg"
  const infoUrl =
    `https://commons.wikimedia.org/w/api.php` +
    `?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json&origin=*`;

  const infoRes = await fetch(infoUrl);
  if (!infoRes.ok) throw new Error(`[Wikimedia] Error obteniendo info: ${infoRes.status}`);

  const infoData = (await infoRes.json()) as {
    query: { pages: Record<string, { imageinfo?: Array<{ url: string }> }> };
  };

  const pages = Object.values(infoData.query?.pages || {});
  const imageUrl = pages[0]?.imageinfo?.[0]?.url;

  if (!imageUrl) throw new Error(`[Wikimedia] No se encontró URL de imagen para: "${fileTitle}"`);

  return imageUrl;
}

/**
 * Sube un Buffer a Cloudflare R2 y retorna la URL pública.
 */
async function subirBufferAR2(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<string> {
  const cfg = requireConfig();
  const s3 = requireS3();

  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.r2BucketName,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.contentType,
      CacheControl: params.cacheControl || 'public, max-age=86400',
    }),
  );

  return `${cfg.r2PublicDomain}/${params.key}`;
}

/**
 * Descarga una URL y retorna su contenido como Buffer.
 */
async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`[Download] HTTP ${res.status} desde ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Llama a Gemini en modo texto puro, SIN tools.
 * Usado en el Fast Path: Gemini solo redacta, sin tomar decisiones de routing.
 */
async function callGeminiRawText(prompt: string): Promise<string> {
  const cfg = requireConfig();
  const model = cfg.geminiModel || 'gemini-3.8-flash';

  // Sin `tools` → Gemini no puede elegir herramientas, solo genera texto
  const response = await genai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.72,
      maxOutputTokens: 1024,
    },
  });

  return (response.text || '').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRACIÓN CON index.ts (Hono)
// ─────────────────────────────────────────────────────────────────────────────
//
// En index.ts, inicializar y registrar la ruta:
//
//   import { initRouter, routePrompt } from './src/router/tgpRouter.js';
//
//   initRouter({
//     githubToken:      GITHUB_TOKEN_HEMEROTECA,
//     githubRepo:       GITHUB_REPO_HEMEROTECA,
//     r2AccountId:      CLOUDFLARE_ACCOUNT_ID,
//     r2AccessKeyId:    R2_ACCESS_KEY_ID,
//     r2SecretAccessKey: R2_SECRET_ACCESS_KEY,
//     r2BucketName:     R2_BUCKET_NAME,
//     r2PublicDomain:   R2_PUBLIC_DOMAIN,
//     remotionApiUrl:   process.env.REMOTION_ENGINE_URL || 'https://remotion-engine-xxx-uc.a.run.app',
//   });
//
//   app.post('/chat', async (c) => {
//     const { prompt } = await c.req.json();
//     const result = await routePrompt(prompt);
//     return c.json(result);
//   });
//
// ─────────────────────────────────────────────────────────────────────────────
