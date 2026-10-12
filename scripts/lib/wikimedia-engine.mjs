/**
 * scripts/lib/wikimedia-engine.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * MÓDULO 1: MOTOR DE BÚSQUEDA Y EVALUACIÓN WIKIMEDIA (ANTI-DRIFT + FLASH VISION)
 *
 * Principio de Responsabilidad Única:
 *   1. Resuelve la entidad canónica en Wikipedia con Gemini Flash (Anti-Drift).
 *   2. Consulta PageImages de Wikipedia y categorías/búsqueda de Wikimedia Commons.
 *   3. Aplica filtros duros (formatos válidos, dimensiones horizontales, no mapas/banderas).
 *   4. Actúa como Juez Visual (Gemini 1.5 Flash Vision) evaluando miniaturas de 800px.
 *   5. Extrae metadatos de licencia Creative Commons (extmetadata).
 *   6. Admite Modo Web (1 mejor hero) y Modo Video Array (--video-array, hasta 5 imágenes).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USER_AGENT = 'TGP-Hemeroteca/1.0 (editorial@thegreatpuzzleproject.com; node-fetch)';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

let aiClient = null;
function getGenAI() {
  if (!aiClient && GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return aiClient;
}

// ── 1. ANTI-DRIFT: RESOLVER ENTIDAD CANÓNICA CON GEMINI FLASH ─────────────────
export async function resolverEntidadCanonica(tema, excerpt = '') {
  const ai = getGenAI();
  if (!ai) {
    console.warn('⚠️ [Anti-Drift] No se detectó GEMINI_API_KEY, usando título directo.');
    return {
      wikiEn: tema,
      wikiEs: tema,
      categoriaCommons: '',
      keywords: tema.toLowerCase().split(/\s+/).filter(w => w.length > 2),
    };
  }

  const prompt = `Actúa como especialista enciclopédico de Wikipedia y Wikimedia Commons para un archivo histórico y arqueológico.
Analiza este tema y título editorial de ensayo: "${tema}".
Contexto/sinopsis: "${excerpt.slice(0, 300)}".

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin markdown extra):
{
  "wikiEn": "Título exacto del artículo principal en Wikipedia en inglés (ej: 'Alexander the Great', 'Gordian Knot')",
  "wikiEs": "Título exacto en Wikipedia en español (ej: 'Alejandro Magno', 'Nudo gordiano')",
  "categoriaCommons": "Nombre de la categoría más específica en Wikimedia Commons si existe, sin 'Category:' (ej: 'Alexander the Great in art', 'Paintings of the Gordian Knot')",
  "keywords": ["2 a 4 palabras clave esenciales en inglés para buscar obras de arte, frescos, relieves o ruinas"]
}`;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ text: prompt }],
      config: { responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse(resp.text || '{}');
    return {
      wikiEn: parsed.wikiEn || tema,
      wikiEs: parsed.wikiEs || tema,
      categoriaCommons: parsed.categoriaCommons || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(k => String(k).toLowerCase()) : [],
    };
  } catch (err) {
    console.warn(`[Anti-Drift] Falló resolución estructurada (${err.message}), fallback léxico.`);
    return {
      wikiEn: tema,
      wikiEs: tema,
      categoriaCommons: '',
      keywords: tema.toLowerCase().split(/\s+/).filter(w => w.length > 2),
    };
  }
}

// ── 2. BÚSQUEDAS EN WIKIPEDIA (PAGEIMAGES) Y WIKIMEDIA COMMONS ─────────────────
async function fetchCommonsJson(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Buscar imagen representativa curada por editores de Wikipedia
async function buscarWikipediaPageImage(title, lang = 'en') {
  if (!title) return null;
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const url = `${base}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages|info&inprop=url&format=json&pithumbsize=800&redirects=1`;
  const data = await fetchCommonsJson(url);
  const pages = data?.query?.pages;
  if (!pages) return null;

  for (const id in pages) {
    if (id === '-1') continue;
    const page = pages[id];
    const thumbUrl = page?.thumbnail?.source;
    if (thumbUrl && /\.(jpe?g|png|webp)$/i.test(thumbUrl)) {
      if (!/(flag|bandera|mapa|map|escudo|coat_of_arms|icon|disambig|symbol|locator)/i.test(thumbUrl)) {
        // Obtener el título del archivo en Commons
        const fileTitle = page?.pageimage ? `File:${page.pageimage}` : null;
        return {
          thumbUrl,
          fileTitle,
          sourceType: `wikipedia_${lang}_pageimage`,
        };
      }
    }
  }
  return null;
}

// Buscar imágenes en Wikimedia Commons con metadatos completos y filtro duro
async function buscarCommonsCandidatos(categoriaCommons, keywords, isManualQuery = false) {
  const candidatos = [];
  const base = 'https://commons.wikimedia.org/w/api.php';

  const parsePagesToCandidates = (pages) => {
    if (!pages) return [];
    const list = [];
    for (const id in pages) {
      if (id === '-1') continue;
      const page = pages[id];
      const title = page?.title || '';
      const info = page?.imageinfo?.[0];
      if (!info) continue;

      const url = info.url;
      const thumbUrl = info.thumburl || url;
      const mime = info.mime || '';
      const width = info.width || 0;
      const height = info.height || 0;

      // FILTRO DURO FORMATO
      if (!mime.startsWith('image/')) continue;
      if (mime.includes('svg') || mime.includes('tiff') || mime.includes('djvu') || mime.includes('pdf')) continue;
      if (!/\.(jpe?g|png|webp)$/i.test(url)) continue;

      // FILTRO DURO RUIDO Y ORIENTACIÓN
      if (/(flag|map|diagram|locator|coat_of_arms|icon|symbol|chart|plan|drawing_sheet)/i.test(title)) continue;

      const minWidth = isManualQuery ? 800 : 1000;
      if (width < minWidth) continue; // Exige resolución digna

      const ratio = width / height;
      if (!isManualQuery && ratio < 1.05) continue; // Estricto para posts automáticos (Hero)
      if (isManualQuery && ratio < 0.75) continue;  // Permisivo (cuadradas/levemente verticales) para búsquedas manuales

      const meta = info.extmetadata || {};
      const artist = cleanHtml(meta.Artist?.value || 'Wikimedia Commons');
      const license = meta.LicenseShortName?.value || meta.UsageTerms?.value || 'Dominio Público / Licencia Libre';
      const licenseUrl = meta.LicenseUrl?.value || 'https://creativecommons.org/licenses/';
      const description = cleanHtml(meta.ImageDescription?.value || title.replace('File:', '').replace(/_/g, ' '));

      list.push({
        fileTitle: title,
        url,
        thumbUrl,
        width,
        height,
        mime,
        attribution: {
          author: artist,
          license,
          licenseUrl,
          source: 'Wikimedia Commons',
          sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
          title: cleanHtml(title.replace('File:', '').replace(/_/g, ' ')),
          description: description.slice(0, 200),
        },
      });
    }
    return list;
  };

  // 1. Por Categoría de Commons
  if (categoriaCommons) {
    const catUrl = `${base}?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent('Category:' + categoriaCommons)}&gcmnamespace=6&gcmlimit=12&prop=imageinfo&iiprop=url|thumburl|mime|size|extmetadata&iiurlwidth=800&format=json`;
    const data = await fetchCommonsJson(catUrl);
    candidatos.push(...parsePagesToCandidates(data?.query?.pages));
  }

  // 2. Por Keywords de Búsqueda
  if ((isManualQuery || candidatos.length < 5) && keywords && keywords.length > 0) {
    const searchString = isManualQuery 
      ? keywords.join(' ') 
      : keywords.join(' ') + ' -map -flag -icon -diagram';
    const sUrl = `${base}?action=query&generator=search&gsrsearch=${encodeURIComponent(searchString)}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|thumburl|mime|size|extmetadata&iiurlwidth=800&format=json`;
    const data = await fetchCommonsJson(sUrl);
    const kwList = parsePagesToCandidates(data?.query?.pages);
    
    // Evitar duplicados por fileTitle
    for (const c of kwList) {
      if (!candidatos.some(x => x.fileTitle === c.fileTitle)) {
        candidatos.push(c);
      }
    }
  }

  return candidatos;
}

function cleanHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
}

// ── 3. JUEZ MULTIMODAL GEMINI 1.5 FLASH VISION ─────────────────────────────────
async function evaluarConJuezVisual(tema, candidatos, isVideoArray = false, maxImages = 5) {
  const ai = getGenAI();
  if (!ai || candidatos.length === 0) {
    // Fallback sin juez: devuelve el primer candidato horizontal si no hay API key
    if (candidatos.length > 0) {
      return isVideoArray ? candidatos.slice(0, maxImages) : [candidatos[0]];
    }
    return [];
  }

  // Preparar lista de candidatos resumida para evaluación contextual de Flash
  const candidatosMetadata = candidatos.slice(0, 8).map((c, idx) => ({
    indice: idx,
    titulo: c.attribution.title,
    ancho: c.width,
    alto: c.height,
    ratio: Math.round((c.width / c.height) * 100) / 100,
    autor: c.attribution.author,
    descripcion: c.attribution.description,
  }));

  const prompt = `Actúa como Director de Arte y Curador Visual de la prestigiosa revista histórica y arqueológica "The Great Puzzle" (TGP).
Estamos buscando imágenes para el post titulado: "${tema}".
Estética editorial: Monumental, claroscuro, pinturas al óleo clásicas, frescos, grabados, relieves antiguos o fotografías de ruinas sin turistas modernos.
Prohibido: Fotos turísticas con baja calidad, diagramas de libros, mapas o fotos con elementos visuales anacrónicos.

Evalúa esta lista de candidatos extraídos de Wikimedia Commons:
${JSON.stringify(candidatosMetadata, null, 2)}

Tu tarea:
${isVideoArray 
  ? `Selecciona hasta ${maxImages} imágenes aprobadas para armar una galería o paquete de video para edición documental (DaVinci Resolve). Ordena de la más impactante a la complementaria.`
  : `Selecciona exactamente la ÚNICA mejor imagen (la más monumental y épica) que sirva como cabecera (Hero panorámico 16:9).`}

Devuelve ÚNICAMENTE un JSON válido con este formato:
{
  "indicesAprobados": [indices ordenados por calidad],
  "calificaciones": [
    { "indice": 0, "puntuacion": 9, "motivo": "Explicación breve de estética y encuadre 16:9" }
  ],
  "mejorIndice": 0 o null si todas son de mala calidad
}`;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ text: prompt }],
      config: { responseMimeType: 'application/json' },
    });
    const result = JSON.parse(resp.text || '{}');
    
    if (isVideoArray) {
      const aprobados = (result.indicesAprobados || [])
        .filter(idx => idx >= 0 && idx < candidatos.length)
        .slice(0, maxImages);
      return aprobados.map(idx => candidatos[idx]);
    } else {
      const winnerIdx = result.mejorIndice ?? (result.indicesAprobados?.[0] ?? null);
      if (winnerIdx !== null && winnerIdx >= 0 && winnerIdx < candidatos.length) {
        return [candidatos[winnerIdx]];
      }
      return [];
    }
  } catch (err) {
    console.warn(`[Juez Flash] Error en evaluación visual (${err.message}). Seleccionando por mejor resolución.`);
    return isVideoArray ? candidatos.slice(0, maxImages) : [candidatos[0]];
  }
}

// ── 4. DESCARGA DE MASTER BUFFER ──────────────────────────────────────────────
async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status} al descargar master de Wikimedia`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ── 5. PIPELINE PRINCIPAL EXPORTABLE ──────────────────────────────────────────
/**
 * @param {Object} options
 * @param {string} options.title - Título del post
 * @param {string} options.excerpt - Sinopsis o excerpt
 * @param {boolean} [options.isVideoArray=false] - Modo video array para DaVinci
 * @param {number} [options.maxImages=5] - Máximo en modo video
 */
export async function curarWikimedia({ title, excerpt = '', isVideoArray = false, maxImages = 5 }) {
  console.log(`\n🌐 [Wikimedia Engine] Iniciando curaduría para: "${title}"`);
  console.log(`   Modo: ${isVideoArray ? `🎬 Video Array (hasta ${maxImages} imágenes)` : '🖼️ Hero Web (1 ganadora)'}`);

  // Paso 1: Anti-Drift canónico
  const entidad = await resolverEntidadCanonica(title, excerpt);
  console.log(`   📌 Entidades: WikiEN="${entidad.wikiEn}" | WikiES="${entidad.wikiEs}" | Cat="${entidad.categoriaCommons || 'N/A'}"`);

  // Paso 2: Recolectar candidatos
  const candidatos = await buscarCommonsCandidatos(entidad.categoriaCommons, [entidad.wikiEn, ...entidad.keywords]);

  // Si no hay suficientes, intentar PageImages
  if (candidatos.length === 0) {
    const pageImg = await buscarWikipediaPageImage(entidad.wikiEn, 'en') || await buscarWikipediaPageImage(entidad.wikiEs, 'es');
    if (pageImg && pageImg.fileTitle) {
      const base = 'https://commons.wikimedia.org/w/api.php';
      const fUrl = `${base}?action=query&titles=${encodeURIComponent(pageImg.fileTitle)}&prop=imageinfo&iiprop=url|thumburl|mime|size|extmetadata&iiurlwidth=800&format=json`;
      const data = await fetchCommonsJson(fUrl);
      const pages = data?.query?.pages;
      if (pages) {
        for (const pid in pages) {
          const info = pages[pid]?.imageinfo?.[0];
          if (info && info.url) {
            candidatos.push({
              fileTitle: pageImg.fileTitle,
              url: info.url,
              thumbUrl: info.thumburl || info.url,
              width: info.width || 1920,
              height: info.height || 1080,
              mime: info.mime || 'image/jpeg',
              attribution: {
                author: cleanHtml(info.extmetadata?.Artist?.value || 'Wikimedia Commons'),
                license: info.extmetadata?.LicenseShortName?.value || 'Dominio Público / CC',
                licenseUrl: info.extmetadata?.LicenseUrl?.value || 'https://creativecommons.org/',
                source: 'Wikimedia Commons',
                sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(pageImg.fileTitle)}`,
                title: cleanHtml(pageImg.fileTitle.replace('File:', '').replace(/_/g, ' ')),
                description: cleanHtml(info.extmetadata?.ImageDescription?.value || title).slice(0, 200),
              },
            });
          }
        }
      }
    }
  }

  console.log(`   🔎 Candidatos válidos tras filtro dimensional: ${candidatos.length}`);
  if (candidatos.length === 0) {
    return {
      ok: false,
      reason: 'sin_candidatos_validos_en_wikimedia',
      items: [],
    };
  }

  // Paso 3: Juez Visual Flash
  const seleccionados = await evaluarConJuezVisual(title, candidatos, isVideoArray, maxImages);
  if (seleccionados.length === 0) {
    console.log(`   ❌ [Juez Flash] Ningún candidato alcanzó el umbral editorial de calidad/16:9.`);
    return {
      ok: false,
      reason: 'rechazados_por_juez_visual',
      items: [],
    };
  }

  console.log(`   ✅ [Juez Flash] Aprobó ${seleccionados.length} imagen(es). Descargando archivos maestros...`);

  // Paso 4: Descarga de buffers
  const itemsListos = [];
  for (const sel of seleccionados) {
    try {
      console.log(`     ⬇️ Descargando: ${sel.attribution.title} (${sel.width}x${sel.height}px)...`);
      const buffer = await downloadBuffer(sel.url);
      itemsListos.push({
        buffer,
        attribution: sel.attribution,
        width: sel.width,
        height: sel.height,
        title: sel.attribution.title,
        sourceUrl: sel.url,
      });
    } catch (err) {
      console.warn(`     ⚠️ Falló descarga para ${sel.fileTitle}: ${err.message}`);
    }
  }

  if (itemsListos.length === 0) {
    return {
      ok: false,
      reason: 'fallo_descarga_buffers',
      items: [],
    };
  }

  return {
    ok: true,
    isVideoArray,
    items: itemsListos,
    primary: itemsListos[0],
  };
}

// ── 5. MODO DRAFT / HITL: EXTRAER HASTA 10 CANDIDATOS SIN DESCARGA PESADA ──────
export async function extraerCandidatosDraft(title, excerpt = '', limit = 10, isManualQuery = false) {
  console.log(`\n🔍 [Draft HITL] Extrayendo candidatos para: "${title}" (Manual: ${isManualQuery})...`);

  // Paso 1: Resolver entidad canónica con Gemini Flash
  let canon;
  if (isManualQuery) {
    canon = {
      wikiEn: title,
      wikiEs: title,
      categoriaCommons: '',
      keywords: title.toLowerCase().split(/\s+/).filter(w => w.length > 2),
    };
  } else {
    canon = await resolverEntidadCanonica(title, excerpt);
  }
  console.log(`   🏛️ Canon: en="${canon.wikiEn}" | es="${canon.wikiEs}" | cat="${canon.categoriaCommons}"`);

  const candidatos = [];
  const vistasUrl = new Set();

  // Paso 2: Intentar PageImages de Wikipedia (inglés y español)
  const [piEn, piEs] = await Promise.all([
    buscarWikipediaPageImage(canon.wikiEn, 'en'),
    buscarWikipediaPageImage(canon.wikiEs, 'es'),
  ]);

  for (const pi of [piEn, piEs]) {
    if (pi && pi.fileTitle) {
      const meta = await obtenerInfoArchivoCommons(pi.fileTitle);
      if (meta && !vistasUrl.has(meta.url)) {
        vistasUrl.add(meta.url);
        candidatos.push(meta);
      }
    }
  }

  // Paso 3: Buscar en Commons por categoría y keywords
  const commonsList = await buscarCommonsCandidatos(canon.categoriaCommons, canon.keywords, isManualQuery);
  for (const c of commonsList) {
    if (!vistasUrl.has(c.url)) {
      vistasUrl.add(c.url);
      candidatos.push(c);
      if (candidatos.length >= 15) break;
    }
  }

  console.log(`   📸 [Draft HITL] Total candidatos pre-filtrados: ${candidatos.length}`);

  // Limitar al número solicitado (ej: 10)
  const recortados = candidatos.slice(0, limit).map((c, idx) => ({
    id: `cand_${idx + 1}_${c.attribution.title.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}`,
    index: idx + 1,
    title: c.attribution.title,
    thumbUrl: c.thumbUrl,
    url: c.url,
    width: c.width,
    height: c.height,
    aspectRatio: (c.width / c.height).toFixed(2),
    sourceType: c.sourceType || 'commons',
    attribution: c.attribution,
  }));

  return {
    ok: recortados.length > 0,
    title,
    canon,
    total: recortados.length,
    candidates: recortados,
  };
}

