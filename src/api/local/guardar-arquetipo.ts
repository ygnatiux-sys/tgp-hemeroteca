import fs from 'node:fs';
import path from 'node:path';

export async function handleGuardarArquetipo(body: any) {
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

  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    return {
      status: 400,
      data: { error: 'slug requerido' }
    };
  }

  const safeSlug = slug.replace(/[^a-z0-9\-_]/gi, '-').replace(/^-+|-+$/g, '');
  const projectRoot = path.resolve(process.cwd());
  const entryDir = path.join(projectRoot, 'src', 'content', 'arquetipos-globales', safeSlug);
  const assetDir = path.join(projectRoot, 'src', 'assets', 'arquetipos-globales', safeSlug);

  if (!fs.existsSync(entryDir)) fs.mkdirSync(entryDir, { recursive: true });
  if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });

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
        fs.writeFileSync(path.join(assetDir, fileName), imageBuffer);
        coverImagePath = `/src/assets/arquetipos-globales/${safeSlug}/${fileName}`;
      }
    } catch (imgErr) {
      console.warn('[guardar-arquetipo] Imagen no guardada:', imgErr);
    }
  }

  // 2. index.json
  const indexPath = path.join(entryDir, 'index.json');
  let existing: Record<string, any> = {};
  try {
    const raw = fs.readFileSync(indexPath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {}

  const today = new Date().toISOString().slice(0, 10);

  const metadata: Record<string, any> = {
    ...existing,
    ...(title !== undefined ? { title } : {}),
    ...(excerpt !== undefined ? { excerpt } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(volanta !== undefined ? { volanta } : {}),
    ...(sitioGeohistorico !== undefined ? { sitioGeohistorico } : {}),
    date: date ?? existing.date ?? today,
    themeColor: themeColor ?? existing.themeColor ?? 'rust-orange',
    draft: draft ?? existing.draft ?? false,
    publicarConImagen: publicarConImagen !== undefined ? Boolean(publicarConImagen) : (existing.publicarConImagen ?? true),
    ...(coverImagePath ? { coverImage: coverImagePath } : existing.coverImage ? { coverImage: existing.coverImage } : {}),
  };

  fs.writeFileSync(indexPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // 3. content.mdoc
  const mdocPath = path.join(entryDir, 'content.mdoc');
  const mdocContent = content && content.trim().length > 0
    ? content.trim()
    : '<!-- sin contenido -->';
  fs.writeFileSync(mdocPath, mdocContent, 'utf-8');

  return {
    status: 200,
    data: {
      success: true,
      productionMode: false,
      slug: safeSlug,
      indexPath: `src/content/arquetipos-globales/${safeSlug}/index.json`,
      mdocPath: `src/content/arquetipos-globales/${safeSlug}/content.mdoc`,
      charactersWritten: mdocContent.length,
      message: `Arquetipo "${metadata.title || safeSlug}" guardado en disco.`
    }
  };
}
