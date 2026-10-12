import type { APIRoute } from 'astro';

export const prerender = false;

const USER_AGENT = 'TGP-Hemeroteca/1.0 (editorial@thegreatpuzzleproject.com; node-fetch)';

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Fallo HTTP ${res.status} al descargar ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const sharp = (await import('sharp')).default;
    const fs = await import('node:fs');
    const path = await import('node:path');

    const body = await request.json();
    const {
      slug,
      collection = 'ensayos-cinematicos',
      mode = 'hero', // 'hero' | 'video-array'
      items = [],
    } = body;

    if (!slug) {
      return new Response(JSON.stringify({ success: false, error: 'Parámetro "slug" requerido.' }), { status: 400, headers });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Debes seleccionar al menos 1 imagen.' }), { status: 400, headers });
    }

    const rootDir = process.cwd();
    const assetsDir = path.join(rootDir, 'src', 'assets', collection, slug);
    const contentPostDir = path.join(rootDir, 'src', 'content', collection, slug);
    const jsonPath = path.join(contentPostDir, 'index.json');

    fs.mkdirSync(assetsDir, { recursive: true });

    // ──────────────────────────────────────────────────────────────────────────
    // MODO 1: WEB HERO (1 sola imagen confirmada)
    // ──────────────────────────────────────────────────────────────────────────
    if (mode === 'hero') {
      const selectedItem = items[0];
      const coverDiskPath = path.join(assetsDir, 'coverImage.webp');
      const coverRelativePath = `/src/assets/${collection}/${slug}/coverImage.webp`;

      console.log(`[HITL API] Descargando y procesando Hero para ${slug}: ${selectedItem.url}`);
      const rawBuffer = await downloadBuffer(selectedItem.url);

      // Optimización Sharp a WebP 2560px
      await sharp(rawBuffer)
        .resize({
          width: 2560,
          height: 1440,
          fit: 'cover',
          position: 'attention',
        })
        .webp({ quality: 88, effort: 5, smartSubsample: true })
        .toFile(coverDiskPath);

      // Actualizar index.json de Keystatic
      if (fs.existsSync(jsonPath)) {
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        jsonData.coverImage = coverRelativePath;
        jsonData.coverImageAttribution = selectedItem.attribution || {
          author: 'Wikimedia Commons',
          license: 'CC',
          sourceUrl: selectedItem.url,
        };

        jsonData.bancoImagenesWikimedia = JSON.stringify({
          selectedItems: [{
            id: (selectedItem.title || 'hero').replace(/\s+/g, '_'),
            url: selectedItem.url,
            thumbUrl: coverRelativePath,
            title: selectedItem.title,
            author: selectedItem.attribution?.author || 'Desconocido',
            license: selectedItem.attribution?.license || 'CC',
            width: selectedItem.width || 2560,
            height: selectedItem.height || 1440,
            aspectRatio: 1.78,
            role: 'HERO',
          }],
        });

        fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
      }

      return new Response(JSON.stringify({
        success: true,
        mode: 'hero',
        slug,
        coverImage: coverRelativePath,
        attribution: selectedItem.attribution,
        message: 'Portada Hero generada y asignada exitosamente en index.json.',
      }), { status: 200, headers });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MODO 2: VIDEO ARRAY (DaVinci Resolve / Remotion, hasta 7 imágenes)
    // ──────────────────────────────────────────────────────────────────────────
    const videoAssetsDir = path.join(assetsDir, 'video_assets');
    fs.mkdirSync(videoAssetsDir, { recursive: true });

    const maxItems = Math.min(items.length, 7);
    const assetListForJson = [];

    console.log(`[HITL API] Procesando array de video (${maxItems} imágenes) para ${slug}...`);

    for (let i = 0; i < maxItems; i++) {
      const it = items[i];
      const numStr = String(i + 1).padStart(2, '0');
      const assetFileName = `asset_${numStr}.webp`;
      const assetDiskPath = path.join(videoAssetsDir, assetFileName);
      const assetRelPath = `/src/assets/${collection}/${slug}/video_assets/${assetFileName}`;

      const rawBuffer = await downloadBuffer(it.url);

      await sharp(rawBuffer)
        .resize({
          width: 2560,
          height: 1440,
          fit: 'cover',
          position: 'attention',
        })
        .webp({ quality: 88, effort: 5, smartSubsample: true })
        .toFile(assetDiskPath);

      assetListForJson.push({
        index: i + 1,
        filename: assetFileName,
        title: it.title,
        relativePath: assetRelPath,
        absolutePath: assetDiskPath.replace(/\\/g, '/'),
        width: 2560,
        height: 1440,
        aspectRatio: '16:9',
        attribution: it.attribution || {
          author: 'Wikimedia Commons',
          license: 'CC',
          sourceUrl: it.url,
        },
      });
    }

    // Generar archivo assets_array.json para DaVinci Resolve
    const arrayJsonPath = path.join(contentPostDir, 'assets_array.json');
    let postTitle = slug;
    if (fs.existsSync(jsonPath)) {
      try {
        const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (d.title) postTitle = d.title;
      } catch {}
    }

    const arrayPayload = {
      slug,
      title: postTitle,
      generatedAt: new Date().toISOString(),
      mode: 'video-array',
      source: 'Wikimedia Commons (Human Curated)',
      totalAssets: assetListForJson.length,
      assets: assetListForJson,
    };

    fs.writeFileSync(arrayJsonPath, JSON.stringify(arrayPayload, null, 2), 'utf8');

    // Asignar también la primera imagen como coverImage si el post estaba vacío
    let coverAssigned = null;
    if (fs.existsSync(jsonPath)) {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (!jsonData.coverImage || jsonData.coverImage.trim() === '') {
        const coverFileName = 'coverImage.webp';
        const coverDiskPath = path.join(assetsDir, coverFileName);
        const coverRelPath = `/src/assets/${collection}/${slug}/${coverFileName}`;
        fs.copyFileSync(path.join(videoAssetsDir, 'asset_01.webp'), coverDiskPath);

        jsonData.coverImage = coverRelPath;
        jsonData.coverImageAttribution = assetListForJson[0].attribution;
        fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
        coverAssigned = coverRelPath;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      mode: 'video-array',
      slug,
      totalProcessed: assetListForJson.length,
      assetsArrayFile: arrayJsonPath.replace(/\\/g, '/'),
      coverAssigned,
      assets: assetListForJson,
      message: `Array de ${assetListForJson.length} imágenes generado para DaVinci Resolve.`,
    }), { status: 200, headers });

  } catch (err: any) {
    console.error('[HITL API Error]', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Error procesando la selección de imágenes.',
    }), { status: 500, headers });
  }
};
