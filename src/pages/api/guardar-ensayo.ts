import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * guardar-ensayo.ts
 *
 * En LOCAL (Node.js dev): escribe en disco el ensayo, excerpt, categoría
 * e imagen de portada del post.
 * En CLOUDFLARE (producción): devuelve productionMode:true para que
 * el componente guíe al usuario a usar el Save nativo de Keystatic.
 *
 * NOTA: No importamos 'fs' ni 'path' a nivel de módulo porque Cloudflare
 * Workers falla en build-time si detecta imports de módulos Node core.
 * Usamos eval() para que el bundler no lo detecte.
 */

export const POST: APIRoute = async ({ request }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

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
    const {
      slug,
      title,
      content,
      excerpt,
      category,
      imageUrl,
      sitioGeohistorico,
      publicarConImagen,
    } = body;

    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return new Response(
        JSON.stringify({
          error: 'Se requiere un slug válido. Para posts nuevos, usá el botón Save de Keystatic primero.',
          skipped: true,
        }),
        { status: 400, headers }
      );
    }

    // ── Detectar entorno Node.js de forma segura ──────────────────────────────
    // En Cloudflare Workers, process.versions.node no existe.
    const isNodeEnv =
      typeof process !== 'undefined' &&
      typeof process.versions === 'object' &&
      typeof process.versions.node === 'string';

    if (!isNodeEnv) {
      return productionModeResponse(slug, title);
    }

    // ── Modo Node.js local ────────────────────────────────────────────────────
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
      const contentDirPath = pathMod.join(process.cwd(), 'src', 'content', 'ensayos', slug);
      const assetDirPath = pathMod.join(process.cwd(), 'src', 'assets', 'ensayos', slug);

      if (!fs.existsSync(contentDirPath)) fs.mkdirSync(contentDirPath, { recursive: true });
      if (!fs.existsSync(assetDirPath)) fs.mkdirSync(assetDirPath, { recursive: true });

      // ── 1. Imagen de portada ─────────────────────────────────────────────────
      let coverImagePath: string | null = null;
      if (imageUrl) {
        try {
          let imageBuffer: Buffer | null = null;
          let ext = 'jpg';

          if (imageUrl.startsWith('data:image/')) {
            const matches = imageUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
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
            fs.writeFileSync(pathMod.join(assetDirPath, fileName), imageBuffer);
            coverImagePath = `/src/assets/ensayos/${slug}/${fileName}`;
          }
        } catch (imgErr) {
          console.warn('[guardar-ensayo] Imagen no guardada:', imgErr);
        }
      }

      // ── 2. index.json ────────────────────────────────────────────────────────
      const jsonFilePath = pathMod.join(contentDirPath, 'index.json');
      let existingData: Record<string, any> = {};
      if (fs.existsSync(jsonFilePath)) {
        try {
          existingData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
        } catch {}
      }

      const todayStr = new Date().toISOString().split('T')[0];
      let finalCoverImage = coverImagePath || existingData.coverImage || null;
      if (finalCoverImage && !finalCoverImage.startsWith('/') && !finalCoverImage.startsWith('http')) {
        finalCoverImage = `/src/assets/ensayos/${slug}/${finalCoverImage}`;
      }

      const updatedData = {
        ...existingData,
        title: title || existingData.title || slug,
        date: existingData.date || todayStr,
        category: category || existingData.category || 'Historia',
        themeColor: existingData.themeColor || 'british-green',
        draft: existingData.draft ?? false,
        sitioGeohistorico: sitioGeohistorico !== undefined ? sitioGeohistorico : (existingData.sitioGeohistorico || null),
        publicarConImagen: publicarConImagen !== undefined ? Boolean(publicarConImagen) : (existingData.publicarConImagen ?? true),
        coverImage: finalCoverImage,
        excerpt: excerpt || existingData.excerpt || '',
        generador: 'Gemini-3.1-Pro',
      };

      fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData, null, 2), 'utf-8');

      // ── 3. content.mdoc ──────────────────────────────────────────────────────
      if (content && content.trim().length > 0) {
        const mdocFilePath = pathMod.join(contentDirPath, 'content.mdoc');
        fs.writeFileSync(mdocFilePath, content, 'utf-8');
      }

      return new Response(
        JSON.stringify({
          success: true,
          productionMode: false,
          slug,
          coverImagePath: updatedData.coverImage,
          message: `Ensayo "${updatedData.title}" guardado en disco.`,
        }),
        { status: 200, headers }
      );

    } catch (fsError: any) {
      console.warn('[guardar-ensayo] Error de escritura en disco, fallback productionMode:', fsError?.code, fsError?.message);
      return productionModeResponse(slug, title);
    }

  } catch (error: any) {
    console.error('[guardar-ensayo] Error inesperado:', error);
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
