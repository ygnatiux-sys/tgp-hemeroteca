/**
 * src/lib/content-filter.ts
 *
 * Filtro centralizado de contenido publicable para TGP.
 *
 * Condición publicable (única fuente de verdad):
 *   • En PRODUCCIÓN: draft !== true
 *   • En DESARROLLO:  todos los posts (borradores incluidos)
 *
 * Control editorial: usa el campo `draft: true` en Keystatic
 * para ocultar posts. No hay listas negras de slugs.
 */

export interface EssayEntry {
  slug: string;
  isCinematicGSAP?: boolean;
  entry: {
    title?: string;
    volanta?: string | null;
    draft?: boolean;
    date?: string | null;
    category?: string | null;
    themeColor?: string | null;
    coverImage?: ImageMetadata | string | null;
    excerpt?: string | null;
    dek?: string | null;
    spotifyLink?: string | null;
    youtubeLink?: string | null;
    generador?: string;
    generadorTexto?: string | null;
    generadorImagen?: string | null;
    notasInvestigador?: string | null;
    [key: string]: unknown;
  };
}

export const R2_STORAGE_BASE_URL = 'https://storage.thegreatpuzzleproject.com';

/**
 * Valida estrictamente si un string o valor representa una ruta/URL de imagen válida
 * y NO un prompt de texto de IA, párrafo descriptivo o cadena sin extensión.
 */
export function isValidImageSrc(src: any): boolean {
  if (!src) return false;
  if (typeof src === 'object' && src.src && typeof src.src === 'string') {
    return isValidImageSrc(src.src);
  }
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed) return false;

  // 1. Data URLs de imágenes (base64)
  if (trimmed.startsWith('data:image/')) return true;

  // Si contiene saltos de línea, es un prompt/texto, nunca una URL
  if (trimmed.includes('\n') || trimmed.includes('\r')) return false;

  // Si contiene directivas clásicas de prompts generativos (Midjourney, DALL-E, etc.)
  if (
    trimmed.includes('--ar ') ||
    trimmed.includes('--v ') ||
    trimmed.includes('--style ') ||
    trimmed.includes('8k resolution') ||
    trimmed.includes('cinematography') ||
    trimmed.includes('establishing shot')
  ) {
    return false;
  }

  // 2. URLs remotas válidas (http:// o https://)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Si contiene espacios libres y longitud de párrafo, es texto, no URL
    if (trimmed.includes(' ') && !trimmed.includes('%20')) return false;
    return true;
  }

  // 3. Rutas de assets locales de Astro / Keystatic
  const isPathPrefix =
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('src/assets/') ||
    trimmed.startsWith('@assets/') ||
    trimmed.startsWith('/ensayos/') ||
    trimmed.startsWith('/georreferencias/') ||
    trimmed.startsWith('/arquetipos-globales/') ||
    trimmed.startsWith('/ensayos-cinematicos/') ||
    trimmed.startsWith('ensayos/') ||
    trimmed.startsWith('georreferencias/') ||
    trimmed.startsWith('arquetipos-globales/') ||
    trimmed.startsWith('ensayos-cinematicos/') ||
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('/assets/');

  const hasImageExtension = /\.(jpe?g|png|webp|avif|gif|svg)(\?.*)?$/i.test(trimmed);

  // Si tiene espacios y es largo (más de 80 chars), es una descripción/prompt, no un path
  if (trimmed.includes(' ') && trimmed.length > 80) return false;

  if (isPathPrefix || (trimmed.startsWith('/') && hasImageExtension) || hasImageExtension) {
    return true;
  }

  return false;
}

/**
 * Transforma rutas locales (/src/assets/...) generadas por Keystatic o el entorno de desarrollo
 * a URLs públicas absolutas del CDN Cloudflare R2 (https://storage.thegreatpuzzleproject.com/...).
 */
export function resolveR2ImageUrl(pathOrUrl: string | any): string {
  if (!pathOrUrl) return '';

  // Si es un objeto ImageMetadata de Astro, extraer .src
  const rawStr = typeof pathOrUrl === 'string' ? pathOrUrl : (pathOrUrl?.src ?? pathOrUrl?.href ?? '');
  if (!rawStr || typeof rawStr !== 'string') {
    return '';
  }
  const trimmed = rawStr.trim();
  if (!trimmed || !isValidImageSrc(trimmed)) return '';

  // 1. Data URLs o URLs absolutas remotas (Wikimedia, R2, CDNs externos) → sin cambio
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 2. Rutas generadas por Keystatic (/src/assets/... o src/assets/...) → R2
  if (trimmed.startsWith('/src/assets/')) {
    const relPath = trimmed.replace(/^\/src\/assets\//, '');
    return `${R2_STORAGE_BASE_URL}/${relPath}`;
  }
  if (trimmed.startsWith('src/assets/')) {
    const relPath = trimmed.replace(/^src\/assets\//, '');
    return `${R2_STORAGE_BASE_URL}/${relPath}`;
  }
  if (trimmed.startsWith('@assets/')) {
    const relPath = trimmed.replace(/^@assets\//, '');
    return `${R2_STORAGE_BASE_URL}/${relPath}`;
  }

  // 3. Rutas de colecciones directas (sin /src/assets/ prefix)
  if (
    trimmed.startsWith('/ensayos/') ||
    trimmed.startsWith('/georreferencias/') ||
    trimmed.startsWith('/arquetipos-globales/') ||
    trimmed.startsWith('/ensayos-cinematicos/')
  ) {
    return `${R2_STORAGE_BASE_URL}${trimmed}`;
  }
  if (
    trimmed.startsWith('ensayos/') ||
    trimmed.startsWith('georreferencias/') ||
    trimmed.startsWith('arquetipos-globales/') ||
    trimmed.startsWith('ensayos-cinematicos/')
  ) {
    return `${R2_STORAGE_BASE_URL}/${trimmed}`;
  }

  // 4. Recursos estáticos locales en /public (/images/..., /favicon..., /perfil.webp) → sin cambio
  return trimmed;
}

/**
 * Sanitiza, resuelve contra R2 y decodifica/normaliza de manera segura URLs de imágenes
 * para eliminar dobles codificaciones (%252C -> %2C -> ,) y caracteres conflictivos.
 */
export function sanitizeImageUrl(imgUrl: string | any): string {
  if (!imgUrl) return '';
  if (typeof imgUrl === 'object' && imgUrl.src) {
    imgUrl = imgUrl.src;
  }
  if (typeof imgUrl !== 'string') return '';
  const trimmed = imgUrl.trim();
  if (!trimmed || !isValidImageSrc(trimmed)) return '';

  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  const resolved = resolveR2ImageUrl(trimmed);
  if (!resolved || typeof resolved !== 'string' || !isValidImageSrc(resolved)) return '';
  let str = resolved.trim();
  if (!str) return '';
  if (str.startsWith('data:image/')) return str;

  // 1. Decodificación recursiva para desenrollar cualquier doble o triple encoding (%252C -> %2C -> ,)
  try {
    let prev = str;
    for (let i = 0; i < 5; i++) {
      const decoded = decodeURIComponent(prev);
      if (decoded === prev) break;
      prev = decoded;
    }
    str = prev;
  } catch (e) {
    try {
      str = decodeURI(str);
    } catch (_) {}
  }

  // 2. Si es una ruta local simple sin espacios
  if (str.startsWith('/') && !str.includes(' ') && !str.includes(',')) {
    return str;
  }

  // 3. Re-codificar de forma limpia con encodeURI (preserva protocolo y slashes, escapa espacios/tildes)
  try {
    return encodeURI(str);
  } catch (e) {
    return str;
  }
}

/**
 * Retorna la imagen principal del ensayo o recurso (URL absoluta de R2 / CDN o null).
 * Si no tiene coverImage directo, busca inteligentemente en sus imágenes asignadas de Wikimedia, galería o generador IA.
 * NUNCA extrae generadorImagen (es el prompt textual) ni prompts como URLs.
 */
export function resolveEssayImage(coverOrEntry?: any, slug?: string): any {
  if (!coverOrEntry) return null;

  // Si ya es un ImageMetadata de Astro (objeto con .src) o string directo
  if (typeof coverOrEntry === 'string') {
    return isValidImageSrc(coverOrEntry) ? sanitizeImageUrl(coverOrEntry) : null;
  }
  if (typeof coverOrEntry === 'object' && coverOrEntry.src && typeof coverOrEntry.src === 'string') {
    return isValidImageSrc(coverOrEntry.src) ? sanitizeImageUrl(coverOrEntry.src) : null;
  }

  // Si es una entrada completa (e.entry o item.data o item)
  const doc = coverOrEntry.entry || coverOrEntry.data || coverOrEntry;

  // 1. Portada asignada directa (revisar coverImage, image, portada, foto, imagen)
  const directCandidate = doc?.coverImage || doc?.image || doc?.portada || doc?.foto || doc?.imagen;
  if (directCandidate) {
    if (typeof directCandidate === 'string' && isValidImageSrc(directCandidate)) {
      return sanitizeImageUrl(directCandidate);
    }
    if (typeof directCandidate === 'object' && directCandidate.src && isValidImageSrc(directCandidate.src)) {
      return sanitizeImageUrl(directCandidate.src);
    }
  }

  // 2. Banco de Imágenes Wikimedia (HERO o primera seleccionada)
  const rawWm = doc?.bancoImagenesWikimedia || doc?.buscadorWikimedia;
  if (rawWm) {
    try {
      const parsed = typeof rawWm === 'string' ? JSON.parse(rawWm) : rawWm;
      if (parsed?.selectedItems && Array.isArray(parsed.selectedItems) && parsed.selectedItems.length > 0) {
        const hero = parsed.selectedItems.find((item: any) => item.role === 'HERO') || parsed.selectedItems[0];
        const url = hero?.thumbUrl || hero?.url;
        if (url && isValidImageSrc(url)) return sanitizeImageUrl(url);
      }
    } catch (e) {}
  }

  // 3. Array de galería (primera imagen válida)
  if (Array.isArray(doc?.gallery) && doc.gallery.length > 0) {
    const firstGal = doc.gallery[0];
    if (typeof firstGal === 'string' && isValidImageSrc(firstGal)) return sanitizeImageUrl(firstGal);
    if (typeof firstGal === 'object' && firstGal?.src && isValidImageSrc(firstGal.src)) return sanitizeImageUrl(firstGal.src);
  }

  // 4. Imagen generada por IA (payload JSON con propiedad .image que sea URL válida o data:image/)
  // IMPORTANTE: NUNCA extraer generadorImagen (es el prompt de IA) ni texto plano de generadorTexto
  const rawGen = doc?.generadorTexto || doc?.generadorGeoref || doc?.generador;
  if (rawGen && typeof rawGen === 'string' && rawGen.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawGen);
      if (parsed?.image && typeof parsed.image === 'string' && isValidImageSrc(parsed.image)) {
        return sanitizeImageUrl(parsed.image);
      }
    } catch (e) {}
  }
  if (doc?.imagenBase64 && typeof doc.imagenBase64 === 'string' && isValidImageSrc(doc.imagenBase64)) {
    return sanitizeImageUrl(doc.imagenBase64);
  }

  return null;
}

/**
 * Determina si una entrada carece de foto y su título o slug indica que es un post de prueba ('Test' / 'Prueba').
 */
export function isNoPhotoTestPost(entry: EssayEntry): boolean {
  const hasImg = Boolean(resolveEssayImage(entry));
  if (hasImg) return false;

  const title = (entry.entry?.title || '').toLowerCase();
  const slug = (entry.slug || '').toLowerCase();
  return title.includes('test') || title.includes('prueba') || slug.includes('test') || slug.includes('prueba');
}

export function sortEssaysByVisualFirst(a: EssayEntry, b: EssayEntry): number {
  const isTestA = isNoPhotoTestPost(a);
  const isTestB = isNoPhotoTestPost(b);

  // Posts de prueba sin foto van al final de todo el archivo/listado
  if (isTestA !== isTestB) {
    return isTestA ? 1 : -1;
  }

  // PRIORIDAD ABSOLUTA: Ensayos cinemáticos siempre al tope (Dossier GSAP)
  if (a.isCinematicGSAP !== b.isCinematicGSAP) {
    return a.isCinematicGSAP ? -1 : 1;
  }

  const hasImgA = resolveEssayImage(a) ? 1 : 0;
  const hasImgB = resolveEssayImage(b) ? 1 : 0;
  
  // Priorizar posts con imagen (sólo aplica si ambos son cinemáticos o ambos son normales)
  if (hasImgA !== hasImgB) {
    return hasImgB - hasImgA;
  }

  const dateA = a.entry?.date ? new Date(a.entry.date).getTime() : 0;
  const dateB = b.entry?.date ? new Date(b.entry.date).getTime() : 0;
  return dateB - dateA;
}

/**
 * Filtra y ordena entradas de la colección 'ensayos'.
 * Única fuente de verdad para todas las superficies editoriales.
 *
 * @param allEntries   Array crudo de getCollection('ensayos')
 * @param isProd       true en producción → oculta draft:true
 */
export function getPublishableEssays(
  allEntries: Array<{ id: string; data: EssayEntry['entry'] }>,
  isProd: boolean = false
): EssayEntry[] {
  return allEntries
    .map(item => ({
      slug: item.id.replace(/\/index$/, ''),
      entry: item.data,
    }))
    .filter(({ entry }) => {
      // Ocultar siempre los marcados explícitamente como borrador/eliminados
      if (entry.draft === true) return false;
      return true;
    })
    .sort(sortEssaysByVisualFirst);
}

/** Normaliza una categoría para agrupación (elimina tildes, convierte a lowercase y agrupa sinónimos). */
export function normalizeCategory(cat?: string | null): string {
  if (!cat || cat.trim() === '' || cat.toLowerCase() === 's/f') return 'ensayo';
  
  const raw = cat
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (raw === 'arqueologia' || raw === 'arqueo') return 'arqueologia';
  if (raw === 'arqueosemiotica' || raw === 'arqueosemiotica') return 'arqueosemiotica';
  if (raw.includes('semiotica') || raw.includes('semiotic')) return 'semiotica-cultural';
  if (raw === 'historia' || raw === 'historia antigua') return 'historia';
  if (raw.includes('religiones') || raw.includes('religios')) return 'historia-religiones';
  if (raw.includes('ideas') || raw.includes('pensamiento')) return 'historia-ideas';
  if (raw.includes('filosofia') || raw.includes('filosofic')) return 'filosofia';
  if (raw.includes('cahier')) return 'cahiers';
  if (raw.includes('georreferencia') || raw.includes('georeferencia') || raw.includes('geohistoric') || raw.includes('geocultura')) return 'georreferencias';
  
  return raw;
}

/** Formatea una categoría para visualización sobria y nítida. */
export function formatCategory(cat?: string | null): string {
  const normalized = normalizeCategory(cat);
  const map: Record<string, string> = {
    'arqueologia': 'Arqueología',
    'arqueosemiotica': 'Arqueosemiótica',
    'semiotica-cultural': 'Semiótica Cultural',
    'historia': 'Historia',
    'historia-religiones': 'Historia de las Religiones',
    'historia-ideas': 'Historia de las Ideas',
    'filosofia': 'Filosofía',
    'cahiers': 'Cahiers Épistémiques',
    'georreferencias': 'Georreferencias',
    'arquetipos-globales': 'Arquetipos Globales',
    'ensayo': 'Ensayo',
  };
  if (map[normalized]) return map[normalized];
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** 
 * Genera 2 a 3 categorías / etiquetas temáticas relacionadas para la cabecera cinematográfica
 * (estilo: HISTORY · CULTURE · EXPLORATION).
 */
export function getRelatedCategories(
  category?: string | null,
  sitio?: string | null,
  title?: string | null
): string[] {
  const normalized = normalizeCategory(category);
  const baseMap: Record<string, string[]> = {
    'arqueologia': ['ARQUEOLOGÍA', 'CIVILIZACIONES', 'VESTIGIOS'],
    'arqueosemiotica': ['ARQUEOSEMIÓTICA', 'HERMENÉUTICA', 'CARTOGRAFÍA'],
    'semiotica-cultural': ['SEMIÓTICA CULTURAL', 'SIMBOLISMO', 'ANTROPOLOGÍA'],
    'historia': ['HISTORIA', 'CULTURA', 'CIVILIZACIONES'],
    'historia-religiones': ['HISTORIA DE LAS RELIGIONES', 'MITOLOGÍA', 'GNOSIS'],
    'historia-ideas': ['HISTORIA DE LAS IDEAS', 'EPISTEMOLOGÍA', 'PENSAMIENTO'],
    'filosofia': ['FILOSOFÍA', 'ONTOLOGÍA', 'HERMENÉUTICA'],
    'cahiers': ['CAHIERS ÉPISTÉMIQUES', 'CUADERNO DE CAMPO', 'ARCHIVO'],
    'georreferencias': ['GEOCULTURA', 'PAISAJE SAGRADO', 'CARTOGRAFÍA'],
    'ensayo': ['INVESTIGACIÓN', 'CARTOGRAFÍA EPISTÉMICA', 'CULTURA'],
  };

  const defaults = baseMap[normalized] || [
    (formatCategory(category) || 'INVESTIGACIÓN').toUpperCase(),
    'CARTOGRAFÍA EPISTÉMICA',
    'CULTURA'
  ];

  if (sitio && sitio.trim().length > 0) {
    return [defaults[0], sitio.trim().toUpperCase(), defaults[2] || 'EXPLORACIÓN'];
  }

  return defaults;
}

/** Formatea una fecha para visualización en español. */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
}

/** Extrae el año de una fecha. */
export function formatYear(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear().toString();
}

/**
 * Agrupa ensayos publicables por categoría normalizada.
 * Retorna solo grupos con al menos `minCount` artículos.
 */
export function groupByCategory(
  essays: EssayEntry[],
  minCount: number = 2
): Map<string, EssayEntry[]> {
  const groups = new Map<string, EssayEntry[]>();
  for (const essay of essays) {
    if (!essay.entry.category || essay.entry.category.trim() === '' || essay.entry.category.toLowerCase() === 's/f') {
      continue;
    }
    const key = normalizeCategory(essay.entry.category);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(essay);
  }
  for (const [key, entries] of groups) {
    if (entries.length < minCount) groups.delete(key);
  }
  return groups;
}



export interface GalleryImageItem {
  id?: string;
  url: string;
  thumbUrl?: string;
  title: string;
  caption?: string;
  author?: string;
  license?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  role?: string;
}

/**
 * Recopila automáticamente todas las imágenes vinculadas a un post:
 * - Imágenes seleccionadas de Wikimedia (bancoImagenesWikimedia o buscadorWikimedia)
 * - Imágenes en disco (/src/assets/ensayos/${slug}/ o /src/assets/georreferencias/${slug}/)
 * - Portada principal
 */
export function resolveAllPostGalleryImages(doc: any, slug?: string): GalleryImageItem[] {
  const images: GalleryImageItem[] = [];
  const seenUrls = new Set<string>();

  const addImg = (item: GalleryImageItem) => {
    const safeUrl = sanitizeImageUrl(item.url);
    if (!safeUrl || seenUrls.has(safeUrl)) return;
    seenUrls.add(safeUrl);
    images.push({
      ...item,
      url: safeUrl,
      thumbUrl: item.thumbUrl ? sanitizeImageUrl(item.thumbUrl) : safeUrl
    });
  };

  // 1. Imágenes seleccionadas de Wikimedia
  const rawWm = doc?.bancoImagenesWikimedia || doc?.buscadorWikimedia;
  if (rawWm) {
    try {
      const parsed = typeof rawWm === 'string' ? JSON.parse(rawWm) : rawWm;
      if (parsed && Array.isArray(parsed.selectedItems)) {
        for (const item of parsed.selectedItems) {
          addImg({
            id: item.id,
            url: item.url || item.thumbUrl,
            thumbUrl: item.thumbUrl || item.url,
            title: item.title || 'Registro Visual',
            caption: item.description || item.title,
            author: item.author || 'Wikimedia Commons',
            license: item.license || 'Licencia Libre',
            width: item.width,
            height: item.height,
            aspectRatio: item.aspectRatio,
            role: item.role
          });
        }
      }
    } catch (e) {}
  }

  // 2. Portada principal
  if (doc?.coverImage) {
    const cover = doc.coverImage;
    const coverUrl = typeof cover === 'object' && cover?.src ? cover.src : typeof cover === 'string' ? cover : null;
    if (coverUrl) {
      addImg({
        url: coverUrl,
        thumbUrl: coverUrl,
        title: doc.title || 'Portada de Archivo',
        caption: doc.excerpt || 'Registro principal',
        width: typeof cover === 'object' ? cover?.width : undefined,
        height: typeof cover === 'object' ? cover?.height : undefined
      });
    }
  }

  // 3. Galería de imágenes (si existe array en doc.gallery)
  if (Array.isArray(doc?.gallery)) {
    for (const item of doc.gallery) {
      const gUrl = typeof item === 'object' && item?.src ? item.src : typeof item === 'string' ? item : null;
      if (gUrl) {
        addImg({
          url: gUrl,
          thumbUrl: gUrl,
          title: doc.title || 'Lámina de Galería',
          caption: 'Registro de galería',
          width: typeof item === 'object' ? item?.width : undefined,
          height: typeof item === 'object' ? item?.height : undefined
        });
      }
    }
  }

  return images;
}

export function splitTitleKeyword(titleStr: string): { prefix: string; keyword: string } {
  if (!titleStr) return { prefix: '', keyword: '' };
  const cleanTitle = titleStr.trim();
  const words = cleanTitle.split(/\s+/);
  if (words.length <= 1) {
    return { prefix: '', keyword: cleanTitle };
  }
  const prefix = words.slice(0, -1).join(' ') + ' ';
  const keyword = words[words.length - 1];
  return { prefix, keyword };
}
