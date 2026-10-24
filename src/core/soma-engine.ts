/**
 * ============================================================================
 * SOMA WIKI ENGINE v1.2 (GOLDEN EDITION) — Motor de Extracción y Preparación
 * ============================================================================
 * Blindado contra crasheos de memoria (TIFFs) y con Tipado estructural 
 * preparado para el Smart Curator IA (Fase 1.5).
 */

export type SomaArchiveSource = 'wikimedia' | 'europeana' | 'smithsonian';
export type SomaOrientation = 'landscape' | 'portrait' | 'square' | 'any';

export interface SomaGeometry {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  scaleToFitCanvas: number;
}

export interface SomaLicenseInfo {
  shortName: string;
  usageTerms: string;
  isPublicDomainOrCC0: boolean;
  attributionRequired: boolean;
  attributionHtml: string;
  attributionPlainText: string;
}

// NUEVO: Capa preparatoria para inyección de Gemini (Fase 1.5)
export interface SomaEditorialMetadata {
  isStarGuest: boolean;
  secuenciaNarrativa?: 1 | 2 | 3 | 4;
  aiBrief?: string;
  cleanTitle?: string;
}

export interface SomaAsset {
  id: string;
  sourceArchive: SomaArchiveSource;
  title: string;
  canonicalQueryUsed: string;
  cdnUrl: string;
  rawUrl: string;
  recordUrl: string;
  mime: string;
  author: string;
  description: string;
  dateCreated: string;
  geometry: SomaGeometry;
  license: SomaLicenseInfo;
  somaScore: number;
  editorial?: SomaEditorialMetadata; // Se llenará en Fase 1.5
}

export interface SomaSearchOptions {
  limit?: number;
  overfetchPool?: number;
  cdnThumbWidth?: number;
  minWidth?: number;
  minHeight?: number;
  orientation?: SomaOrientation;
  onlyCC0OrPublicDomain?: boolean;
  sources?: SomaArchiveSource[];
  targetCanvas?: { width: number; height: number };
  geminiApiKey?: string;
  europeanaApiKey?: string;
  smithsonianApiKey?: string;
  timeoutMs?: number;
  userAgent?: string;
  useGeminiAgent?: boolean; // Compatibilidad retroactiva
}

export interface SomaSearchResult {
  originalQuery: string;
  canonicalQuery: string;
  totalCandidatesScanned: number;
  curatedBatch: SomaAsset[];
  heroTop3: SomaAsset[];
  warnings: string[]; // NUEVO: Registro forense de archivos peligrosos esquivados
  stats?: {           // Compatibilidad retroactiva
    total: number;
    wikimediaCount: number;
    europeanaCount: number;
    smithsonianCount: number;
    cc0OrPdCount: number;
    landscapeCount: number;
  };
}

const SOMA_PROMPTS = {
  DOCUMENTALISTA_ONTOLOGICO: `
Eres un bibliotecario experto de Wikimedia Commons, Europeana y Smithsonian.
Tu único trabajo es tomar la idea de búsqueda del usuario (en cualquier idioma) y devolver el TÉRMINO DE BÚSQUEDA EXACTO Y CANÓNICO en inglés enciclopédico.
Ejemplo: 'piramide sarcofago en roma' -> 'Pyramid of Cestius'
DEVUELVE ÚNICAMENTE EL TÉRMINO EN INGLÉS.`.trim()
};

const GARBAGE_TITLE_REGEX = /\b(flag|coat of arms|escudo|bandera|locator|blank map|icon|symbol|logo|signature|stamp|seal|coin|pdf|djvu|svg|user:|talk:|template:)\b/i;

// REGLA DE ORO ANTI-OOM: Exclusión absoluta de TIFFs
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function stripHtmlAndClean(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function computeGeometry(width: number, height: number, targetCanvas = { width: 1920, height: 1080 }): SomaGeometry {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const aspectRatio = Number((safeW / safeH).toFixed(4));
  let orientation: 'landscape' | 'portrait' | 'square' = 'square';
  if (aspectRatio >= 1.15) orientation = 'landscape';
  else if (aspectRatio <= 0.88) orientation = 'portrait';
  const scaleToFitCanvas = Number(Math.min(targetCanvas.width / safeW, targetCanvas.height / safeH).toFixed(4));
  return { width: safeW, height: safeH, aspectRatio, orientation, scaleToFitCanvas };
}

function classifyLicense(shortNameRaw: string, usageTermsRaw: string, artistClean: string, titleClean: string): SomaLicenseInfo {
  const shortName = stripHtmlAndClean(shortNameRaw) || 'CC Archive';
  const usageTerms = stripHtmlAndClean(usageTermsRaw) || shortName;
  const isPublicDomainOrCC0 = /\b(cc0|public domain|pd|pdm|no restrictions)\b/i.test(`${shortName} ${usageTerms}`.toLowerCase());
  const safeAuthor = artistClean || 'Archivo Patrimonial';
  return {
    shortName, usageTerms, isPublicDomainOrCC0, attributionRequired: !isPublicDomainOrCC0,
    attributionPlainText: `${titleClean} — Foto: ${safeAuthor} (${shortName})`,
    attributionHtml: `<span><strong>${safeAuthor}</strong> · <em>${shortName}</em></span>`
  };
}

function computeEditorialScore(asset: Omit<SomaAsset, 'somaScore'>): number {
  let score = 50;
  if (asset.geometry.width >= 2500) score += 20;
  else if (asset.geometry.width >= 1600) score += 14;
  if (asset.geometry.aspectRatio >= 1.33 && asset.geometry.aspectRatio <= 2.4) score += 15;
  if (asset.description.length > 40) score += 8;
  if (asset.license.isPublicDomainOrCC0) score += 5;
  return Math.max(0, Math.min(100, score));
}

export async function translateToCanonicalQuery(rawQuery: string, geminiApiKey?: string, timeoutMs = 5000): Promise<string> {
  const cleanQuery = rawQuery.trim();
  if (!geminiApiKey || !cleanQuery) return cleanQuery;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SOMA_PROMPTS.DOCUMENTALISTA_ONTOLOGICO }] },
        contents: [{ role: 'user', parts: [{ text: cleanQuery }] }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 40 }
      })
    });
    if (!res.ok) return cleanQuery;
    const data = await res.json();
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return translated ? translated.replace(/^["']|["']$/g, '') : cleanQuery;
  } catch { return cleanQuery; } finally { clearTimeout(timer); }
}

async function fetchFromWikimedia(
  canonicalQuery: string,
  opts: Required<Pick<SomaSearchOptions, 'overfetchPool' | 'cdnThumbWidth' | 'minWidth' | 'minHeight' | 'orientation' | 'targetCanvas' | 'timeoutMs' | 'userAgent'>>,
  warnings: string[] // Se inyecta array por referencia
): Promise<SomaAsset[]> {
  const cirrusQuery = `${canonicalQuery} filetype:bitmap fileres:>900 -intitle:map -intitle:svg`;
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6',
    gsrsearch: cirrusQuery, gsrlimit: String(Math.min(50, opts.overfetchPool)),
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(opts.cdnThumbWidth)
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { 'User-Agent': opts.userAgent, 'Api-User-Agent': opts.userAgent }, signal: controller.signal
    });
    if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
    const pages = (await res.json())?.query?.pages;
    if (!pages) return [];

    const results: SomaAsset[] = [];
    for (const page of Object.values<any>(pages)) {
      const info = page?.imageinfo?.[0];
      if (!info) continue;

      const rawTitle = String(page.title || '').replace(/^File:/i, '');
      const mime = String(info.mime || '').toLowerCase();

      if (!ALLOWED_MIMES.has(mime)) {
        warnings.push(`[MIME Denegado] ${rawTitle} (${mime}) omitido para evitar OOM.`);
        continue;
      }
      if (GARBAGE_TITLE_REGEX.test(rawTitle)) continue;

      const geometry = computeGeometry(Number(info.width || 0), Number(info.height || 0), opts.targetCanvas);
      if (geometry.width < opts.minWidth || geometry.height < opts.minHeight) continue;

      const ext = info.extmetadata || {};
      const partialAsset: Omit<SomaAsset, 'somaScore'> = {
        id: `wiki-${page.pageid}`, sourceArchive: 'wikimedia',
        title: rawTitle.replace(/\.[a-z0-9]{3,4}$/i, '').replace(/_/g, ' '),
        canonicalQueryUsed: canonicalQuery,
        cdnUrl: info.thumburl || info.url, rawUrl: info.url,
        recordUrl: info.descriptionurl || `https://commons.wikimedia.org/?curid=${page.pageid}`,
        mime,
        author: stripHtmlAndClean(ext.Artist?.value) || 'Wikimedia',
        description: stripHtmlAndClean(ext.ImageDescription?.value),
        dateCreated: stripHtmlAndClean(ext.DateTimeOriginal?.value),
        geometry,
        license: classifyLicense(ext.LicenseShortName?.value, ext.UsageTerms?.value, stripHtmlAndClean(ext.Artist?.value), rawTitle)
      };
      results.push({ ...partialAsset, somaScore: computeEditorialScore(partialAsset) });
    }
    return results;
  } finally { clearTimeout(timer); }
}

export async function somaSearch(query: string, options: SomaSearchOptions = {}): Promise<SomaSearchResult> {
  const cfg = {
    limit: options.limit ?? 12, overfetchPool: options.overfetchPool ?? 40,
    cdnThumbWidth: options.cdnThumbWidth ?? 1600, minWidth: options.minWidth ?? 1000,
    minHeight: options.minHeight ?? 650, orientation: options.orientation ?? 'landscape',
    onlyCC0OrPublicDomain: options.onlyCC0OrPublicDomain ?? false,
    sources: options.sources ?? ['wikimedia'], targetCanvas: options.targetCanvas ?? { width: 1920, height: 1080 },
    timeoutMs: options.timeoutMs ?? 10000,
    userAgent: options.userAgent ?? 'TGP-Engine/1.2 (research@thegreatpuzzle.org)'
  };

  const canonicalQuery = await translateToCanonicalQuery(query, options.geminiApiKey);
  const tasks: Promise<SomaAsset[]>[] = [];
  const warnings: string[] = []; // Nuevo registro forense global

  if (cfg.sources.includes('wikimedia')) tasks.push(fetchFromWikimedia(canonicalQuery, cfg, warnings));
  
  // Protección robusta con allSettled para no abortar si una API externa cae
  const settled = await Promise.allSettled(tasks);
  const allCandidates = settled.flatMap(res => res.status === 'fulfilled' ? res.value : []);

  const uniqueRanked = Array.from(new Map(allCandidates.map(item => [item.rawUrl.split('?')[0].toLowerCase(), item])).values())
    .sort((a, b) => b.somaScore - a.somaScore);

  const curatedBatch = uniqueRanked.slice(0, cfg.limit);
  const heroTop3 = uniqueRanked.filter(img => img.geometry.aspectRatio >= 1.33).slice(0, 3);

  let cc0OrPdCount = 0;
  let landscapeCount = 0;
  curatedBatch.forEach(img => {
    if (img.license.isPublicDomainOrCC0) cc0OrPdCount++;
    if (img.geometry.orientation === 'landscape') landscapeCount++;
  });

  return {
    originalQuery: query,
    canonicalQuery,
    totalCandidatesScanned: allCandidates.length,
    curatedBatch,
    heroTop3,
    warnings,
    stats: {
      total: curatedBatch.length,
      wikimediaCount: curatedBatch.length,
      europeanaCount: 0,
      smithsonianCount: 0,
      cc0OrPdCount,
      landscapeCount,
    }
  };
}

// ── Alias de compatibilidad retroactiva para rutas y tests ──────────────────
export async function executeSomaEngine(options: SomaSearchOptions & { query: string }): Promise<SomaSearchResult> {
  return somaSearch(options.query, options);
}
