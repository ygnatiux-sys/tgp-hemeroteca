// ─────────────────────────────────────────────────────────────────────────────
// SOMA WIKI ENGINE v1.0 · Motor de Curaduría Visual Patrimonial (TGP Ecosystem)
// Fuentes: Wikimedia Commons + Europeana + Stub Smithsonian
// 0 Dependencias externas: fetch nativo de Node 20+
// ─────────────────────────────────────────────────────────────────────────────

export interface SomaCuratedItem {
  id: string;
  source: 'wikimedia' | 'europeana' | 'smithsonian';
  title: string;
  cleanTitle: string;
  url: string;
  thumbUrl: string;
  description: string;
  author: string;
  date: string;
  license: string;
  licenseShortName: string;
  isCC0OrPublicDomain: boolean;
  width: number;
  height: number;
  aspectRatio: number;
  isLandscape: boolean;
  is16x9Plus: boolean;
  score?: number;
}

export interface SomaSearchOptions {
  query: string;
  limit?: number; // default: 40
  sources?: ('wikimedia' | 'europeana' | 'smithsonian')[];
  geminiApiKey?: string;
  europeanaApiKey?: string;
  useGeminiAgent?: boolean;
}

export interface SomaSearchResult {
  queryOriginal: string;
  queryCanonical: string;
  rationale?: string;
  curatedBatch: SomaCuratedItem[];
  heroTop3: SomaCuratedItem[];
  stats: {
    total: number;
    wikimediaCount: number;
    europeanaCount: number;
    smithsonianCount: number;
    cc0OrPdCount: number;
    landscapeCount: number;
  };
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

function classifyLicense(licenseStr: string = '', licenseShort: string = ''): {
  isCC0OrPublicDomain: boolean;
} {
  const text = `${licenseStr} ${licenseShort}`.toLowerCase();
  const isCC0 = text.includes('cc0') || text.includes('zero') || text.includes('no rights reserved') || text.includes('publicdomain');
  const isPD = text.includes('pd') || text.includes('public domain') || text.includes('dominio público') || text.includes('pd-old') || text.includes('pd-art');
  return { isCC0OrPublicDomain: isCC0 || isPD };
}

/**
 * Agente de traducción canónica arqueológica/patrimonial con Gemini Flash vía fetch nativo REST
 */
async function getCanonicalTermGemini(
  query: string,
  apiKey?: string
): Promise<{ englishTerm: string; rationale?: string }> {
  if (!apiKey) {
    return { englishTerm: query.replace(/[¿?¡!]/g, '').trim().replace(/\s+/g, ' ') };
  }

  const prompt = `Actúa como Agente Documentalista Visual y Archivista Experto para The Great Puzzle Project (TGP SOMA Engine).
Traduce la siguiente consulta patrimonial o arqueológica en español al término canónico en inglés más efectivo para buscadores de patrimonio (Wikimedia Commons CirrusSearch y Europeana).
Evita adjetivos vacíos o términos coloquiales. Utiliza terminología documental y arquitectónica sobria (ej: "relief", "façade", "excavation", "architecture", "ruins", "monolith").

Devuelve ÚNICAMENTE un JSON válido sin markdown:
{
  "englishTerm": "término exacto en inglés",
  "rationale": "breve justificación"
}

CONSULTA: ${query}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.englishTerm && typeof parsed.englishTerm === 'string') {
        return {
          englishTerm: parsed.englishTerm.trim(),
          rationale: parsed.rationale || undefined,
        };
      }
    }
  } catch (err) {
    // Fallback silencioso y seguro a sanitización manual
  }

  return { englishTerm: query.replace(/[¿?¡!]/g, '').trim().replace(/\s+/g, ' ') };
}

/**
 * Adaptador Wikimedia Commons (CirrusSearch + API imageinfo)
 */
async function searchWikimedia(
  englishTerm: string,
  limit: number
): Promise<SomaCuratedItem[]> {
  const cirrusQuery = `${englishTerm} filetype:bitmap fileres:>1000 -intitle:map -intitle:svg -intitle:diagram`;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: cirrusQuery,
    gsrnamespace: '6',
    gsrlimit: String(Math.min(limit, 50)),
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1600',
    origin: '*',
  });

  const targetUrl = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'SomaWikiEngine/1.0 (contact@thegreatpuzzleproject.com; SOMA Visual Core)',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return [];

  const data = await res.json();
  if (!data?.query?.pages) return [];

  const pages = Object.values(data.query.pages) as any[];

  return pages
    .map((page): SomaCuratedItem | null => {
      const info = page.imageinfo?.[0];
      if (!info || !info.url) return null;

      const rawUrl = info.url as string;
      if (!/\.(jpe?g|png|webp|tiff?)(\?.*)?$/i.test(rawUrl)) return null;

      const width = Number(info.width) || 1600;
      const height = Number(info.height) || 900;
      const aspectRatio = Number((width / height).toFixed(3));
      const isLandscape = aspectRatio >= 1.3;
      const is16x9Plus = aspectRatio >= 1.7;

      const extmeta = info.extmetadata || {};
      const author = stripHtml(extmeta.Artist?.value || '') || 'Autor en Wikimedia Commons';
      const description = stripHtml(extmeta.ImageDescription?.value || '') || '';
      const date = stripHtml(extmeta.DateTimeOriginal?.value || extmeta.DateTime?.value || '') || '';
      const licenseShortName = stripHtml(extmeta.LicenseShortName?.value || extmeta.UsageTerms?.value || 'Dominio Público');
      const license = stripHtml(extmeta.License?.value || 'pd');

      const { isCC0OrPublicDomain } = classifyLicense(license, licenseShortName);

      const cleanTitle = (page.title || '')
        .replace(/^File:/i, '')
        .replace(/_/g, ' ')
        .replace(/\.[^/.]+$/, '');

      return {
        id: `wiki-${page.pageid}`,
        source: 'wikimedia',
        title: page.title || '',
        cleanTitle,
        url: rawUrl,
        thumbUrl: info.thumburl || rawUrl,
        description,
        author,
        date,
        license,
        licenseShortName,
        isCC0OrPublicDomain,
        width,
        height,
        aspectRatio,
        isLandscape,
        is16x9Plus,
      };
    })
    .filter((item): item is SomaCuratedItem => item !== null);
}

/**
 * Adaptador Europeana (REST API v2)
 */
async function searchEuropeana(
  query: string,
  limit: number,
  apiKey?: string
): Promise<SomaCuratedItem[]> {
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      wskey: apiKey,
      query: `${query} AND TYPE:IMAGE`,
      rows: String(Math.min(limit, 30)),
      profile: 'standard',
      media: 'true',
    });

    const res = await fetch(`https://api.europeana.eu/record/v2/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data?.items)) return [];

    return data.items
      .map((item: any): SomaCuratedItem | null => {
        const url = item.edmPreview?.[0] || item.edmIsShownBy?.[0];
        if (!url) return null;

        const title = Array.isArray(item.title) ? item.title[0] : item.title || 'Registro Europeana';
        const author = Array.isArray(item.dcCreator) ? item.dcCreator[0] : item.dcCreator || 'Europeana Heritage';
        const license = item.rights?.[0] || 'Europeana';
        const isCC0 = license.toLowerCase().includes('publicdomain') || license.toLowerCase().includes('zero');

        return {
          id: `europeana-${item.id?.replace(/[^a-zA-Z0-9_-]/g, '_') || Math.random().toString(36).substring(7)}`,
          source: 'europeana',
          title,
          cleanTitle: title,
          url,
          thumbUrl: url,
          description: Array.isArray(item.dcDescription) ? item.dcDescription[0] : 'Acervo Europeana Heritage',
          author,
          date: Array.isArray(item.year) ? String(item.year[0]) : '',
          license,
          licenseShortName: isCC0 ? 'CC0' : 'Europeana Rights',
          isCC0OrPublicDomain: isCC0,
          width: 1600,
          height: 1200,
          aspectRatio: 1.333,
          isLandscape: true,
          is16x9Plus: false,
        };
      })
      .filter((item): item is SomaCuratedItem => item !== null);
  } catch {
    return [];
  }
}

/**
 * Stub Smithsonian Open Access API (devuelve [] de forma segura para no romper tipos)
 */
async function searchSmithsonian(
  _query: string,
  _limit: number
): Promise<SomaCuratedItem[]> {
  return [];
}

/**
 * Algoritmo de Curaduría Editorial SOMA: Selecciona el Top 3 Hero
 * Prioriza: 1) Alta resolución panorámica (>= 1.5), 2) Licencia abierta CC0/PD, 3) Densidad visual
 */
function selectTop3Hero(items: SomaCuratedItem[]): SomaCuratedItem[] {
  const scored = items.map((item) => {
    let score = 0;
    if (item.is16x9Plus) score += 30;
    else if (item.isLandscape) score += 20;

    if (item.isCC0OrPublicDomain) score += 25;
    if (item.width >= 2000) score += 20;
    else if (item.width >= 1400) score += 10;

    if (item.description && item.description.length > 50) score += 15;
    if (item.author && !item.author.toLowerCase().includes('desconocido')) score += 10;

    return { ...item, score };
  });

  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  return scored.slice(0, 3);
}

/**
 * MOTOR PRINCIPAL: SOMA WIKI ENGINE v1.0
 */
export async function executeSomaEngine(
  options: SomaSearchOptions
): Promise<SomaSearchResult> {
  const {
    query,
    limit = 40,
    sources = ['wikimedia', 'europeana', 'smithsonian'],
    geminiApiKey,
    europeanaApiKey,
    useGeminiAgent = true,
  } = options;

  let queryCanonical = query;
  let rationale: string | undefined = undefined;

  if (useGeminiAgent) {
    const translation = await getCanonicalTermGemini(query, geminiApiKey);
    queryCanonical = translation.englishTerm;
    rationale = translation.rationale;
  }

  const tasks: Promise<SomaCuratedItem[]>[] = [];

  if (sources.includes('wikimedia')) {
    tasks.push(searchWikimedia(queryCanonical, limit));
  }
  if (sources.includes('europeana')) {
    tasks.push(searchEuropeana(queryCanonical, Math.round(limit / 2), europeanaApiKey));
  }
  if (sources.includes('smithsonian')) {
    tasks.push(searchSmithsonian(queryCanonical, limit));
  }

  const resultsNested = await Promise.all(tasks);
  const curatedBatch = resultsNested.flat().slice(0, limit);
  const heroTop3 = selectTop3Hero(curatedBatch);

  let cc0OrPdCount = 0;
  let landscapeCount = 0;
  let wikimediaCount = 0;
  let europeanaCount = 0;
  let smithsonianCount = 0;

  curatedBatch.forEach((item) => {
    if (item.isCC0OrPublicDomain) cc0OrPdCount++;
    if (item.isLandscape) landscapeCount++;
    if (item.source === 'wikimedia') wikimediaCount++;
    if (item.source === 'europeana') europeanaCount++;
    if (item.source === 'smithsonian') smithsonianCount++;
  });

  return {
    queryOriginal: query,
    queryCanonical,
    rationale,
    curatedBatch,
    heroTop3,
    stats: {
      total: curatedBatch.length,
      wikimediaCount,
      europeanaCount,
      smithsonianCount,
      cc0OrPdCount,
      landscapeCount,
    },
  };
}
