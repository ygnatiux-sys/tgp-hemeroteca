import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * guardar-cinematico.ts
 *
 * En LOCAL (Node.js dev): escribe en disco el ensayo cinemático, metadatos
 * e imagen de portada en src/content/ensayos-cinematicos/[slug] y src/assets/ensayos-cinematicos/[slug].
 * En CLOUDFLARE (producción): devuelve productionMode:true para que
 * el componente guíe al usuario a usar el Save nativo de Keystatic.
 *
 * NOTA: No importamos 'fs' ni 'path' a nivel de módulo para evitar errores
 * de compilación en Cloudflare Workers. Usamos eval("require(...)").
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
      imageUrl,
      atmosfera,
      date,
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

    const safeSlug = slug.replace(/[^a-z0-9\-_]/gi, '-').replace(/^-+|-+$/g, '');

    // ── Detectar entorno Node.js de forma segura ──────────────────────────────
    const isNodeEnv =
      typeof process !== 'undefined' &&
      typeof process.versions === 'object' &&
      typeof process.versions.node === 'string';

    if (!isNodeEnv) {
      return productionModeResponse(safeSlug, title);
    }

    // ── Modo Node.js local ────────────────────────────────────────────────────
    let fs: any, pathMod: any;
    try {
      // eslint-disable-next-line no-eval
      fs = eval("require('fs')");
      // eslint-disable-next-line no-eval
      pathMod = eval("require('path')");
    } catch {
      return productionModeResponse(safeSlug, title);
    }

    try {
      const projectRoot = pathMod.resolve(process.cwd());
      const contentDirPath = pathMod.join(projectRoot, 'src', 'content', 'ensayos-cinematicos', safeSlug);
      const assetDirPath = pathMod.join(projectRoot, 'src', 'assets', 'ensayos-cinematicos', safeSlug);

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
            coverImagePath = `/src/assets/ensayos-cinematicos/${safeSlug}/${fileName}`;
          }
        } catch (imgErr) {
          console.warn('[guardar-cinematico] Imagen no guardada:', imgErr);
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
        finalCoverImage = `/src/assets/ensayos-cinematicos/${safeSlug}/${finalCoverImage}`;
      }

      const generadorPayload = JSON.stringify({
        text: content || '',
        image: finalCoverImage || ''
      });

      const updatedData = {
        ...existingData,
        title: title || existingData.title || safeSlug,
        date: date || existingData.date || todayStr,
        generadorTexto: generadorPayload,
        agenteErudito: existingData.agenteErudito ?? '',
        atmosfera: atmosfera || existingData.atmosfera || { discriminant: 'obsidiana' },
        gallery: existingData.gallery || [],
        coverImage: finalCoverImage,
        excerpt: excerpt || existingData.excerpt || '',
      };

      fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData, null, 2), 'utf-8');

      // ── 3. content.mdoc ──────────────────────────────────────────────────────
      const mdocFilePath = pathMod.join(contentDirPath, 'content.mdoc');
      const mdocContent = content && content.trim().length > 0
        ? content.trim()
        : '<!-- sin contenido -->';
      fs.writeFileSync(mdocFilePath, mdocContent, 'utf-8');

      return new Response(
        JSON.stringify({
          success: true,
          productionMode: false,
          slug: safeSlug,
          coverImagePath: updatedData.coverImage,
          indexPath: `src/content/ensayos-cinematicos/${safeSlug}/index.json`,
          mdocPath: `src/content/ensayos-cinematicos/${safeSlug}/content.mdoc`,
          charactersWritten: mdocContent.length,
          message: `Ensayo cinemático "${updatedData.title}" guardado en disco.`,
        }),
        { status: 200, headers }
      );

    } catch (fsError: any) {
      console.warn('[guardar-cinematico] Error de escritura en disco, fallback productionMode:', fsError?.code, fsError?.message);
      return productionModeResponse(safeSlug, title);
    }

  } catch (error: any) {
    console.error('[guardar-cinematico] Error inesperado:', error);
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
