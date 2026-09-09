/**
 * generatePremiumReport.ts
 * Orquestador de pipeline para la creación de Informes Premium TGP.
 *
 * Flujo:
 *   1. Recibe payload: titulo, coleccion, fuenteVisual, directrices?
 *   2. Motor Cognitivo → delega al microservicio PUBLIC_TGP_MIND_URL (Cloud Run)
 *   3. Adquisición visual → Wikimedia (archivo) o VEO3/Imagen3 (sintética)
 *   4. Refinamiento → Sharp a WebP optimizado
 *   5. Almacenamiento → Cloudflare R2
 *   6. Ensamblaje → frontmatter YAML + cuerpo MDX → GitHub vía Keystatic API
 */

import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type FuenteVisual = 'wikimedia' | 'sintetica';

export interface InformePremiumPayload {
  titulo: string;
  coleccion: 'liminal' | 'heterodoxia' | 'anomalias' | 'apocrifa';
  fuenteVisual: FuenteVisual;
  directrices?: string;
  tags?: string[];
}

export interface InformePremiumResult {
  slug: string;
  mdxPath: string;
  imagenR2Url: string;
  contenido: string;
}

// ── Helpers de entorno ─────────────────────────────────────────────────────────

function getEnv(key: string): string {
  const val =
    (import.meta as any).env?.[key] ||
    process.env[key] ||
    '';
  if (!val) throw new Error(`Variable de entorno requerida no definida: ${key}`);
  return val;
}

function getOptionalEnv(key: string, fallback = ''): string {
  return (import.meta as any).env?.[key] || process.env[key] || fallback;
}

// ── Cliente R2 ────────────────────────────────────────────────────────────────

function getR2Client() {
  const accountId = getEnv('R2_ACCOUNT_ID');
  const accessKeyId = getEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('R2_SECRET_ACCESS_KEY');
  const endpoint = getOptionalEnv('R2_ENDPOINT', `https://${accountId}.r2.cloudflarestorage.com`);
  const bucket = getOptionalEnv('R2_BUCKET_NAME', 'tgp-storage');

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  return { client, bucket };
}

// ── FASE 1: Utilidades de slug ─────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

// ── FASE 2: Motor Cognitivo (Cloud Run TGP Mind) ──────────────────────────────

async function generarTexto(payload: InformePremiumPayload): Promise<string> {
  const mindUrl = getEnv('PUBLIC_TGP_MIND_URL');

  const prompt = `Eres un investigador-ensayista especializado en historia profunda, arqueosemiótica y análisis cultural de alto nivel.

Escribe un ensayo de densidad académica sobre el siguiente tema:

TÍTULO: ${payload.titulo}
COLECCIÓN: ${payload.coleccion.toUpperCase()}
DIRECTRICES: ${payload.directrices || 'Exploración libre con rigor analítico y tensión narrativa.'}
TAGS: ${(payload.tags || []).join(', ')}

INSTRUCCIONES DE ESTRUCTURA:
1. Apertura ensayística impactante (2-3 párrafos): abre con un concepto fuerte o anomalía histórica.
2. Desarrollo (5-7 párrafos): incluye marcadores <!-- IMAGEN_1 --> e <!-- IMAGEN_2 --> donde correspondan imágenes documentales.
3. Cierre analítico (2 párrafos): reflexión sobre implicaciones en la condición humana o la memoria colectiva.

El tono debe ser literario-académico. Evita clichés. Usa el lenguaje con precisión quirúrgica.
Devuelve SOLO el texto en formato Markdown, sin ningún bloque de código envolvente.`;

  const response = await fetch(mindUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: 'gemini-2.5-pro',
      temperature: 0.85,
      maxOutputTokens: 8192,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Sin detalle');
    throw new Error(`TGP Mind respondió con ${response.status}: ${errorText}`);
  }

  const data = await response.json() as { text?: string; content?: string; result?: string };
  const texto = data.text || data.content || data.result || '';

  if (!texto.trim()) {
    throw new Error('TGP Mind devolvió contenido vacío.');
  }

  return texto;
}

// ── FASE 3A: Adquisición Visual — Wikimedia ───────────────────────────────────

async function obtenerImagenWikimedia(termino: string): Promise<Buffer> {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(termino)}&prop=imageinfo&iiprop=url&format=json&origin=*&gsrlimit=3`;

  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) });
  if (!searchRes.ok) throw new Error(`Wikimedia API error: ${searchRes.status}`);

  const searchData = await searchRes.json() as { query?: { pages?: Record<string, { imageinfo?: Array<{ url: string }> }> } };
  const pages = Object.values(searchData.query?.pages || {});

  const imageUrl = pages
    .map(p => p.imageinfo?.[0]?.url)
    .filter((u): u is string => !!u && /\.(jpg|jpeg|png|webp)$/i.test(u))
    [0];

  if (!imageUrl) {
    throw new Error(`No se encontraron imágenes en Wikimedia Commons para: "${termino}"`);
  }

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!imgRes.ok) throw new Error(`Error descargando imagen Wikimedia: ${imgRes.status}`);

  return Buffer.from(await imgRes.arrayBuffer());
}

// ── FASE 3B: Adquisición Visual — Sintética (VEO3 / TGP App) ─────────────────

async function obtenerImagenSintetica(prompt: string): Promise<Buffer> {
  const appUrl = getEnv('PUBLIC_IA_WEBHOOK_URL');

  const response = await fetch(`${appUrl}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Dark Academia, high contrast, archival grain, symbolic — ${prompt}`,
      model: 'imagen-3.0-generate-002',
      width: 1280,
      height: 720,
      format: 'jpeg',
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`TGP App (imagen sintética) respondió con ${response.status}`);
  }

  const data = await response.json() as { imageBase64?: string; image?: string };
  const b64 = data.imageBase64 || data.image || '';
  if (!b64) throw new Error('TGP App devolvió imagen vacía.');

  return Buffer.from(b64, 'base64');
}

// ── FASE 4: Refinamiento con Sharp → WebP ─────────────────────────────────────

async function refinarImagen(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 1280, height: 720, fit: 'cover', position: 'attention' })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

// ── FASE 5: Almacenamiento en Cloudflare R2 ───────────────────────────────────

async function subirAR2(buffer: Buffer, slug: string): Promise<string> {
  const { client, bucket } = getR2Client();
  const key = `informes/${slug}/${slug}-cover.webp`;
  const publicBase = getOptionalEnv('R2_PUBLIC_BASE', 'https://storage.thegreatpuzzleproject.com');

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return `${publicBase}/${key}`;
}

// ── FASE 6: Ensamblaje MDX ────────────────────────────────────────────────────

function ensamblarMDX(payload: InformePremiumPayload, contenido: string, imagenUrl: string, slug: string): string {
  const fechaISO = new Date().toISOString().split('T')[0];
  const tags = (payload.tags || [payload.coleccion]).map(t => `  - "${t}"`).join('\n');

  const frontmatter = `---
titulo: "${payload.titulo.replace(/"/g, '\\"')}"
slug: "${slug}"
coleccion: "${payload.coleccion}"
fuenteVisual: "${payload.fuenteVisual}"
imagenDestacada: "${imagenUrl}"
date: "${fechaISO}"
tags:
${tags}
draft: false
generatedBy: "generatePremiumReport@TGP"
---`;

  // Inyectar imagen de cover en el marcador <!-- IMAGEN_1 -->
  const imagenMDX = `\n![${payload.titulo}](${imagenUrl})\n`;
  const contenidoConImagen = contenido.replace('<!-- IMAGEN_1 -->', imagenMDX);

  return `${frontmatter}\n\n${contenidoConImagen}\n`;
}

// ── PIPELINE PRINCIPAL ────────────────────────────────────────────────────────

export async function generatePremiumReport(payload: InformePremiumPayload): Promise<InformePremiumResult> {
  const slug = slugify(payload.titulo);
  const mdxPath = `src/content/informes/${slug}/index.mdx`;

  console.log(`[InformePremium] Iniciando pipeline para: "${payload.titulo}" (${slug})`);

  // FASE 2: Motor Cognitivo
  console.log('[InformePremium] Fase 2: Generando texto con TGP Mind...');
  const contenido = await generarTexto(payload);

  // FASE 3: Adquisición Visual
  let imagenBuffer: Buffer;
  console.log(`[InformePremium] Fase 3: Adquiriendo imagen (${payload.fuenteVisual})...`);
  if (payload.fuenteVisual === 'wikimedia') {
    imagenBuffer = await obtenerImagenWikimedia(payload.titulo);
  } else {
    imagenBuffer = await obtenerImagenSintetica(payload.titulo);
  }

  // FASE 4: Refinamiento con Sharp
  console.log('[InformePremium] Fase 4: Refinando imagen con Sharp → WebP...');
  const webpBuffer = await refinarImagen(imagenBuffer);

  // FASE 5: Subida a R2
  console.log('[InformePremium] Fase 5: Subiendo a Cloudflare R2...');
  const imagenR2Url = await subirAR2(webpBuffer, slug);

  // FASE 6: Ensamblaje MDX
  console.log('[InformePremium] Fase 6: Ensamblando MDX...');
  const mdxContent = ensamblarMDX(payload, contenido, imagenR2Url, slug);

  console.log(`[InformePremium] ✓ Pipeline completado. Ruta: ${mdxPath}`);

  return {
    slug,
    mdxPath,
    imagenR2Url,
    contenido: mdxContent,
  };
}
