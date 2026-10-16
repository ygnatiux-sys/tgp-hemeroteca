/**
 * scripts/generate-alternative-post.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * PIPELINE COGNITIVO TGP: GENERADOR DE ENSAYOS & BEST HERO (HEMEROTECA EDITION)
 *
 * Capacidades:
 * 1. Búsqueda inteligente en Wikimedia Commons con list=search y filtro bitmap
 *    para fotos de máxima resolución (6000x4000+ px).
 * 2. Transmutación a WebP vía microservicio Cloud Run (tgp-vault-run) hacia R2 + D1.
 * 3. Fallback a síntesis documental con gemini-3.1-flash-image (Plan C).
 * 4. Redacción con Gemini 2.5 Flash o Gemini 3.1 Pro Preview (estilo Dark Academia / TGP).
 * 5. Persistencia dual compatible:
 *    - Keystatic (por defecto): src/content/ensayos/{slug}/(index.json + content.mdoc)
 *    - Astro MDX: src/content/ensayos/{slug}.mdx
 * 6. Garantía Safe Image: copia física HD en src/assets/ensayos/{slug}/coverImage.webp.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Directorios y Configuración ──────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const ENSAYOS_DIR = path.join(ROOT_DIR, 'src', 'content', 'ensayos');
const ASSETS_DIR = path.join(ROOT_DIR, 'src', 'assets', 'ensayos');

// Cargar variables de entorno locales de forma segura
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
const VAULT_IMAGE_URL = (process.env.VAULT_IMAGE_URL || 'https://tgp-vault-run-713934653057.us-central1.run.app/image-ingest').trim();
const VAULT_UPLOAD_URL = (process.env.VAULT_UPLOAD_URL || 'https://tgp-vault-run-713934653057.us-central1.run.app/vault-ingest').trim();

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

const topic = getArg('topic', 'Pumapunku y la tecnología megalítica en Tiwanaku');
const engine = getArg('engine', 'pro').toLowerCase(); // 'flash' | 'pro'
const format = getArg('format', 'keystatic').toLowerCase(); // 'keystatic' | 'mdx'
const modelName = engine === 'flash' ? 'gemini-2.5-flash' : 'gemini-3.1-pro-preview';
const heroImageArg = getArg('hero-image', '');
const galleryImageArg = getArg('gallery-image', '');
const forceSynthetic = hasFlag('force-synthetic');
const testSyntheticFallback = hasFlag('test-synthetic-fallback');

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  ⚡ PIPELINE COGNITIVO TGP: GENERADOR DE ENSAYOS & BEST HERO        ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`◈ Tema: "${topic}"`);
console.log(`◈ Motor de Texto: ${engine.toUpperCase()} (${modelName})`);
console.log(`◈ Motor Sintético: GEMINI-3.1-FLASH-IMAGE (Google AI Studio)`);
console.log(`◈ Formato de Salida: ${format.toUpperCase()}`);
console.log(`◈ Microservicio Vault: ${VAULT_IMAGE_URL}\n`);

// ─── 1. PLAN C: GENERADOR DE IMAGEN SINTÉTICA (GOOGLE AI STUDIO) ───────────────
export async function generarImagenSintetica(promptTema) {
  console.log(`\n🤖 [PLAN C: SINTÉTICA] Forjando fotografía documental con Gemini Image Engine...`);
  console.log(`   Prompt base: "${promptTema}"`);

  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY no encontrada en variables de entorno.');
  }

  const imagePrompt = `Hyper-detailed panoramic documentary photograph of ${promptTema}. Ultra-realistic geological stone texture, dramatic cinematic lighting filtering through ancient landscape, 8k resolution, authentic archaeological atmosphere, dark academia aesthetic, no modern artifacts.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${GEMINI_KEY}`;

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

  if (!imagePart?.inlineData?.data) {
    throw new Error('La respuesta de Gemini no contiene datos binarios de imagen (inlineData).');
  }

  console.log(`   ✓ Imagen sintética forjada (${imagePart.inlineData.mimeType}, ${imagePart.inlineData.data.length} bytes base64).`);
  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

  // Subir a Cloudflare R2 vía tgp-vault-run/vault-ingest si está disponible
  let r2Url = '';
  try {
    console.log(`   ⚡ Transmitiendo buffer binario a Cloudflare R2 y D1 vía tgp-vault-run...`);
    const formData = new FormData();
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), `synthetic-${Date.now()}.jpg`);
    formData.append('title', `${topic} (Visual Sintético TGP)`);
    formData.append('topic', topic);

    const headers = {};
    if (PIN) headers['Authorization'] = `Bearer ${PIN}`;

    const vaultRes = await fetch(VAULT_UPLOAD_URL, {
      method: 'POST',
      headers,
      body: formData
    });

    if (vaultRes.ok) {
      const vaultResult = await vaultRes.json();
      r2Url = vaultResult.data?.media?.publicUrl || vaultResult.url || '';
      console.log(`   ✓ Imagen sintética persistida en R2: ${r2Url}`);
    }
  } catch (vErr) {
    console.warn(`   ⚠ tgp-vault-run no disponible para sintética, procediendo con buffer local:`, vErr.message);
  }

  return {
    url: r2Url || `data:image/jpeg;base64,${imagePart.inlineData.data}`,
    buffer: imageBuffer,
    isSynthetic: true
  };
}

// ─── 2. BÚSQUEDA WIKIMEDIA COMMONS (HD HERO SELECTION) ────────────────────────
async function buscarOgenerarImagen(termino) {
  if (heroImageArg) {
    console.log(`[1/4] 🎯 Imagen Hero manual vía CLI: ${heroImageArg}`);
    return { url: heroImageArg, title: termino, isManual: true };
  }

  if (testSyntheticFallback) {
    console.log(`[1/4] 🧪 [PRUEBA FALLBACK] Simulando que Wikimedia Commons no tiene imágenes.`);
    return await generarImagenSintetica(termino);
  }

  if (forceSynthetic) {
    console.log(`[1/4] 🤖 Flag --force-synthetic activado: generando síntesis directamente...`);
    return await generarImagenSintetica(termino);
  }

  console.log(`[1/4] 🔍 Rastreando artefactos visuales en Wikimedia Commons para "${termino}"...`);
  const cleanTerm = termino.replace(/[:(].*$/, '').replace(/-/g, ' ').trim();

  try {
    // Usar list=search con filtro bitmap para asegurar la máxima calidad
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(cleanTerm + ' filetype:bitmap')}&srnamespace=6&srlimit=8`;
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
        .filter(img => img.url && (img.url.endsWith('.jpg') || img.url.endsWith('.png') || img.url.endsWith('.webp') || img.url.endsWith('.jpeg')))
        .sort((a, b) => (b.width * b.height) - (a.width * a.height)); // Ordenar de mayor a menor resolución

      if (validImages.length > 0) {
        console.log(`  ✓ Encontradas ${validImages.length} imágenes.`);
        console.log(`  ✓ Best Image Hero seleccionada: ${validImages[0].title} [${validImages[0].width}x${validImages[0].height} px]`);
        return validImages[0];
      }
    } else {
      console.warn(`  ⚠ Wikimedia Commons no devolvió archivos en list=search para "${cleanTerm}".`);
    }
  } catch (err) {
    console.warn('  ⚠ Error al consultar Wikimedia Commons:', err.message);
  }

  // Fallback automático al Plan C
  console.log(`  ⚡ Activando Fallback Sintético (Plan C)...`);
  return await generarImagenSintetica(termino);
}

// ─── 3. PLAN A: TRANSMUTACIÓN EN CLOUD RUN (R2 + D1) CON PLAN B SHARP Y RESGUARDO LOCAL
async function transmutarYResguardar(imageResult, slug, titulo) {
  console.log(`[2/4] ⚡ Procesando imagen y asegurando resguardo local en alta definición...`);
  const rawUrl = imageResult.url;
  let r2Url = '';
  let localAssetPath = '';

  const postAssetDir = path.join(ASSETS_DIR, slug);
  if (!fs.existsSync(postAssetDir)) fs.mkdirSync(postAssetDir, { recursive: true });

  // 1. Guardar copia local de máxima calidad para garantizar 100% de disponibilidad en dev y build
  try {
    const sharpModule = await import('sharp').catch(() => null);
    let bufferToProcess = imageResult.buffer;

    if (!bufferToProcess && rawUrl.startsWith('http')) {
      const imgRes = await fetch(rawUrl, {
        headers: { 'User-Agent': 'TGP-Research-Bot/1.0 (contact@thegreatpuzzleproject.com)' }
      });
      if (imgRes.ok) {
        bufferToProcess = Buffer.from(await imgRes.arrayBuffer());
      }
    }

    if (bufferToProcess) {
      const localFilePath = path.join(postAssetDir, 'coverImage.webp');
      if (sharpModule?.default) {
        await sharpModule.default(bufferToProcess)
          .resize({ width: 2400, withoutEnlargement: true })
          .webp({ quality: 88 })
          .toFile(localFilePath);
      } else {
        fs.writeFileSync(localFilePath, bufferToProcess);
      }
      localAssetPath = `/src/assets/ensayos/${slug}/coverImage.webp`;
      console.log(`  ✓ Resguardo local HD confirmado: ${localAssetPath} (${(fs.statSync(localFilePath).size / 1024).toFixed(1)} KB)`);
    }
  } catch (localErr) {
    console.warn('  ⚠ Advertencia en resguardo local:', localErr.message);
  }

  // 2. Transmutación a R2 vía Cloud Run (Plan A)
  if (rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('storage.thegreatpuzzleproject.com')) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (PIN) headers['Authorization'] = `Bearer ${PIN}`;

      const res = await fetch(VAULT_IMAGE_URL, {
        method: 'POST',
        headers,
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
      console.warn('  ⚠ Transmutación Cloud Run omitida (usando resguardo local):', e.message);
    }
  }

  return {
    primaryUrl: localAssetPath || r2Url || rawUrl,
    r2Url: r2Url || rawUrl,
    localAssetPath
  };
}

// ─── 4. REDACCIÓN ERUDITA CON GEMINI API ──────────────────────────────────────
async function forjarEnsayoConGemini(tema, motor) {
  console.log(`[3/4] 🧠 Redactando tratado con Gemini (${motor.toUpperCase()})...`);

  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY no configurada.');
  }

  const prompt = `Eres un historiador erudito, arqueólogo de campo y ensayista del proyecto The Great Puzzle Project (estética Dark Academia, estilo MUBI, prosa solemne, rigurosa y analítica).
Escribe un ensayo monumental y exhaustivo sobre: "${tema}".

Devuelve estrictamente un JSON válido con esta estructura exacta:
{
  "title": "Título monumental y evocador",
  "subtitle": "Subtítulo analítico y poético",
  "volanta": "Categoría epistemológica (ej: Arqueología Lítica & Paradigmas Disidentes)",
  "abstract": "Párrafo conciso y cautivador de 2 o 3 líneas describiendo el dilema estratigráfico",
  "era": "Período histórico o arqueológico estimado",
  "date": "Datación arqueométrica aproximada",
  "badge": "Insignia conceptual",
  "content": "Cuerpo completo del ensayo en Markdown con subtítulos ## y ###, citas textuales en blockquote >, análisis métrico/geológico riguroso y una sección final ## Fuentes Eruditas & Referencias Históricas con bibliografía especializada."
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
    throw new Error(`Gemini API respondió con status ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Respuesta vacía de Gemini al redactar el texto.');

  return JSON.parse(rawText);
}

// ─── 5. GUARDADO COMPATIBLE (KEYSTATIC / MDX) ─────────────────────────────────
async function guardarPost(ensayo, imagePackage) {
  console.log(`[4/4] 📁 Guardando ensayo en formato ${format.toUpperCase()}...`);
  
  const rawSlug = (ensayo.title || topic)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const slug = rawSlug.slice(0, 45).replace(/-$/, '');

  const coverToUse = imagePackage.localAssetPath || imagePackage.primaryUrl;
  const galleryList = [coverToUse];

  if (format === 'keystatic') {
    // Estructura oficial de Keystatic en tgp-hemeroteca:
    // src/content/ensayos/{slug}/index.json + content.mdoc
    const postDir = path.join(ENSAYOS_DIR, slug);
    if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });

    const indexJson = {
      title: ensayo.title,
      volanta: ensayo.volanta || 'Arqueología Lítica',
      draft: false,
      date: new Date().toISOString().split('T')[0],
      category: 'Historia Alternativa',
      themeColor: 'british-green',
      coverImage: coverToUse,
      heroUrl: imagePackage.r2Url || coverToUse,
      excerpt: ensayo.abstract || '',
      dek: ensayo.subtitle || ensayo.abstract || '',
      sitioGeohistorico: topic,
      publicarConImagen: true,
      generador: modelName,
      generadorTexto: modelName,
      generadorImagen: imagePackage.isSynthetic ? 'gemini-3.1-flash-image' : 'Wikimedia Commons',
      notasInvestigador: `Fuente de portada: ${imagePackage.r2Url || coverToUse}`,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(path.join(postDir, 'index.json'), JSON.stringify(indexJson, null, 2), 'utf8');
    fs.writeFileSync(path.join(postDir, 'content.mdoc'), ensayo.content, 'utf8');
    console.log(`  ✓ Ensayo guardado en: src/content/ensayos/${slug}/`);
  } else {
    // Estructura Astro MDX
    if (!fs.existsSync(ENSAYOS_DIR)) fs.mkdirSync(ENSAYOS_DIR, { recursive: true });
    const mdxPath = path.join(ENSAYOS_DIR, `${slug}.mdx`);
    const mdxContent = `---
title: "${ensayo.title.replace(/"/g, '\\"')}"
abstract: "${(ensayo.abstract || '').replace(/"/g, '\\"')}"
volanta: "${(ensayo.volanta || 'Historia Alternativa').replace(/"/g, '\\"')}"
layoutMode: "post-continuo"
powertype: "Investigación Primaria"
date: "${new Date().toISOString()}"
category: "Historia Alternativa"
themeColor: "#c9a96e"
coverImage: "${coverToUse}"
heroUrl: "${imagePackage.r2Url || coverToUse}"
gallery:
${galleryList.map(img => `  - "${img}"`).join('\n')}
draft: false
---

${ensayo.content}
`;
    fs.writeFileSync(mdxPath, mdxContent, 'utf8');
    console.log(`  ✓ Ensayo MDX guardado en: src/content/ensayos/${slug}.mdx`);
  }

  // 6. Verificación final de integridad Safe Image
  if (coverToUse.startsWith('/src/')) {
    const absPath = path.join(ROOT_DIR, coverToUse.replace(/^\//, ''));
    if (fs.existsSync(absPath)) {
      console.log(`  🛡️ [SAFE IMAGE OK] Portada verificada físicamente en disco (${(fs.statSync(absPath).size / 1024).toFixed(1)} KB).`);
    } else {
      console.warn(`  ⚠️ [SAFE IMAGE ALERTA] No se encontró el archivo local en: ${absPath}`);
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ ENSAYO PUBLICADO EN HEMEROTECA                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`   ◈ Slug: ${slug}`);
  console.log(`   ◈ URL Local: http://localhost:4321/hemeroteca/${slug}/`);
  console.log(`   ◈ Portada: ${coverToUse}\n`);

  return slug;
}

// ─── EJECUCIÓN PRINCIPAL ─────────────────────────────────────────────────────
(async () => {
  try {
    if (testSyntheticFallback) {
      console.log('🧪 Comprobando certeza del fallback sintético con gemini-3.1-flash-image...');
      const fallbackResult = await generarImagenSintetica(topic);
      console.log(`🎯 Fallback verificado con éxito.`);
      return;
    }

    // 1. Obtener imagen principal (Wiki HD o Sintética)
    const imageResult = await buscarOgenerarImagen(topic);

    // 2. Procesar y asegurar resguardo local + transmutación R2
    const slugPreview = topic
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 45).replace(/-$/, '');

    const imagePackage = await transmutarYResguardar(imageResult, slugPreview, topic);

    // 3. Forjar tratado con Gemini (Flash o Pro)
    const ensayo = await forjarEnsayoConGemini(topic, engine);

    // 4. Guardar archivo
    const finalSlug = await guardarPost(ensayo, imagePackage);

  } catch (error) {
    console.error('❌ Error en el pipeline:', error);
    process.exit(1);
  }
})();
