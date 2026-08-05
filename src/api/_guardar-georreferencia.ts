import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const prerender = false;

function unnestJsonIfPresent(rawText: string) {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') && (trimmed.includes('"informeMarkdown"') || trimmed.includes('"volantaHook"') || trimmed.includes('"content"'))) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // Regex extraction fallback
      const extract = (field: string) => {
        const match = trimmed.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"|\\s*})`));
        return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null;
      };
      return {
        informeMarkdown: extract('informeMarkdown'),
        volantaHook: extract('volantaHook'),
        excerpt: extract('excerpt'),
        saberMasDato: extract('saberMasDato')
      };
    }
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    let { slug, title, content, volantaHook, saberMasDato, sitioGeohistorico, excerpt, category, imageUrl, publicarConImagen, bancoImagenesWikimedia, generadorGeoref } = body;

    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return new Response(JSON.stringify({ 
        error: 'Se requiere un slug válido para la georreferencia.',
        skipped: true 
      }), { status: 400, headers });
    }

    // Unnesting preventivo si el contenido venía como un payload JSON de Gemini
    const unnestedFromContent = unnestJsonIfPresent(content) || unnestJsonIfPresent(generadorGeoref);
    if (unnestedFromContent) {
      if (unnestedFromContent.informeMarkdown || unnestedFromContent.content) {
        content = unnestedFromContent.informeMarkdown || unnestedFromContent.content;
      }
      if (!volantaHook && unnestedFromContent.volantaHook) {
        volantaHook = unnestedFromContent.volantaHook;
      }
      if (!saberMasDato && unnestedFromContent.saberMasDato) {
        saberMasDato = unnestedFromContent.saberMasDato;
      }
      if (!excerpt && unnestedFromContent.excerpt) {
        excerpt = unnestedFromContent.excerpt;
      }
      if (!sitioGeohistorico && unnestedFromContent.sitioGeohistorico) {
        sitioGeohistorico = unnestedFromContent.sitioGeohistorico;
      }
    }

    const contentDirPath = path.join(process.cwd(), 'src', 'content', 'georreferencias', slug);
    const assetDirPath = path.join(process.cwd(), 'src', 'assets', 'georreferencias', slug);

    if (!fs.existsSync(contentDirPath)) {
      fs.mkdirSync(contentDirPath, { recursive: true });
    }
    if (!fs.existsSync(assetDirPath)) {
      fs.mkdirSync(assetDirPath, { recursive: true });
    }

    // 1. PROCESAMIENTO Y GUARDADO DE IMAGEN
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
        } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          const resp = await fetch(imageUrl);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuf);
          }
        }

        if (imageBuffer) {
          const fileName = `coverImage.${ext}`;
          const localAssetPath = path.join(assetDirPath, fileName);
          fs.writeFileSync(localAssetPath, imageBuffer);
          coverImagePath = `/src/assets/georreferencias/${slug}/${fileName}`;
        }
      } catch (errImg) {
        console.error('Error guardando la imagen de la georreferencia:', errImg);
      }
    }

    // 2. LECTURA Y ACTUALIZACIÓN DE INDEX.JSON
    const jsonFilePath = path.join(contentDirPath, 'index.json');
    let existingData: Record<string, any> = {};

    if (fs.existsSync(jsonFilePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      } catch (e) {}
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
      generadorGeoref: (typeof content === 'string' && content.trim().length > 0) ? content.trim() : (existingData.generadorGeoref || '')
    };

    fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData, null, 2), 'utf-8');

    // 3. GUARDADO DE CONTENIDO EN CONTENT.MDOC
    if (content) {
      const mdocFilePath = path.join(contentDirPath, 'content.mdoc');
      fs.writeFileSync(mdocFilePath, content, 'utf-8');
    }

    return new Response(JSON.stringify({
      success: true,
      slug,
      coverImagePath: updatedData.coverImage,
      message: `Georreferencia "${updatedData.title}" guardada exitosamente en la colección de Georreferencias.`
    }), { status: 200, headers });

  } catch (error: any) {
    console.error('Error guardando georreferencia:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 500, headers });
  }
};
