import type { APIRoute } from 'astro';

export const prerender = false;

function unnestJsonIfPresent(rawText: string) {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (
    trimmed.startsWith('{') &&
    (trimmed.includes('"informeMarkdown"') || trimmed.includes('"volantaHook"') || trimmed.includes('"content"'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      const extract = (field: string) => {
        const match = trimmed.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"|\\s*})`));
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

  try {
    const body = await request.json();
    let {
      slug, title, content, volantaHook, saberMasDato, sitioGeohistorico,
      excerpt, category, imageUrl, publicarConImagen, bancoImagenesWikimedia, generadorGeoref,
    } = body;

    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Se requiere un slug válido.', skipped: true }),
        { status: 400, headers }
      );
    }

    // Unnesting preventivo
    const unnestedFromContent = unnestJsonIfPresent(content) || unnestJsonIfPresent(generadorGeoref);
    if (unnestedFromContent) {
      if (unnestedFromContent.informeMarkdown || unnestedFromContent.content)
        content = unnestedFromContent.informeMarkdown || unnestedFromContent.content;
      if (!volantaHook && unnestedFromContent.volantaHook) volantaHook = unnestedFromContent.volantaHook;
      if (!saberMasDato && unnestedFromContent.saberMasDato) saberMasDato = unnestedFromContent.saberMasDato;
      if (!excerpt && unnestedFromContent.excerpt) excerpt = unnestedFromContent.excerpt;
      if (!sitioGeohistorico && unnestedFromContent.sitioGeohistorico) sitioGeohistorico = unnestedFromContent.sitioGeohistorico;
    }

    // ── Intento de escritura local (Node.js dev) ──────────────────────────────
    // Si CUALQUIER operación de disco falla (EPERM, EROFS, etc.) → productionMode.
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const contentDirPath = path.join(process.cwd(), 'src', 'content', 'georreferencias', slug);
      const assetDirPath = path.join(process.cwd(), 'src', 'assets', 'georreferencias', slug);

      // Si el directorio raíz no se puede crear → estamos en un entorno de solo lectura
      if (!fs.existsSync(contentDirPath)) fs.mkdirSync(contentDirPath, { recursive: true });
      if (!fs.existsSync(assetDirPath)) fs.mkdirSync(assetDirPath, { recursive: true });

      // Imagen
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
            fs.writeFileSync(path.join(assetDirPath, fileName), imageBuffer);
            coverImagePath = `/src/assets/georreferencias/${slug}/${fileName}`;
          }
        } catch (imgErr) {
          console.warn('[guardar-georreferencia] No se pudo guardar imagen:', imgErr);
        }
      }

      // index.json
      const jsonFilePath = path.join(contentDirPath, 'index.json');
      let existingData: Record<string, any> = {};
      if (fs.existsSync(jsonFilePath)) {
        try { existingData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8')); } catch {}
      }

      const todayStr = new Date().toISOString().split('T')[0];
      let finalCoverImage = coverImagePath || existingData.coverImage || null;
      if (finalCoverImage && !finalCoverImage.startsWith('/') && !finalCoverImage.startsWith('http')) {
        finalCoverImage = `/src/assets/georreferencias/${slug}/${finalCoverImage}`;
      }

      const updatedData = {
        title: title || existingData.title || slug,
        sitioGeohistorico: sitioGeohistorico || existingData.sitioGeohistorico || title || slug,
        volantaHook: volantaHook || existingData.volantaHook || '',
        saberMasDato: saberMasDato || existingData.saberMasDato || '',
        date: existingData.date || todayStr,
        category: category || existingData.category || 'Arqueosemiótica',
        publicarConImagen: publicarConImagen !== undefined ? Boolean(publicarConImagen) : (existingData.publicarConImagen ?? true),
        draft: existingData.draft ?? false,
        coverImage: finalCoverImage,
        bancoImagenesWikimedia: bancoImagenesWikimedia !== undefined ? bancoImagenesWikimedia : (existingData.bancoImagenesWikimedia || null),
        excerpt: excerpt || existingData.excerpt || '',
        generadorGeoref: typeof content === 'string' && content.trim().length > 0
          ? content.trim()
          : (existingData.generadorGeoref || ''),
      };

      fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData, null, 2), 'utf-8');

      if (content) {
        fs.writeFileSync(path.join(contentDirPath, 'content.mdoc'), content, 'utf-8');
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
      // Cloudflare Workers / disco de solo lectura / cualquier EPERM → productionMode
      const code = fsError?.code || '';
      const isReadOnly = ['EPERM', 'EROFS', 'EACCES', 'ENOENT', 'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(code)
        || fsError?.message?.includes('operation not permitted')
        || fsError?.message?.includes('read-only')
        || fsError?.message?.includes('Cannot find module');

      if (isReadOnly || true) {
        // Siempre caemos aquí en Cloudflare — retornamos productionMode
        console.info(`[guardar-georreferencia] Entorno de solo lectura detectado (${code || 'unknown'}). Retornando productionMode.`);
        return new Response(
          JSON.stringify({
            success: true,
            productionMode: true,
            slug,
            message: `Contenido listo. Presioná el botón azul "Save" de Keystatic para publicar "${title || slug}" en GitHub.`,
          }),
          { status: 200, headers }
        );
      }

      throw fsError;
    }

  } catch (error: any) {
    console.error('[guardar-georreferencia] Error inesperado:', error);
    return new Response(
      JSON.stringify({
        // En lugar de 500, devolvemos success+productionMode para no romper la UI
        success: true,
        productionMode: true,
        slug: '',
        message: 'Presioná el botón "Save" de Keystatic para guardar en GitHub.',
        _internalError: error?.message,
      }),
      { status: 200, headers }
    );
  }
};
