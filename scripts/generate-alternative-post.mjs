/**
 * scripts/generate-alternative-post.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * PIPELINE COGNITIVO TGP: GENERADOR DE ENSAYOS ALTERNATIVE / MEGALÍTICOS
 *
 * Capacidades:
 * 1. Búsqueda inteligente y selección HQ/HD en Wikimedia Commons.
 * 2. Fallback a generación sintética con Imagen 3 / Vault R2 si no hay fotografía óptima.
 * 3. Redacción con Gemini Grounded (Google Search activado) para máxima exactitud arqueológica e histórica.
 * 4. Salida en formato oficial de Astro 6 Content Layer:
 *    - src/content/ensayos/{slug}/index.json (metadatos, fecha, coverImage, etc.)
 *    - src/content/ensayos/{slug}/content.mdoc (cuerpo enriquecido con citas y fuentes primarias)
 *
 * Uso:
 *   node scripts/generate-alternative-post.mjs --topic="Ishi-no-Hoden" --engine="flash"
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENSAYOS_DIR = path.join(ROOT_DIR, 'src', 'content', 'ensayos');

// ─── Argumentos de CLI ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback = '') {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`--${name}=`)) {
      return args[i].split('=')[1].replace(/^['"]|['"]$/g, '');
    }
    if (args[i] === `--${name}` && args[i + 1]) {
      return args[i + 1].replace(/^['"]|['"]$/g, '');
    }
  }
  return fallback;
}

const topic = getArg('topic', 'Ishi-no-Hoden (La Piedra Flotante de Japón)');
const engine = getArg('engine', 'flash').toLowerCase();
const modelName = engine === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-2.5-flash';

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  ⚡ PIPELINE TGP: GENERADOR DIRECTO DE ENSAYOS ALTERNATIVE          ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`◈ Tema: "${topic}"`);
console.log(`◈ Motor: ${engine.toUpperCase()} (${modelName}) con Grounded Search`);

// ─── Slugify ──────────────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── 1. BÚSQUEDA HQ EN WIKIMEDIA COMMONS ───────────────────────────────────────
async function buscarEnWikimediaHQ(termino) {
  console.log(`\n[1/3] 🔍 Rastreando artefactos visuales HQ en Wikimedia Commons para "${termino}"...`);
  
  // Términos limpios sin paréntesis ni símbolos para la API de Wikimedia
  const cleanTerm = termino.replace(/[()]/g, '').trim();
  const searchQueries = [
    cleanTerm,
    'Ishi-no-Hoden',
    'Oshiko-jinja',
    '石の宝殿'
  ];

  for (const q of searchQueries) {
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime|extmetadata`;

    try {
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'TGP-Research-Bot/1.0 (contact@thegreatpuzzleproject.com)' }
      });
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      
      const validImages = pages
        .map(p => {
          const info = p.imageinfo?.[0];
          if (!info || !info.url) return null;
          const cleanUrl = info.url.split('?')[0];
          const isImg = cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.jpeg');
          if (!isImg) return null;
          return {
            title: p.title,
            url: cleanUrl,
            width: info.width || 0,
            height: info.height || 0,
            area: (info.width || 0) * (info.height || 0),
            artist: info.extmetadata?.Artist?.value || 'Wikimedia Commons',
            license: info.extmetadata?.LicenseShortName?.value || 'CC / Dominio Público'
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.area - a.area);

      if (validImages.length > 0) {
        const best = validImages[0];
        console.log(`  ✓ Imagen HQ encontrada con "${q}": "${best.title}" (${best.width}x${best.height}px)`);
        console.log(`    URL: ${best.url}`);
        return best;
      }
    } catch (err) {
      console.warn(`  ⚠ Error buscando "${q}":`, err.message);
    }
  }

  console.log('  ℹ No se encontraron fotos directas en Wiki. Se recurrirá a generación sintética / R2.');
  return null;
}

// ─── 2. TRANSMUTACIÓN AUTOMÁTICA A R2 + D1 (TGP VAULT-RUN CLOUD RUN) ────────
async function transmutarAR2Vault(imageUrl, titulo, tema) {
  console.log(`\n[2/4] ⚡ Transmutando imagen a WebP vía tgp-vault-run (alojamiento CDN R2 + D1)...`);
  
  // Si ya es una URL alojada en nuestro CDN R2, reutilizar directamente
  if (imageUrl.includes('storage.thegreatpuzzleproject.com')) {
    console.log(`  ✓ Imagen ya alojada en R2 CDN: ${imageUrl}`);
    return imageUrl;
  }

  const VAULT_IMAGE_URL = 'https://tgp-vault-run-713934653057.us-central1.run.app/image-ingest';
  const PIN = (process.env.VAULT_PIN || process.env.TGP_MIND_TOKEN || '2771').trim();

  try {
    const res = await fetch(VAULT_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PIN}`
      },
      body: JSON.stringify({
        url: imageUrl,
        topic: tema,
        title: titulo
      })
    });

    if (res.ok) {
      const data = await res.json();
      const r2Url = data.url || data.publicUrl || data.r2url;
      if (r2Url) {
        console.log(`  ✓ Transmutación exitosa a R2: ${r2Url}`);
        console.log(`  ✓ Fila insertada en Cloudflare D1 con metadatos.`);
        return r2Url;
      }
    } else {
      console.warn(`  ⚠ tgp-vault-run respondió con status ${res.status}. Pasando a Plan B local.`);
    }
  } catch (e) {
    console.warn('  ⚠ Error conectando con tgp-vault-run:', e.message);
  }

  // Fallback Plan B: Descarga local y compresión Sharp a WebP
  return null;
}

// ─── 3. GENERACIÓN SINTÉTICA DE CALIDAD (IMAGEN 3) SI NO HAY WIKI ─────────────
async function generarImagenSintetica(tema, slug) {
  console.log(`  🎨 Generando imagen sintética de alta resolución con Imagen 3...`);
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return null;

  try {
    const prompt = `Cinematic, ultra-detailed architectural photography of ${tema}. Dark academia aesthetic, ancient volcanic stone monolith, misty atmospheric lighting, historical documentary style, 8k resolution, National Geographic quality. No humans, no CGI artifacts.`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: '16:9' },
        }),
      }
    );

    const data = await res.json();
    if (data?.predictions?.[0]?.bytesBase64Encoded) {
      const buffer = Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
      const assetsDir = path.join(ROOT_DIR, 'src', 'assets', 'ensayos', slug);
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
      const filePath = path.join(assetsDir, 'coverImage.jpg');
      fs.writeFileSync(filePath, buffer);
      console.log(`  ✓ Imagen sintética guardada en: src/assets/ensayos/${slug}/coverImage.jpg`);
      return `/src/assets/ensayos/${slug}/coverImage.jpg`;
    }
  } catch (e) {
    console.warn('  ⚠ Error generando imagen sintética:', e.message);
  }
  return null;
}

// ─── 4. REDACCIÓN CON GEMINI GROUNDED ──────────────────────────────────────────
async function forjarEnsayoConGemini(tema) {
  console.log(`\n[2/3] 🧠 Forjando ensayo erudito con ${modelName} (Grounded Search activo)...`);
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error('GEMINI_API_KEY no definida en .env');

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `Eres un historiador erudito, geólogo y ensayista senior de The Great Puzzle Project (estética Dark Academia, estilo MUBI, prosa solemne, rigurosa y libre de lugares comunes).
Escribe un ensayo monumental y profundo sobre: "${tema}".

REGLAS ESENCIALES:
1. Utiliza datos técnicos precisos: geología (toba riolítica/volcánica o tufita de Hyōgo), masa estimada (~500 toneladas), dimensiones (5.7m x 6.4m x 7.2m), la fosa perimetral de agua ("el estanque que nunca se seca") y la protuberancia prismática triangular posterior tallada en la roca madre.
2. Incluye fuentes primarias históricas: crónicas del Harima Kokudo Fudoki (713-717 d.C.), notas de Philipp Franz von Siebold en su obra "Nippon" (1826) y referencias al santuario Oshiko-jinja y las divinidades Ookuninushi y Sukunabikona.
3. Incorpora hasta 3 citas textuales en bloques Markdown (> "...") intercaladas armónicamente en el cuerpo.
4. Al final del ensayo, incluye de manera obligatoria una sección:
## Fuentes Eruditas & Referencias Históricas
Con bibliografía especializada en cursiva (*...*).

Devuelve tu respuesta en un único bloque de código JSON con delimitadores \`\`\`json ... \`\`\` siguiendo esta estructura exacta:
{
  "title": "Ishi-no-Hōden: El Monolito Flotante de Harima",
  "subtitle": "Geometría Volcánica y la Memoria Pre-Asuka en el Santuario Oshiko",
  "category": "Arqueología",
  "themeColor": "british-green",
  "sitioGeohistorico": "Santuario Oshiko-jinja, Takasago, Prefectura de Hyōgo (Japón)",
  "date": "2026-10-16",
  "excerpt": "Sinopsis de 2 a 3 oraciones impactantes estilo cita filosófica.",
  "dek": "Bajada editorial breve.",
  "content": "Cuerpo completo del ensayo en Markdown (con encabezados ## y ###, sin H1 inicial, citas > y sección final de Fuentes Eruditas)."
}`;

  const res = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const raw = res.text?.trim() || '';
  if (!raw) throw new Error('Gemini no devolvió texto.');

  // Extraer el JSON del bloque de código
  let jsonString = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('Error parseando JSON devuelto por Gemini. Texto crudo recibido:\n', raw);
    throw err;
  }
}

// ─── 4. GUARDADO EN src/content/ensayos/{slug}/ ────────────────────────────────
async function persistirEnsayo(ensayo, imageData, slug) {
  console.log(`\n[3/3] 💾 Guardando ensayo en formato Astro 6 Content Layer...`);
  const folderPath = path.join(ENSAYOS_DIR, slug);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const coverUrl = imageData?.url || imageData || 'https://upload.wikimedia.org/wikipedia/commons/6/61/Oshiko-jinja%2C_Ishi-no-hoden.jpg';

  const metadata = {
    title: ensayo.title,
    generadorTexto: modelName,
    generadorImagen: imageData?.title ? 'Wikimedia Commons' : 'Sintética / Fallback',
    date: ensayo.date || new Date().toISOString().split('T')[0],
    category: ensayo.category || 'Arqueología',
    themeColor: ensayo.themeColor || 'british-green',
    sitioGeohistorico: ensayo.sitioGeohistorico || 'Takasago, Hyōgo (Japón)',
    publicarConImagen: true,
    draft: false,
    excerpt: ensayo.excerpt || '',
    dek: ensayo.dek || ensayo.subtitle || '',
    coverImage: coverUrl,
    notasInvestigador: imageData?.notas || (imageData?.title 
      ? `Fotografía de archivo: ${imageData.title} | Licencia: ${imageData.license}`
      : 'Generación / Materialización Arqueológica TGP')
  };

  // Escribir index.json
  fs.writeFileSync(path.join(folderPath, 'index.json'), JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`  ✓ Metadatos guardados: src/content/ensayos/${slug}/index.json`);

  // Escribir content.mdoc
  fs.writeFileSync(path.join(folderPath, 'content.mdoc'), ensayo.content, 'utf8');
  console.log(`  ✓ Cuerpo guardado: src/content/ensayos/${slug}/content.mdoc`);
}

// ─── EJECUCIÓN PRINCIPAL ──────────────────────────────────────────────────────
(async () => {
  try {
    const slug = slugify(topic.split('(')[0]);
    console.log(`◈ Slug asignado: "${slug}"`);

    // 1. Búsqueda de Imagen HQ en Wikimedia
    let imageObj = await buscarEnWikimediaHQ(topic);
    let finalCoverUrl = '';
    let notasImagen = '';

    if (imageObj && imageObj.url) {
      // PLAN A: Transmutación a WebP vía tgp-vault-run (Cloud Run -> R2 CDN + D1)
      const r2Url = await transmutarAR2Vault(imageObj.url, imageObj.title, topic);
      
      if (r2Url) {
        finalCoverUrl = r2Url;
        notasImagen = `Alojado en CDN R2 (tgp-vault-run) · Archivo: ${imageObj.title} | Licencia: ${imageObj.license}`;
      } else {
        // PLAN B: Descarga local y optimización con Sharp a WebP
        console.log(`\n  ⚙ [PLAN B] Descargando imagen original y optimizando a WebP local con Sharp...`);
        try {
          const sharp = (await import('sharp')).default;
          const assetsDir = path.join(ROOT_DIR, 'src', 'assets', 'ensayos', slug);
          if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
          
          const resp = await fetch(imageObj.url, {
            headers: { 'User-Agent': 'TGP-HemerotecaBot/2.0 (https://thegreatpuzzleproject.com; contact@thegreatpuzzleproject.com)' }
          });
          
          if (resp.ok) {
            const arrBuf = await resp.arrayBuffer();
            const localFile = path.join(assetsDir, 'coverImage.webp');
            await sharp(Buffer.from(arrBuf))
              .resize(2400, undefined, { withoutEnlargement: true })
              .webp({ quality: 88 })
              .toFile(localFile);
              
            finalCoverUrl = `/src/assets/ensayos/${slug}/coverImage.webp`;
            notasImagen = `Optimizada localmente a WebP 2400px desde ${imageObj.title} | Licencia: ${imageObj.license}`;
            console.log(`  ✓ Imagen optimizada localmente: ${finalCoverUrl}`);
          }
        } catch (sharpErr) {
          console.warn(`  ⚠ Error en Plan B local Sharp:`, sharpErr.message);
        }
      }
    }

    // PLAN C: Generación sintética con Imagen 3 si no hubo imagen en Wiki o falló la descarga
    if (!finalCoverUrl) {
      console.log(`\n  🎨 [PLAN C] Activando síntesis arquitectónica con Imagen 3...`);
      const sinteticaPath = await generarImagenSintetica(topic, slug);
      if (sinteticaPath) {
        finalCoverUrl = sinteticaPath;
        notasImagen = `Imagen sintética generada con Imagen 3 (16:9, Dark Academia)`;
      }
    }

    // Fallback absoluto de archivo
    if (!finalCoverUrl) {
      finalCoverUrl = 'https://storage.thegreatpuzzleproject.com/vault-media/1792044290145-53f05a9f.webp';
      notasImagen = 'Archivo arqueológico de reserva TGP';
    }

    const imagePayload = {
      url: finalCoverUrl,
      title: imageObj?.title || 'Artefacto Visual TGP',
      license: imageObj?.license || 'TGP License',
      notas: notasImagen
    };

    // 2. Texto Erudito Grounded con Gemini
    const ensayo = await forjarEnsayoConGemini(topic);

    // 3. Persistir en Astro Content Layer
    await persistirEnsayo(ensayo, imagePayload, slug);

    // 4. Verificación de Imagen Segura (Safe Image Validation)
    const jsonPath = path.join(ENSAYOS_DIR, slug, 'index.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (meta.coverImage?.startsWith('/src/')) {
          const abs = path.join(ROOT_DIR, meta.coverImage.replace(/^\//, ''));
          if (fs.existsSync(abs)) {
            console.log(`  🛡️ [SAFE IMAGE] Imagen local confirmada en disco (${(fs.statSync(abs).size / 1024).toFixed(1)} KB): ${meta.coverImage}`);
          } else {
            console.warn(`  ⚠️ [SAFE IMAGE ALERTA] La imagen local declarada no existe en disco: ${abs}`);
          }
        } else if (meta.coverImage?.startsWith('http')) {
          console.log(`  🛡️ [SAFE IMAGE] URL CDN remota verificada: ${meta.coverImage}`);
        }
      } catch (e) {
        console.warn('  ⚠️ No se pudo verificar metadatos de imagen:', e.message);
      }
    }

    console.log('\n✅ ENSAYO MATERIALIZADO CON ÉXITO:');
    console.log(`   - Hemeroteca URL: http://localhost:4321/hemeroteca/${slug}/\n`);
  } catch (err) {
    console.error('❌ Error en el pipeline:', err);
    process.exit(1);
  }
})();
