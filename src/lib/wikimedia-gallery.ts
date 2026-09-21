// ─────────────────────────────────────────────────────────────────────────────
// TGP Hemeroteca · Motor de Búsqueda y Galería Wikimedia Commons (CC0 / PD)
// Búsqueda concurrente optimizada con Promise.all y generator=search (Namespace 6)
// ─────────────────────────────────────────────────────────────────────────────

export interface WikimediaImageItem {
  term: string;
  title: string;
  url: string;
  thumbUrl: string;
  descriptionUrl: string;
  author: string;
  license: string;
  licenseShortName: string;
  width?: number;
  height?: number;
}

const WIKI_API_URL = 'https://commons.wikimedia.org/w/api.php';

/**
 * Busca imágenes en Wikimedia Commons a partir de un array de conceptos o string.
 * @param searchTerms Array de términos (ej: ["Nun god relief", "Atum creation", "Egypt primeval waters"])
 * @param limitPerTerm Límite de imágenes por término (default: 3)
 */
export async function getWikimediaGallery(
  searchTerms: string[] | string,
  limitPerTerm: number = 3
): Promise<WikimediaImageItem[]> {
  const terms = Array.isArray(searchTerms)
    ? searchTerms.map(t => t.trim()).filter(Boolean)
    : searchTerms.split(',').map(t => t.trim()).filter(Boolean);

  if (terms.length === 0) return [];

  // Mapeamos cada término a una promesa de búsqueda concurrente
  const fetchPromises = terms.map(async (term): Promise<WikimediaImageItem[]> => {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: term,
      gsrnamespace: '6', // Solo archivos multimedia (File:)
      gsrlimit: String(limitPerTerm),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '600', // Genera miniatura optimizada CDN
      origin: '*',       // Permite CORS directo desde el navegador
    });

    const targetUrl = `${WIKI_API_URL}?${params.toString()}`;
    const proxyUrl = typeof window !== 'undefined'
      ? `/api/wikimedia-proxy?url=${encodeURIComponent(targetUrl)}`
      : targetUrl;

    try {
      let response = await fetch(proxyUrl);
      if (!response.ok && proxyUrl !== targetUrl) {
        response = await fetch(targetUrl);
      }
      if (!response.ok) return [];

      const data = await response.json();
      if (!data.query || !data.query.pages) return [];

      const pages = Object.values(data.query.pages) as any[];

      return pages.map((page): WikimediaImageItem | null => {
        const info = page.imageinfo?.[0];
        if (!info || !info.url) return null;

        const rawUrl = info.url as string;
        // Filtrar exclusivamente archivos de imagen (evitar PDFs, SVGs complejos, audios)
        if (!/\.(jpe?g|png|webp)$/i.test(rawUrl)) return null;

        const extmeta = info.extmetadata || {};
        const authorHtml = extmeta.Artist?.value || '';
        const authorText = authorHtml.replace(/<[^>]*>?/gm, '').trim() || 'Desconocido';
        const licenseShort = extmeta.LicenseShortName?.value || extmeta.UsageTerms?.value || 'CC0 / Dominio Público';
        const cleanTitle = (page.title || '').replace(/^File:/i, '').replace(/_/g, ' ');

        return {
          term,
          title: cleanTitle,
          url: rawUrl,
          thumbUrl: info.thumburl || rawUrl,
          descriptionUrl: info.descriptionurl || '',
          author: authorText,
          license: extmeta.License?.value || 'pd',
          licenseShortName: licenseShort,
          width: info.width,
          height: info.height,
        };
      }).filter((item): item is WikimediaImageItem => item !== null);

    } catch (error) {
      console.error(`[Wikimedia] Error buscando término "${term}":`, error);
      return [];
    }
  });

  // Ejecución paralela sin cuellos de botella
  const resultsMatrix = await Promise.all(fetchPromises);
  const finalGallery = resultsMatrix.flat();

  // Deduplicar imágenes por URL
  const seenUrls = new Set<string>();
  return finalGallery.filter(img => {
    if (seenUrls.has(img.url)) return false;
    seenUrls.add(img.url);
    return true;
  });
}

/**
 * Descarga una imagen de Wikimedia Commons y la convierte en un objeto File nativo.
 * Utiliza fallback al proxy de Astro si el navegador bloquea CORS binario.
 */
export async function downloadWikimediaImageAsFile(img: WikimediaImageItem): Promise<File> {
  const safeName = img.title.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50) + '.jpg';

  try {
    // 1. Intento directo con CORS nativo
    const res = await fetch(img.url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      return new File([blob], safeName, { type: blob.type || 'image/jpeg' });
    }
  } catch {}

  // 2. Fallback resiliente vía proxy de Astro SSR
  const proxyUrl = `/api/wikimedia-proxy?url=${encodeURIComponent(img.url)}`;
  const proxyRes = await fetch(proxyUrl);
  if (!proxyRes.ok) {
    throw new Error(`No se pudo descargar la imagen desde Wikimedia: HTTP ${proxyRes.status}`);
  }
  const blob = await proxyRes.blob();
  return new File([blob], safeName, { type: blob.type || 'image/jpeg' });
}
