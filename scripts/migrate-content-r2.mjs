import fs from 'fs';
import path from 'path';

const CONTENT_DIR = path.resolve('src/content');
const R2_BASE = 'https://storage.thegreatpuzzleproject.com/';

function extractFilename(url) {
  try {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.split('?')[0];
    
    // Thumbnail pattern: /wikipedia/commons/thumb/x/xx/filename.ext/123px-filename.ext
    const thumbMatch = cleanUrl.match(/\/wikipedia\/commons\/thumb\/[^/]+\/[^/]+\/([^/]+)\/[^/]+$/i);
    if (thumbMatch) {
      return thumbMatch[1];
    }
    
    // Direct pattern: /wikipedia/commons/x/xx/filename.ext
    const directMatch = cleanUrl.match(/\/wikipedia\/commons\/[^/]+\/[^/]+\/([^/]+)$/i);
    if (directMatch) {
      return directMatch[1];
    }
    
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1];
  } catch (e) {
    return null;
  }
}

function migrateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  if (!rawUrl.includes('upload.wikimedia.org')) return rawUrl;
  const filename = extractFilename(rawUrl);
  if (!filename) return rawUrl;
  return `${R2_BASE}${filename}`;
}

let modifiedFiles = [];
let totalMigrated = 0;

function transformValue(val) {
  if (typeof val === 'string') {
    // If it's a nested JSON string (like bancoImagenesWikimedia)
    if (val.trim().startsWith('{') || val.trim().startsWith('[')) {
      try {
        const nested = JSON.parse(val);
        const transformedNested = transformValue(nested);
        return JSON.stringify(transformedNested, null, 2);
      } catch (e) {
        // Not a JSON string, process as normal string
      }
    }
    
    if (val.includes('upload.wikimedia.org')) {
      totalMigrated++;
      return migrateUrl(val);
    }
    return val;
  }
  
  if (Array.isArray(val)) {
    return val.map(item => transformValue(item));
  }
  
  if (val !== null && typeof val === 'object') {
    const res = {};
    for (const key of Object.keys(val)) {
      res[key] = transformValue(val[key]);
    }
    return res;
  }
  
  return val;
}

function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (raw.includes('upload.wikimedia.org')) {
      const data = JSON.parse(raw);
      const prevCount = totalMigrated;
      const transformed = transformValue(data);
      const diff = totalMigrated - prevCount;
      if (diff > 0) {
        fs.writeFileSync(filePath, JSON.stringify(transformed, null, 2) + '\n', 'utf8');
        modifiedFiles.push({ file: path.relative(process.cwd(), filePath), count: diff });
      }
    }
  } else if (ext === '.md' || ext === '.mdx') {
    let raw = fs.readFileSync(filePath, 'utf8');
    if (raw.includes('upload.wikimedia.org')) {
      let count = 0;
      const updated = raw.replace(/https:\/\/upload\.wikimedia\.org\/[^\s"')\]]+/g, (match) => {
        count++;
        totalMigrated++;
        return migrateUrl(match);
      });
      if (count > 0) {
        fs.writeFileSync(filePath, updated, 'utf8');
        modifiedFiles.push({ file: path.relative(process.cwd(), filePath), count });
      }
    }
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile()) {
      processFile(fullPath);
    }
  }
}

walkDir(CONTENT_DIR);

console.log(`\n======================================================`);
console.log(`  MIGRACIÓN EXCLUSIVA DE SRC/CONTENT/ A CLOUDFLARE R2`);
console.log(`======================================================`);
console.log(`Total de archivos de contenido modificados: ${modifiedFiles.length}`);
console.log(`Total de URLs de imágenes migradas: ${totalMigrated}\n`);

modifiedFiles.forEach(({ file, count }) => {
  console.log(`  ✓ [MIGRADO] ${file} (${count} URLs)`);
});
