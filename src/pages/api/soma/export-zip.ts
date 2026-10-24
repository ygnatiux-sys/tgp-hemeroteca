/**
 * src/pages/api/soma/export-zip.ts
 * Endpoint de exportación por lotes de imágenes patrimoniales SOMA.
 * Convierte cada imagen a formato WebP optimizado con sharp en memoria
 * y empaqueta todo en un archivo .ZIP con metadatos y manifiesto legal.
 */
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import zlib from 'node:zlib';

export const prerender = false;

// ── Calculador CRC32 estándar (RFC 1952) ───────────────────────────────────
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Empaquetador ZIP en memoria puro (PKZIP Spec) ───────────────────────────
interface ZipEntry {
  filename: string;
  data: Buffer;
}

function createZipBuffer(entries: ZipEntry[]): Buffer {
  const localFileChunks: Buffer[] = [];
  const centralDirChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.filename, 'utf8');
    const rawData = entry.data;
    const crc = crc32(rawData);
    const uncompressedSize = rawData.length;

    // Compresión DEFLATE
    const compressedData = zlib.deflateRawSync(rawData);
    const compressedSize = compressedData.length;

    // Local file header: 30 bytes + filename + data
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);          // Version needed
    localHeader.writeUInt16LE(0x0800, 6);      // General purpose bit flag (UTF-8)
    localHeader.writeUInt16LE(8, 8);           // Compression method (8 = Deflate)
    localHeader.writeUInt16LE(0, 10);          // Last mod time
    localHeader.writeUInt16LE(0, 12);          // Last mod date
    localHeader.writeUInt32LE(crc, 14);        // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18);   // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBytes.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28);          // Extra field length

    localFileChunks.push(localHeader, nameBytes, compressedData);

    // Central directory header: 46 bytes + filename
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4);          // Version made by
    centralHeader.writeUInt16LE(20, 6);          // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);      // Bit flag (UTF-8)
    centralHeader.writeUInt16LE(8, 10);          // Compression method
    centralHeader.writeUInt16LE(0, 12);          // Last mod time
    centralHeader.writeUInt16LE(0, 14);          // Last mod date
    centralHeader.writeUInt32LE(crc, 16);        // CRC-32
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);          // Extra field length
    centralHeader.writeUInt16LE(0, 32);          // Comment length
    centralHeader.writeUInt16LE(0, 34);          // Disk number
    centralHeader.writeUInt16LE(0, 36);          // Internal attributes
    centralHeader.writeUInt32LE(0, 38);          // External attributes
    centralHeader.writeUInt32LE(offset, 42);     // Relative offset of local header

    centralDirChunks.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + compressedData.length;
  }

  const centralDirBuffer = Buffer.concat(centralDirChunks);
  const centralDirSize = centralDirBuffer.length;
  const centralDirOffset = offset;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // EOCD signature
  eocd.writeUInt16LE(0, 4);                // Disk number
  eocd.writeUInt16LE(0, 6);                // Start disk
  eocd.writeUInt16LE(entries.length, 8);   // Entries on this disk
  eocd.writeUInt16LE(entries.length, 10);  // Total entries
  eocd.writeUInt32LE(centralDirSize, 12);  // Central dir size
  eocd.writeUInt32LE(centralDirOffset, 16);// Central dir offset
  eocd.writeUInt16LE(0, 20);               // Comment length

  return Buffer.concat([...localFileChunks, centralDirBuffer, eocd]);
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 70);
}

// ── Handler POST ────────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const images: any[] = Array.isArray(body?.images) ? body.images : [];
    const collectionName: string = body?.collectionName || 'soma-curated';

    if (images.length === 0) {
      return new Response(JSON.stringify({ error: 'No se enviaron imágenes para exportar.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const zipEntries: ZipEntry[] = [];
    const metadataManifest: any[] = [];
    let licenseNotes = `════════════════════════════════════════════════════════════════════════════════\n`;
    licenseNotes += ` TGP SOMA ENGINE · MANIFIESTO DE CURADURÍA Y DERECHOS VISUALES\n`;
    licenseNotes += ` Colección: ${collectionName}\n`;
    licenseNotes += ` Fecha de exportación: ${new Date().toISOString()}\n`;
    licenseNotes += `════════════════════════════════════════════════════════════════════════════════\n\n`;

    // Procesamiento en paralelo de hasta 6 imágenes concurrentes
    const concurrency = 6;
    for (let i = 0; i < images.length; i += concurrency) {
      const slice = images.slice(i, i + concurrency);
      await Promise.all(
        slice.map(async (item, sliceIdx) => {
          const index = i + sliceIdx + 1;
          const url = item.url || item.thumbUrl;
          if (!url) return;

          try {
            const res = await fetch(url, {
              headers: {
                'User-Agent': 'SomaWikiEngine/1.0 (contact@thegreatpuzzleproject.com; SOMA Visual Core)',
              },
              signal: AbortSignal.timeout(20000),
            });

            if (!res.ok) return;

            const arrayBuf = await res.arrayBuffer();
            const inputBuf = Buffer.from(arrayBuf);

            // Conversión a WebP con sharp (calidad 85 para balance perfecto fidelidad/peso)
            const webpBuf = await sharp(inputBuf)
              .webp({ quality: 85, effort: 4 })
              .toBuffer();

            const safeTitle = sanitizeFilename(item.cleanTitle || item.title || `img-${index}`);
            const paddedIdx = String(index).padStart(2, '0');
            const filename = `${paddedIdx}_${safeTitle}.webp`;

            zipEntries.push({
              filename,
              data: webpBuf,
            });

            metadataManifest.push({
              index,
              filename,
              originalTitle: item.title,
              cleanTitle: item.cleanTitle,
              author: item.author || 'Desconocido',
              license: item.license || 'N/A',
              licenseShortName: item.licenseShortName || 'N/A',
              isCC0OrPublicDomain: Boolean(item.isCC0OrPublicDomain),
              originalResolution: `${item.width || '?'}x${item.height || '?'}`,
              aspectRatio: item.aspectRatio || '?',
              sourceUrl: item.url,
            });

            licenseNotes += `[${paddedIdx}] ${filename}\n`;
            licenseNotes += `  Título: ${item.cleanTitle || item.title}\n`;
            licenseNotes += `  Autor: ${item.author || 'No especificado'}\n`;
            licenseNotes += `  Licencia: ${item.licenseShortName || item.license || 'Dominio Público'}\n`;
            licenseNotes += `  Fuente: ${item.url}\n\n`;
          } catch (err: any) {
            console.error(`Error procesando imagen ${item.url}:`, err.message);
          }
        })
      );
    }

    if (zipEntries.length === 0) {
      return new Response(JSON.stringify({ error: 'No se pudo descargar ninguna imagen para empaquetar.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Agregar archivos documentales de metadatos al ZIP
    zipEntries.push({
      filename: 'metadata.json',
      data: Buffer.from(JSON.stringify({ collection: collectionName, total: zipEntries.length, items: metadataManifest }, null, 2), 'utf8'),
    });

    zipEntries.push({
      filename: 'LICENCIAS_Y_FUENTES.txt',
      data: Buffer.from(licenseNotes, 'utf8'),
    });

    // Generar ZIP binario
    const zipBuffer = createZipBuffer(zipEntries);
    const safeZipName = sanitizeFilename(collectionName);

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeZipName}-webp-collection.zip"`,
        'Content-Length': String(zipBuffer.length),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error en la exportación ZIP.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
