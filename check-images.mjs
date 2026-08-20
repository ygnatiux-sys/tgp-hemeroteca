import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const contentDir = path.join(__dirname, 'src', 'content');

function findContentFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findContentFiles(filePath, fileList);
    } else if (
      filePath.endsWith('.json') ||
      filePath.endsWith('.mdoc') ||
      filePath.endsWith('.md') ||
      filePath.endsWith('.mdx')
    ) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = findContentFiles(contentDir);
let errorsFound = 0;
const brokenEntries = [];

console.log('🔍 Escaneando contenido (JSON, MDOC, MD) en busca de imágenes fantasma...\n');

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');

  // Caso 1: Archivos JSON
  if (filePath.endsWith('.json')) {
    try {
      const data = JSON.parse(content);
      if (data.coverImage && typeof data.coverImage === 'string' && data.coverImage.startsWith('/src/')) {
        const relativeImg = data.coverImage.replace(/^\//, '');
        const absoluteImagePath = path.join(__dirname, relativeImg);
        if (!fs.existsSync(absoluteImagePath)) {
          console.log(`❌ Entrada rota (JSON): ${path.relative(__dirname, filePath)}`);
          console.log(`   Imagen faltante: ${data.coverImage}\n`);
          brokenEntries.push({ file: filePath, missingImage: data.coverImage });
          errorsFound++;
        }
      }
    } catch (e) {}
    return;
  }

  // Caso 2: Frontmatter en MDOC, MD, MDX
  const match = content.match(/coverImage:\s*['"]?(\/src\/assets\/[^'"\s\n]+)/);
  if (match) {
    const imagePath = match[1];
    const relativeImg = imagePath.replace(/^\//, '');
    const absoluteImagePath = path.join(__dirname, relativeImg);

    if (!fs.existsSync(absoluteImagePath)) {
      console.log(`❌ Entrada rota (MD/MDOC): ${path.relative(__dirname, filePath)}`);
      console.log(`   Imagen faltante: ${imagePath}\n`);
      brokenEntries.push({ file: filePath, missingImage: imagePath });
      errorsFound++;
    }
  }
});

if (errorsFound === 0) {
  console.log('✅ ¡Todo perfecto! No hay imágenes fantasma.');
} else {
  console.log(`⚠️ Se encontraron ${errorsFound} entradas con enlaces a imágenes que no existen en disco.`);
  console.log('Puedes revisar la lista de arriba para corregir o purgar.');
}
