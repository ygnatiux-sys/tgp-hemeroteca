/**
 * curar-batch-segundo.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline unificado de curaduría para el Lote 3 Final (12 posts finales):
 * - 6 artículos se nutren de obras maestras en HD ya presentes en src/assets/remotas/
 * - 6 artículos se resuelven y descargan desde Wikimedia Commons con validación binaria
 * - Actualiza index.json en UTF-8 puro (sin BOM) activando publicarConImagen: true
 * - Sincroniza las portadas a Cloudflare R2 (npm run upload:assets)
 * - Ejecuta la auditoría inflexible final (npm run audit:r2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const USER_AGENT = 'TGPHemeroteca/1.0 (https://thegreatpuzzleproject.com; contact@tgp.org)';

const BATCH_ITEMS = [
  // ── 6 Posts con obras existentes en src/assets/remotas/ ─────────────────────
  {
    col: 'georreferencias',
    slug: 'santuario-de-ballenas-peninsula-de-valdez-patagonia',
    localSource: 'remotas/tail-of-a-whale-near-valdes-peninsula.webp',
    notes: 'Cola de ballena franca austral en Península Valdés | CC-BY-SA'
  },
  {
    col: 'georreferencias',
    slug: 'isla-de-los-estados-en-tierra-del-fuego',
    localSource: 'remotas/isla-de-los-estados.webp',
    notes: 'Faro del Fin del Mundo e Isla de los Estados, Tierra del Fuego | CC-BY-SA'
  },
  {
    col: 'georreferencias',
    slug: 'valle-de-la-luna',
    localSource: 'remotas/anfiteatro-valle-de-la-luna-san-pedro-de-atacama-c.webp',
    notes: 'Anfiteatro del Valle de la Luna, Desierto de Atacama | CC-BY-SA'
  },
  {
    col: 'georreferencias',
    slug: 'ellora-caves',
    localSource: 'remotas/courtyard-and-mahabharata-reliefs-at-the-kailasa-t.webp',
    notes: 'Relieves del Mahabharata en el Templo Kailasa, Cuevas de Ellora | CC-BY-SA'
  },
  {
    col: 'georreferencias',
    slug: 'meroe-la-dinastia-egipcia-nubia',
    localSource: 'remotas/nubian-pyramids-of-meroe-in-1821.webp',
    notes: 'Pirámides nubias de Meroe en grabado litográfico de 1821 | Dominio Público'
  },
  {
    col: 'georreferencias',
    slug: 'piramide-romana-de-cestia',
    localSource: 'remotas/piramide-cestia.webp',
    notes: 'Pirámide de Cayo Cestio en Roma junto a Porta San Paolo | CC-BY-SA'
  },

  // ── 6 Posts para resolver en Wikimedia Commons ─────────────────────────────
  {
    col: 'georreferencias',
    slug: 'la-cueva-de-lascaux',
    query: 'Lascaux painting bulls cave',
    preferredFiles: ['File:Lascaux_painting.jpg', 'File:Cave_art_Lascaux.jpg', 'File:Dordogne_Lascaux_aurochs.jpg'],
    notes: 'Pintura rupestre polícroma de uros en Lascaux | Dominio Público'
  },
  {
    col: 'georreferencias',
    slug: 'aramu-muru-puerta-de-los-dioses',
    query: 'Aramu Muru Hayu Marca Lake Titicaca',
    preferredFiles: ['File:Hayu_Marca_or_Aramu_Muru.jpg', 'File:Aramu_Muru_gate.jpg', 'File:Amaru_Muru_doorway.jpg'],
    notes: 'Portal megalítico de Hayu Marca (Aramu Muru), Puno | CC-BY-SA'
  },
  {
    col: 'arquetipos-globales',
    slug: 'arquetipos-globales-introduccion',
    query: 'Harmonia Macrocosmica Cellarius celestial map',
    preferredFiles: ['File:Cellarius_Harmonia_Macrocosmica_1660_Planisphaerium_Braheum.jpg', 'File:The_Celestial_Map_of_Cellarius_1660.jpg', 'File:Harmonia_Macrocosmica.jpg'],
    notes: 'Carta celeste de Harmonia Macrocosmica por Andreas Cellarius (1660) | Dominio Público'
  },
  {
    col: 'ensayos',
    slug: '7-pecados-7-chackras',
    query: 'Tantric Chakra Man subtle body',
    preferredFiles: ['File:Chakras_illustration.jpg', 'File:Tantric_Chakra_Man.jpg', 'File:Chakras_map.jpg'],
    notes: 'Diagrama tradicional de los siete chakras del yoga tántrico | Dominio Público'
  },
  {
    col: 'ensayos',
    slug: 'vision-2026-09-21-5c3cbc481eb2a0a5d9609a87b16fd0a099126377',
    query: 'Palenque Temple of the Inscriptions Maya',
    preferredFiles: ['File:Palenque_Temple_of_the_Inscriptions.jpg', 'File:Palenque_Temple_de_las_Inscripciones.jpg', 'File:Temple_of_the_Inscriptions_Palenque_Chiapas.jpg'],
    notes: 'Templo de las Inscripciones, sitio arqueológico maya de Palenque | Dominio Público'
  },
  {
    col: 'ensayos-cinematicos',
    slug: 'vision-2026-10-12-consulta-manual',
    query: 'Flammarion atmosphere woodcut',
    preferredFiles: ['File:Flammarion_Atmosphere.jpg', 'File:Flammarion_Woodcut_1888.jpg', 'File:Flammarion-atmosphere.png'],
    notes: 'Grabado de Camille Flammarion: El peregrino en el borde del cosmos (1888) | Dominio Público'
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
  for (const pref of item.preferredFiles) {
    try {
      const resolved = await resolveWikimediaUrl(pref);
      if (resolved) {
        return { ...resolved, title: pref };
      }
    } catch {}
  }

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
  console.log('║       ⚡ TGP - PIPELINE UNIFICADO DE CURADURÍA (LOTE 3 FINAL: 12 POSTS)   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

  let successCount = 0;

  for (const item of BATCH_ITEMS) {
    console.log(`\n🎨 Curando [${item.col}] -> ${item.slug}...`);
    try {
      const targetDir = path.resolve('src/assets', item.col, item.slug);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      let buffer;
      let title = '';

      if (item.localSource) {
        const localSourcePath = path.resolve('src/assets', item.localSource);
        if (!fs.existsSync(localSourcePath)) {
          throw new Error(`El archivo fuente local ${item.localSource} no existe`);
        }
        buffer = fs.readFileSync(localSourcePath);
        title = item.localSource;
        console.log(`   💎 Obtenido desde asset local optimizado: ${item.localSource}`);
      } else {
        const best = await fetchBestImage(item);
        title = best.title;
        console.log(`   🔗 Obra resuelta: ${best.title}`);
        console.log(`   📥 Descargando desde: ${best.url}`);

        const res = await fetch(best.url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) throw new Error(`HTTP ${res.status} al descargar`);
        buffer = Buffer.from(await res.arrayBuffer());
      }

      // Validación estricta de Magic Bytes
      const fmt = detectImageFormat(buffer);
      const sizeKB = Math.round(buffer.length / 1024);
      if (['HTML_ERROR', 'SVG_PLACEHOLDER', 'CORRUPT'].includes(fmt) || sizeKB < 15) {
        throw new Error(`Rechazado por filtro de integridad: formato ${fmt}, tamaño ${sizeKB}KB`);
      }
      console.log(`   🛡️ Filtro superado: Formato ${fmt} válido [${sizeKB} KB]`);

      let ext = 'jpg';
      if (fmt === 'PNG') ext = 'png';
      if (fmt === 'WEBP') ext = 'webp';

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
        jsonContent.notasInvestigador = `Portada HD: ${title} | ${item.notes} | Curada TGP Batch Final`;

        fs.writeFileSync(indexPath, JSON.stringify(jsonContent, null, 2), 'utf8');
        console.log(`   📝 index.json actualizado (UTF-8 sin BOM, publicarConImagen: true)`);
      }

      successCount++;
    } catch (err) {
      console.error(`   ❌ Error en ${item.slug}:`, err.message);
    }
  }

  console.log(`\n─────────────────────────────────────────────────────────────────────────────`);
  console.log(`✅ Lote Final completado: ${successCount} de ${BATCH_ITEMS.length} imágenes descargadas y enlazadas.`);
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
