#!/usr/bin/env node
/**
 * scripts/auditar-desduplicar-perdidos.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * AUDITORÍA Y DESDUPLICACIÓN ESTRICTA DE POSTEOS PERDIDOS / DORMIDOS (TGP)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Escanea todas las páginas activas en `src/pages/` y colecciones en `src/content/`
 *    para construir el índice canónico de posts que YA TIENEN PÁGINA (publicados).
 * 2. Consulta Cloudflare D1 (`resguardo_documental` y `data_lake_vision`).
 * 3. Cruza títulos, slugs y palabras clave para filtrar sin piedad cualquier post
 *    duplicado que ya cuente con página propia (Gunung Padang, Diquís, Moais, etc.).
 * 4. Aísla y preserva ÚNICAMENTE los post que estaban REALMENTE PERDIDOS o dormidos.
 * 5. Exporta el resultado depurado a `src/data/lost-posts-curated.json` para ser
 *    consumido directamente por los visores IMAX MAX.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Cargar .env de tgp-mind o raíz
const envMind = path.resolve(ROOT_DIR, 'tgp-mind/.env');
const envRoot = path.resolve(ROOT_DIR, '.env');
if (fs.existsSync(envMind)) dotenv.config({ path: envMind });
if (fs.existsSync(envRoot)) dotenv.config({ path: envRoot });

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_D1_DB_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 1. MAPEAR TODO LO YA PUBLICADO ──────────────────────────────────────────
console.log('🔍 [Paso 1] Indexando todas las páginas y colecciones ya existentes...');

const publishedIndex = new Map(); // normalized_title -> source_path

function scanDirectory(dir, type) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      scanDirectory(fullPath, type);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name);
      const base = path.basename(ent.name, ext);
      
      // Indexar por slug de archivo o carpeta
      const parentDir = path.basename(path.dirname(fullPath));
      const slugCandidate = ext === '.astro' ? base : (parentDir !== 'src' && parentDir !== 'content' ? parentDir : base);
      
      const normSlug = normalize(slugCandidate.replace(/-/g, ' '));
      if (normSlug && normSlug.length > 3) {
        publishedIndex.set(normSlug, { path: fullPath, type });
      }

      // Si es json o frontmatter mdoc/md, leer título explícito
      if (ent.name === 'index.json' || ent.name === 'content.mdoc' || ext === '.json' || ext === '.astro') {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          let titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/i) ||
                           content.match(/title:\s*['"]([^'"]+)['"]/i) ||
                           content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          if (titleMatch && titleMatch[1]) {
            const normTitle = normalize(titleMatch[1]);
            if (normTitle && normTitle.length > 3) {
              publishedIndex.set(normTitle, { path: fullPath, type, title: titleMatch[1] });
            }
          }
        } catch {}
      }
    }
  }
}

// Escanear páginas de colecciones y páginas individuales
scanDirectory(path.resolve(ROOT_DIR, 'src/pages/colecciones'), 'page-coleccion');
scanDirectory(path.resolve(ROOT_DIR, 'src/pages/ensayos-cinematicos'), 'page-cinematico');
scanDirectory(path.resolve(ROOT_DIR, 'src/pages/misterios-del-africa'), 'page-africa');
scanDirectory(path.resolve(ROOT_DIR, 'src/pages/colecciones/america-secrets'), 'page-america');
scanDirectory(path.resolve(ROOT_DIR, 'src/pages/colecciones/asia-secrets'), 'page-asia');
scanDirectory(path.resolve(ROOT_DIR, 'src/pages/colecciones/enigmas-subterraneos'), 'page-enigmas');
scanDirectory(path.resolve(ROOT_DIR, 'src/content/ensayos-cinematicos'), 'content-cinematico');

console.log(`✅ Total de patrones ya publicados indexados: ${publishedIndex.size}`);

// Función de chequeo estricto de duplicidad
function isAlreadyPublished(candidateTitle, candidateSlug = '') {
  const normTitle = normalize(candidateTitle);
  const normSlug = normalize(candidateSlug.replace(/-/g, ' '));

  // 1. Coincidencia exacta
  if (publishedIndex.has(normTitle)) return publishedIndex.get(normTitle);
  if (publishedIndex.has(normSlug)) return publishedIndex.get(normSlug);

  // 2. Coincidencia por subcadena fuerte (ej: 'gunung padang', 'diquis', 'moai', 'gobekli tepe', 'pumapunku', 'barabar', 'derinkuyu', 'esfinge', 'nan madol')
  const criticalKeys = [
    'gunung padang', 'diquis', 'moai', 'gobekli tepe', 'pumapunku',
    'barabar', 'derinkuyu', 'esfinge', 'nan madol', 'hesiodo', 'saqqara',
    'kheper', 'oraculo de delfos', 'cnosos', 'albigenses', 'montsegur',
    'cataros', 'demeter', 'la gomera', 'bonampak', 'teogonia'
  ];

  for (const key of criticalKeys) {
    if ((normTitle.includes(key) || normSlug.includes(key))) {
      // Buscar en el índice
      for (const [indexedNorm, val] of publishedIndex.entries()) {
        if (indexedNorm.includes(key)) {
          return val;
        }
      }
    }
  }

  // 3. Similitud difusa por palabras
  const candidateWords = normTitle.split(' ').filter(w => w.length > 4);
  if (candidateWords.length >= 2) {
    for (const [indexedNorm, val] of publishedIndex.entries()) {
      let matches = 0;
      for (const w of candidateWords) {
        if (indexedNorm.includes(w)) matches++;
      }
      if (matches >= 3 || (candidateWords.length === 2 && matches === 2)) {
        return val;
      }
    }
  }

  return false;
}

// ── 2. CONSULTAR D1 Y ARCHIVOS LOCALES DORMIDOS ───────────────────────────────
async function fetchD1Records() {
  if (!CF_ACCOUNT_ID || !CF_D1_DB_ID || !CF_API_TOKEN) {
    console.warn('⚠️ Credenciales D1 incompletas en .env. Saltando consulta remota D1.');
    return [];
  }
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DB_ID}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: 'SELECT id, origen, destino, tema, texto_generado, metadatos, imagen_r2_url, fecha_creacion FROM resguardo_documental ORDER BY fecha_creacion DESC'
      })
    });
    const data = await res.json();
    return data?.result?.[0]?.results || [];
  } catch (err) {
    console.error('Error al consultar D1:', err.message);
    return [];
  }
}

// Escanear borradores o ensayos en `src/content/ensayos/` que no tengan página dedicada
function fetchLocalDormantEssays() {
  const dormant = [];
  const ensayosDir = path.resolve(ROOT_DIR, 'src/content/ensayos');
  if (!fs.existsSync(ensayosDir)) return dormant;

  const entries = fs.readdirSync(ensayosDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const itemDir = path.join(ensayosDir, ent.name);
    const indexJson = path.join(itemDir, 'index.json');
    const contentMdoc = path.join(itemDir, 'content.mdoc');

    let meta = {};
    let content = '';

    if (fs.existsSync(indexJson)) {
      try { meta = JSON.parse(fs.readFileSync(indexJson, 'utf8')); } catch {}
    }
    if (fs.existsSync(contentMdoc)) {
      try { content = fs.readFileSync(contentMdoc, 'utf8'); } catch {}
    }

    if (meta.title || content) {
      dormant.push({
        source: 'local_dormant_content',
        slug: ent.name,
        title: meta.title || ent.name.replace(/-/g, ' '),
        category: meta.category || 'Ensayo Inédito',
        date: meta.date || '2026-08-01',
        coverImage: meta.coverImage || '',
        excerpt: meta.excerpt || meta.dek || '',
        body: content,
        rawMeta: meta
      });
    }
  }
  return dormant;
}

// ── 3. EJECUCIÓN Y FILTRADO RIGUROSO ─────────────────────────────────────────
async function main() {
  console.log('\n📡 [Paso 2] Obteniendo registros de Cloudflare D1...');
  const d1Rows = await fetchD1Records();
  console.log(`✅ Registros recuperados de D1: ${d1Rows.length}`);

  console.log('\n📂 [Paso 3] Obteniendo ensayos locales no enlazados...');
  const localDormant = fetchLocalDormantEssays();
  console.log(`✅ Ensayos locales encontrados: ${localDormant.length}`);

  console.log('\n⚖️ [Paso 4] Cruzando auditoría: ¿Cuáles YA TIENEN PÁGINA vs. Cuáles están REALMENTE PERDIDOS?...\n');

  const duplicadosExcluidos = [];
  const realmentePerdidos = [];

  // Evaluar D1
  for (const row of d1Rows) {
    const rawTitle = row.tema || 'Sin título';
    // Extraer título si viene en formato markdown '# Titulo'
    const matchH1 = row.texto_generado?.match(/^#\s+(.+)$/m);
    const candidateTitle = matchH1 ? matchH1[1].trim() : rawTitle;

    const already = isAlreadyPublished(candidateTitle);
    if (already) {
      duplicadosExcluidos.push({
        item: candidateTitle,
        origen: `D1 (${row.origen})`,
        motivo: `Ya existe en: ${path.relative(ROOT_DIR, already.path)}`
      });
    } else {
      realmentePerdidos.push({
        id: row.id,
        source: 'cloudflare_d1_resguardo',
        title: candidateTitle,
        category: row.destino === 'alternative' ? 'Historia Alternativa' : 'Hemeroteca Clásica',
        date: row.fecha_creacion?.split('T')[0] || '2026-10-18',
        coverImage: row.imagen_r2_url || '/placeholder-cinematic.jpg',
        excerpt: (row.texto_generado || '').slice(0, 180).replace(/[#*`_]/g, '').trim() + '...',
        fullText: row.texto_generado,
        metadatos: row.metadatos ? JSON.parse(row.metadatos) : {}
      });
    }
  }

  // Evaluar Ensayos Locales
  for (const item of localDormant) {
    const already = isAlreadyPublished(item.title, item.slug);
    if (already) {
      duplicadosExcluidos.push({
        item: item.title,
        origen: `Local (${item.slug})`,
        motivo: `Ya existe en: ${path.relative(ROOT_DIR, already.path)}`
      });
    } else {
      realmentePerdidos.push({
        id: `local-${item.slug}`,
        source: 'local_unpublished_archive',
        slug: item.slug,
        title: item.title,
        category: item.category,
        date: item.date,
        coverImage: item.coverImage,
        excerpt: item.excerpt || (item.body || '').slice(0, 180).replace(/[#*`_]/g, '').trim() + '...',
        fullText: item.body,
        metadatos: item.rawMeta
      });
    }
  }

  // Filtrar comandos de bot, prompts técnicos o títulos vacíos
  const rawJunkPatterns = [/^\/start/i, /^flash propone/i, /^analiza esta imagen/i, /^realiza un informe/i, /^captura informe/i, /^sin t[ií]tulo/i, /^undefined/i];
  
  // Desduplicar internamente entre la lista de perdidos y filtrar basura
  const uniqueLost = [];
  const seenLost = new Set();
  for (const item of realmentePerdidos) {
    if (!item.title || item.title.trim().length < 4) continue;
    if (rawJunkPatterns.some(p => p.test(item.title))) continue;
    if (item.fullText && item.fullText.length < 150) continue; // Descartar respuestas vacías

    const norm = normalize(item.title);
    if (!seenLost.has(norm) && norm.length > 3) {
      seenLost.add(norm);
      uniqueLost.push(item);
    }
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`🚫 EXCLUIDOS PORQUE YA TIENEN PÁGINA O ARTÍCULO ACTIVO: ${duplicadosExcluidos.length}`);
  duplicadosExcluidos.slice(0, 15).forEach((d, i) => {
    console.log(`   ${i + 1}. [${d.item}] -> ${d.motivo}`);
  });
  if (duplicadosExcluidos.length > 15) {
    console.log(`   ... y ${duplicadosExcluidos.length - 15} más.`);
  }

  console.log('\n💎 REALMENTE PERDIDOS Y RESCATADOS PARA LOS VISORES IMAX MAX:');
  console.log(`   Total encontrados: ${uniqueLost.length}`);
  uniqueLost.forEach((p, i) => {
    console.log(`   ${i + 1}. [${p.title}] (${p.category}) · Img: ${p.coverImage ? 'SI' : 'NO'}`);
  });
  console.log('─────────────────────────────────────────────────────────────\n');

  // ── 4. SELECCIÓN CURADA DE LOS 2 REELS IMAX MAX (10 POSTS CADA UNO) ──────
  // Reel 1: Arqueología Lítica, Herejías & Enigmas Arcaicos
  // Reel 2: Filosofía de la Conciencia, Gnosis & Tiempo Sagrado

  const reel1Keys = [
    'lepra', 'fascinum', 'assassin', 'templar', 'imperio buevo', 'qapaq nan',
    'ishi no hoden', 'masuda no iwafune', 'atacama', 'teogonia'
  ];

  const reel2Keys = [
    'carpocracianos', 'esenios', 'nestorianos', 'cartago', 'san agustin',
    'suenos lucidos', 'silencio', 'borges y el tiempo ciclico', 'saber es recordar', 'sisifo'
  ];

  function findItem(keys) {
    for (const key of keys) {
      const match = uniqueLost.find(it => normalize(it.title).includes(key) || (it.slug && normalize(it.slug).includes(key)));
      if (match) return match;
    }
    return null;
  }

  // Mapear con fallback seguro para que siempre haya 10 en cada reel
  const finalReel1 = [];
  const finalReel2 = [];
  const usedIds = new Set();

  for (const k of reel1Keys) {
    const item = uniqueLost.find(it => !usedIds.has(it.id) && (normalize(it.title).includes(k) || (it.slug && normalize(it.slug).includes(k))));
    if (item) {
      usedIds.add(item.id);
      finalReel1.push(item);
    }
  }

  for (const k of reel2Keys) {
    const item = uniqueLost.find(it => !usedIds.has(it.id) && (normalize(it.title).includes(k) || (it.slug && normalize(it.slug).includes(k))));
    if (item) {
      usedIds.add(item.id);
      finalReel2.push(item);
    }
  }

  // Rellenar si faltara alguno hasta 10
  for (const it of uniqueLost) {
    if (finalReel1.length < 10 && !usedIds.has(it.id)) {
      usedIds.add(it.id);
      finalReel1.push(it);
    } else if (finalReel2.length < 10 && !usedIds.has(it.id)) {
      usedIds.add(it.id);
      finalReel2.push(it);
    }
  }

  // Normalizar imágenes y títulos para la presentación cinematográfica
  function formatForImax(item, reelNum, index) {
    let cleanTitle = item.title.replace(/^\[|\]$/g, '').replace(/''/g, '"').trim();
    if (cleanTitle.toLowerCase().includes('imperio buevo')) cleanTitle = 'El Imperio Nuevo Egipcio: Superpotencia y Ruptura de Aislamiento';
    if (cleanTitle.toLowerCase().includes('lepra')) cleanTitle = 'La Lepra en el Oriente Próximo: ¿Una Enfermedad Divina?';
    if (cleanTitle.toLowerCase().includes('fascinum')) cleanTitle = 'Fascinum Romano: El Conjuro Fálico contra el Mal de Ojo';
    if (cleanTitle.toLowerCase().includes('assassin')) cleanTitle = 'Los Assassins de Alamut: ¿Sociedad Iniciática o Fraude Historiográfico?';
    if (cleanTitle.toLowerCase().includes('templar')) cleanTitle = 'Los Templarios en la Historia: De la Pobreza a la Red Bancaria Sacra';
    if (cleanTitle.toLowerCase().includes('cartago')) cleanTitle = 'La Caída de Cartago: Sal en la Herida y el Destino de lo Posible';
    if (cleanTitle.toLowerCase().includes('esenios')) cleanTitle = 'Los Esenios: La Comunidad del Desierto y los Rollos de Qumrán';
    if (cleanTitle.toLowerCase().includes('atacama')) cleanTitle = 'The Atacama Mummy: La Momificación Chinchorro del Desierto Árido';

    let img = item.coverImage;
    if (!img || img === '/placeholder-cinematic.jpg') {
      if (cleanTitle.includes('Lepra')) img = 'https://storage.thegreatpuzzleproject.com/1789969923610-11d07e02.webp';
      else if (cleanTitle.includes('Fascinum')) img = 'https://storage.thegreatpuzzleproject.com/Good_Shepherd_Catacomb_of_Priscilla_Rome.jpg';
      else if (cleanTitle.includes('Assassins')) img = 'https://storage.thegreatpuzzleproject.com/vault-media/1789969923610-11d07e02.webp';
      else if (cleanTitle.includes('Templarios')) img = 'https://storage.thegreatpuzzleproject.com/Nestorian_Priests_Palm_Sunday_Khocho.jpg';
      else if (cleanTitle.includes('Imperio Nuevo')) img = 'https://storage.thegreatpuzzleproject.com/1790036463702-59643383.webp';
      else img = '/images/bg-boveda.webp';
    }

    return {
      id: item.id || `lost-${reelNum}-${index}`,
      reel: reelNum,
      index: index + 1,
      title: cleanTitle,
      category: item.category || (reelNum === 1 ? 'Arqueología & Lítica' : 'Filosofía & Conciencia'),
      coverImage: img,
      date: item.date || '2026-08-01',
      excerpt: item.excerpt || 'Exploración documental profunda recuperada del pozo del archivo.',
      fullText: item.fullText || item.body || item.excerpt,
      source: item.source
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    totalRecovered: finalReel1.length + finalReel2.length,
    reel1_arqueologia_litica: finalReel1.map((it, i) => formatForImax(it, 1, i)),
    reel2_filosofia_gnosis: finalReel2.map((it, i) => formatForImax(it, 2, i)),
    allLostRaw: uniqueLost
  };

  // Guardar archivo depurado
  const dataDir = path.resolve(ROOT_DIR, 'src/data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const targetFile = path.join(dataDir, 'lost-posts-curated.json');

  fs.writeFileSync(targetFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`💾 Archivo maestro de posts perdidos exportado con éxito en:`);
  console.log(`   ${targetFile}`);
  console.log(`\n🎞️ REEL 1 (Arqueología Lítica & Herejías): ${payload.reel1_arqueologia_litica.length} posts`);
  payload.reel1_arqueologia_litica.forEach(p => console.log(`   ${p.index}. ${p.title} · ${p.category}`));

  console.log(`\n🎞️ REEL 2 (Filosofía & Gnosis Sagrada): ${payload.reel2_filosofia_gnosis.length} posts`);
  payload.reel2_filosofia_gnosis.forEach(p => console.log(`   ${p.index}. ${p.title} · ${p.category}`));
  console.log('\n─────────────────────────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
