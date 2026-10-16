import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const ensayosDir = path.join(ROOT_DIR, 'src', 'content', 'ensayos');
const folders = fs.readdirSync(ensayosDir);

const all = [];
folders.forEach(f => {
  const p = path.join(ensayosDir, f, 'index.json');
  if (fs.existsSync(p)) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      all.push({
        slug: f,
        title: data.title || f,
        category: data.category || 'Sin categoría',
        sitio: data.sitioGeohistorico || '',
        coverImage: data.coverImage || ''
      });
    } catch (e) {}
  }
});

console.log(`TOTAL ENSAYOS ENCONTRADOS: ${all.length}\n`);

all.forEach((item, idx) => {
  console.log(`${idx + 1}. [${item.slug}]`);
  console.log(`   Título: ${item.title}`);
  console.log(`   Categoría: ${item.category} | Sitio: ${item.sitio}`);
  console.log(`   Cover: ${item.coverImage ? 'Sí' : 'No'}\n`);
});
