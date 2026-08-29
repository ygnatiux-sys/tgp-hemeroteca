/**
 * scripts/limpiar-urls-contenido.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Script recursivo para limpiar y normalizar URLs de Cloudflare R2 en el contenido
 * (src/content/), resolviendo problemas de doble o múltiple codificación
 * (%252C -> %2C -> ,, %2528 -> (, %2529 -> ), etc.).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENT_DIR = path.resolve(__dirname, '../src/content');

const R2_PREFIX = 'https://storage.thegreatpuzzleproject.com/';
const URL_REGEX = /https:\/\/storage\.thegreatpuzzleproject\.com\/([^\s"'\\\)\]<>]+)/g;

let totalFilesScanned = 0;
let modifiedFilesCount = 0;
let totalUrlsFixed = 0;

/**
 * Decodifica recursivamente una cadena hasta que no queden secuencias %XX de doble codificación.
 */
function cleanUrlPath(encodedPath) {
  let current = encodedPath;
  let iterations = 0;
  
  while (iterations < 5) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
      iterations++;
    } catch (_e) {
      break;
    }
  }

  return current;
}

/**
 * Escanea recursivamente un directorio en busca de archivos .json, .md, .mdoc, .mdx
 */
function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else if (/\.(json|md|mdoc|mdx)$/i.test(file)) {
      results.push(filePath);
    }
  }

  return results;
}

function processFile(filePath) {
  totalFilesScanned++;
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  let fileUrlsFixed = 0;

  const newContent = rawContent.replace(URL_REGEX, (fullUrl, pathPart) => {
    // Si contiene secuencias codificadas como %25, %2C, %28, %29, %C3, etc.
    if (/%[0-9A-Fa-f]{2}/.test(pathPart)) {
      const cleaned = cleanUrlPath(pathPart);
      if (cleaned !== pathPart) {
        fileUrlsFixed++;
        return `${R2_PREFIX}${cleaned}`;
      }
    }
    return fullUrl;
  });

  if (fileUrlsFixed > 0 && newContent !== rawContent) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    modifiedFilesCount++;
    totalUrlsFixed += fileUrlsFixed;
    const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
    console.log(`✔ [Modificado] ${relPath} (${fileUrlsFixed} URL${fileUrlsFixed > 1 ? 's' : ''} corregida${fileUrlsFixed > 1 ? 's' : ''})`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('  🧹 TGP — LIMPIEZA DE URLs DE IMÁGENES EN CONTENIDO');
  console.log('======================================================');
  console.log(`• Directorio:   ${CONTENT_DIR}`);
  console.log(`• Prefijo R2:   ${R2_PREFIX}\n`);

  const files = getFilesRecursively(CONTENT_DIR);
  console.log(`📡 Archivos de contenido detectados: ${files.length}\n`);

  for (const filePath of files) {
    processFile(filePath);
  }

  console.log('\n======================================================');
  console.log('  📊 RESUMEN DE LA LIMPIEZA');
  console.log('======================================================');
  console.log(`• Archivos analizados:    ${totalFilesScanned}`);
  console.log(`• Archivos corregidos:    ${modifiedFilesCount}`);
  console.log(`• Total URLs limpiadas:   ${totalUrlsFixed}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('❌ Error ejecutando la limpieza:', err);
  process.exit(1);
});
