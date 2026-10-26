/**
 * wikimediaSearch.ts
 * Módulo TypeScript moderno para Astro y Node.js (>= 18)
 * Diseñado para timelines GSAP (3 fotos landscape consistentes) y revistas 3D Three.js (12 fotos HD).
 * 
 * Optimizaciones incluidas:
 * 1. Operadores CirrusSearch nativos en el servidor de Wikimedia (filetype:bitmap fileres:>1000 -intitle:...)
 * 2. Over-fetching (gsrlimit=40) con scoring heurístico en memoria (descripción limpia + resolución).
 * 3. Filtro estricto de Aspect Ratio (landscape >= 1.25, portrait <= 0.8, any).
 * 4. Sanitización profunda de extmetadata (HTML tags, entidades HTML, saltos).
 * 5. Cero dependencias de Google Apps Script (fetch nativo + AbortController).
 */

export interface WikiImage {
  /** Título limpio del archivo (sin prefijo "File:" ni extensión) */
  title: string;
  /** Título crudo de Wikimedia (ej: "File:Tikal Temple I.jpg") */
  rawTitle: string;
  /** URL directa del archivo original en alta resolución */
  originalUrl: string;
  /** URL de thumbnail optimizado por CDN de Wikimedia (ej: 1280px o 1920px) */
  thumbUrl: string;
  /** Ancho original en píxeles */
  width: number;
  /** Alto original en píxeles */
  height: number;
  /** Relación de aspecto (width / height) */
  aspectRatio: number;
  /** Orientación detectada */
  orientation: 'landscape' | 'portrait' | 'square';
  /** Ancho del thumbnail generado */
  thumbWidth?: number;
  /** Alto del thumbnail generado */
  thumbHeight?: number;
  /** Tipo MIME (ej: "image/jpeg", "image/png", "image/webp") */
  mime: string;
  /** Tamaño del archivo original en bytes */
  sizeBytes?: number;
  /** Licencia legal (ej: "CC BY-SA 4.0", "Public domain", "CC0") */
  license: string;
  /** Nombre del autor/fotógrafo limpio de HTML */
  author: string;
  /** URL oficial en Wikimedia Commons para atribución legal */
  descriptionUrl: string;
  /** Descripción o pie de foto limpio de HTML */
  description?: string;
  /** Puntaje heurístico de calidad calculado (resolución + metadatos) */
  score: number;
}

export interface SearchWikimediaOptions {
  /** Límite de resultados a devolver (ej: 3 para timeline GSAP, 12 para revista Three.js). Default: 8 */
  limit?: number;
  /** Cantidad de candidatos a solicitar a la API para el sobremuestreo (over-fetching). Default: 40 */
  fetchCandidates?: number;
  /** Ancho objetivo para el thumbnail CDN generado (default: 1280) */
  thumbWidth?: number;
  /** Ancho mínimo para descartar imágenes pequeñas (default: 1000) */
  minWidth?: number;
  /** Alto mínimo para descartar imágenes pequeñas (default: 600) */
  minHeight?: number;
  /**
   * Filtro de orientación:
   * - 'landscape': ratio ancho/alto >= 1.25 (indispensable para timelines GSAP)
   * - 'portrait': ratio ancho/alto <= 0.8
   * - 'any': cualquier orientación
   * Default: 'landscape'
   */
  orientation?: 'landscape' | 'portrait' | 'any';
  /** Timeout en milisegundos para la petición HTTP (default: 12000) */
  timeoutMs?: number;
  /**
   * User-Agent conforme a la política de Wikimedia Foundation.
   * Obligatorio para evitar bloqueos HTTP 403.
   */
  userAgent?: string;
}

// Regex de respaldo en memoria por si se escapa algún diagrama/mapa del filtro CirrusSearch
const BACKUP_EXCLUSION_REGEX = /(flag|bandera|coat of arms|escudo|arms of|locator|location map|carte|mapa|icon|icono|logo|symbol|diagram|drawing|seal of|blank map|floor plan|croquis|planimetry|ground plan)/i;

/**
 * Sanitizador de extmetadata: elimina etiquetas HTML y entidades codificadas.
 */
export function stripHtml(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]*>/g, ' ')               // Elimina tags HTML (<a ...>, <span>, etc)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, '')                 // Entidades numéricas
    .replace(/\s+/g, ' ')                   // Normaliza espacios
    .trim();
}

/**
 * Motor de búsqueda y filtrado consolidado para Wikimedia Commons.
 */
export async function searchWikimediaImages(
  query: string,
  options: SearchWikimediaOptions = {}
): Promise<WikiImage[]> {
  const {
    limit = 8,
    fetchCandidates = 40,
    thumbWidth = 1280,
    minWidth = 1000,
    minHeight = 600,
    orientation = 'landscape',
    timeoutMs = 12000,
    userAgent = 'WikiRescueAstro/1.0 (https://github.com/rescate-scripts-gas; contact@example.com)'
  } = options;

  const cleanQuery = query ? query.trim() : '';
  if (!cleanQuery) return [];

  // 1. CirrusSearch: Operadores nativos en el servidor de Wikimedia
  // Filtra en origen: solo bitmaps, resolución >1000px y excluye mapas, planos, diagramas y escudos
  const cirrusFilter = 'filetype:bitmap fileres:>1000 -intitle:map -intitle:diagram -intitle:plan -intitle:coat -intitle:flag -intitle:svg';
  const fullSearchQuery = `${cleanQuery} ${cirrusFilter}`;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: fullSearchQuery,
    gsrnamespace: '6', // Namespace 6 = "File:"
    gsrlimit: String(Math.min(Math.max(fetchCandidates, limit), 50)), // Sobre-muestreo hasta 50
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(thumbWidth),
    origin: '*' // Soporte CORS nativo
  });

  const apiUrl = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Api-User-Agent': userAgent,
        'User-Agent': userAgent
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Wikimedia API HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.query || !data.query.pages) {
      return [];
    }

    const pages = Object.values(data.query.pages) as any[];
    const candidates: WikiImage[] = [];

    for (const page of pages) {
      if (!page.imageinfo || !page.imageinfo.length) continue;

      const info = page.imageinfo[0];
      const mime = (info.mime || '').toLowerCase();
      const rawTitle = page.title || '';
      const originalUrl = info.url || '';
      const thumbUrl = info.thumburl || originalUrl;
      const width = Number(info.width || 0);
      const height = Number(info.height || 0);

      // Descarte de SVG o no-rasterizados
      if (mime.includes('svg') || originalUrl.toLowerCase().endsWith('.svg')) continue;
      if (!mime.includes('jpeg') && !mime.includes('jpg') && !mime.includes('png') && !mime.includes('webp')) continue;

      // Descarte por dimensiones mínimas absolutas
      if (width < minWidth || height < minHeight) continue;

      // Relación de aspecto
      const ratio = height > 0 ? Number((width / height).toFixed(3)) : 1;
      let detectedOrientation: 'landscape' | 'portrait' | 'square' = 'square';
      if (ratio >= 1.25) detectedOrientation = 'landscape';
      else if (ratio <= 0.8) detectedOrientation = 'portrait';

      // 3. Filtro de Aspect Ratio
      if (orientation === 'landscape' && ratio < 1.25) continue;
      if (orientation === 'portrait' && ratio > 0.8) continue;

      // Respaldo heurístico de título
      if (BACKUP_EXCLUSION_REGEX.test(rawTitle)) continue;

      // 4. Sanitización profunda de extmetadata
      const meta = info.extmetadata || {};
      const licenseShort = stripHtml(meta.LicenseShortName?.value || meta.UsageTerms?.value || 'Licencia libre Wikimedia');
      const author = stripHtml(meta.Artist?.value || meta.Credit?.value || 'Autor no documentado');
      const description = stripHtml(meta.ImageDescription?.value || '');
      const descUrl = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(rawTitle.replace(/\s+/g, '_'))}`;
      const cleanTitle = rawTitle.replace(/^File:/i, '').replace(/\.[^/.]+$/, '');

      // 2. Score heurístico de calidad
      // Prioriza imágenes con descripción detallada, autor identificado y resolución superior a 1280px
      let score = 0;
      if (width >= 1920) score += 30;
      else if (width >= 1280) score += 20;
      else score += 10;

      if (description && description.length > 20) score += 25;
      if (author && author !== 'Autor no documentado' && !author.toLowerCase().includes('unknown')) score += 20;
      if (!licenseShort.toLowerCase().includes('desconocid')) score += 15;
      if (ratio >= 1.33 && ratio <= 1.78) score += 10; // Proporción áurea / 16:9 ideal para GSAP

      candidates.push({
        title: cleanTitle,
        rawTitle,
        originalUrl,
        thumbUrl,
        width,
        height,
        aspectRatio: ratio,
        orientation: detectedOrientation,
        thumbWidth: info.thumbwidth,
        thumbHeight: info.thumbheight,
        mime,
        sizeBytes: info.size,
        license: licenseShort,
        author,
        descriptionUrl: descUrl,
        description,
        score
      });
    }

    // Ordenar de mayor a menor calidad según el score
    candidates.sort((a, b) => b.score - a.score);

    // Devolver exactamente la cantidad solicitada tras el sobremuestreo
    return candidates.slice(0, limit);

  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Timeout al conectar con la API de Wikimedia (${timeoutMs}ms).`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
