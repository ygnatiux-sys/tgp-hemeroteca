import fs from 'node:fs';
import path from 'node:path';

export async function handleGuardarEnsayo(body: any) {
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
    return {
      status: 400,
      data: { error: 'Se requiere un slug válido para el ensayo.', skipped: true }
    };
  }

  const contentDirPath = path.join(process.cwd(), 'src', 'content', 'ensayos', slug);
  const assetDirPath = path.join(process.cwd(), 'src', 'assets', 'ensayos', slug);

  if (!fs.existsSync(contentDirPath)) fs.mkdirSync(contentDirPath, { recursive: true });
  if (!fs.existsSync(assetDirPath)) fs.mkdirSync(assetDirPath, { recursive: true });

  // 1. Imagen de portada
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
        coverImagePath = `/src/assets/ensayos/${slug}/${fileName}`;
      }
    } catch (imgErr) {
      console.warn('[guardar-ensayo] Imagen no guardada:', imgErr);
    }
  }

  // 2. index.json
  const jsonFilePath = path.join(contentDirPath, 'index.json');
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

  // 3. content.mdoc
  if (content && content.trim().length > 0) {
    const mdocFilePath = path.join(contentDirPath, 'content.mdoc');
    fs.writeFileSync(mdocFilePath, content, 'utf-8');
  }

  return {
    status: 200,
    data: {
      success: true,
      productionMode: false,
      slug,
      coverImagePath: updatedData.coverImage,
      message: `Ensayo "${updatedData.title}" guardado en disco.`
    }
  };
}
