/**
 * auditar-imagenes-r2.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Auditoría inflexible de imágenes de portada y CDN de Cloudflare R2:
 * 1. Inspección física binaria (descarta falsos positivos, HTML 404/403 y placeholders SVG).
 * 2. Comprobación de cabeceras mágicas (JPEG, PNG, WebP).
 * 3. Verificación en vivo contra el CDN de Cloudflare R2 (https://storage.thegreatpuzzleproject.com).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';

const R2_BASE_URL = 'https://storage.thegreatpuzzleproject.com';
const COLLECTIONS = ['ensayos', 'ensayos-cinematicos', 'arquetipos-globales', 'georreferencias'];

// Magic bytes para validación binaria
function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 12) return 'EMPTY_OR_CORRUPT';
  
  // Detectar HTML de error (falsos positivos donde se guardó una página web en vez de la imagen)
  const headerStr = buffer.subarray(0, 100).toString('utf8').trim().toLowerCase();
  if (headerStr.includes('<!doctype') || headerStr.includes('<html') || headerStr.includes('error 404') || headerStr.includes('403 forbidden')) {
    return 'HTML_ERROR_PAGE';
  }
  if (headerStr.includes('<svg') || headerStr.includes('<?xml')) {
    return 'SVG_PLACEHOLDER';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'JPEG';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'PNG';
  }
  // WebP: RIFF ... WEBP
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'WEBP';
  }

  return 'UNKNOWN_BINARY';
}

async function checkR2Status(relativeAssetPath) {
  // relativeAssetPath ej: "ensayos/bonampak/coverImage.jpg"
  const cleanPath = relativeAssetPath.replace(/^[\\/]/, '').replace(/^src[\\/]assets[\\/]/, '');
  const url = `${R2_BASE_URL}/${cleanPath.replace(/\\/g, '/')}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);

    return {
      url,
      exists: res.status === 200,
      statusCode: res.status,
      contentType: res.headers.get('content-type') || 'desconocido',
      contentLength: res.headers.get('content-length') ? parseInt(res.headers.get('content-length'), 10) : null
    };
  } catch (err) {
    return {
      url,
      exists: false,
      statusCode: 'ERROR_CONEXION',
      contentType: 'none',
      contentLength: null,
      error: err.message
    };
  }
}

async function runAudit() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║       🔬 TGP - AUDITORÍA INFLEXIBLE DE IMÁGENES Y CLOUDFLARE R2          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

  const results = [];
  const args = process.argv.slice(2);
  const targetSlug = args.find(a => !a.startsWith('--'));

  for (const col of COLLECTIONS) {
    const colDir = path.resolve('src/content', col);
    if (!fs.existsSync(colDir)) continue;

    const entries = fs.readdirSync(colDir);
    for (const slug of entries) {
      if (targetSlug && slug !== targetSlug) continue;

      const indexPath = path.join(colDir, slug, 'index.json');
      if (!fs.existsSync(indexPath)) continue;

      try {
        const meta = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const coverImage = meta.coverImage || '';

        if (!coverImage && !targetSlug) continue; // Si no tiene portada configurada y no es búsqueda puntual, omitir

        const item = {
          collection: col,
          slug,
          title: meta.title || slug,
          configuredCover: coverImage,
          localExists: false,
          localSizeKB: 0,
          format: 'SIN_IMAGEN',
          isPlaceholderOrError: false,
          r2Status: null
        };

        if (coverImage) {
          // Resolver ruta local en src/assets
          let localPath = '';
          if (coverImage.startsWith('/src/assets/')) {
            localPath = path.resolve('.' + coverImage);
          } else if (coverImage.startsWith('http')) {
            // Es URL remota de R2
            const rel = coverImage.replace(R2_BASE_URL, '').replace(/^\//, '');
            localPath = path.resolve('src/assets', rel);
          } else {
            localPath = path.resolve('src/assets', coverImage.replace(/^\//, ''));
          }

          if (fs.existsSync(localPath)) {
            item.localExists = true;
            const stat = fs.statSync(localPath);
            item.localSizeKB = Math.round(stat.size / 1024);

            // Leer cabecera binaria
            const fd = fs.openSync(localPath, 'r');
            const buffer = Buffer.alloc(256);
            fs.readSync(fd, buffer, 0, 256, 0);
            fs.closeSync(fd);

            item.format = detectImageFormat(buffer);

            // Criterios inflexibles de falso positivo
            if (['HTML_ERROR_PAGE', 'SVG_PLACEHOLDER', 'EMPTY_OR_CORRUPT'].includes(item.format) || item.localSizeKB < 5) {
              item.isPlaceholderOrError = true;
            }

            // Chequeo remoto contra R2
            const relForR2 = path.relative(path.resolve('src/assets'), localPath);
            item.r2Status = await checkR2Status(relForR2);
          } else {
            // No existe localmente, pero puede existir directamente en R2
            if (coverImage.startsWith('http')) {
              const relPath = coverImage.replace(R2_BASE_URL, '').replace(/^\//, '');
              item.r2Status = await checkR2Status(relPath);
            }
          }
        }

        results.push(item);
      } catch (e) {
        console.error(`[ERROR LEYENDO ${indexPath}]:`, e.message);
      }
    }
  }

  // Visualizar resultados
  let totalAuditados = results.length;
  let validasDisco = 0;
  let falsosPositivos = 0;
  let activasEnR2 = 0;
  let pendientesR2 = 0;

  console.log(`Auditoría ejecutada sobre ${totalAuditados} artículos con portada configurada:\n`);

  for (const r of results) {
    const isOkDisk = r.localExists && !r.isPlaceholderOrError;
    const isOkR2 = r.r2Status && r.r2Status.exists;

    if (isOkDisk) validasDisco++;
    if (r.isPlaceholderOrError) falsosPositivos++;
    if (isOkR2) activasEnR2++;
    else if (isOkDisk) pendientesR2++;

    let badgeDisk = '';
    if (!r.localExists) badgeDisk = '❌ NO EXISTE LOCAL';
    else if (r.isPlaceholderOrError) badgeDisk = `🚨 FALSO POSITIVO (${r.format}, ${r.localSizeKB}KB)`;
    else badgeDisk = `✅ OK DISCO [${r.format} ${r.localSizeKB}KB]`;

    let badgeR2 = '';
    if (!r.r2Status) badgeR2 = '⚪ SIN CONSULTA R2';
    else if (r.r2Status.exists) badgeR2 = `☁️ R2 ACTIVO (${r.r2Status.statusCode})`;
    else badgeR2 = `⏳ PENDIENTE SUBIDA A R2 (${r.r2Status.statusCode})`;

    console.log(` • [${r.collection}] ${r.slug}`);
    console.log(`    ↳ Disco: ${badgeDisk}`);
    console.log(`    ↳ Nube : ${badgeR2} -> ${r.r2Status ? r.r2Status.url : 'N/A'}`);
  }

  console.log('\n─────────────────────────────────────────────────────────────────────────────');
  console.log('📊 RESUMEN FINAL DE INTEGRIDAD DE IMÁGENES:');
  console.log(`  • Artículos auditados:              ${totalAuditados}`);
  console.log(`  • Imágenes físicas HD válidas:      ${validasDisco}`);
  console.log(`  • Falsos positivos / Placeholders:  ${falsosPositivos} ${falsosPositivos === 0 ? '(✅ CERO errores)' : '(🚨 ATENCIÓN)'}`);
  console.log(`  • Sincronizadas en Cloudflare R2:   ${activasEnR2}`);
  console.log(`  • Pendientes de subida a R2:        ${pendientesR2}`);
  console.log('─────────────────────────────────────────────────────────────────────────────\n');

  if (pendientesR2 > 0) {
    console.log('💡 Para subir las imágenes locales pendientes a Cloudflare R2 ejecuta:');
    console.log('   npm run upload:assets\n');
  }
}

runAudit();
