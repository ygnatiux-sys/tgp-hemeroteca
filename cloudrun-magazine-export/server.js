/**
 * cloudrun-magazine-export/server.js
 * Microservicio aislado: WebP (sharp) + hoja de contacto PDF (pdfkit) + ZIP (archiver).
 * Corre igual en local (`node server.js`, puerto 8080) y en Cloud Run.
 *
 * Seguridad:
 *  - Solo descarga desde hosts de Wikimedia (allowlist) por https.
 *  - Si existe la variable EXPORT_SECRET, exige el header `x-tgp-secret`.
 * Memoria:
 *  - Procesa las fotos con concurrencia limitada (CONCURRENCY) para no agotar RAM.
 */
import express from 'express';
import cors from 'cors';
import sharp from 'sharp';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';

const PORT = process.env.PORT || 8080;
const EXPORT_SECRET = process.env.EXPORT_SECRET || '';
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const MAX_IMAGES = Number(process.env.MAX_IMAGES || 60);
const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(['upload.wikimedia.org', 'commons.wikimedia.org']);
const USER_AGENT = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com; Magazine Export Service)';

sharp.cache(false);
sharp.concurrency(1);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

function slugify(text, fallback) {
  const s = String(text || fallback || 'foto')
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 45);
  return s || fallback || 'foto';
}

function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/** Ejecuta `worker` sobre `items` con un máximo de `limit` tareas simultáneas. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_DOWNLOAD_BYTES) throw new Error('Archivo demasiado grande');
  return Buffer.from(await res.arrayBuffer());
}

async function processImage(img, index, quality) {
  const sourceUrl = img.url || img.thumbUrl;
  const title = img.cleanTitle || img.title || `foto-${index + 1}`;
  const base = { img, title, index };
  if (!isAllowedUrl(sourceUrl)) {
    return { ...base, ok: false, error: 'URL no permitida (solo Wikimedia https)' };
  }
  try {
    const input = await downloadImage(sourceUrl);
    const pipeline = () => sharp(input, { failOn: 'none' }).rotate();
    const webp = await pipeline()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer();
    const thumb = await pipeline()
      .resize({ width: 260, height: 180, fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();
    const fileName = `${String(index + 1).padStart(2, '0')}_${slugify(title, `foto-${index + 1}`)}.webp`;
    return { ...base, ok: true, webp, thumb, fileName };
  } catch (err) {
    return { ...base, ok: false, error: err.message || 'Error de procesamiento' };
  }
}

function buildContactSheet(collectionName, results) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(20).text('THE GREAT PUZZLE PROJECT', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(12).text(`Hoja de contacto y atribución: ${collectionName}`, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor('gray').text(`Generado ${new Date().toISOString()} · Wikimedia Commons`, { align: 'center' });
    doc.fillColor('black').moveDown(1);

    const ROW_H = 120;
    results.forEach((r) => {
      if (doc.y + ROW_H > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const top = doc.y;
      if (r.ok && r.thumb) {
        try { doc.image(r.thumb, 40, top, { width: 130, height: 90 }); } catch { /* miniatura opcional */ }
      }
      const img = r.img;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('black')
        .text(`#${String(r.index + 1).padStart(2, '0')} ${r.title}`.slice(0, 90), 185, top, { width: 370 });
      doc.font('Helvetica').fontSize(8.5)
        .text(`Autor: ${img.author || 'Desconocido'}`, 185, doc.y + 2, { width: 370 })
        .text(`Licencia: ${img.licenseShortName || img.license || 'Commons'}`, { width: 370 })
        .text(`Fuente: ${img.url || img.thumbUrl || '-'}`, { width: 370 });
      if (!r.ok) doc.fillColor('red').text(`No incluida en el ZIP: ${r.error}`, { width: 370 }).fillColor('black');
      doc.y = Math.max(doc.y, top + ROW_H - 10);
      doc.moveDown(0.6);
    });

    doc.end();
  });
}

function requireSecret(req, res, next) {
  if (!EXPORT_SECRET) return next();
  if (req.get('x-tgp-secret') === EXPORT_SECRET) return next();
  return res.status(401).json({ error: 'No autorizado' });
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'tgp-magazine-export' }));

app.post('/api/cloudrun-magazine-export', requireSecret, async (req, res) => {
  const { collectionName = 'tgp-batch', images = [], webpQuality = 82 } = req.body || {};
  const action = req.query.action || req.body?.action || 'zip-desktop-dual';

  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array no vacío de imágenes.' });
  }
  if (images.length > MAX_IMAGES) {
    return res.status(400).json({ error: `Máximo ${MAX_IMAGES} imágenes por lote.` });
  }

  if (action === 'drive-magazine-folder') {
    return res.status(501).json({ error: 'Exportación a Google Drive aún no implementada en este servicio.' });
  }
  if (action !== 'zip-desktop' && action !== 'zip-desktop-dual') {
    return res.status(400).json({ error: `Acción "${action}" no reconocida.` });
  }

  try {
    const quality = Math.min(95, Math.max(40, Number(webpQuality) || 82));
    const results = await mapLimit(images, CONCURRENCY, (img, i) => processImage(img, i, quality));
    const okFiles = results.filter((r) => r.ok);
    if (okFiles.length === 0) {
      return res.status(502).json({
        error: 'No se pudo procesar ninguna imagen.',
        details: results.map((r) => ({ title: r.title, error: r.error })),
      });
    }

    const pdf = await buildContactSheet(collectionName, results);
    const manifest = {
      project: 'The Great Puzzle Project',
      exportDate: new Date().toISOString(),
      requested: images.length,
      included: okFiles.length,
      images: results.map((r) => ({
        index: r.index + 1,
        title: r.title,
        author: r.img.author || null,
        license: r.img.licenseShortName || r.img.license || null,
        sourceUrl: r.img.url || r.img.thumbUrl || null,
        file: r.ok ? r.fileName : null,
        error: r.ok ? null : r.error,
      })),
    };

    const safeName = slugify(collectionName, 'tgp-batch');
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}-webp-pdf.zip"`,
      'Cache-Control': 'no-store',
    });

    const archive = archiver('zip', { store: true }); // WebP/JPEG ya están comprimidos
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.destroy(err);
    });
    archive.pipe(res);
    okFiles.forEach((r) => archive.append(r.webp, { name: r.fileName }));
    archive.append(pdf, { name: 'catalogo-referencia.pdf' });
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    await archive.finalize();
  } catch (err) {
    console.error('Export Error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Error en exportación' });
  }
});

app.get('/api/cloudrun-magazine-export', (_req, res) => {
  res.json({
    service: 'tgp-magazine-export',
    status: 'online',
    supportedActions: ['zip-desktop', 'zip-desktop-dual'],
    pending: ['drive-magazine-folder'],
  });
});

app.listen(PORT, () => {
  console.log(`TGP Magazine Export listening on port ${PORT}`);
});
