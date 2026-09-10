/**
 * scripts/optimizar-remotas.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Rastreador y Optimizador Automático de Imágenes Externas (TGP Proxy Local)
 * 
 * Funcionalidad:
 * 1. Escanea todos los archivos (.astro, .ts, .js, .md, .mdx, .json) en src/.
 * 2. Detecta URLs externas de imágenes (por ejemplo, Wikimedia Commons).
 * 3. Las descarga automáticamente.
 * 4. Las convierte a WebP optimizado con Sharp (máximo 1920px, calidad 80).
 * 5. Las guarda en src/assets/remotas/ (u otro directorio local).
 * 6. Actualiza el código fuente para reemplazar la URL externa por la local
 *    (ej: /src/assets/remotas/imagen.webp), la cual luego será resuelta a R2
 *    por content-filter.ts y subida automáticamente en npm run sync.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const ASSETS_REMOTE_DIR = path.resolve('src/assets/remotas');
const DIRS_TO_SCAN = [
  path.resolve('src/pages'),
  path.resolve('src/components'),
  path.resolve('src/content'),
  path.resolve('src/layouts'),
  path.resolve('src/config'),
  path.resolve('src/lib')
];

// Regex para detectar URLs de imágenes externas que queremos capturar.
// Por ahora configurado para Wikimedia Commons, pero puede expandirse.
// Excluimos \s " ' ` y \\ para no romper escapes en archivos JSON.
const URL_REGEX = /https:\/\/upload\.wikimedia\.org\/[^\s"'`\\]+/g;

// Extensiones de archivos a escanear
const ALLOWED_EXTS = /\.(astro|md|mdx|json|ts|js|tsx|jsx)$/;

// ── INICIALIZACIÓN ───────────────────────────────────────────────────────────
if (!fs.existsSync(ASSETS_REMOTE_DIR)) {
  fs.mkdirSync(ASSETS_REMOTE_DIR, { recursive: true });
}

// ── UTILIDADES ───────────────────────────────────────────────────────────────
function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

function getCleanFilename(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    let last = parts[parts.length - 1];
    last = decodeURIComponent(last);
    last = last.replace(/^\d+px-/, ''); // Ej: 2560px-Archivo.jpg -> Archivo.jpg
    last = last.replace(/\.[a-zA-Z0-9]+$/, ''); // Quitar extensión
    last = last.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Si quedó muy corto o vacío, usar un hash
    if (last.length < 3) throw new Error('Nombre muy corto');
    
    // Limitar longitud para evitar problemas en el sistema de archivos
    if (last.length > 50) last = last.substring(0, 50);
    
    return last + '.webp';
  } catch (e) {
    return 'img-' + crypto.createHash('md5').update(url).digest('hex').substring(0, 8) + '.webp';
  }
}

async function processUrl(url) {
  const filename = getCleanFilename(url);
  const destPath = path.join(ASSETS_REMOTE_DIR, filename);
  // Ruta que Astro y content-filter resolverán para subir a R2:
  const localAssetUrl = `/src/assets/remotas/${filename}`; 

  if (fs.existsSync(destPath)) {
    // Ya fue descargada y procesada previamente
    return localAssetUrl;
  }

  console.log(`\n📥 Descargando: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`✨ Optimizando a WebP: ${filename}`);
    await sharp(buffer)
      .resize({ width: 1920, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 80, effort: 4 })
      .toFile(destPath);
      
    return localAssetUrl;
  } catch (error) {
    console.error(`❌ Error procesando ${url}:`, error.message);
    return null;
  }
}

// ── BUCLE PRINCIPAL ──────────────────────────────────────────────────────────
async function main() {
  console.log('======================================================');
  console.log('  🌐 TGP - AUTO-OPTIMIZADOR DE IMÁGENES EXTERNAS');
  console.log('======================================================');

  let filesToScan = [];
  DIRS_TO_SCAN.forEach(dir => {
    walkDir(dir, (filePath) => {
      if (ALLOWED_EXTS.test(filePath)) {
        filesToScan.push(filePath);
      }
    });
  });

  let totalReplaced = 0;
  let filesModified = 0;

  for (const filePath of filesToScan) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(URL_REGEX);
    
    if (matches && matches.length > 0) {
      let changed = false;
      
      // Procesar URLs únicas para no descargar repetidas veces en el mismo archivo
      const uniqueUrls = [...new Set(matches)];
      
      for (const url of uniqueUrls) {
        const localUrl = await processUrl(url);
        
        if (localUrl && localUrl !== url) {
          // Reemplazar todas las ocurrencias de esta URL en el archivo
          // Escapamos la URL para poder usarla en RegExp
          const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const replaceRegex = new RegExp(escapedUrl, 'g');
          
          content = content.replace(replaceRegex, localUrl);
          changed = true;
          totalReplaced++;
        }
      }
      
      if (changed) {
        fs.writeFileSync(filePath, content, 'utf-8');
        filesModified++;
        console.log(`📝 Actualizado código en: ${path.relative(process.cwd(), filePath)}`);
      }
    }
  }

  console.log('\n======================================================');
  console.log(`  ✅ Proceso finalizado.`);
  console.log(`  • URLs externas convertidas a WebP: ${totalReplaced}`);
  console.log(`  • Archivos de código actualizados:  ${filesModified}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
