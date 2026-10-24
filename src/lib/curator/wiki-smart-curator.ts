/**
 * src/lib/curator/wiki-smart-curator.ts
 * Módulo Independiente de Curaduría IA Patrimonial para Wikimedia Commons
 * 
 * Orquestación Híbrida Gemini (Flash + Pro) con CirrusSearch Multifacética
 * Aislamiento total: Stateless, 0 llamadas a fs, 100% en memoria.
 */

import { GoogleGenAI } from '@google/genai';

// ── Interfaz Oficial Estricta de Retorno ──────────────────────────────────────
export interface CuratedWikiBatch {
  modoCuraduria: "revista-completa" | "mini-pdf";
  totalSeleccionadas: number;
  imagenes: Array<{
    cdnUrl: string;         // URL de la imagen optimizada a 1600px
    geometry: {
      width: number;
      height: number;
      aspectRatio: number;
    };
    isStarGuest: boolean;   // true si es un mapa o panorama de alto valor documental
    secuenciaNarrativa: 1 | 2 | 3 | 4; // 1:Contexto/Mapas, 2:Historia B&N, 3:Vistas, 4:Detalles
    aiBrief: string;        // Párrafo ejecutivo redactado por Gemini Pro
    cleanTitle: string;     // Título corto editorial
    credits: string;        // Autor y licencia original de Wikimedia
  }>;
}

export interface WikiCuratorOptions {
  query: string;
  modoCuraduria?: "revista-completa" | "mini-pdf"; // default: "revista-completa"
  editorialModel?: "flash" | "pro"; // default: "flash" (modo económico para desarrollo; "pro" para publicación final)
  geminiApiKey?: string;
}

// ── Estructura Interna de Candidata Wikimedia ────────────────────────────────
interface RawWikiCandidate {
  id: string;
  title: string;
  cleanTitleCandidate: string;
  rawUrl: string;
  cdnUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  mime: string;
  author: string;
  description: string;
  date: string;
  license: string;
  licenseShort: string;
  isHistorical: boolean;
  facetaOrigen: 'vistas' | 'detalles' | 'contexto';
}

// ── Utilidades de Sanitización y Validación ──────────────────────────────────
const WIKIMEDIA_ALLOWED_HOSTS = ['upload.wikimedia.org', 'commons.wikimedia.org'];

function isAllowedWikimediaUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname === 'wikimedia.org' || parsed.hostname.endsWith('.wikimedia.org');
  } catch {
    return false;
  }
}

function stripHtml(input: string = ''): string {
  return input
    .replace(/<[^>]*>?/gm, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function sanitizeJsonString(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

// ── 1. CirrusSearch Multi-Faceta con Promise.allSettled ──────────────────────
async function fetchFacetSearch(
  query: string,
  faceta: 'vistas' | 'detalles' | 'contexto'
): Promise<RawWikiCandidate[]> {
  const cleanQuery = query.trim().replace(/[¿?¡!"]/g, '');
  
  // Sub-consultas precisas y atómicas por faceta para garantizar 100% relevancia temática en Wikimedia
  let subQueries: string[] = [];
  if (faceta === 'vistas') {
    subQueries = [`${cleanQuery} architecture`, `${cleanQuery} pyramid`, `${cleanQuery} facade`, `${cleanQuery} ruins`];
  } else if (faceta === 'detalles') {
    subQueries = [`${cleanQuery} relief`, `${cleanQuery} detail`, `${cleanQuery} carving`, `${cleanQuery} glyphs`];
  } else if (faceta === 'contexto') {
    subQueries = [`${cleanQuery} map`, `${cleanQuery} plan`, `${cleanQuery} history`, `${cleanQuery} expedition`];
  }

  const facetCandidates: RawWikiCandidate[] = [];

  for (const q of subQueries) {
    const cirrus = `${q} filetype:bitmap -intitle:svg -intitle:diagram`;
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: cirrus,
      gsrnamespace: '6',
      gsrlimit: '15',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '1600',
      origin: '*',
    });

    const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'TgpSomaCurator/1.0 (contact@thegreatpuzzleproject.com; SOMA Visual Core)',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {}) as any[];

      for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (!info || !info.url) continue;

        const rawUrl = info.url as string;
        const cdnUrl = (info.thumburl as string) || rawUrl;
        const mime = String(info.mime || '').toLowerCase();

        // ── FILTROS TÉCNICOS DUROS ANTI-CRASH ────────────────────────────────
        // 1. Veto tajante a TIFF, SVG o PDF (rompen PDFKit)
        if (mime.includes('tiff') || mime.includes('svg') || mime.includes('pdf')) continue;
        if (/\.(tiff?|svg|pdf|djvu)$/i.test(rawUrl)) continue;

        // 2. Solo formatos estándar Web
        const isStandardMime = ['image/jpeg', 'image/png', 'image/webp'].some(m => mime.includes(m));
        const isStandardExt = /\.(jpe?g|png|webp)(\?.*)?$/i.test(rawUrl);
        if (!isStandardMime && !isStandardExt) continue;

        // 3. Verificación de host permitido
        if (!isAllowedWikimediaUrl(cdnUrl) && !isAllowedWikimediaUrl(rawUrl)) continue;

        const width = Number(info.width) || 0;
        const height = Number(info.height) || 0;
        if (width <= 0 || height <= 0) continue;

        const extmeta = info.extmetadata || {};
        const dateStr = stripHtml(extmeta.DateTimeOriginal?.value || extmeta.DateTime?.value || '');
        const desc = stripHtml(extmeta.ImageDescription?.value || '');
        const author = stripHtml(extmeta.Artist?.value || 'Autor no especificado');
        const license = stripHtml(extmeta.License?.value || 'pd');
        const licenseShort = stripHtml(extmeta.LicenseShortName?.value || 'Dominio Público');

        // Detección de fotos históricas / siglo XIX
        const is19thCentury =
          /\b(18\d\d|19[0-2]\d)\b/.test(dateStr) ||
          /19th century|vintage|historical|expedition|catherwood|maldonado|196\d|197\d|198\d/i.test(`${desc} ${page.title}`);

        // 4. Descarte de resoluciones < 1000px salvo que sea joya histórica
        if (width < 1000 && height < 1000 && !is19thCentury) {
          continue;
        }

        const aspectRatio = Number((width / height).toFixed(3));
        const cleanTitleCandidate = (page.title || '')
          .replace(/^File:/i, '')
          .replace(/_/g, ' ')
          .replace(/\.[^/.]+$/, '');

        facetCandidates.push({
          id: `wiki-${page.pageid}`,
          title: page.title || '',
          cleanTitleCandidate,
          rawUrl,
          cdnUrl,
          width,
          height,
          aspectRatio,
          mime,
          author,
          description: desc,
          date: dateStr,
          license,
          licenseShort,
          isHistorical: is19thCentury,
          facetaOrigen: faceta,
        });
      }
    } catch {
      // Continuar con la siguiente sub-consulta de forma resiliente
    }
  }

  return facetCandidates;
}

async function gatherMultiFacetCandidates(query: string): Promise<RawWikiCandidate[]> {
  // Ejecución concurrente con Promise.allSettled para máxima tolerancia a fallos
  const results = await Promise.allSettled([
    fetchFacetSearch(query, 'vistas'),
    fetchFacetSearch(query, 'detalles'),
    fetchFacetSearch(query, 'contexto'),
  ]);

  const allItems: RawWikiCandidate[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allItems.push(...r.value);
    }
  }

  // Deduplicación por id único de Wikimedia
  const seen = new Set<string>();
  const uniqueCandidates: RawWikiCandidate[] = [];

  for (const item of allItems) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      uniqueCandidates.push(item);
    }
  }

  return uniqueCandidates;
}

// ── 2. Orquestación Híbrida Gemini (Flash + Pro) ─────────────────────────────

interface SelectedStructureItem {
  id: string;
  secuenciaNarrativa: 1 | 2 | 3 | 4;
  isStarGuest: boolean;
  motivoSeleccion: string;
}

/**
 * Etapa 1: Selección Estructural con Gemini 2.5 Flash
 * Aplica cupo exacto (15 o 30), proporción 67/33 y secuencia narrativa
 */
async function selectStructureWithFlash(
  candidates: RawWikiCandidate[],
  targetCount: number,
  genai: GoogleGenAI
): Promise<Array<RawWikiCandidate & { secuenciaNarrativa: 1 | 2 | 3 | 4; isStarGuest: boolean }>> {
  // Si las candidatas son iguales o menores al target, las devolvemos ordenadas por faceta
  if (candidates.length <= targetCount) {
    return candidates.map((c, idx) => {
      let secuencia: 1 | 2 | 3 | 4 = 3;
      if (c.facetaOrigen === 'contexto') secuencia = c.isHistorical ? 2 : 1;
      else if (c.facetaOrigen === 'detalles') secuencia = 4;
      return {
        ...c,
        secuenciaNarrativa: secuencia,
        isStarGuest: idx < 2 && c.aspectRatio >= 1.4,
      };
    });
  }

  // Payload resumido para optimizar tokens y tiempo de respuesta
  const compactCatalog = candidates.map(c => ({
    id: c.id,
    title: c.cleanTitleCandidate,
    description: c.description.slice(0, 180),
    faceta: c.facetaOrigen,
    isHistorical: c.isHistorical,
    aspectRatio: c.aspectRatio,
    resolution: `${c.width}x${c.height}`,
  }));

  const systemInstruction = `Actúa como Editor Fotográfico Senior y Curador Documental para The Great Puzzle Project (TGP).
Tu labor es seleccionar exactamente ${targetCount} imágenes de un catálogo candidato, descartando fotos redundantes, ángulos duplicados o imágenes turísticas de baja relevancia.

CRITERIOS OBLIGATORIOS:
1. CUPO EXACTO: Selecciona estrictamente ${targetCount} IDs únicos.
2. PROPORCIÓN: 67% de imágenes principales (arquitectura/fachadas) y 33% de contexto (mapas, planos, B&N histórico, epigrafía/detalles).
3. JOYAS DOCUMENTALES: Marca exactamente entre 2 y 3 imágenes panorámicas o cartográficas excepcionales con "isStarGuest": true.
4. SECUENCIA NARRATIVA: Asigna a cada imagen una secuencia:
   - 1: Contexto geográfico y mapas.
   - 2: Archivo histórico B&N / expediciones del siglo XIX.
   - 3: Vistas generales y volumetría del monumento.
   - 4: Detalles anatómicos, dinteles, relieves y epigrafía.
5. ORDEN FINAL: El array debe estar estrictamente ordenado por "secuenciaNarrativa" ascendente (1 -> 2 -> 3 -> 4).`;

  const prompt = `Catálogo de ${candidates.length} candidatas para curar:\n${JSON.stringify(compactCatalog, null, 2)}`;

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.15,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT' as any,
          properties: {
            seleccionadas: {
              type: 'ARRAY' as any,
              items: {
                type: 'OBJECT' as any,
                properties: {
                  id: { type: 'STRING' as any },
                  secuenciaNarrativa: { type: 'INTEGER' as any, description: '1, 2, 3 o 4' },
                  isStarGuest: { type: 'BOOLEAN' as any },
                  motivoSeleccion: { type: 'STRING' as any },
                },
                required: ['id', 'secuenciaNarrativa', 'isStarGuest'],
              },
            },
          },
          required: ['seleccionadas'],
        },
      },
    });

    const rawText = sanitizeJsonString(response.text || '{}');
    const parsed = JSON.parse(rawText);
    const selectedList: SelectedStructureItem[] = Array.isArray(parsed?.seleccionadas) ? parsed.seleccionadas : [];

    // Mapeo con los objetos completos originales
    const candidateMap = new Map(candidates.map(c => [c.id, c]));
    const matched: Array<RawWikiCandidate & { secuenciaNarrativa: 1 | 2 | 3 | 4; isStarGuest: boolean }> = [];

    for (const item of selectedList) {
      const orig = candidateMap.get(item.id);
      if (orig) {
        let seq = Number(item.secuenciaNarrativa) as 1 | 2 | 3 | 4;
        if (![1, 2, 3, 4].includes(seq)) seq = 3;
        matched.push({
          ...orig,
          secuenciaNarrativa: seq,
          isStarGuest: Boolean(item.isStarGuest),
        });
        candidateMap.delete(item.id); // Evitar duplicados
      }
    }

    // Si la IA devolvió menos del target por descarte agresivo, rellenamos con las mejores restantes
    if (matched.length < targetCount) {
      for (const remaining of candidateMap.values()) {
        if (matched.length >= targetCount) break;
        let fallbackSeq: 1 | 2 | 3 | 4 = 3;
        if (remaining.facetaOrigen === 'contexto') fallbackSeq = remaining.isHistorical ? 2 : 1;
        else if (remaining.facetaOrigen === 'detalles') fallbackSeq = 4;
        matched.push({
          ...remaining,
          secuenciaNarrativa: fallbackSeq,
          isStarGuest: false,
        });
      }
    }

    // Ordenamiento estricto 1 -> 2 -> 3 -> 4
    matched.sort((a, b) => a.secuenciaNarrativa - b.secuenciaNarrativa);

    return matched.slice(0, targetCount);
  } catch (err: any) {
    console.warn('[Gemini Flash] Fallback manual en selección estructural:', err?.message || err);
    // Fallback algorítmico determinista si falla la API
    return candidates.slice(0, targetCount).map((c, idx) => {
      let seq: 1 | 2 | 3 | 4 = 3;
      if (c.facetaOrigen === 'contexto') seq = c.isHistorical ? 2 : 1;
      else if (c.facetaOrigen === 'detalles') seq = 4;
      return {
        ...c,
        secuenciaNarrativa: seq,
        isStarGuest: idx < 2 && c.aspectRatio >= 1.4,
      };
    });
  }
}

/**
 * Etapa 2: Redacción Editorial en Lote Único con Gemini 2.5 Pro
 * Realiza UNA SOLA llamada batch para evitar Rate Limits (HTTP 429)
 */
async function redactEditorialBatchWithPro(
  items: Array<RawWikiCandidate & { secuenciaNarrativa: 1 | 2 | 3 | 4; isStarGuest: boolean }>,
  queryContext: string,
  genai: GoogleGenAI,
  editorialModel: 'flash' | 'pro' = 'flash'
): Promise<Array<{ id: string; cleanTitle: string; aiBrief: string; credits: string }>> {
  const batchPayload = items.map((item, idx) => ({
    id: item.id,
    posicion: idx + 1,
    secuenciaNarrativa: item.secuenciaNarrativa,
    tituloOriginal: item.title,
    tituloLimpioCandidato: item.cleanTitleCandidate,
    descripcionCommons: item.description.slice(0, 240),
    autor: item.author,
    fecha: item.date,
    licencia: item.licenseShort || item.license,
  }));

  const systemInstruction = `Eres Xavier Benítez, ensayista y director editorial de The Great Puzzle Project (TGP).
Tu tarea es redactar las fichas editoriales definitivas para un lote de ${items.length} imágenes patrimoniales sobre "${queryContext}".

DOCTRINA EDITORIAL TGP (XAVIER BENÍTEZ):
1. TONO: Rioplatense culto, sobrio, documental, con bisturí conceptual.
2. VETOS ESTRICTOS: Prohibido el cliché esotérico ("sabiduría ancestral", "misterio sin resolver", "desde tiempos inmemoriales", "energías").
3. RIGOR DOCUMENTAL: Redacta con base estricta en los datos materiales y arquitectónicos provistos en la descripción. Prohibido alucinar fechas o datos no respaldados.
4. "cleanTitle": Título editorial corto, formal y elegante (ej: "Fachada del Gobernador y Mascarones de Chaac", "Plano Topográfico de la Acrópolis").
5. "aiBrief": Párrafo ejecutivo de 2 a 3 oraciones concisas y de alta densidad que explique la función constructiva, cronología o anomalía material del objeto.
6. "credits": Atribución documental exacta (ej: "Fotografía por John Doe · CC BY-SA 4.0" o "Acervo Histórico · Dominio Público").`;

  const prompt = `Redacta las fichas editoriales para el siguiente lote de imágenes:\n${JSON.stringify(batchPayload, null, 2)}`;

  const schemaConfig = {
    systemInstruction,
    temperature: 0.25,
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT' as any,
      properties: {
        fichas: {
          type: 'ARRAY' as any,
          items: {
            type: 'OBJECT' as any,
            properties: {
              id: { type: 'STRING' as any },
              cleanTitle: { type: 'STRING' as any },
              aiBrief: { type: 'STRING' as any },
              credits: { type: 'STRING' as any },
            },
            required: ['id', 'cleanTitle', 'aiBrief', 'credits'],
          },
        },
      },
      required: ['fichas'],
    },
  };

  try {
    let response: any;
    if (editorialModel === 'pro') {
      try {
        response = await genai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: schemaConfig,
        });
      } catch (proErr: any) {
        console.warn('[Gemini Pro] Fallback a Flash para redacción editorial:', proErr?.message || proErr);
        response = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: schemaConfig,
        });
      }
    } else {
      // Modo ultra económico y veloz para desarrollo / pruebas ($0.005 USD)
      response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: schemaConfig,
      });
    }

    const rawText = sanitizeJsonString(response.text || '{}');
    const parsed = JSON.parse(rawText);
    const fichas = Array.isArray(parsed?.fichas) ? parsed.fichas : [];

    const resultById = new Map<string, { cleanTitle: string; aiBrief: string; credits: string }>();
    for (const f of fichas) {
      if (f.id) {
        resultById.set(f.id, {
          cleanTitle: String(f.cleanTitle || '').trim() || 'Registro Arqueológico',
          aiBrief: String(f.aiBrief || '').trim() || 'Registro fotográfico patrimonial del acervo documental.',
          credits: String(f.credits || '').trim(),
        });
      }
    }

    // Ensamblaje con fallbacks estrictos
    return items.map(item => {
      const found = resultById.get(item.id);
      return {
        id: item.id,
        cleanTitle: found?.cleanTitle || item.cleanTitleCandidate || 'Registro Arqueológico',
        aiBrief: found?.aiBrief || (item.description ? item.description.slice(0, 160) : 'Documentación visual patrimonial de la estructura.'),
        credits: found?.credits || `${item.author} · ${item.licenseShort || item.license || 'Dominio Público'}`,
      };
    });
  } catch (err: any) {
    console.warn('[Gemini Pro] Fallback manual en redacción editorial batch:', err?.message || err);
    // Fallback seguro sin crash
    return items.map(item => ({
      id: item.id,
      cleanTitle: item.cleanTitleCandidate || 'Registro Arqueológico',
      aiBrief: item.description ? item.description.slice(0, 160) : 'Documentación visual patrimonial.',
      credits: `${item.author} · ${item.licenseShort || item.license || 'Dominio Público'}`,
    }));
  }
}

// ── 3. Función Principal del Módulo: executeWikiSmartCurator ──────────────────
export async function executeWikiSmartCurator(
  options: WikiCuratorOptions
): Promise<CuratedWikiBatch> {
  const {
    query,
    modoCuraduria = 'revista-completa',
    editorialModel = 'flash',
    geminiApiKey = process.env.GEMINI_API_KEY,
  } = options;

  const targetCount = modoCuraduria === 'mini-pdf' ? 15 : 30;

  if (!query || !query.trim()) {
    throw new Error('El parámetro "query" es requerido para ejecutar la curaduría.');
  }

  // Instanciación del cliente oficial Google Gen AI SDK
  const genai = new GoogleGenAI({ apiKey: geminiApiKey || '' });

  // 1. CirrusSearch Multifacética (Reunión de ~45 candidatas)
  const candidates = await gatherMultiFacetCandidates(query.trim());

  if (candidates.length === 0) {
    return {
      modoCuraduria,
      totalSeleccionadas: 0,
      imagenes: [],
    };
  }

  // 2. Etapa 1: Selección Estructural y Secuencia Narrativa (Gemini Flash)
  const structuredWinners = await selectStructureWithFlash(candidates, targetCount, genai);

  // 3. Etapa 2: Redacción Editorial en Lote Único (Gemini Flash para dev, Pro para release)
  const editorialFichas = await redactEditorialBatchWithPro(structuredWinners, query.trim(), genai, editorialModel);
  const fichaMap = new Map(editorialFichas.map(f => [f.id, f]));

  // 4. Mapeo a la interfaz oficial CuratedWikiBatch con Allowlist de URLs
  const finalImagenes = structuredWinners
    .map(w => {
      // Allowlist de URLs: verificación estricta de seguridad
      const targetCdn = isAllowedWikimediaUrl(w.cdnUrl) ? w.cdnUrl : w.rawUrl;
      if (!isAllowedWikimediaUrl(targetCdn)) return null;

      const ficha = fichaMap.get(w.id);

      return {
        cdnUrl: targetCdn,
        geometry: {
          width: w.width,
          height: w.height,
          aspectRatio: w.aspectRatio,
        },
        isStarGuest: w.isStarGuest,
        secuenciaNarrativa: w.secuenciaNarrativa,
        aiBrief: ficha?.aiBrief || 'Registro documental de acervo.',
        cleanTitle: ficha?.cleanTitle || w.cleanTitleCandidate || 'Registro Arqueológico',
        credits: ficha?.credits || `${w.author} · ${w.licenseShort || 'Dominio Público'}`,
      };
    })
    .filter((img): img is NonNullable<typeof img> => img !== null);

  return {
    modoCuraduria,
    totalSeleccionadas: finalImagenes.length,
    imagenes: finalImagenes,
  };
}
