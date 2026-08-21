import fs from 'fs';
import path from 'path';

const contentDirs = [
  'src/content/ensayos',
  'src/content/arquetipos-globales',
  'src/content/georreferencias',
  'src/content/ensayos-cinematicos',
];

const results = [];

for (const relDir of contentDirs) {
  const fullDir = path.resolve(process.cwd(), relDir);
  if (!fs.existsSync(fullDir)) continue;

  const slugs = fs.readdirSync(fullDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const slug of slugs) {
    const slugPath = path.join(fullDir, slug);
    const jsonPath = path.join(slugPath, 'index.json');
    const mdocPath = path.join(slugPath, 'content.mdoc');

    let jsonData = {};
    if (fs.existsSync(jsonPath)) {
      try {
        jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (e) {
        jsonData = { error: 'invalid json' };
      }
    }

    let mdocContent = '';
    if (fs.existsSync(mdocPath)) {
      mdocContent = fs.readFileSync(mdocPath, 'utf8').trim();
    }

    // Check images in json
    const coverImage = jsonData.coverImage;
    let wikimediaImages = [];
    if (jsonData.bancoImagenesWikimedia) {
      try {
        const parsed = typeof jsonData.bancoImagenesWikimedia === 'string' 
          ? JSON.parse(jsonData.bancoImagenesWikimedia) 
          : jsonData.bancoImagenesWikimedia;
        if (parsed?.selectedItems && Array.isArray(parsed.selectedItems)) {
          wikimediaImages = parsed.selectedItems;
        }
      } catch (e) {}
    }

    let galleryImages = Array.isArray(jsonData.gallery) ? jsonData.gallery : [];
    
    // Check disk assets
    const assetsDir = path.resolve(process.cwd(), 'src/assets', path.basename(relDir), slug);
    let diskAssets = [];
    if (fs.existsSync(assetsDir)) {
      diskAssets = fs.readdirSync(assetsDir).filter(f => /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(f));
    }

    // Check body text
    const generadorTexto = (jsonData.generadorTexto || '').trim();
    const notasInvestigador = (jsonData.notasInvestigador || '').trim();
    const excerpt = (jsonData.excerpt || '').trim();
    const hasBody = Boolean(mdocContent.length > 20 || generadorTexto.length > 50);

    const hasAnyImage = Boolean(
      coverImage || 
      wikimediaImages.length > 0 || 
      galleryImages.length > 0 || 
      diskAssets.length > 0
    );

    results.push({
      collection: path.basename(relDir),
      slug,
      title: jsonData.title || 'Sin Título',
      draft: jsonData.draft,
      coverImage: Boolean(coverImage),
      coverImagePath: typeof coverImage === 'string' ? coverImage : (coverImage ? '[Object]' : null),
      wikimediaCount: wikimediaImages.length,
      firstWikimediaUrl: wikimediaImages[0]?.url || wikimediaImages[0]?.thumbUrl || null,
      galleryCount: galleryImages.length,
      diskAssetsCount: diskAssets.length,
      hasBody,
      bodyLength: mdocContent.length || generadorTexto.length,
      hasAnyImage,
      isCandidateForDeletion: !hasAnyImage && !hasBody
    });
  }
}

console.log(JSON.stringify(results, null, 2));
