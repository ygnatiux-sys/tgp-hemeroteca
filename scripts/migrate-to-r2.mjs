import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve('src');
const R2_BASE = 'https://storage.thegreatpuzzleproject.com/';

function extractFilename(url) {
  try {
    // Remove query params
    const cleanUrl = url.split('?')[0];
    
    // Check if it is a thumbnail: /wikipedia/commons/thumb/a/ab/Original_Name.jpg/960px-Original_Name.jpg
    const thumbMatch = cleanUrl.match(/\/wikipedia\/commons\/thumb\/[^/]+\/[^/]+\/([^/]+)\/[^/]+$/);
    if (thumbMatch) {
      return thumbMatch[1];
    }
    
    // Check if it is direct: /wikipedia/commons/a/ab/Original_Name.jpg
    const directMatch = cleanUrl.match(/\/wikipedia\/commons\/[^/]+\/[^/]+\/([^/]+)$/);
    if (directMatch) {
      return directMatch[1];
    }
    
    // Fallback: take the last segment
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1];
  } catch (e) {
    return null;
  }
}

function processContent(content) {
  let count = 0;
  // Match any https://upload.wikimedia.org/... string until quotes, whitespace, or end of string
  const regex = /https:\/\/upload\.wikimedia\.org\/[^\s"',\\}]+/g;
  
  const updated = content.replace(regex, (match) => {
    const filename = extractFilename(match);
    if (filename) {
      count++;
      return `${R2_BASE}${filename}`;
    }
    return match;
  });
  
  return { updated, count };
}

const modifiedFiles = [];
let totalReplacements = 0;

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && /\.(json|md|mdoc|mdx|astro|ts|tsx|js|mjs)$/.test(entry.name)) {
      const original = fs.readFileSync(fullPath, 'utf8');
      if (original.includes('upload.wikimedia.org')) {
        const { updated, count } = processContent(original);
        if (count > 0 && updated !== original) {
          fs.writeFileSync(fullPath, updated, 'utf8');
          modifiedFiles.push({ file: path.relative(process.cwd(), fullPath), replacements: count });
          totalReplacements += count;
        }
      }
    }
  }
}

walkDir(SRC_DIR);

console.log(`\n=== REPORTE DE MIGRACIÓN A CLOUDFLARE R2 ===`);
console.log(`Total de archivos modificados: ${modifiedFiles.length}`);
console.log(`Total de URLs migradas a R2: ${totalReplacements}\n`);
modifiedFiles.forEach(({ file, replacements }) => {
  console.log(`  ✓ ${file} (${replacements} URLs migradas)`);
});
