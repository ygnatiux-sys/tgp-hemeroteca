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
  entry: {
    title?: string;
    volanta?: string | null;
    draft?: boolean;
    date?: string | null;
    category?: string | null;
    themeColor?: string | null;
    coverImage?: string | null;
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
      // En producción, solo ocultar los marcados explícitamente como borrador
      if (isProd && entry.draft === true) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = a.entry.date ? new Date(a.entry.date).getTime() : 0;
      const dateB = b.entry.date ? new Date(b.entry.date).getTime() : 0;
      return dateB - dateA;
    });
}

/** Normaliza una categoría para agrupación (lowercase, trim). */
export function normalizeCategory(cat?: string | null): string {
  if (!cat || cat.trim() === '' || cat.toLowerCase() === 's/f') return 'ensayo';
  return cat.toLowerCase().trim();
}

/** Formatea una categoría para visualización. */
export function formatCategory(cat?: string | null): string {
  const normalized = normalizeCategory(cat);
  if (normalized === 'ensayo') return 'Ensayo';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

/**
 * Mapa centralizado de imágenes de ensayos en Vite/Astro.
 */
export const essayImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/ensayos/**/*.{jpeg,jpg,png,gif,webp,avif}',
  { eager: true }
);

/**
 * Resuelve la imagen óptima de un ensayo:
 * 1. Coincidencia exacta con coverImage si existe.
 * 2. Si no, busca automáticamente cualquier imagen en la carpeta del slug (`/src/assets/ensayos/${slug}/`).
 */
export function resolveEssayImage(coverPath?: string | null, slug?: string): ImageMetadata | null {
  if (coverPath && essayImages[coverPath]) {
    return essayImages[coverPath].default;
  }
  if (slug) {
    const slugPrefix = `/src/assets/ensayos/${slug}/`;
    for (const [key, mod] of Object.entries(essayImages)) {
      if (key.startsWith(slugPrefix)) {
        return mod.default;
      }
    }
  }
  return null;
}
