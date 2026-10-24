// ─────────────────────────────────────────────────────────────────────────────
// TGP Hemeroteca · Motor Pre-Fetch de Curaduría Visual (Wikimedia Commons + Gemini)
// Joya 2 (Lote 2): Agente Documentalista + CirrusSearch + Ratio + Licencias
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';

export interface WikiCuratedImage {
  id: string;
  pageId: number;
  title: string;
  cleanTitle: string;
  url: string;
  thumbUrl: string;
  descriptionUrl: string;
  author: string;
  description: string;
  date: string;
  license: string;
  licenseShortName: string;
  isCC0OrPublicDomain: boolean;
  licenseType: 'cc0' | 'pd' | 'cc-by' | 'cc-by-sa' | 'other';
  width: number;
  height: number;
  aspectRatio: number;
  isLandscape: boolean;
  isUltrawide: boolean;
  is16x9Plus: boolean;
  rawBytesEstimated: number;
  webpBytesEstimated: number;
}

export interface WikiCuratorEngineOptions {
  query: string;
  limit?: number; // default: 40
  useGeminiAgent?: boolean;
  apiKey?: string;
}

export interface WikiCuratorEngineResult {
  searchTermOriginal: string;
  searchTermEnglish: string;
  rationale?: string;
  images: WikiCuratedImage[];
  stats: {
    total: number;
    cc0OrPdCount: number;
    wide16x9PlusCount: number;
    totalRawMbEstimated: number;
    totalWebpMbEstimated: number;
    savedMbEstimated: number;
  };
}

export const PROMPT_AGENTE_DOCUMENTALISTA = `Actúa como Agente Documentalista Visual y Archivista Experto de Wikimedia Commons para The Great Puzzle Project (TGP Hemeroteca).
Tu objetivo es tomar una consulta de búsqueda en español sobre arqueología, historia, civilizaciones o monumentos y traducirla al término canónico en inglés más efectivo para el motor CirrusSearch de Wikimedia Commons.

REGLAS DE BÚSQUEDA CANÓNICA:
1. Traduce nombres propios y locaciones históricas a su denominación patrimonial canónica en inglés (ej: "Pirámide de Keops" -> "Great Pyramid of Giza exterior", "Guerreros de terracota" -> "Terracotta Army figures excavation").
2. Evita términos turísticos o coloquiales; utiliza terminología arqueológica, arquitectónica y documental (ej: "monolithic", "relief", "façade", "excavation", "architecture", "ruins", "temple", "statue").
3. Si el término original ya está en inglés, depúralo eliminando palabras vacías.
4. Devuelve ÚNICAMENTE un objeto JSON estrictamente válido sin formato markdown con esta estructura:
{
  "englishTerm": "término de búsqueda optimizado en inglés",
  "keywords": ["palabra1", "palabra2", "palabra3"],
  "rationale": "breve justificación archivística"
}`;

/**
 * Pasa la consulta por Gemini Flash a temperatura 0.2 para obtener el término exacto en inglés.
 */
export async function getCanonicalEnglishTerm(
  querySpanish: string,
  apiKey?: string
): Promise<{ englishTerm: string; rationale?: string }> {
  let key = apiKey;
  if (!key && typeof import.meta !== 'undefined' && (import.meta as any).env?.GEMINI_API_KEY) {
    key = (import.meta as any).env.GEMINI_API_KEY;
  }
  if (!key && typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    key = process.env.GEMINI_API_KEY;
  }

  // Fallback heurístico si no hay API key disponible
  if (!key) {
    return { englishTerm: sanitizeFallbackQuery(querySpanish) };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${PROMPT_AGENTE_DOCUMENTALISTA}\n\nCONSULTA EN ESPAÑOL:\n${querySpanish}` }],
        },
      ],
      config: {
        temperature: 0.2,
      },
    });

    const rawText = response.text?.trim() || '';
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.englishTerm && typeof parsed.englishTerm === 'string') {
      return {
        englishTerm: parsed.englishTerm.trim(),
        rationale: parsed.rationale || undefined,
      };
    }
  } catch (err) {
    console.warn('[wikiCuratorEngine] Fallback heurístico por error en Gemini:', (err as any)?.message);
  }

  return { englishTerm: sanitizeFallbackQuery(querySpanish) };
}

function sanitizeFallbackQuery(query: string): string {
  return query
    .replace(/[¿?¡!]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
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

/**
 * Clasificación booleana y semántica de licencias Wikimedia Commons.
 */
function classifyLicense(licenseStr: string = '', licenseShort: string = ''): {
  isCC0OrPublicDomain: boolean;
  licenseType: 'cc0' | 'pd' | 'cc-by' | 'cc-by-sa' | 'other';
} {
  const text = `${licenseStr} ${licenseShort}`.toLowerCase();

  const isCC0 = text.includes('cc0') || text.includes('zero') || text.includes('no rights reserved');
  const isPD = text.includes('pd') || text.includes('public domain') || text.includes('dominio público') || text.includes('pd-old') || text.includes('pd-art');
  const isCCBySa = text.includes('cc-by-sa') || text.includes('cc by-sa') || text.includes('sharealike') || text.includes('sa 4.0') || text.includes('sa 3.0');
  const isCCBy = !isCCBySa && (text.includes('cc-by') || text.includes('cc by') || text.includes('attribution'));

  const isCC0OrPublicDomain = isCC0 || isPD;
  const licenseType: 'cc0' | 'pd' | 'cc-by' | 'cc-by-sa' | 'other' = 
    isCC0 ? 'cc0' : isPD ? 'pd' : isCCBySa ? 'cc-by-sa' : isCCBy ? 'cc-by' : 'other';

  return { isCC0OrPublicDomain, licenseType };
}

/**
 * Motor Principal de Curaduría Visual TGP:
 * Consulta 40 fotos con CirrusSearch, filtra bitmap, calcula aspect ratio y evalúa licencias.
 */
export async function searchWikiCurator(
  options: WikiCuratorEngineOptions
): Promise<WikiCuratorEngineResult> {
  const { query, limit = 40, useGeminiAgent = true, apiKey } = options;

  let englishTerm = query;
  let rationale: string | undefined = undefined;

  if (useGeminiAgent) {
    const translation = await getCanonicalEnglishTerm(query, apiKey);
    englishTerm = translation.englishTerm;
    rationale = translation.rationale;
  }

  // Operadores CirrusSearch canónicos según Joya 2
  const cirrusQuery = `${englishTerm} filetype:bitmap fileres:>1000 -intitle:map -intitle:svg -intitle:diagram`;

  const commonsParams = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: cirrusQuery,
    gsrnamespace: '6', // Multimedia File:
    gsrlimit: String(Math.min(limit, 50)),
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1600', // Pre-fetch de alta fidelidad para el Hero Cinemático
    origin: '*',
  });

  const targetUrl = `https://commons.wikimedia.org/w/api.php?${commonsParams.toString()}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'TGPHemerotecaCurator/1.0 (contact@thegreatpuzzleproject.com; Visual Engine)',
      },
    });

    if (!res.ok) {
      throw new Error(`Respuesta inválida de Wikimedia: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.query || !data.query.pages) {
      return {
        searchTermOriginal: query,
        searchTermEnglish: englishTerm,
        rationale,
        images: [],
        stats: { total: 0, cc0OrPdCount: 0, wide16x9PlusCount: 0, totalRawMbEstimated: 0, totalWebpMbEstimated: 0, savedMbEstimated: 0 },
      };
    }

    const pages = Object.values(data.query.pages) as any[];

    const images: WikiCuratedImage[] = pages
      .map((page): WikiCuratedImage | null => {
        const info = page.imageinfo?.[0];
        if (!info || !info.url) return null;

        const rawUrl = info.url as string;
        // Solo mapas de bits reales
        if (!/\.(jpe?g|png|webp|tiff?)(\?.*)?$/i.test(rawUrl)) return null;

        const width = Number(info.width) || 1600;
        const height = Number(info.height) || 900;
        const aspectRatio = Number((width / height).toFixed(3));
        const isLandscape = aspectRatio >= 1.3;
        const is16x9Plus = aspectRatio >= 1.7;
        const isUltrawide = aspectRatio >= 2.0;

        const extmeta = info.extmetadata || {};
        const author = stripHtml(extmeta.Artist?.value || '') || 'Autor en Wikimedia';
        const description = stripHtml(extmeta.ImageDescription?.value || '') || '';
        const date = stripHtml(extmeta.DateTimeOriginal?.value || extmeta.DateTime?.value || '') || '';
        const licenseShortName = stripHtml(extmeta.LicenseShortName?.value || extmeta.UsageTerms?.value || 'Dominio Público');
        const license = stripHtml(extmeta.License?.value || 'pd');

        const { isCC0OrPublicDomain, licenseType } = classifyLicense(license, licenseShortName);

        const cleanTitle = (page.title || '')
          .replace(/^File:/i, '')
          .replace(/_/g, ' ')
          .replace(/\.[^/.]+$/, '');

        // Estimación de peso basada en tamaño real o píxeles
        const rawBytesEstimated = Number(info.size) || Math.round(width * height * 0.45);
        const webpBytesEstimated = Math.round(rawBytesEstimated * 0.18); // ~82% de compresión promedio con Sharp q82

        return {
          id: `wiki-${page.pageid}`,
          pageId: page.pageid,
          title: page.title || '',
          cleanTitle,
          url: rawUrl,
          thumbUrl: info.thumburl || rawUrl,
          descriptionUrl: info.descriptionurl || '',
          author,
          description,
          date,
          license,
          licenseShortName,
          isCC0OrPublicDomain,
          licenseType,
          width,
          height,
          aspectRatio,
          isLandscape,
          isUltrawide,
          is16x9Plus,
          rawBytesEstimated,
          webpBytesEstimated,
        };
      })
      .filter((item): item is WikiCuratedImage => item !== null);

    // Métricas y estadísticas calculadas
    let totalRawBytes = 0;
    let totalWebpBytes = 0;
    let cc0OrPdCount = 0;
    let wide16x9PlusCount = 0;

    images.forEach((img) => {
      totalRawBytes += img.rawBytesEstimated;
      totalWebpBytes += img.webpBytesEstimated;
      if (img.isCC0OrPublicDomain) cc0OrPdCount++;
      if (img.is16x9Plus) wide16x9PlusCount++;
    });

    const totalRawMbEstimated = Number((totalRawBytes / (1024 * 1024)).toFixed(2));
    const totalWebpMbEstimated = Number((totalWebpBytes / (1024 * 1024)).toFixed(2));
    const savedMbEstimated = Number((totalRawMbEstimated - totalWebpMbEstimated).toFixed(2));

    return {
      searchTermOriginal: query,
      searchTermEnglish: englishTerm,
      rationale,
      images,
      stats: {
        total: images.length,
        cc0OrPdCount,
        wide16x9PlusCount,
        totalRawMbEstimated,
        totalWebpMbEstimated,
        savedMbEstimated,
      },
    };
  } catch (error) {
    console.error('[wikiCuratorEngine] Error consultando Commons:', error);
    return {
      searchTermOriginal: query,
      searchTermEnglish: englishTerm,
      rationale,
      images: [],
      stats: { total: 0, cc0OrPdCount: 0, wide16x9PlusCount: 0, totalRawMbEstimated: 0, totalWebpMbEstimated: 0, savedMbEstimated: 0 },
    };
  }
}
