#!/usr/bin/env node
/**
 * scripts/asignar-wikimedia.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Busca automáticamente una imagen en Wikimedia Commons para cada post
 * sin foto y la asigna al campo bancoImagenesWikimedia del index.json.
 *
 * Uso:
 *   node scripts/asignar-wikimedia.mjs --dry-run   → solo muestra resultados
 *   node scripts/asignar-wikimedia.mjs             → escribe en index.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'src', 'content');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Colores ANSI ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', cyan: '\x1b[36m', yellow: '\x1b[33m',
  green: '\x1b[32m', red: '\x1b[31m', bold: '\x1b[1m', dim: '\x1b[2m',
};

// ── Lista de posts a procesar ─────────────────────────────────────────────────
// Formato: { collection, slug, searchQuery }
// searchQuery es la consulta ÓPTIMA para Wikimedia Commons (en inglés/español)
const TARGETS = [
  {
    collection: 'arquetipos-globales',
    slug: 'los-orixas-africanos',
    searchQuery: 'Candomblé orixás religion african brazil',
    titleHint: 'Los Orixas africanos',
  },
  {
    collection: 'arquetipos-globales',
    slug: 'la-torre-de-babel',
    searchQuery: 'Tower of Babel Brueghel painting',
    titleHint: 'La Torre de Babel',
  },
  {
    collection: 'arquetipos-globales',
    slug: 'urano',
    searchQuery: 'Uranus planet astronomy mythology',
    titleHint: 'Urano — Planeta y Arquetipo',
  },
  {
    collection: 'ensayos',
    slug: 'los-esenios-mgzn',
    searchQuery: 'Dead Sea Scrolls Qumran caves manuscripts',
    titleHint: 'Los Esenios — Manuscritos del Mar Muerto',
  },
  {
    collection: 'georreferencias',
    slug: 'santuario-de-ballenas-peninsula-de-valdez-patagonia',
    searchQuery: 'Peninsula Valdes whales patagonia argentina',
    titleHint: 'Santuario de Ballenas, Patagonia',
  },
  {
    collection: 'georreferencias',
    slug: 'meroe-la-dinastia-egipcia-nubia',
    searchQuery: 'Meroe pyramids Sudan Nubia ancient',
    titleHint: 'Meroe — Dinastía Nubia',
  },
  {
    collection: 'georreferencias',
    slug: 'ellora-caves',
    searchQuery: 'Ellora caves Kailasa temple India rock carved',
    titleHint: 'Ellora Caves — Kailasa Temple',
  },
  {
    collection: 'georreferencias',
    slug: 'piramide-romana-de-cestia',
    searchQuery: 'Pyramid of Cestius Rome ancient',
    titleHint: 'Pirámide Romana de Cestia',
  },
  {
    collection: 'georreferencias',
    slug: 'isla-de-los-estados-en-tierra-del-fuego',
    searchQuery: 'Isla de los Estados Staten Island Argentina Tierra del Fuego',
    titleHint: 'Isla de los Estados, Tierra del Fuego',
  },
  {
    collection: 'georreferencias',
    slug: 'valle-de-la-luna',
    searchQuery: 'Valle de la Luna San Juan Argentina Ischigualasto',
    titleHint: 'Valle de la Luna — Ischigualasto',
  },
];

// ── HTTP helper ───────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'TGP-Hemeroteca/1.0 (editorial@thegreatpuzzleproject.com)' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

// ── Buscar en Wikimedia Commons ───────────────────────────────────────────────
async function searchWikimedia(query, limit = 5) {
  const encoded = encodeURIComponent(query);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srnamespace=6&srlimit=${limit}&srinfo=&srprop=snippet&format=json`;
  
  try {
    const data = await fetchJson(url);
    const results = data?.query?.search || [];
    return results.map(r => ({
      title: r.title,
      pageid: r.pageid,
    }));
  } catch (e) {
    return [];
  }
}

// ── Obtener URL de imagen de una página de Commons ───────────────────────────
async function getImageUrl(pageTitle) {
  const encoded = encodeURIComponent(pageTitle);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encoded}&prop=imageinfo&iiprop=url|thumburl|mime|size&iiurlwidth=1200&format=json`;
  
  try {
    const data = await fetchJson(url);
    const pages = data?.query?.pages || {};
    const page  = Object.values(pages)[0];
    const info  = page?.imageinfo?.[0];
    if (!info) return null;
    
    // Solo imágenes (no vídeos, no svg solo si no hay otra opción)
    if (info.mime && !info.mime.startsWith('image/')) return null;
    
    return {
      url: info.url,
      thumbUrl: info.thumburl || info.url,
      width: info.width,
      height: info.height,
      mime: info.mime,
    };
  } catch (e) {
    return null;
  }
}

// ── Construir objeto bancoImagenesWikimedia ───────────────────────────────────
function buildWikimediaBank(imageInfo, pageTitle, titleHint) {
  const item = {
    id: pageTitle.replace('File:', '').replace(/\s+/g, '_'),
    url: imageInfo.url,
    thumbUrl: imageInfo.thumbUrl,
    title: pageTitle.replace('File:', '').replace(/_/g, ' '),
    caption: titleHint,
    author: 'Wikimedia Commons',
    license: 'Dominio Público / Licencia Libre',
    width: imageInfo.width,
    height: imageInfo.height,
    aspectRatio: imageInfo.width && imageInfo.height
      ? Math.round((imageInfo.width / imageInfo.height) * 100) / 100
      : 1.78,
    role: 'HERO',
  };

  return JSON.stringify({
    selectedItems: [item],
  });
}

// ── Leer / escribir index.json ────────────────────────────────────────────────
function readJson(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return null; }
}

function writeJson(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const hr = (c = '─', n = 72) => C.dim + c.repeat(n) + C.reset;

console.log('\n' + hr('═'));
console.log(`${C.bold}  📸 TGP — ASIGNACIÓN AUTOMÁTICA WIKIMEDIA${DRY_RUN ? ' [DRY RUN]' : ''}${C.reset}`);
console.log(hr('═') + '\n');

if (DRY_RUN) {
  console.log(`${C.yellow}  ⚠️  MODO PREVIEW — No se escribirá nada.${C.reset}\n`);
}

let ok = 0, failed = 0;

for (const target of TARGETS) {
  const { collection, slug, searchQuery, titleHint } = target;
  const jsonPath = path.join(CONTENT, collection, slug, 'index.json');

  process.stdout.write(`  🔍 ${titleHint.padEnd(45)} `);

  if (!fs.existsSync(jsonPath)) {
    console.log(`${C.red}[NO ENCONTRADO]${C.reset}`);
    failed++;
    continue;
  }

  // Buscar en Wikimedia
  const results = await searchWikimedia(searchQuery, 8);

  // Filtrar para quedarnos con imágenes (evitar categorías u otras páginas)
  const imgResults = results.filter(r =>
    r.title.startsWith('File:') &&
    !/\.svg$/i.test(r.title) &&
    !/\.ogg$/i.test(r.title) &&
    !/\.ogv$/i.test(r.title) &&
    !/\.webm$/i.test(r.title)
  );

  if (imgResults.length === 0) {
    console.log(`${C.yellow}[SIN RESULTADOS]${C.reset}`);
    failed++;
    continue;
  }

  // Tomar el primer resultado con URL válida
  let imageInfo = null;
  let chosenTitle = '';
  for (const r of imgResults) {
    imageInfo = await getImageUrl(r.title);
    if (imageInfo?.url) {
      chosenTitle = r.title;
      break;
    }
  }

  if (!imageInfo?.url) {
    console.log(`${C.yellow}[SIN URL]${C.reset}`);
    failed++;
    continue;
  }

  const bankJson = buildWikimediaBank(imageInfo, chosenTitle, titleHint);

  if (DRY_RUN) {
    console.log(`${C.green}[OK]${C.reset} ${C.dim}→ ${chosenTitle.slice(0, 50)}${C.reset}`);
    console.log(`      ${C.dim}URL: ${imageInfo.thumbUrl?.slice(0, 80)}...${C.reset}`);
    ok++;
    continue;
  }

  // Escribir en index.json
  const currentJson = readJson(jsonPath);
  if (!currentJson) {
    console.log(`${C.red}[ERROR LECTURA]${C.reset}`);
    failed++;
    continue;
  }

  currentJson.bancoImagenesWikimedia = bankJson;
  writeJson(jsonPath, currentJson);
  console.log(`${C.green}[ASIGNADO]${C.reset} ${C.dim}→ ${chosenTitle.slice(0, 50)}${C.reset}`);
  ok++;
}

console.log('\n' + hr('═'));
console.log(`\n  ${C.green}✅ Asignados: ${ok}${C.reset}   ${C.red}❌ Fallidos: ${failed}${C.reset}`);
if (!DRY_RUN && ok > 0) {
  console.log(`\n  ${C.cyan}Ejecuta 'node scripts/analisis-distribucion.mjs' para verificar el impacto.${C.reset}`);
}
console.log('\n' + hr('═') + '\n');
