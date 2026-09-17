import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * /api/hemeroteca/transmute
 *
 * Recibe el payload de un VisionResult desde ScriptoriumCapture.svelte
 * y crea una entrada de Hemeroteca lista para Keystatic.
 *
 * En LOCAL (Node.js dev): escribe el archivo MDX directamente en disco.
 * En CLOUDFLARE (produccion): devuelve `productionMode: true` para que
 * el componente informe al usuario que debe guardar via Keystatic UI.
 */

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

export const OPTIONS: APIRoute = async () =>
  new Response(null, {
    status: 204,
    headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { collection = 'ensayosCinematicos', pillLabel, prompt, response, imageName, imageSource, timestamp } = body as {
      collection?: string;
      pillLabel: string;
      prompt: string;
      response: string;
      imageName: string;
      imageSource: string;
      timestamp: string;
    };

    if (!response?.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'response vacio' }), {
        status: 400,
        headers,
      });
    }

    const targetCollection = collection || 'ensayosCinematicos';
    const date = new Date(timestamp || Date.now());
    const dateStr = date.toISOString().slice(0, 10);
    const baseSlug = slugify(imageName.replace(/\.[^.]+$/, '') || pillLabel);
    const slug = `vision-${dateStr}-${baseSlug}`;

    // Modo Produccion (Cloudflare Workers): sin acceso a fs
    const isCloudflare =
      typeof process === 'undefined' ||
      process.env.CLOUDFLARE === '1' ||
      !process.versions?.node;

    if (isCloudflare) {
      return new Response(
        JSON.stringify({
          success: true,
          productionMode: true,
          slug,
          collection: targetCollection,
          message: `Contenido listo. Crea la entrada "${slug}" manualmente en Keystatic UI (${targetCollection}).`,
        }),
        { status: 200, headers }
      );
    }

    // Mapeo a carpetas físicas reales del CMS
    const folderMap: Record<string, string> = {
      ensayos: 'ensayos',
      ensayosCinematicos: 'ensayos-cinematicos',
      arquetiposGlobales: 'arquetipos-globales',
      georreferencias: 'georreferencias',
      direccionDeArte: 'estilos-visuales',
      informesPremium: 'informes',
    };
    const folderName = folderMap[collection] || collection;

    // Modo Local (Node.js)
    const path = await eval("import('path')") as typeof import('path');
    const fs = await eval("import('fs/promises')") as typeof import('fs/promises');

    const cwd = process.cwd();
    const entryDir = path.join(cwd, 'src', 'content', folderName, slug);
    await fs.mkdir(entryDir, { recursive: true });

    // 1. index.json: Metadatos para Keystatic y Astro Content Layer
    const metadata = {
      title: `Captura ${pillLabel} — ${imageName || slug}`,
      slug,
      date: dateStr,
      category: 'Historia',
      themeColor: 'british-green',
      draft: false,
      generador: response,
      generadorTexto: response,
      dek: `Captura multimodal (${pillLabel}): ${prompt.slice(0, 100)}...`,
      excerpt: prompt,
      imageSource: imageSource || 'local',
      capturedAt: date.toISOString(),
    };
    await fs.writeFile(path.join(entryDir, 'index.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    // 2. content.mdoc: Cuerpo Markdoc para el editor de Keystatic y el renderizador de la web
    await fs.writeFile(path.join(entryDir, 'content.mdoc'), response, 'utf-8');

    return new Response(
      JSON.stringify({
        success: true,
        productionMode: false,
        slug,
        collection: targetCollection,
        entryDir,
        message: `Entrada "${slug}" creada en src/content/${folderName}/${slug}/ (index.json + content.mdoc).`,
      }),
      { status: 200, headers }
    );
  } catch (err: any) {
    console.error('[transmute] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? 'Error interno' }),
      { status: 500, headers }
    );
  }
};
