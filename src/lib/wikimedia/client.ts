/**
 * CLIENTE Y MOTOR DE BÚSQUEDA ADAPTATIVO DE WIKIMEDIA COMMONS TGP
 * Realiza búsquedas multietapa, sanitización inteligente de términos,
 * expansión de consultas para lugares remotos / arqueología / fauna / historia,
 * clasificación de roles sin restricciones bloqueantes y garantía de resultados mínimos.
 */

export interface WikimediaImageItem {
  id: string;
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  mime: string;
  role: 'HERO' | 'SECUNDARIA' | 'B_ROLL';
  roleLabel: string;
  author: string;
  license: string;
  licenseUrl: string;
  description: string;
  credit: string;
  pageUrl: string;
}

export interface WikimediaSearchResult {
  query: string;
  timestamp: number;
  items: WikimediaImageItem[];
}

const CACHE_PREFIX = 'tgp_wm_cache_v2_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Genera variantes de búsqueda a partir de una consulta del usuario
 * para maximizar la probabilidad de encontrar fotos en Wikimedia Commons
 */
function generateQueryVariations(rawQuery: string): string[] {
  const clean = rawQuery
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  const variations: string[] = [clean];

  // Stopwords en español e inglés para aislar nombres propios y conceptos clave
  const stopwords = new Set([
    'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u',
    'en', 'del', 'al', 'con', 'por', 'para', 'sobre', 'entre', 'hacia', 'desde',
    'of', 'the', 'in', 'and', 'at', 'by', 'for', 'with', 'from', 'to'
  ]);

  const words = clean.split(' ').filter(w => w.length > 1);
  const keywords = words.filter(w => !stopwords.has(w.toLowerCase()));

  // 1. Variante con palabras clave principales unidas
  if (keywords.length > 1 && keywords.length !== words.length) {
    variations.push(keywords.join(' '));
  }

  // 2. Variante con operador OR entre términos clave
  if (keywords.length >= 2) {
    variations.push(keywords.slice(0, 3).join(' OR '));
  }

  // 3. Subconjuntos de los 2 términos más significativos
  if (keywords.length >= 3) {
    variations.push(`${keywords[0]} ${keywords[1]}`);
    variations.push(`${keywords[keywords.length - 2]} ${keywords[keywords.length - 1]}`);
  }

  // 4. Términos individuales clave
  keywords.forEach(kw => {
    if (kw.length >= 4 && !variations.includes(kw)) {
      variations.push(kw);
    }
  });

  return Array.from(new Set(variations));
}

/**
 * Consulta un endpoint de Wikimedia Commons con una cadena de búsqueda específica
 */
async function fetchWikimediaQuery(queryStr: string, limit: number): Promise<WikimediaImageItem[]> {
  const endpoint = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: queryStr,
    gsrnamespace: '6', // Namespace File:
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '800'
  });

  try {
    const res = await fetch(`${endpoint}?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data.query?.pages || {};

    const items: WikimediaImageItem[] = [];

    for (const key of Object.keys(pages)) {
      const page = pages[key];
      const info = page.imageinfo?.[0];
      if (!info) continue;

      const mime = (info.mime || '').toLowerCase();
      
      // Filtrar únicamente formatos no visuales (audio/video/documentos raw)
      if (
        mime.includes('audio/') ||
        mime.includes('video/') ||
        mime.includes('application/ogg') ||
        mime.includes('application/pdf')
      ) {
        continue;
      }

      const width = Number(info.width || 800);
      const height = Number(info.height || 600);
      const title = (page.title || '').replace(/^File:/i, '').replace(/_/g, ' ');

      // Parseo de Metadatos y Licencias
      const meta = info.extmetadata || {};
      const licenseShort = meta.LicenseShortName?.value || meta.License?.value || 'CC / Dominio Público (Citar)';
      const licenseUrl = meta.LicenseUrl?.value || 'https://commons.wikimedia.org';
      const authorRaw = meta.Artist?.value || meta.Credit?.value || info.user || 'Archivo Wikimedia';
      const cleanAuthor = authorRaw.replace(/<[^>]*>?/gm, '').trim();

      const descriptionRaw = meta.ImageDescription?.value || meta.ObjectName?.value || title;
      const cleanDescription = descriptionRaw.replace(/<[^>]*>?/gm, '').slice(0, 300).trim();

      // Clasificación de Roles Visuales flexible
      const aspectRatio = Number((width / height).toFixed(2)) || 1.33;
      let role: 'HERO' | 'SECUNDARIA' | 'B_ROLL' = 'B_ROLL';
      let roleLabel = 'Lámina de Archivo / Registro';

      if (width >= 1200 && aspectRatio >= 1.2) {
        role = 'HERO';
        roleLabel = 'Hero Image (Encabezado Panorámico)';
      } else if (width >= 750) {
        role = 'SECUNDARIA';
        roleLabel = 'Imagen Secundaria (Editorial)';
      }

      items.push({
        id: String(page.pageid || Math.random().toString(36).substring(2, 9)),
        title,
        url: info.url,
        thumbUrl: info.thumburl || info.url,
        width,
        height,
        aspectRatio,
        mime,
        role,
        roleLabel,
        author: cleanAuthor || 'Dominio Público',
        license: licenseShort,
        licenseUrl,
        description: cleanDescription || title,
        credit: meta.Credit?.value || '',
        pageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.title || '')}`
      });
    }

    return items;
  } catch (e) {
    console.warn('[Wikimedia Client] Error en fetch:', e);
    return [];
  }
}

/**
 * Busca imágenes en Wikimedia Commons con motor multietapa de alta tolerancia y garantía de resultados
 */
export async function searchWikimediaCommons(query: string, limit: number = 24): Promise<WikimediaSearchResult> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { query: '', timestamp: Date.now(), items: [] };
  }

  // 1. Revisar Caché en localStorage
  const cacheKey = `${CACHE_PREFIX}${encodeURIComponent(normalizedQuery.toLowerCase())}`;
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed: WikimediaSearchResult = JSON.parse(cachedData);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.items.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Caché no disponible:', e);
  }

  const variations = generateQueryVariations(normalizedQuery);
  const collectedItems: WikimediaImageItem[] = [];
  const seenUrls = new Set<string>();

  const addItemSafely = (item: WikimediaImageItem) => {
    if (!item.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    collectedItems.push(item);
  };

  // 2. Ejecución Multietapa: Consulta Principal y Fallbacks automáticos
  for (const q of variations) {
    if (collectedItems.length >= limit) break;
    const batch = await fetchWikimediaQuery(q, limit * 2);
    batch.forEach(addItemSafely);
  }

  // 3. Ordenar priorizando resolución y rol
  let finalItems = collectedItems.sort((a, b) => (b.width * b.height) - (a.width * a.height));

  // 4. Si los resultados son muy escasos (ej. 1 a 3 fotos en lugares ultra remotos),
  // garantizar un set visual enriquecido repitiendo/variando los ítems para no dejar grilla vacía
  if (finalItems.length > 0 && finalItems.length < 4) {
    const originalCount = finalItems.length;
    while (finalItems.length < 4) {
      const cloned = { ...finalItems[finalItems.length % originalCount] };
      cloned.id = `${cloned.id}_replica_${finalItems.length}`;
      finalItems.push(cloned);
    }
  }

  finalItems = finalItems.slice(0, limit);

  const result: WikimediaSearchResult = {
    query: normalizedQuery,
    timestamp: Date.now(),
    items: finalItems
  };

  // 5. Guardar en caché local
  try {
    if (finalItems.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    }
  } catch (e) {
    console.warn('No se pudo guardar en caché:', e);
  }

  return result;
}

/**
 * Limpia toda la caché de Wikimedia en localStorage
 */
export function clearWikimediaCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tgp_wm_cache_') || key.startsWith(CACHE_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error al limpiar caché:', e);
  }
}
