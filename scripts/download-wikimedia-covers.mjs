import fs from 'fs';
import path from 'path';

const USER_AGENT = 'TGPHemeroteca/1.0 (https://github.com/ygnatiux-sys/tgp-hemeroteca; contact@tgp.org)';

const posts = [
  { slug: 'san-agustin-y-su-pasado', title: 'File:Sandro_Botticelli_-_St_Augustine_in_His_Study_-_WGA02741.jpg', ext: 'jpg' },
  { slug: 'la-arquitectura-de-los-suenos-lucidos', title: 'File:Giovanni_Paolo_Panini_-_Architectural_Capriccio_with_Roman_Ruins_-_WGA16947.jpg', ext: 'jpg' },
  { slug: 'los-carpocracianos', title: 'File:Good_Shepherd_Catacomb_of_Priscilla_Rome.jpg', ext: 'jpg' },
  { slug: 'bonampak-2', title: 'File:Mexico-2347_-_Mayan_Music_Time_in_770AD_(4285760560).jpg', ext: 'jpg' },
  { slug: 'el-diablo-en-el-tarot', title: 'File:15_Devil_Tarot_Card.jpg', ext: 'jpg' },
  { slug: 'homero-el-poeta-ciego', title: 'File:Homer_British_Museum.jpg', ext: 'jpg' },
  { slug: 'los-nestorianos', title: 'File:Nestorian_Priests_Palm_Sunday_Khocho.jpg', ext: 'jpg' },
  { slug: 'neoplatonicos', title: 'File:"The_School_of_Athens"_by_Raffaello_Sanzio_da_Urbino.jpg', ext: 'jpg' },
  { slug: 'socrates2', title: 'File:David_-_The_Death_of_Socrates.jpg', ext: 'jpg' },
  { slug: 'el-diablo-en-el-tarot-1', title: 'File:Baphomet.png', ext: 'png' },
  { slug: 'los-carpocracianos-1', title: 'File:POxy_I_1.jpg', ext: 'jpg' },
  { slug: 'los-nestorianos-1', title: 'File:Nestorian_stele_full_view.jpg', ext: 'jpg' }
];

async function getImageUrl(title) {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(title)}`;
  const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) throw new Error('No pages in response');
  
  for (const pageId in pages) {
    const info = pages[pageId].imageinfo;
    if (info && info.length > 0) {
      return info[0].url;
    }
  }
  throw new Error('No imageinfo URL found');
}

async function downloadImage(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arrayBuffer));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('🚀 Iniciando la descarga inteligente con reintentos automáticos (máx 3 intentos) y delay...');

  for (const post of posts) {
    console.log(`\n🔍 Procesando [${post.slug}]...`);
    const assetDir = path.join('./src/assets/ensayos', post.slug);
    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true });
    }

    const fileName = `coverImage.${post.ext}`;
    const destPath = path.join(assetDir, fileName);

    // Eliminar SVG temporal si existe
    const oldSvg = path.join(assetDir, 'coverImage.svg');
    if (fs.existsSync(oldSvg)) {
      fs.unlinkSync(oldSvg);
    }

    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`   Attempt ${attempts}/${maxAttempts}...`);
        
        // 1. Obtener URL exacta y fresca desde la API de Wikimedia
        const exactUrl = await getImageUrl(post.title);
        console.log(`     🔗 URL Exacta obtenida: ${exactUrl}`);
        
        // 2. Descargar la imagen desde la URL exacta
        await downloadImage(exactUrl, destPath);
        console.log(`     ✅ Guardada en: ${destPath}`);

        // 3. Actualizar el index.json
        const jsonPath = path.join('./src/content/ensayos', post.slug, 'index.json');
        if (fs.existsSync(jsonPath)) {
          const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          jsonData.coverImage = `/src/assets/ensayos/${post.slug}/${fileName}`;
          fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
          console.log(`     📝 index.json actualizado.`);
        }
        success = true;
      } catch (err) {
        console.error(`     ❌ Error en intento ${attempts}:`, err.message);
        if (attempts < maxAttempts) {
          console.log(`     ⏱️  Esperando 1000ms antes de reintentar...`);
          await sleep(1000);
        }
      }
    }

    if (!success) {
      console.log(`   🛑 No se pudo procesar [${post.slug}] tras ${maxAttempts} intentos. Se descarta.`);
    }

    // Delay de seguridad entre posts
    await sleep(500);
  }

  console.log('\n🎉 ¡Proceso de descarga e indexación completado!');
}

run();
