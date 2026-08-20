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
    spotifyLink?: string | null;
    youtubeLink?: string | null;
    generador?: string;
    generadorTexto?: string | null;
    generadorImagen?: string | null;
    notasInvestigador?: string | null;
    [key: string]: unknown;
  };
}

/**
 * Retorna la portada del ensayo o recurso (ImageMetadata si fue importado por Astro, o string / null).
 */
export function resolveEssayImage(coverPath?: any, slug?: string): any {
  if (!coverPath) return null;
  return coverPath;
}

/**
 * Determina si una entrada carece de foto y su título o slug indica que es un post de prueba ('Test' / 'Prueba').
 */
export function isNoPhotoTestPost(entry: EssayEntry): boolean {
  const hasImg = Boolean(entry.entry?.coverImage);
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

  const hasImgA = resolveEssayImage(a.entry?.coverImage, a.slug) ? 1 : 0;
  const hasImgB = resolveEssayImage(b.entry?.coverImage, b.slug) ? 1 : 0;
  
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
    if (!item.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    images.push(item);
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
