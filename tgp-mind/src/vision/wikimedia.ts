// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo Vision: Wikimedia Anti-Drift
// Extraído de index.ts. Contiene:
//   - resolverEntidadCanonica     — usa Gemini Flash para mapear nombres canónicos de Wikipedia
//   - buscarPageImageWikipedia    — PageImages curada en Wikipedia EN/ES
//   - buscarCommonsEstricto       — búsqueda por categoría o keywords en Wikimedia Commons
//   - buscarImagenWikipediaFallback — respaldo por búsqueda de texto
//   - procesarImagen              — pipeline completo: resolver → buscar → subir a R2
// ─────────────────────────────────────────────────────────────────────────────

import { genai } from '../ia/gemini.js';
import { subirImagenAR2 } from '../storage/r2.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface EntidadVisualCanonica {
  wikiEn: string;
  wikiEs: string;
  categoriaCommons: string;
  keywords: string[];
}

// ── Resolver entidad canónica con Gemini ──────────────────────────────────────
export async function resolverEntidadCanonica(tema: string): Promise<EntidadVisualCanonica> {
  const prompt = `Actúa como especialista enciclopédico de Wikipedia y Wikimedia Commons.
Analiza este tema o búsqueda histórica/geológica/cultural (que puede tener errores tipográficos o nombres informales): "${tema}".
Devuelve ÚNICAMENTE un objeto JSON sin formato markdown con esta estructura exacta:
{
  "wikiEn": "Título exacto del artículo principal en Wikipedia en inglés (ej: 'Klerksdorp sphere')",
  "wikiEs": "Título exacto del artículo principal en Wikipedia en español (ej: 'Esferas de Klerksdorp')",
  "categoriaCommons": "Nombre de la categoría más específica en Wikimedia Commons si existe, sin 'Category:' (ej: 'Klerksdorp spheres')",
  "keywords": ["2 a 4 palabras clave esenciales en inglés o español sin stopwords"]
}`;

  try {
    const resp = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ text: prompt }],
      config: { responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse(resp.text || '{}');
    return {
      wikiEn: parsed.wikiEn || tema,
      wikiEs: parsed.wikiEs || tema,
      categoriaCommons: parsed.categoriaCommons || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((k: string) => k.toLowerCase()) : [],
    };
  } catch (err) {
    console.warn('[Anti-Drift] Falló resolución con Gemini, usando término directo:', err);
    return {
      wikiEn: tema,
      wikiEs: tema,
      categoriaCommons: '',
      keywords: tema.toLowerCase().split(/\s+/).filter(w => w.length > 3),
    };
  }
}

// ── Búsqueda curada vía PageImages de Wikipedia ───────────────────────────────
export async function buscarPageImageWikipedia(titulo: string, lang: 'en' | 'es'): Promise<string> {
  if (!titulo) return '';
  const ua   = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const url  = `${base}?action=query&titles=${encodeURIComponent(titulo)}&prop=pageimages|original&format=json&pithumbsize=1200&redirects=1`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': ua } });
    if (!res.ok) return '';
    const data = await res.json() as any;
    const pages = data?.query?.pages;
    if (!pages) return '';

    for (const id in pages) {
      if (id === '-1') continue;
      const page = pages[id];
      const src  = page?.original?.source || page?.thumbnail?.source;
      if (src && /\.(jpe?g|png|webp)$/i.test(src)) {
        if (!/(flag|bandera|mapa|map|escudo|coat_of_arms|icon|disambig|symbol)/i.test(src)) {
          return src;
        }
      }
    }
  } catch (err) {
    console.warn(`[PageImage] Error en Wikipedia ${lang} para "${titulo}":`, err);
  }
  return '';
}

// ── Búsqueda restringida en Wikimedia Commons ─────────────────────────────────
export async function buscarCommonsEstricto(categoria: string, keywords: string[]): Promise<string> {
  const ua   = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const base = 'https://commons.wikimedia.org/w/api.php';

  if (categoria) {
    try {
      const catUrl = `${base}?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent('Category:' + categoria)}&gcmnamespace=6&gcmlimit=8&prop=imageinfo&iiprop=url|size&format=json`;
      const res  = await fetch(catUrl, { headers: { 'User-Agent': ua } });
      const data = await res.json() as any;
      const pages = data?.query?.pages;
      if (pages) {
        for (const id in pages) {
          const info   = pages[id]?.imageinfo?.[0];
          const imgUrl = info?.url;
          if (imgUrl && /\.(jpe?g|png|webp)$/i.test(imgUrl)) {
            if (!/(map|flag|diagram|icon|locator)/i.test(imgUrl) && (!info.width || info.width >= 500)) {
              return imgUrl;
            }
          }
        }
      }
    } catch {}
  }

  if (keywords.length > 0) {
    try {
      const queryStr  = keywords.join(' ') + ' -map -flag -icon -diagram';
      const searchUrl = `${base}?action=query&generator=search&gsrsearch=${encodeURIComponent(queryStr)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size&format=json`;
      const res  = await fetch(searchUrl, { headers: { 'User-Agent': ua } });
      const data = await res.json() as any;
      const pages = data?.query?.pages;
      if (pages) {
        for (const id in pages) {
          const title  = (pages[id]?.title || '').toLowerCase();
          const info   = pages[id]?.imageinfo?.[0];
          const imgUrl = info?.url;
          if (!imgUrl || !/\.(jpe?g|png|webp)$/i.test(imgUrl)) continue;
          const matchKw = keywords.some(k => title.includes(k));
          if (matchKw && !/(map|flag|diagram|icon|locator)/i.test(title)) return imgUrl;
        }
      }
    } catch {}
  }

  return '';
}

// ── Fallback de búsqueda textual en Wikipedia ─────────────────────────────────
export async function buscarImagenWikipediaFallback(termino: string, lang: 'es' | 'en'): Promise<string> {
  const ua   = 'TGPMind/1.0 (contact@thegreatpuzzleproject.com)';
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const url  = `${base}?action=query&generator=search&gsrsearch=${encodeURIComponent(termino)}&gsrlimit=3&prop=pageimages&format=json&pithumbsize=1000`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': ua } });
    const d   = await res.json() as any;
    if (d?.query?.pages) {
      for (const id in d.query.pages) {
        const src = d.query.pages[id]?.thumbnail?.source;
        if (src) return src;
      }
    }
  } catch {}
  return '';
}

// ── Pipeline completo: resolver → buscar → subir a R2 ────────────────────────
export async function procesarImagen(terminoBusqueda: string): Promise<string> {
  console.log(`[Anti-Drift Imagen] Iniciando búsqueda verificada para: "${terminoBusqueda}"`);
  try {
    const entidad = await resolverEntidadCanonica(terminoBusqueda);
    console.log(`[Anti-Drift] Entidad: WikiEN="${entidad.wikiEn}", WikiES="${entidad.wikiEs}", CatCommons="${entidad.categoriaCommons}"`);

    let raw = await buscarPageImageWikipedia(entidad.wikiEn, 'en');
    if (!raw) raw = await buscarPageImageWikipedia(entidad.wikiEs, 'es');
    if (!raw) raw = await buscarCommonsEstricto(entidad.categoriaCommons, entidad.keywords);
    if (!raw) raw = await buscarImagenWikipediaFallback(entidad.wikiEs, 'es') || await buscarImagenWikipediaFallback(entidad.wikiEn, 'en');

    if (!raw) {
      console.warn(`[Anti-Drift] Sin resultados verificados para: "${terminoBusqueda}"`);
      return '';
    }

    console.log(`[Anti-Drift] Imagen seleccionada con éxito: ${raw}`);
    return await subirImagenAR2(raw);
  } catch (err) {
    console.error(`[procesarImagen] Error para "${terminoBusqueda}":`, err);
    return '';
  }
}
