/**
 * scripts/generate-cinematic-post.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * PIPELINE TGP: GENERADOR DE ENSAYOS CINEMÁTICOS (NATIVO KEYSTATIC)
 *
 * Características:
 * 1. 100% Nativo Keystatic: index.json + content.mdoc (CERO MDX).
 * 2. Motor de Texto: Gemini 2.5 Flash por defecto (ultrarrápido y eficiente).
 * 3. Selección Visual: Wikimedia Commons HD + Fallback a Google Imagen 3.
 * 4. Transmutación Cloudflare R2 y D1 vía tgp-vault-run + Resguardo local en src/assets.
 * 5. Atmósfera cinemática GSAP: umbral (Paralaje de Abismo - Profundidad Z).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Directorios y Configuración ──────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const CINEMATIC_CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content', 'ensayos-cinematicos');
const CINEMATIC_ASSETS_DIR = path.join(ROOT_DIR, 'src', 'assets', 'ensayos-cinematicos');
const CUSTOM_COLLECTIONS_FILE = path.join(ROOT_DIR, 'src', 'lib', 'custom-collections.ts');

// Cargar variables de entorno
if (fs.existsSync(ENV_FILE)) {
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

const PIN = (process.env.VAULT_PIN || process.env.TGP_MIND_TOKEN || '2771').trim();
const GEMINI_KEY = (process.env.GEMINI_API_KEY || process.env.PUBLIC_GEMINI_API_KEY || '').trim();
const VAULT_IMAGE_URL = 'https://tgp-vault-run-713934653057.us-central1.run.app/image-ingest';
const VAULT_UPLOAD_URL = 'https://tgp-vault-run-713934653057.us-central1.run.app/vault-ingest';

// ─── Argumentos de CLI ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback = '') {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`--${name}=`)) {
      return args[i].split('=')[1].replace(/^['"]|['"]$/g, '');
    }
    if (args[i] === `--${name}` && args[i + 1] && !args[i + 1].startsWith('--')) {
      return args[i + 1].replace(/^['"]|['"]$/g, '');
    }
  }
  return fallback;
}

const hasFlag = (name) => args.includes(`--${name}`);

const topic = getArg('topic', 'La Teogonía de Hesíodo (Ensayo Cinemático)');
const engine = getArg('engine', 'flash').toLowerCase(); // 'flash' por defecto
const modelName = engine === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-2.5-flash';
const atmosfera = getArg('atmosfera', 'umbral'); // 'umbral' = Opción 3 (Paralaje de Abismo)
const heroImageArg = getArg('hero-image', '');
const forceSynthetic = hasFlag('force-synthetic');

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  ⚡ PIPELINE TGP: GENERADOR DE ENSAYOS CINEMÁTICOS                  ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`◈ Tema: "${topic}"`);
console.log(`◈ Motor de Texto: ${engine.toUpperCase()} (${modelName})`);
console.log(`◈ Atmósfera GSAP: ${atmosfera.toUpperCase()} (Paralaje de Abismo)`);
console.log(`◈ Formato: KEYSTATIC NATIVO (index.json + content.mdoc)\n`);

// ─── 1. GENERADOR DE IMAGEN SINTÉTICA (FALLBACK DE SEGURIDAD) ─────────────────
export async function generarImagenSintetica(promptTema) {
  console.log(`\n🤖 [SINTÉTICA] Invocando Google Imagen 3 (imagen-3.0-generate-002)...`);
  console.log(`   Prompt base: "${promptTema}"`);

  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY no configurada.');
  }

  const imagePrompt = `Epic cinematic museum photograph depicting ${promptTema}. Dark primordial abyss, Tartarus depths, primordial Greek mythology, hyper-detailed marble and bronze textures, volumetric darkness, mist and subterranean lighting, 8k resolution, dramatic composition, MUBI dark aesthetic, no modern elements.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: imagePrompt }] }]
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Fallo en Gemini Image API (Status ${res.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData);
  const b64 = imagePart?.inlineData?.data;

  if (!b64) {
    throw new Error('La respuesta de Gemini Image no contiene datos binarios de imagen (inlineData).');
  }

  console.log(`   ✓ Fotografía sintética generada con éxito (${b64.length} bytes base64).`);
  const imageBuffer = Buffer.from(b64, 'base64');

  // Subir a Cloudflare R2 vía tgp-vault-run
  console.log(`   ⚡ Transmitiendo a Cloudflare R2 vía tgp-vault-run...`);
  try {
    const formData = new FormData();
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), `synthetic-${Date.now()}.jpg`);
    formData.append('title', `${topic} (Visual TGP)`);
    formData.append('topic', topic);

    const vaultRes = await fetch(VAULT_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PIN}` },
      body: formData
    });

    if (vaultRes.ok) {
      const vaultResult = await vaultRes.json();
      const r2Url = vaultResult.data?.media?.publicUrl || vaultResult.url;
      console.log(`   ✓ Imagen persistida en R2: ${r2Url}`);
      return { url: r2Url, buffer: imageBuffer, isSynthetic: true };
    }
  } catch (err) {
    console.warn('   ⚠ tgp-vault-run no disponible, usando buffer local:', err.message);
  }

  return { url: '', buffer: imageBuffer, isSynthetic: true };
}

// ─── 2. BÚSQUEDA EN WIKIMEDIA COMMONS CON FILTRO BITMAP HD ────────────────────
async function buscarOgenerarImagen(termino) {
  if (heroImageArg) {
    console.log(`[1/4] 🎯 Imagen Hero manual vía CLI: ${heroImageArg}`);
    return { url: heroImageArg, title: termino, isManual: true };
  }

  if (forceSynthetic) {
    console.log(`[1/4] 🤖 Flag --force-synthetic activado.`);
    return await generarImagenSintetica(termino);
  }

  console.log(`[1/4] 🔍 Rastreando artefactos visuales en Wikimedia Commons para "${termino}"...`);
  const cleanTerm = termino.replace(/[:(].*$/, '').replace(/-/g, ' ').trim();
  const searchQueries = [
    cleanTerm,
    cleanTerm.replace(/^(La|El|Los|Las)\s+/i, ''),
    'Hesiod Theogony',
    'Hesiod'
  ];

  for (const query of searchQueries) {
    try {
      console.log(`   -> Consultando Wikimedia Commons con término: "${query}"...`);
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=10`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'TGP-Research-Bot/1.0 (contact@thegreatpuzzleproject.com)' }
      });
      const searchData = await searchRes.json();
      const titles = (searchData.query?.search || []).map(s => s.title);

      if (titles.length > 0) {
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|mime&titles=${encodeURIComponent(titles.join('|'))}`;
        const infoRes = await fetch(infoUrl, {
          headers: { 'User-Agent': 'TGP-Research-Bot/1.0 (contact@thegreatpuzzleproject.com)' }
        });
        const infoData = await infoRes.json();
        const pages = Object.values(infoData.query?.pages || {});

        const validImages = pages
          .map(p => ({
            title: p.title,
            url: p.imageinfo?.[0]?.url,
            width: p.imageinfo?.[0]?.width || 0,
            height: p.imageinfo?.[0]?.height || 0
          }))
          .filter(img => img.url && /\.(jpe?g|png|webp|avif)/i.test(img.url.split('?')[0]))
          .sort((a, b) => (b.width * b.height) - (a.width * a.height));

        if (validImages.length > 0) {
          console.log(`  ✓ Encontradas ${validImages.length} imágenes en Wikimedia Commons para "${query}".`);
          console.log(`  ✓ Best Image Hero seleccionada: ${validImages[0].title} [${validImages[0].width}x${validImages[0].height} px]`);
          return validImages[0];
        }
      }
    } catch (err) {
      console.warn(`  ⚠ Error en Wikimedia Commons para "${query}":`, err.message);
    }
  }

  console.log(`  ⚡ Activando Fallback con síntesis visual TGP...`);
  return await generarImagenSintetica(termino);
}

// ─── 3. TRANSMUTACIÓN R2 Y RESGUARDO LOCAL SEGURO ────────────────────────────
async function transmutarYResguardar(imageResult, slug, titulo) {
  console.log(`[2/4] ⚡ Procesando imagen y asegurando resguardo local en alta definición...`);
  const rawUrl = imageResult.url;
  let r2Url = '';

  const postAssetDir = path.join(CINEMATIC_ASSETS_DIR, slug);
  if (!fs.existsSync(postAssetDir)) fs.mkdirSync(postAssetDir, { recursive: true });

  const localFilePath = path.join(postAssetDir, 'coverImage.webp');
  const relativeAssetPath = `/src/assets/ensayos-cinematicos/${slug}/coverImage.webp`;

  // 1. Guardar buffer local
  try {
    let bufferToProcess = imageResult.buffer;
    if (!bufferToProcess && rawUrl && rawUrl.startsWith('http')) {
      const imgRes = await fetch(rawUrl, {
        headers: { 'User-Agent': 'TGP-Research-Bot/1.0 (contact@thegreatpuzzleproject.com)' }
      });
      if (imgRes.ok) {
        bufferToProcess = Buffer.from(await imgRes.arrayBuffer());
      }
    }

    if (bufferToProcess) {
      const sharpModule = await import('sharp').catch(() => null);
      if (sharpModule?.default) {
        await sharpModule.default(bufferToProcess)
          .resize({ width: 2400, withoutEnlargement: true })
          .webp({ quality: 88 })
          .toFile(localFilePath);
      } else {
        fs.writeFileSync(localFilePath, bufferToProcess);
      }
      console.log(`  ✓ Resguardo local HD confirmado: ${relativeAssetPath}`);
    }
  } catch (err) {
    console.warn('  ⚠ Advertencia en resguardo local:', err.message);
  }

  // 2. Transmutar a Cloudflare R2 vía Cloud Run
  if (rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('storage.thegreatpuzzleproject.com')) {
    try {
      const res = await fetch(VAULT_IMAGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PIN}`
        },
        body: JSON.stringify({
          url: rawUrl,
          topic: topic,
          title: titulo
        })
      });

      if (res.ok) {
        const data = await res.json();
        r2Url = data.url || data.publicUrl || data.r2url || '';
        if (r2Url) {
          console.log(`  ✓ Transmutación exitosa a R2: ${r2Url}`);
        }
      }
    } catch (e) {
      console.warn('  ⚠ Transmutación omitida:', e.message);
    }
  } else if (rawUrl && rawUrl.includes('storage.thegreatpuzzleproject.com')) {
    r2Url = rawUrl;
  }

  return {
    primaryUrl: r2Url || relativeAssetPath || rawUrl,
    r2Url: r2Url || rawUrl,
    localAssetPath: relativeAssetPath
  };
}

// ─── 4. REDACCIÓN CINEMÁTICA CON GEMINI FLASH ─────────────────────────────────
async function forjarEnsayoConGemini(tema, motor) {
  console.log(`[3/4] 🧠 Redactando ensayo cinemático con ${motor.toUpperCase()}...`);

  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY no configurada.');
  }

  const prompt = `Eres un erudito clasicista, mitólogo de campo y ensayista del proyecto The Great Puzzle Project (estética Dark Academia, MUBI, prosa rigurosa, solemne y fascinante).
Escribe un ensayo cinemático monumental sobre: "${tema}".

Atmósfera conceptual: Opción 3 - Paralaje de Abismo (Profundidad Z). Tártaro, Caos primordial hesiódico, la génesis del cosmos, la castración de Urano, la Titanomaquia y el descenso a las profundidades de la memoria arcaica griega.

Detalles obligatorios:
1. El marco poético de Hesíodo (c. 700 a.C.) en Beocia, el Monte Helicón y el canto de las Musas.
2. La arquitectura del Caos primigenio: Caos, Gea, Tártaro y Eros.
3. El conflicto genealógico y la mutilación de Urano por Cronos.
4. La Titanomaquia y el confinamiento de los Titanes en el abismo del Tártaro (la distancia medida por el yunque de bronce que cae durante nueve días y nueve noches).
5. Epistemología del mito: El tránsito de la cosmogonía violenta hacia la justicia divina (Diké) de Zeus y su relación con las cosmologías del Próximo Oriente (Enuma Elish, el ciclo Kumarbi hitita).

Devuelve estrictamente un JSON válido con esta estructura:
{
  "title": "La Teogonía de Hesíodo: El Abismo Primordial y el Tiempo de los Titanes",
  "subtitle": "Cosmogonía del Caos, la Mutilación de Urano y el Yunque del Tártaro",
  "volanta": "Mitología Arcaica & Arqueología Epistémica",
  "abstract": "Párrafo cautivador de 3 líneas sobre el surgimiento del cosmos a partir de la sima primordial del Caos y la tragedia cósmica de las dinastías titánicas.",
  "era": "Grecia Arcaica (c. 700 a.C.)",
  "date": "${new Date().toISOString().split('T')[0]}",
  "badge": "Paralaje de Abismo",
  "category": "Alternative · Enigmas Subterráneos",
  "content": "Cuerpo completo del ensayo en Markdown con subtítulos ## y ###, citas poéticas en blockquote >, análisis filológico y una sección final ## Fuentes Eruditas & Referencias Históricas con bibliografía canónica (Hesíodo, M.L. West, Vernant, Kirk \u0026 Raven)."
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (Status ${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Respuesta vacía de Gemini.');

  return JSON.parse(rawText);
}

// ─── 5. GUARDADO KEYSTATIC NATIVO (index.json + content.mdoc) ─────────────────
async function guardarPostCinematico(ensayo, imagePackage) {
  console.log(`[4/4] 📁 Guardando ensayo en src/content/ensayos-cinematicos/ (Keystatic)...`);

  const rawSlug = (ensayo.title || topic)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const slug = rawSlug.slice(0, 50).replace(/-$/, '');

  const postDir = path.join(CINEMATIC_CONTENT_DIR, slug);
  if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });

  const coverUrl = imagePackage.primaryUrl;
  const galleryList = [coverUrl];

  // 1. index.json de Keystatic para ensayosCinematicos
  const indexJson = {
    title: ensayo.title,
    category: ensayo.category || 'Alternative · Enigmas Subterráneos',
    volanta: ensayo.volanta || 'Mitología Arcaica',
    date: ensayo.date || new Date().toISOString().split('T')[0],
    atmosfera: {
      discriminant: atmosfera
    },
    coverImage: coverUrl,
    gallery: galleryList,
    excerpt: ensayo.abstract || '',
    dek: ensayo.subtitle || ensayo.abstract || '',
    generador: modelName,
    generadorTexto: JSON.stringify({
      text: ensayo.content,
      image: coverUrl
    })
  };

  fs.writeFileSync(path.join(postDir, 'index.json'), JSON.stringify(indexJson, null, 2), 'utf8');

  // 2. content.mdoc para el editor Markdoc de Keystatic
  fs.writeFileSync(path.join(postDir, 'content.mdoc'), ensayo.content, 'utf8');

  console.log(`  ✓ index.json y content.mdoc guardados en: src/content/ensayos-cinematicos/${slug}/`);

  // 3. Vincular a custom-collections.ts en la colección Alternative · Enigmas Subterráneos
  try {
    if (fs.existsSync(CUSTOM_COLLECTIONS_FILE)) {
      let customSrc = fs.readFileSync(CUSTOM_COLLECTIONS_FILE, 'utf8');
      if (!customSrc.includes(`slug: '${slug}'`)) {
        const itemCode = `      {
        slug: '${slug}',
        href: '/ensayos-cinematicos/${slug}/',
        img: '${coverUrl}',
        entry: {
          title: '${ensayo.title.replace(/'/g, "\\'")}',
          category: 'Alternative · Enigmas Subterráneos',
          coverImage: '${coverUrl}',
          excerpt: '${(ensayo.abstract || '').replace(/'/g, "\\'")}',
          dek: '${(ensayo.subtitle || ensayo.abstract || '').replace(/'/g, "\\'")}',
          date: '${new Date().toISOString()}',
          themeColor: 'abismo',
          sitio: 'Monte Helicón & Beocia, Grecia',
        },
      },\n`;
        const marker = "catKey: 'enigmas-subterraneos',\n    catLabel: 'Alternative · Enigmas Subterráneos',\n    href: '/colecciones/enigmas-subterraneos/',\n    entorno: 'Capadocia · Valle de Beqaa · Hipogeos de la India',\n    essays: [\n";
        if (customSrc.includes(marker)) {
          customSrc = customSrc.replace(marker, marker + itemCode);
          fs.writeFileSync(CUSTOM_COLLECTIONS_FILE, customSrc, 'utf8');
          console.log(`  ✓ Post integrado en el frente de la colección 'Alternative · Enigmas Subterráneos'.`);
        }
      }
    }
  } catch (cErr) {
    console.warn('  ⚠ No se pudo actualizar custom-collections.ts:', cErr.message);
  }

  // URLs interactivas
  const postUrl = `http://localhost:4321/ensayos-cinematicos/${slug}/`;
  const storageUrl = imagePackage.r2Url;

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ ENSAYO CINEMÁTICO PUBLICADO EXITOSAMENTE                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`◈ URL del Post: ${postUrl}`);
  console.log(`◈ URL de Storage R2: ${storageUrl}\n`);

  return { slug, postUrl, storageUrl, title: ensayo.title };
}

// ─── EJECUCIÓN PRINCIPAL ─────────────────────────────────────────────────────
(async () => {
  try {
    const imageResult = await buscarOgenerarImagen(topic);
    const slugPreview = topic
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 50).replace(/-$/, '');

    const imagePackage = await transmutarYResguardar(imageResult, slugPreview, topic);
    const ensayo = await forjarEnsayoConGemini(topic, engine);
    const resultado = await guardarPostCinematico(ensayo, imagePackage);

    console.log(`LATEST_POST_URL=${resultado.postUrl}`);
    console.log(`STORAGE_URL=${resultado.storageUrl}`);
  } catch (err) {
    console.error('❌ Error fatal en el pipeline cinemático:', err);
    process.exit(1);
  }
})();
