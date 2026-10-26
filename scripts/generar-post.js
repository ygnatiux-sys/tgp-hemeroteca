/**
 * scripts/generar-post.js
 *
 * TGP Hemeroteca — Taller Cognitivo Unificado & Seguro (Desk Local)
 * Motores de Texto: Gemini 1.5 Flash (Rápido) / Gemini 1.5 Pro / 3.1 Pro (Erudito)
 * Curaduría Visual:
 *   - Golden Wiki (CirrusSearch) con transmutación WebP + R2
 *   - Google Imagen 3 (Sintética Banana) con transmutación WebP + R2
 *   - Conjuntiva: Wiki Hero + Galería Wiki (3/5/9) Y/O Imagen 3
 *
 * Uso: node scripts/generar-post.js
 */

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { transmuteRemoteToR2, uploadBufferToR2Webp } from '../src/lib/vault-r2.mjs';
import { orquestarTaxonomiaFlash, imprimirFichaUbicacionExacta } from '../src/lib/tgp-router-oracle.mjs';

// ─── SLUGIFY UNICODE ──────────────────────────────────────────────────────────
const slugify = (text) =>
  text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

// ─── CONSULTA DIRECTA WIKIMEDIA CIRRUSSEARCH ──────────────────────────────────
async function fetchWikimediaCandidates(query, limit = 15) {
  const clean = query.replace(/[:(].*$/, '').trim();
  const cirrusFilter = 'filetype:bitmap -intitle:map -intitle:diagram -intitle:plan -intitle:coat -intitle:flag -intitle:svg';
  const fullSearch = `${clean} ${cirrusFilter}`;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: fullSearch,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280',
    origin: '*',
  });

  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { 'User-Agent': 'TGP-Cognitive-Studio/1.0 (contact@thegreatpuzzleproject.com)' },
    });
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {});
    const items = [];

    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info || !info.url) continue;
      const width = info.width || 0;
      const height = info.height || 0;
      if (width < 800) continue; // Descartar thumbnails enanos

      items.push({
        title: p.title.replace(/^File:/i, ''),
        url: info.url,
        thumbUrl: info.thumburl || info.url,
        width,
        height,
        aspectRatio: height > 0 ? (width / height).toFixed(2) : 1,
      });
    }

    return items;
  } catch (err) {
    console.warn('  ⚠️ No se pudo consultar Wikimedia:', err.message);
    return [];
  }
}

// ─── GENERADOR DE IMAGEN SINTÉTICA (IMAGEN BANANA GEMINI) ─────────────────────
async function generarImagenBanana(apiKey, prompt, slug) {
  console.log('  🍌 Conectando con Google Image Engine (gemini-3.1-flash-image-preview)...');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: [{
      role: 'user',
      parts: [{ text: `${prompt}. Aspect ratio 16:9, ultra-detailed architectural photography, dark academia.` }],
    }],
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p) => p.inlineData);
  const b64 = imagePart?.inlineData?.data;

  if (!b64) {
    throw new Error('El motor de imagen de Gemini no devolvió datos binarios (inlineData).');
  }

  const buffer = Buffer.from(b64, 'base64');
  console.log('  ⚡ Transmutando imagen sintética a WebP y subiendo a R2...');
  const uploaded = await uploadBufferToR2Webp(buffer, 'sinteticas-banana', `${slug}-banana`);
  console.log(`  ✅ Guardada en Cloudflare R2: ${uploaded.url}`);
  return uploaded.url;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const getArg = (name, fallback = '') => {
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith(`--${name}=`)) return args[i].split('=')[1].replace(/^['"]|['"]$/g, '');
      if (args[i] === `--${name}` && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1].replace(/^['"]|['"]$/g, '');
    }
    return fallback;
  };

  const cliTopic = getArg('topic');
  const cliCategory = getArg('category', 'Ensayo');
  const cliEngine = getArg('engine'); // 'flash' | 'pro'
  const cliVisual = getArg('visual'); // '1' (wiki), '2' (banana), '3' (conjuntiva)
  const cliGalleryCount = getArg('gallery', '3');

  const rl = !cliTopic ? createInterface({ input, output }) : null;
  const ask = async (q) => (rl ? (await rl.question(q)).trim() : '');

  console.log('\n╔═════════════════════════════════════════════════════════════════╗');
  console.log('║   🏛️ TGP COGNITIVE STUDIO — TALLER DE PRODUCCIÓN Y CURADURÍA   ║');
  console.log('╚═════════════════════════════════════════════════════════════════╝\n');

  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) throw new Error('GEMINI_API_KEY no encontrada en .env');

    // 1. Título y Categoría
    const titulo = cliTopic || (await ask('  📝 Título o tema del ensayo: '));
    if (!titulo) throw new Error('El título no puede estar vacío.');

    const categoriaInput = cliTopic ? cliCategory : (await ask('  🗂  Categoría [Ensayo]: '));
    const categoria = categoriaInput || 'Ensayo';

    // 2. Selección del Motor Cognitivo
    let textModel = 'gemini-3.1-pro-preview';
    if (cliEngine) {
      textModel = cliEngine.toLowerCase() === 'flash' ? 'gemini-2.5-flash' : 'gemini-3.1-pro-preview';
    } else {
      console.log('\n  🧠 ¿Qué motor de redacción deseas usar?');
      console.log('     [1] Gemini 2.5 Flash (Ultra rápido, ágil y económico)');
      console.log('     [2] Gemini 3.1 Pro (Erudito, monumental y denso)');
      const motorChoice = (await ask('     Selecciona (1/2) [2]: ')) || '2';
      textModel = motorChoice === '1' ? 'gemini-2.5-flash' : 'gemini-3.1-pro-preview';
    }

    // 3. Verificación Previa de Archivo Wikimedia (Golden Wiki)
    console.log(`\n  🔎 Verificando existencia de fotos históricas en Wikimedia Commons para "${titulo}"...`);
    const wikiCandidates = await fetchWikimediaCandidates(titulo, 15);
    console.log(`     -> Encontradas ${wikiCandidates.length} imágenes válidas en el archivo histórico.`);

    // 4. Árbol de Opciones Visuales
    console.log('\n  🎨 CONFIGURACIÓN VISUAL DEL POST:');
    if (wikiCandidates.length > 0) {
      console.log(`     [1] Solo Fotografía Histórica de Archivo (Golden Wiki -> R2)`);
      console.log(`     [2] Solo Arte Sintético con Imagen 3 (Banana IA -> R2)`);
      console.log(`     [3] CONJUNTIVA: Wiki Hero + Galería de Fotos + Arte Sintético Imagen 3`);
      console.log(`     [4] Sin imagen (Borrador de texto puro)`);
    } else {
      console.log(`     [1] Arte Sintético con Imagen 3 (Banana IA -> R2) [Recomendado: No hay fotos en Wiki]`);
      console.log(`     [2] Sin imagen`);
    }

    const visualChoice = cliVisual || (await ask(`     Elige una opción [1]: `)) || '1';

    let coverImage = null;
    let galleryImages = [];
    let imageMetadataLabel = '';
    const slug = slugify(titulo);

    if (wikiCandidates.length > 0 && visualChoice === '1') {
      // Opción 1: Solo Wiki
      console.log(`\n  ⚡ Transmutando mejor Hero de Wikimedia a WebP y alojando en R2...`);
      coverImage = await transmuteRemoteToR2(wikiCandidates[0].url, 'wikimedia', `${slug}-hero`);
      imageMetadataLabel = `wikimedia-commons (Golden Wiki): ${wikiCandidates[0].title}`;
      console.log(`  ✅ Portada R2: ${coverImage}`);

    } else if ((wikiCandidates.length > 0 && visualChoice === '2') || (wikiCandidates.length === 0 && visualChoice === '1')) {
      // Opción: Solo Sintética
      const imagePrompt = `Cinematic, dark academia editorial photography. Concept: ${titulo}. Category: ${categoria}. Moody atmosphere, archival textures, deep shadows, historical symbolism. No text, no fantasy elements. Restrained color palette, fine grain, high detail.`;
      coverImage = await generarImagenBanana(API_KEY, imagePrompt, slug);
      imageMetadataLabel = 'imagen-3.0-generate-001 (Sintética Banana IA)';

    } else if (wikiCandidates.length > 0 && visualChoice === '3') {
      // Opción 3: Conjuntiva (Wiki Hero + Galería + Imagen 3)
      console.log(`\n  🌟 Modo Conjuntivo Activado.`);
      console.log(`  ⚡ Transmutando Hero histórico de Wikimedia a R2...`);
      coverImage = await transmuteRemoteToR2(wikiCandidates[0].url, 'wikimedia', `${slug}-hero`);
      console.log(`  ✅ Portada Hero R2: ${coverImage}`);

      // Preguntar cuántas fotos agregar a la galería
      const maxGallery = Math.min(wikiCandidates.length - 1, 9);
      if (maxGallery > 0) {
        console.log(`\n  📚 Hay ${maxGallery} fotos adicionales disponibles para enriquecer el post.`);
        const numImgsStr = cliVisual ? cliGalleryCount : ((await ask(`     ¿Cuántas imágenes incluir en la galería? (3 / 5 / 9) [3]: `)) || '3');
        const numImgs = Math.min(parseInt(numImgsStr, 10) || 3, maxGallery);

        console.log(`  ⚡ Transmutando ${numImgs} fotos de galería a R2...`);
        for (let i = 1; i <= numImgs; i++) {
          try {
            const galUrl = await transmuteRemoteToR2(wikiCandidates[i].url, 'wikimedia', `${slug}-gal-${i}`);
            galleryImages.push(galUrl);
            console.log(`     [${i}/${numImgs}] Galería R2: ${galUrl}`);
          } catch (e) {
            console.warn(`     ⚠️ Error en imagen ${i}: ${e.message}`);
          }
        }
      }

      // Generar también la sintética
      const imagePrompt = `Cinematic dark academia editorial concept: ${titulo}. Archaic atmosphere, solemn lighting, deep shadows.`;
      const syntheticUrl = await generarImagenBanana(API_KEY, imagePrompt, `${slug}-sintetica`);
      galleryImages.push(syntheticUrl);
      imageMetadataLabel = `Híbrido: Golden Wiki Hero + ${galleryImages.length - 1} de Archivo + Imagen 3 Sintética`;
    }

    if (rl) rl.close();

    // 5. Redacción Cognitiva con Gemini
    console.log(`\n  ✍️  Redactando ensayo con ${textModel} (Estilo Xavier Benítez)...`);
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const textResult = await ai.models.generateContent({
      model: textModel,
      contents: `Redacta un ensayo editorial monumental sobre: "${titulo}". Categoría: "${categoria}".`,
      config: {
        systemInstruction:
          'Eres el motor cognitivo TGP y socio analítico de Xavier Benítez. ' +
          'Tu función es redactar textos orientados al análisis cultural, histórico y filosófico ' +
          'bajo el formato de ensayo argentino contemporáneo. ' +
          'Tono: Dark Academia accesible — preciso, sobrio, agudo. Sin tono casual. ' +
          'Estructura: 1. Apertura con tensión material, 2. Anclaje histórico riguroso, 3. Tesis de transformación, ' +
          '4. Tensión historiográfica, 5. Cierre en destilación filosófica. ' +
          'Usa Markdown para párrafos y encabezados (##, ###). No uses H1 ni lugares comunes.',
      },
    });

    const textoEnsayo = textResult.text;
    if (!textoEnsayo || textoEnsayo.length < 100) {
      throw new Error('El texto generado está vacío o es demasiado corto.');
    }

    // 6. Preparar Rutas y Archivos
    const folderPath = path.join(process.cwd(), 'src/content/ensayos', slug);
    if (fs.existsSync(folderPath)) {
      throw new Error(`Ya existe un post con el slug "${slug}". Elige un título diferente.`);
    }

    const firstParagraph = textoEnsayo
      .split('\n')
      .map((p) => p.trim())
      .find((p) => p.length > 50 && !p.startsWith('#') && !p.startsWith('>'));
    const excerpt = firstParagraph ? firstParagraph.substring(0, 200).replace(/\*\*?/g, '') + '...' : '';

    fs.mkdirSync(folderPath, { recursive: true });

    // 7b. Orquestador Flash Taxonomist: Enriquecimiento semántico y categorización canónica
    console.log('  🧠 Orquestando taxonomía canónica con Gemini Flash...');
    const flashTaxonomy = await orquestarTaxonomiaFlash(API_KEY, titulo, textoEnsayo);
    const finalCategory = (categoriaInput && categoriaInput !== 'Ensayo') ? categoriaInput : flashTaxonomy.categoria;

    // Escribir index.json con Metadatos Blindados
    const metadata = {
      title: titulo,
      volanta: flashTaxonomy.dossierLevel || '',
      date: new Date().toISOString().split('T')[0],
      category: finalCategory,
      themeColor: 'british-green',
      draft: true,
      coverImage: coverImage,
      gallery: galleryImages,
      videoBg: null,
      excerpt,
      generador: textModel,
      generadorTexto: textoEnsayo,
      generadorImagen: imageMetadataLabel,
      notasInvestigador: `Taxonomía: ${flashTaxonomy.tags?.join(' · ')}`,
      spotifyLink: null,
      youtubeLink: null,
    };

    fs.writeFileSync(path.join(folderPath, 'index.json'), JSON.stringify(metadata, null, 2), 'utf-8');
    fs.writeFileSync(path.join(folderPath, 'content.mdoc'), textoEnsayo, 'utf-8');

    // 8. Ficha de Ubicación Exacta y Hubs Clickeables (Determinista + Flash)
    imprimirFichaUbicacionExacta({
      titulo,
      slug,
      collection: 'ensayos',
      categoria: finalCategory,
      coverUrl: coverImage,
      galleryCount: galleryImages.length,
      imageTag: imageMetadataLabel || 'Sin imagen',
      engine: textModel,
    });

  } catch (error) {
    console.error('\n  ❌ ERROR:', error.message || error);
    process.exit(1);
  }
}

main();
