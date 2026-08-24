// src/pages/api/guardar-arquetipo.ts
// Endpoint SSR que escribe a disco los archivos de un arquetipo:
//   src/content/arquetipos-globales/{slug}/index.json   -> metadatos
//   src/content/arquetipos-globales/{slug}/content.mdoc -> cuerpo Markdown
//
// Replcia el patron de guardar-ensayo.ts para la coleccion Arquetipos Globales.
// Solo activo en modo local (astro dev). En Cloudflare, Keystatic gestiona via GitHub API.

import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON invalido' }), { status: 400, headers });
  }

  const {
    slug,
    title,
    content,
    excerpt,
    category,
    volanta,
    imageUrl,
    date,
    themeColor,
    sitioGeohistorico,
    publicarConImagen,
    draft,
  } = body;

  if (!slug || typeof slug !== 'string') {
    return new Response(JSON.stringify({ error: 'slug requerido' }), { status: 400, headers });
  }

  // Sanitizar slug (sin path traversal)
  const safeSlug = slug.replace(/[^a-z0-9\-_]/gi, '-').replace(/^-+|-+$/g, '');

  try {
    const projectRoot = path.resolve(process.cwd());
    const entryDir = path.join(projectRoot, 'src', 'content', 'arquetipos-globales', safeSlug);

    // Crear directorio si no existe
    await fs.mkdir(entryDir, { recursive: true });

    // 1. Leer index.json existente para no pisar campos que no vengan en el body
    const indexPath = path.join(entryDir, 'index.json');
    let existing: Record<string, any> = {};
    try {
      const raw = await fs.readFile(indexPath, 'utf-8');
      existing = JSON.parse(raw);
    } catch {
      // Archivo nuevo
    }

    // 2. Construir el objeto de metadatos fusionado
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const metadata: Record<string, any> = {
      ...existing,
      ...(title    !== undefined ? { title }    : {}),
      ...(excerpt  !== undefined ? { excerpt }  : {}),
      ...(category !== undefined ? { category } : {}),
      ...(volanta  !== undefined ? { volanta }  : {}),
      ...(themeColor     !== undefined ? { themeColor }     : {}),
      ...(sitioGeohistorico !== undefined ? { sitioGeohistorico } : {}),
      ...(publicarConImagen !== undefined ? { publicarConImagen } : {}),
      ...(draft    !== undefined ? { draft }    : {}),
      date: date ?? existing.date ?? today,
      // La imagen es un string URL externo; no usamos el transformer image() de Astro
      ...(imageUrl ? { coverImage: imageUrl } : {}),
      themeColor: themeColor ?? existing.themeColor ?? 'rust-orange',
      draft: draft ?? existing.draft ?? false,
      publicarConImagen: publicarConImagen ?? existing.publicarConImagen ?? true,
    };

    await fs.writeFile(indexPath, JSON.stringify(metadata, null, 2), 'utf-8');

    // 3. Escribir content.mdoc (placeholder si no hay texto para que Astro no falle)
    const mdocPath = path.join(entryDir, 'content.mdoc');
    const mdocContent = content && content.trim().length > 0
      ? content.trim()
      : '<!-- sin contenido -->';

    await fs.writeFile(mdocPath, mdocContent, 'utf-8');

    return new Response(JSON.stringify({
      success: true,
      slug: safeSlug,
      indexPath: `src/content/arquetipos-globales/${safeSlug}/index.json`,
      mdocPath:  `src/content/arquetipos-globales/${safeSlug}/content.mdoc`,
      charactersWritten: mdocContent.length,
    }), { status: 200, headers });

  } catch (err: any) {
    console.error('[guardar-arquetipo] Error al escribir en disco:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Error interno' }), { status: 500, headers });
  }
};
