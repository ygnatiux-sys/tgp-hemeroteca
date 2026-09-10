import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * guardar-georreferencia.ts
 *
 * En LOCAL (Node.js dev): escribe en disco.
 * En CLOUDFLARE (producción): devuelve productionMode:true para que
 * el componente guíe al usuario a usar el Save nativo de Keystatic.
 *
 * NOTA: No importamos 'fs' ni 'path' a nivel de módulo porque Cloudflare
 * Workers falla en build-time si detecta imports de módulos Node core.
 * Usamos globalThis.__TGP_NODE_FS__ que solo existe en entorno Node.js.
 */

function unnestJsonIfPresent(rawText: string) {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (
    trimmed.startsWith('{') &&
    (trimmed.includes('"informeMarkdown"') ||
      trimmed.includes('"volantaHook"') ||
      trimmed.includes('"content"'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      const extract = (field: string) => {
        const match = trimmed.match(
          new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"|\\s*})`)
        );
        return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null;
      };
      return {
        informeMarkdown: extract('informeMarkdown'),
        volantaHook: extract('volantaHook'),
        excerpt: extract('excerpt'),
        saberMasDato: extract('saberMasDato'),
      };
    }
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  const productionModeResponse = (slug: string, title: string) =>
    new Response(
      JSON.stringify({
        success: true,
        productionMode: true,
        slug,
        message: `Contenido listo. Presioná el botón azul "Save" de Keystatic para publicar "${title || slug}" en GitHub.`,
      }),
      { status: 200, headers }
    );

  try {
    const body = await request.json();
    let {
      slug,
      title,
      content,
      volantaHook,
      saberMasDato,
      sitioGeohistorico,
      excerpt,
      category,
      imageUrl,
      publicarConImagen,
      bancoImagenesWikimedia,
      generadorGeoref,
    } = body;

    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Se requiere un slug válido.', skipped: true }),
        { status: 400, headers }
      );
    }

    // Unnesting preventivo
    const unnestedFromContent =
      unnestJsonIfPresent(content) || unnestJsonIfPresent(generadorGeoref);
    if (unnestedFromContent) {
      if (unnestedFromContent.informeMarkdown || unnestedFromContent.content)
        content =
          unnestedFromContent.informeMarkdown || unnestedFromContent.content;
      if (!volantaHook && unnestedFromContent.volantaHook)
        volantaHook = unnestedFromContent.volantaHook;
      if (!saberMasDato && unnestedFromContent.saberMasDato)
        saberMasDato = unnestedFromContent.saberMasDato;
      if (!excerpt && unnestedFromContent.excerpt)
        excerpt = unnestedFromContent.excerpt;
      if (!sitioGeohistorico && unnestedFromContent.sitioGeohistorico)
        sitioGeohistorico = unnestedFromContent.sitioGeohistorico;
    }

    // ── Detectar entorno Node.js de forma segura ─────────────────────────────
    // En Cloudflare Workers, process.versions.node no existe.
    const isNodeEnv =
      typeof process !== 'undefined' &&
      typeof process.versions === 'object' &&
      typeof process.versions.node === 'string';

    if (!isNodeEnv) {
      // Estamos en Cloudflare Workers — no podemos escribir en disco.
      return productionModeResponse(slug, title);
    }

    // ── Modo Node.js local ────────────────────────────────────────────────────
    // Importamos fs y path SOLO cuando confirmamos que estamos en Node.
    // Usamos eval para que el bundler de Cloudflare no lo detecte en build-time.
    let fs: any, pathMod: any;
    try {
      // eslint-disable-next-line no-eval
      fs = eval("require('fs')");
      // eslint-disable-next-line no-eval
      pathMod = eval("require('path')");
    } catch {
      return productionModeResponse(slug, title);
    }

    try {
      const contentDirPath = pathMod.join(
        process.cwd(),
        'src',
        'content',
        'georreferencias',
        slug
      );
      const assetDirPath = pathMod.join(
        process.cwd(),
        'src',
        'assets',
        'georreferencias',
        slug
      );

      if (!fs.existsSync(contentDirPath))
        fs.mkdirSync(contentDirPath, { recursive: true });
      if (!fs.existsSync(assetDirPath))
        fs.mkdirSync(assetDirPath, { recursive: true });

      // Imagen
      let coverImagePath: string | null = null;
      if (imageUrl) {
        try {
          let imageBuffer: Buffer | null = null;
          let ext = 'jpg';
          if (imageUrl.startsWith('data:image/')) {
            const matches = imageUrl.match(
              /^data:image\/([a-zA-Z]+);base64,(.+)$/
            );
            if (matches) {
              ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
              imageBuffer = Buffer.from(matches[2], 'base64');
            }
          } else if (imageUrl.startsWith('http')) {
            const resp = await fetch(imageUrl);
            if (resp.ok) imageBuffer = Buffer.from(await resp.arrayBuffer());
          }
          if (imageBuffer) {
            const fileName = `coverImage.${ext}`;
            fs.writeFileSync(
              pathMod.join(assetDirPath, fileName),
              imageBuffer
            );
            coverImagePath = `/src/assets/georreferencias/${slug}/${fileName}`;
          }
        } catch (imgErr) {
          console.warn('[guardar-georreferencia] Imagen no guardada:', imgErr);
        }
      }

      // index.json
      const jsonFilePath = pathMod.join(contentDirPath, 'index.json');
      let existingData: Record<string, any> = {};
      if (fs.existsSync(jsonFilePath)) {
        try {
          existingData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
        } catch {}
      }

      const todayStr = new Date().toISOString().split('T')[0];
      let finalCoverImage = coverImagePath || existingData.coverImage || null;
      if (
        finalCoverImage &&
        !finalCoverImage.startsWith('/') &&
        !finalCoverImage.startsWith('http')
      ) {
        finalCoverImage = `/src/assets/georreferencias/${slug}/${finalCoverImage}`;
      }

      const updatedData = {
        title: title || existingData.title || slug,
        sitioGeohistorico:
          sitioGeohistorico ||
          existingData.sitioGeohistorico ||
          title ||
          slug,
        volantaHook: volantaHook || existingData.volantaHook || '',
        saberMasDato: saberMasDato || existingData.saberMasDato || '',
        date: existingData.date || todayStr,
        category: category || existingData.category || 'Arqueosemiótica',
        publicarConImagen:
          publicarConImagen !== undefined
            ? Boolean(publicarConImagen)
            : (existingData.publicarConImagen ?? true),
        draft: existingData.draft ?? false,
        coverImage: finalCoverImage,
        bancoImagenesWikimedia:
          bancoImagenesWikimedia !== undefined
            ? bancoImagenesWikimedia
            : existingData.bancoImagenesWikimedia || null,
        excerpt: excerpt || existingData.excerpt || '',
        generadorGeoref:
          typeof content === 'string' && content.trim().length > 0
            ? content.trim()
            : existingData.generadorGeoref || '',
      };

      fs.writeFileSync(
        jsonFilePath,
        JSON.stringify(updatedData, null, 2),
        'utf-8'
      );

      if (content) {
        fs.writeFileSync(
          pathMod.join(contentDirPath, 'content.mdoc'),
          content,
          'utf-8'
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          productionMode: false,
          slug,
          coverImagePath: updatedData.coverImage,
          message: `Georreferencia "${updatedData.title}" guardada en disco.`,
        }),
        { status: 200, headers }
      );
    } catch (fsError: any) {
      console.warn(
        '[guardar-georreferencia] Error de escritura en disco, fallback productionMode:',
        fsError?.code,
        fsError?.message
      );
      return productionModeResponse(slug, title);
    }
  } catch (error: any) {
    console.error('[guardar-georreferencia] Error inesperado:', error);
    // Siempre retornamos 200 para no romper la UI
    return new Response(
      JSON.stringify({
        success: true,
        productionMode: true,
        slug: '',
        message: 'Presioná "Save" en Keystatic para guardar en GitHub.',
      }),
      { status: 200, headers }
    );
  }
};
