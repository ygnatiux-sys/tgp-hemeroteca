/**
 * CLIENTE Y FILTRADOR DE WIKIMEDIA COMMONS TGP
 * Realiza búsquedas de imágenes de alta resolución, aplica sanitización estricta,
 * categorización de roles (Hero, Secundaria, B-Roll), parseo de licencias CC/CC0 y caché local.
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

const CACHE_PREFIX = 'tgp_wm_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Lista negra de palabras clave en títulos/descripciones que indican material no apto
const BLACKLIST_KEYWORDS = [
  'screenshot', 'captura', 'map', 'mapa', 'diagram', 'diagrama', 
  'flag', 'bandera', 'logo', 'logotipo', 'icon', 'icono', 'button', 
  'botón', 'chart', 'gráfico', 'pdf', 'page', 'página', 'selfie',
  'drawing', 'dibujo', 'sketch', 'boceto', 'symbol', 'símbolo'
];

/**
 * Busca imágenes en Wikimedia Commons aplicando reglas estrictas de filtrado
 */
export async function searchWikimediaCommons(query: string, limit: number = 25): Promise<WikimediaSearchResult> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return { query: '', timestamp: Date.now(), items: [] };
  }

  // 1. Revisar Caché en localStorage
  const cacheKey = `${CACHE_PREFIX}${encodeURIComponent(normalizedQuery)}`;
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

  // 2. Consultar la API oficial de Wikimedia Commons
  const endpoint = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${normalizedQuery} filetype:bitmap`,
    gsrnamespace: '6', // Namespace de Archivos (File:)
    gsrlimit: String(limit * 2), // Consultamos el doble para compensar el filtrado estricto
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '800' // Ancho para la miniatura de la grilla
  });

  try {
    const response = await fetch(`${endpoint}?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status} de Wikimedia`);

    const data = await response.json();
    const pages = data.query?.pages || {};

    const rawItems: WikimediaImageItem[] = [];

    for (const key of Object.keys(pages)) {
      const page = pages[key];
      const info = page.imageinfo?.[0];
      if (!info) continue;

      const mime = (info.mime || '').toLowerCase();
      const width = Number(info.width || 0);
      const height = Number(info.height || 0);
      const title = (page.title || '').replace(/^File:/i, '');

      // --- REGLAS ESTRICTAS DE FILTRADO ---
      
      // A. Formatos permitidos: Solo JPG, PNG, WEBP (No SVG, PDF, TIF, WEBM, etc.)
      if (!mime.includes('image/jpeg') && !mime.includes('image/png') && !mime.includes('image/webp')) {
        continue;
      }

      // B. Resolución mínima: Ancho >= 1000px y Alto >= 600px
      if (width < 1000 || height < 600) {
        continue;
      }

      // C. Filtro de lista negra en título
      const lowerTitle = title.toLowerCase();
      if (BLACKLIST_KEYWORDS.some(kw => lowerTitle.includes(kw))) {
        continue;
      }

      // D. Extracción de Metadatos y Licencias (extmetadata)
      const meta = info.extmetadata || {};
      const licenseShort = meta.LicenseShortName?.value || 'Dominio Público / CC';
      const licenseUrl = meta.LicenseUrl?.value || 'https://commons.wikimedia.org';
      const authorRaw = meta.Artist?.value || meta.Credit?.value || info.user || 'Desconocido';
      
      // Limpiar etiquetas HTML simples del campo autor
      const cleanAuthor = authorRaw.replace(/<[^>]*>?/gm, '').trim();

      const descriptionRaw = meta.ImageDescription?.value || title;
      const cleanDescription = descriptionRaw.replace(/<[^>]*>?/gm, '').slice(0, 200);

      // E. Clasificación por Rol Visual
      const aspectRatio = Number((width / height).toFixed(2));
      let role: 'HERO' | 'SECUNDARIA' | 'B_ROLL' = 'B_ROLL';
      let roleLabel = 'B-Roll / Relleno (Detalles)';

      if (aspectRatio >= 1.5 && width >= 1600) {
        role = 'HERO';
        roleLabel = 'Hero Image (Encabezado Panorámico)';
      } else if (aspectRatio >= 1.0 && width >= 1200) {
        role = 'SECUNDARIA';
        roleLabel = 'Imagen Secundaria (Editorial)';
      }

      rawItems.push({
        id: String(page.pageid || Math.random()),
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
        description: cleanDescription,
        credit: meta.Credit?.value || '',
        pageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`
      });
    }

    // Ordenar de mayor a menor resolución (priorizando calidad Hero)
    const filteredItems = rawItems
      .sort((a, b) => (b.width * b.height) - (a.width * a.height))
      .slice(0, limit);

    const result: WikimediaSearchResult = {
      query: normalizedQuery,
      timestamp: Date.now(),
      items: filteredItems
    };

    // Guardar en caché local
    try {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (e) {
      console.warn('No se pudo guardar en caché:', e);
    }

    return result;

  } catch (err: any) {
    console.error('Error al consultar Wikimedia Commons:', err);
    return { query: normalizedQuery, timestamp: Date.now(), items: [] };
  }
}

/**
 * Limpia toda la caché de Wikimedia en localStorage
 */
export function clearWikimediaCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error al limpiar caché:', e);
  }
}
