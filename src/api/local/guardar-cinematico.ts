import fs from 'node:fs';
import path from 'node:path';

export async function handleGuardarCinematico(body: any) {
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
    return {
      status: 400,
      data: { error: 'Se requiere un slug válido para el ensayo cinemático.', skipped: true }
    };
  }

  const safeSlug = slug.replace(/[^a-z0-9\-_]/gi, '-').replace(/^-+|-+$/g, '');
  const projectRoot = path.resolve(process.cwd());
  const contentDirPath = path.join(projectRoot, 'src', 'content', 'ensayos-cinematicos', safeSlug);
  const assetDirPath = path.join(projectRoot, 'src', 'assets', 'ensayos-cinematicos', safeSlug);

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
        coverImagePath = `/src/assets/ensayos-cinematicos/${safeSlug}/${fileName}`;
      }
    } catch (imgErr) {
      console.warn('[guardar-cinematico] Imagen no guardada:', imgErr);
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

  // 3. content.mdoc
  const mdocFilePath = path.join(contentDirPath, 'content.mdoc');
  const mdocContent = content && content.trim().length > 0
    ? content.trim()
    : '<!-- sin contenido -->';
  fs.writeFileSync(mdocFilePath, mdocContent, 'utf-8');

  return {
    status: 200,
    data: {
      success: true,
      productionMode: false,
      slug: safeSlug,
      coverImagePath: updatedData.coverImage,
      indexPath: `src/content/ensayos-cinematicos/${safeSlug}/index.json`,
      mdocPath: `src/content/ensayos-cinematicos/${safeSlug}/content.mdoc`,
      charactersWritten: mdocContent.length,
      message: `Ensayo cinemático "${updatedData.title}" guardado en disco.`
    }
  };
}
