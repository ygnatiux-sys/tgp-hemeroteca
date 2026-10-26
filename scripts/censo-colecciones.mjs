#!/usr/bin/env node
/**
 * scripts/censo-colecciones.mjs
 * 
 * TGP Hemeroteca — Censo Cartográfico de Colecciones y Rutas Canónicas
 * Mapea exhaustivamente todas las colecciones de contenido (src/content/),
 * sus posts hijos y genera las URLs exactas y clickeables para dev y producción.
 * 
 * Uso:
 *   node scripts/censo-colecciones.mjs
 *   npm run censo
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');
const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

// Mapeo determinista de colecciones a sus rutas activas en Astro
function resolveCanonicalUrl(collection, slug) {
  switch (collection) {
    case 'ensayos':
      return `${BASE_URL}/hemeroteca/${slug}/`;
    case 'ensayos-cinematicos':
      return `${BASE_URL}/ensayos-cinematicos/${slug}/`;
    case 'notas':
      return `${BASE_URL}/notas/${slug}/`;
    case 'arquetipos-globales':
      return `${BASE_URL}/colecciones/arquetipos/${slug}/`;
    case 'georreferencias':
      return `${BASE_URL}/colecciones/georreferencias/${slug}/`;
    default:
      return `${BASE_URL}/${collection}/${slug}/`;
  }
}

if (!fs.existsSync(CONTENT_DIR)) {
  console.error(`❌ No se encontró el directorio de contenidos en ${CONTENT_DIR}`);
  process.exit(1);
}

console.log(`\n${C.bold}${C.cyan}╔═════════════════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}${C.cyan}║   🗺️  TGP HEMEROTECA — CENSO DE COLECCIONES Y RUTAS CANÓNICAS   ║${C.reset}`);
console.log(`${C.bold}${C.cyan}╚═════════════════════════════════════════════════════════════════╝${C.reset}`);
console.log(`${C.dim}Directorio base: ${ROOT_DIR}${C.reset}`);
console.log(`${C.dim}Servidor local:  ${BASE_URL}${C.reset}\n`);

const collections = fs
  .readdirSync(CONTENT_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

let totalPosts = 0;
const summary = [];

for (const col of collections) {
  const colPath = path.join(CONTENT_DIR, col);
  const items = fs.readdirSync(colPath, { withFileTypes: true });
  const posts = [];

  for (const item of items) {
    let slug = '';
    let title = '';
    let cover = '';
    let isDraft = false;

    if (item.isDirectory()) {
      slug = item.name;
      const jsonPath = path.join(colPath, item.name, 'index.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          title = d.title || slug;
          cover = d.coverImage || '';
          isDraft = !!d.draft;
        } catch {
          title = slug;
        }
      } else {
        title = slug;
      }
      posts.push({ slug, title, cover, isDraft, isDir: true });
    } else if (item.isFile() && /\.(md|mdx|mdoc)$/i.test(item.name)) {
      slug = item.name.replace(/\.[^/.]+$/, '');
      const filePath = path.join(colPath, item.name);
      const raw = fs.readFileSync(filePath, 'utf8');
      const titleMatch = raw.match(/title:\s*['"]?([^'"\n\r]+)/);
      title = titleMatch ? titleMatch[1] : slug;
      posts.push({ slug, title, cover: '', isDraft: false, isDir: false });
    }
  }

  totalPosts += posts.length;
  summary.push({ name: col, count: posts.length });

  console.log(`${C.bold}${C.yellow}📁 [Colección] ${col.toUpperCase()}${C.reset} ${C.dim}(${posts.length} entradas)${C.reset}`);
  
  // Mostrar los primeros 5 como muestra en terminal
  const displaySample = posts.slice(0, 4);
  for (const p of displaySample) {
    const canonicalUrl = resolveCanonicalUrl(col, p.slug);
    const draftBadge = p.isDraft ? ` ${C.magenta}[BORRADOR]${C.reset}` : '';
    console.log(`   ├── ${C.bold}${p.title}${C.reset}${draftBadge}`);
    console.log(`   │   🔗 ${C.cyan}${canonicalUrl}${C.reset}`);
  }
  if (posts.length > 4) {
    console.log(`   └── ${C.dim}... y ${posts.length - 4} posts más en esta colección.${C.reset}`);
  }
  console.log('');
}

console.log(`${C.bold}═════════════════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}📊 BALANCE TOTAL DEL CENSO:${C.reset}`);
for (const s of summary) {
  console.log(` • ${s.name.padEnd(25)} : ${C.green}${C.bold}${s.count}${C.reset} entradas`);
}
console.log(`\n🌟 Total General: ${C.bold}${C.green}${totalPosts} posts activos${C.reset} mapeados en ${collections.length} colecciones.\n`);

// Hubs de Navegación Globales
console.log(`${C.bold}🌐 HUBS DE NAVEGACIÓN GENERALES:${C.reset}`);
console.log(` • 🏛️ Portada Principal:   ${C.cyan}${BASE_URL}/${C.reset}`);
console.log(` • 📚 Hemeroteca Archivo: ${C.cyan}${BASE_URL}/archivo/${C.reset}`);
console.log(` • 🗂️ Colecciones Hub:    ${C.cyan}${BASE_URL}/colecciones/${C.reset}`);
console.log(` • ⚙️  Editor Keystatic:   ${C.cyan}${BASE_URL}/keystatic/${C.reset}\n`);
