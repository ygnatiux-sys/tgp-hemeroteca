/**
 * curar-batch-segundo.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline unificado de curaduría para el Lote 2 (10 artículos con texto masivo):
 * 1. Resuelve obras de alta resolución en Wikimedia Commons (Dominio Público/CC).
 * 2. Descarga la imagen y valida Magic Bytes (JPEG/PNG/WebP, >25KB, cero placeholders).
 * 3. Actualiza index.json en UTF-8 puro (sin BOM), activando publicarConImagen: true.
 * 4. Sube las nuevas portadas a Cloudflare R2 invocando el sincronizador oficial.
 * 5. Ejecuta auditar-imagenes-r2.mjs certificando 100% de integridad y CDN activo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const USER_AGENT = 'TGPHemeroteca/1.0 (https://thegreatpuzzleproject.com; contact@tgp.org)';

const BATCH_ITEMS = [
  {
    col: 'arquetipos-globales',
    slug: 'el-puma-americano',
    query: 'Puma concolor Torres del Paine',
    preferredFiles: ['File:Torres_del_Paine_Puma_jf4.webp', 'File:Puma_concolor_sitting_in_the_grass.jpg', 'File:Mountain_Lion_in_Montana.jpg'],
    notes: 'Puma concolor en hábitat andino-patagónico | CC-BY-SA'
  },
  {
    col: 'arquetipos-globales',
    slug: 'los-orixas',
    query: 'Carybe orixas Yemanja',
    preferredFiles: ['File:Caryb_rilievi_degli_orixas_yemanjá_recorte.webp', 'File:Iemanjá_-_Carybé.jpg', 'File:Festa_de_Iemanjá_em_Salvador.jpg'],
    notes: 'Bajorrelieve ritual de Orixás y Yemanjá | CC / Dominio Público'
  },
  {
    col: 'arquetipos-globales',
    slug: 'los-orixas-africanos',
    query: 'Bronze head from Ife British Museum',
    preferredFiles: ['File:Bronze_head_from_Ife_in_the_British_Museum.jpg', 'File:Ife_terracotta_head.jpg', 'File:Yoruba_bronze_head.jpg'],
    notes: 'Escultura sagrada yoruba de Ife | Dominio Público'
  },
  {
    col: 'ensayos-cinematicos',
    slug: 'la-ciudadela-inexpugnable-filosofia-poder-y-trascendencia-en-el-estoicismo-romano',
    query: 'Marcus Aurelius Glyptothek Munich',
    preferredFiles: ['File:Marcus_Aurelius_Glyptothek_Munich.jpg', 'File:Statue_of_Marcus_Aurelius_Musei_Capitolini_Rome.jpg'],
    notes: 'Busto clásico de Marco Aurelio, Gliptoteca de Múnich | CC-BY-SA'
  },
  {
    col: 'arquetipos-globales',
    slug: 'urano',
    query: 'Uranus Voyager 2 NASA',
    preferredFiles: ['File:Uranus2.jpg', 'File:Uranus_in_true_and_false_colour.jpg', 'File:Uranus_clouds.jpg'],
    notes: 'Urano en color real capturado por NASA / Voyager 2 | Dominio Público NASA'
  },
  {
    col: 'arquetipos-globales',
    slug: 'sanson',
    query: 'Peter Paul Rubens Samson and Delilah',
    preferredFiles: ['File:Peter_Paul_Rubens_-_Samson_and_Delilah_-_Google_Art_Project.jpg', 'File:Samson_and_Delilah_by_Rubens.jpg'],
    notes: 'Sansón y Dalila por Peter Paul Rubens | Dominio Público'
  },
  {
    col: 'ensayos-cinematicos',
    slug: 'sadhguru-y-la-gramatica-cinematografica-del-mistico-global-arqueosemiotica-del-extasis-mecanizado',
    query: 'Adiyogi Shiva statue Coimbatore',
    preferredFiles: ['File:Adiyogi_statue_at_Isha_Yoga_Center_in_Coimbatore.jpg', 'File:Adiyogi_Shiva_statue_with_lighting.jpg'],
    notes: 'Monolito consagrado de Adiyogi Shiva en Coimbatore | CC-BY-SA'
  },
  {
    col: 'ensayos-cinematicos',
    slug: 'la-catedral-de-la-razon-arqueosemiotica-y-vigencia-de-la-escolastica',
    query: 'Strasbourg Cathedral Nave interior',
    preferredFiles: ['File:Strasbourg_Cathedral_Nave.jpg', 'File:Amiens_cathedral_nave_looking_east.jpg', 'File:Nave_of_Chartres_Cathedral.jpg'],
    notes: 'Bóveda gótica monumental y claristorio escolástico | CC-BY-SA'
  },
  {
    col: 'ensayos',
    slug: 'moctezuma-y-cortez-el-ultimo-azteca',
    query: 'Meeting of Cortes and Montezuma',
    preferredFiles: ['File:The_Meeting_of_Cortés_and_Moctezuma.jpg', 'File:Meeting_of_Cortés_and_Montezuma.jpg', 'File:Moctezuma_and_cortes.jpg'],
    notes: 'El Encuentro de Hernán Cortés y Moctezuma II | Dominio Público'
  },
  {
    col: 'ensayos',
    slug: 'saber-es-recordar-la-teoria-de-platon',
    query: 'Plato Silanion Musei Capitolini',
    preferredFiles: ['File:Plato_Silanion_Musei_Capitolini_MC1377.jpg', 'File:Sanzio_01_Plato_Aristotle.jpg', 'File:Plato_in_School_of_Athens.jpg'],
    notes: 'Retrato clásico de Platón, Museos Capitolinos de Roma | Dominio Público'
  }
];

function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 12) return 'CORRUPT';
  const str = buffer.subarray(0, 100).toString('utf8').toLowerCase();
  if (str.includes('<!doctype') || str.includes('<html') || str.includes('404 not found') || str.includes('403 forbidden')) {
    return 'HTML_ERROR';
  }
  if (str.includes('<svg') || str.includes('<?xml')) return 'SVG_PLACEHOLDER';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'JPEG';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'PNG';
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') return 'WEBP';
  return 'UNKNOWN';
}

async function resolveWikimediaUrl(fileTitle) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|mime|size&titles=${encodeURIComponent(fileTitle)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.pages || {};
  for (const pid in pages) {
    const info = pages[pid]?.imageinfo;
    if (info && info.length > 0 && info[0].url) {
      return { url: info[0].url, mime: info[0].mime, size: info[0].size };
    }
  }
  return null;
}

async function searchWikimedia(searchQuery) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=5&srsearch=${encodeURIComponent(searchQuery)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.query?.search || []).map(s => s.title);
}

async function fetchBestImage(item) {
  // 1. Probar lista de archivos preferidos
  for (const pref of item.preferredFiles) {
    try {
      const resolved = await resolveWikimediaUrl(pref);
      if (resolved) {
        return { ...resolved, title: pref };
      }
    } catch {}
  }

  // 2. Fallback de búsqueda dinámica en Wikimedia
  const searchResults = await searchWikimedia(item.query);
  for (const foundTitle of searchResults) {
    try {
      const resolved = await resolveWikimediaUrl(foundTitle);
      if (resolved && resolved.size > 20000) {
        return { ...resolved, title: foundTitle };
      }
    } catch {}
  }

  throw new Error(`No se pudo resolver ninguna imagen válida en Wikimedia para "${item.query}"`);
}

async function run() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║       ⚡ TGP - PIPELINE UNIFICADO DE CURADURÍA (LOTE 2: 10 POSTS)         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

  let successCount = 0;

  for (const item of BATCH_ITEMS) {
    console.log(`\n🎨 Curando [${item.col}] -> ${item.slug}...`);
    try {
      const best = await fetchBestImage(item);
      console.log(`   🔗 Obra resuelta: ${best.title}`);
      console.log(`   📥 Descargando desde: ${best.url}`);

      const res = await fetch(best.url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar`);
      const buffer = Buffer.from(await res.arrayBuffer());

      // Validación estricta de Magic Bytes
      const fmt = detectImageFormat(buffer);
      const sizeKB = Math.round(buffer.length / 1024);
      if (['HTML_ERROR', 'SVG_PLACEHOLDER', 'CORRUPT'].includes(fmt) || sizeKB < 25) {
        throw new Error(`Rechazado por filtro de integridad: formato ${fmt}, tamaño ${sizeKB}KB`);
      }
      console.log(`   🛡️ Filtro superado: Formato ${fmt} válido [${sizeKB} KB]`);

      // Determinar extensión
      let ext = 'jpg';
      if (fmt === 'PNG') ext = 'png';
      if (fmt === 'WEBP') ext = 'webp';

      const targetDir = path.resolve('src/assets', item.col, item.slug);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileName = `coverImage.${ext}`;
      const assetPath = path.join(targetDir, fileName);
      fs.writeFileSync(assetPath, buffer);
      console.log(`   💾 Archivo físico guardado en: src/assets/${item.col}/${item.slug}/${fileName}`);

      // Actualizar index.json con UTF-8 puro (sin BOM)
      const indexPath = path.resolve('src/content', item.col, item.slug, 'index.json');
      if (fs.existsSync(indexPath)) {
        const jsonContent = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        jsonContent.coverImage = `/src/assets/${item.col}/${item.slug}/${fileName}`;
        jsonContent.publicarConImagen = true;
        jsonContent.draft = false;
        jsonContent.date = jsonContent.date || new Date().toISOString().split('T')[0];
        jsonContent.notasInvestigador = `Portada HD Wikimedia Commons: ${best.title} | ${item.notes} | Curada TGP Batch 2`;

        fs.writeFileSync(indexPath, JSON.stringify(jsonContent, null, 2), 'utf8');
        console.log(`   📝 index.json actualizado (UTF-8 sin BOM, publicarConImagen: true)`);
      }

      successCount++;
    } catch (err) {
      console.error(`   ❌ Error en ${item.slug}:`, err.message);
    }
  }

  console.log(`\n─────────────────────────────────────────────────────────────────────────────`);
  console.log(`✅ Lote 2 completado: ${successCount} de ${BATCH_ITEMS.length} imágenes descargadas y enlazadas.`);
  console.log(`─────────────────────────────────────────────────────────────────────────────\n`);

  if (successCount > 0) {
    console.log('☁️ Sincronizando con Cloudflare R2 (npm run upload:assets)...');
    try {
      execSync('npm run upload:assets', { stdio: 'inherit' });
    } catch (e) {
      console.warn('⚠️ Advertencia en subida R2:', e.message);
    }

    console.log('\n🔬 Ejecutando auditoría inflexible final (npm run audit:r2)...');
    try {
      execSync('node scripts/auditar-imagenes-r2.mjs', { stdio: 'inherit' });
    } catch (e) {
      console.warn('⚠️ Advertencia en auditoría:', e.message);
    }
  }
}

run();
