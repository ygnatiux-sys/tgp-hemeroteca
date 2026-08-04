import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const prerender = false;

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/[^\w\-]+/g, '') // Eliminar caracteres especiales
    .replace(/\-\-+/g, '-');
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { slug, title, content, excerpt, category, imageUrl, sitioGeohistorico, publicarConImagen } = body;

    // GUARD CRÍTICO: Solo operar si hay un slug explícito y confirmado.
    // NUNCA auto-generar slug desde title (eso le corresponde exclusivamente a Keystatic).
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      console.warn('[guardar-ensayo] Rechazado: sin slug válido. Los posts nuevos deben ser guardados por Keystatic primero.');
      return new Response(JSON.stringify({ 
        error: 'Se requiere un slug válido. Para posts nuevos, usa el botón Create/Save de Keystatic primero.',
        skipped: true 
      }), { status: 400, headers });
    }

    const contentDirPath = path.join(process.cwd(), 'src', 'content', 'ensayos', slug);
    const assetDirPath = path.join(process.cwd(), 'src', 'assets', 'ensayos', slug);

    // Crear directorios si no existen
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
          coverImagePath = `/src/assets/ensayos/${slug}/${fileName}`;
        }
      } catch (errImg) {
        console.error('Error guardando la imagen de portada:', errImg);
      }
    }

    // 2. LECTURA Y ACTUALIZACIÓN DE INDEX.JSON
    const jsonFilePath = path.join(contentDirPath, 'index.json');
    let existingData: Record<string, any> = {};

    if (fs.existsSync(jsonFilePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      } catch (e) {
        console.warn('No se pudo leer index.json existente, se creará uno nuevo.');
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Normalizar coverImage existente si tenía ruta relativa rota
    let finalCoverImage = coverImagePath || existingData.coverImage || null;
    if (finalCoverImage && !finalCoverImage.startsWith('/') && !finalCoverImage.startsWith('http')) {
      finalCoverImage = `/src/assets/ensayos/${slug}/${finalCoverImage}`;
    }

    const updatedData = {
      title: title || existingData.title || slug,
      date: existingData.date || todayStr,
      category: category || existingData.category || 'Historia',
      themeColor: existingData.themeColor || 'british-green',
      draft: existingData.draft ?? false,
      sitioGeohistorico: sitioGeohistorico !== undefined ? sitioGeohistorico : (existingData.sitioGeohistorico || null),
      publicarConImagen: publicarConImagen !== undefined ? Boolean(publicarConImagen) : (existingData.publicarConImagen ?? true),
      coverImage: finalCoverImage,
      excerpt: excerpt || existingData.excerpt || '',
      generador: 'Gemini-3.1-Pro'
    };

    fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData, null, 2), 'utf-8');

    // 3. GUARDADO EXCLUSIVO DE CONTENIDO EN CONTENT.MDOC
    if (content) {
      const mdocFilePath = path.join(contentDirPath, 'content.mdoc');
      fs.writeFileSync(mdocFilePath, content, 'utf-8');
    }

    return new Response(JSON.stringify({
      success: true,
      slug,
      coverImagePath: updatedData.coverImage,
      message: `Ensayo "${updatedData.title}" guardado exitosamente en el sistema de archivos.`
    }), { status: 200, headers });

  } catch (error: any) {
    console.error('Error guardando ensayo:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 500, headers });
  }
};
