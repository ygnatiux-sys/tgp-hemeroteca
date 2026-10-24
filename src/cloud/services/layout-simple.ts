/**
 * src/cloud/services/layout-simple.ts
 * Maquetador Estructural Ligero (Ecosistema TGP SOMA / ARGON)
 * 
 * Normaliza payloads provenientes tanto de SOMA Engine (somaSearch) como de
 * Smart Curator (CuratedWikiBatch) en un modelo canónico de páginas editoriales
 * listo para ser renderizado por pdfkit-builder.ts.
 */

import type { CuratedWikiBatch } from '../../lib/curator/wiki-smart-curator.ts';
import type { SomaAsset, SomaSearchResult } from '../../core/soma-engine.ts';

export type DossierPageType = 'cover' | 'section-divider' | 'plate' | 'star-guest-full';

export interface DossierPlateItem {
  id: string;
  cdnUrl: string;
  cleanTitle: string;
  aiBrief: string;
  credits: string;
  secuenciaNarrativa: 1 | 2 | 3 | 4;
  isStarGuest: boolean;
  geometry: {
    width: number;
    height: number;
    aspectRatio: number;
  };
}

export interface DossierPage {
  pageIndex: number;
  type: DossierPageType;
  title: string;
  subtitle?: string;
  secuenciaNarrativa?: 1 | 2 | 3 | 4;
  plate?: DossierPlateItem;
}

export interface DossierLayout {
  topic: string;
  subtitle: string;
  dateGenerated: string;
  totalPages: number;
  totalPlates: number;
  starGuestsCount: number;
  pages: DossierPage[];
}

const SECTION_TITLES: Record<1 | 2 | 3 | 4, { title: string; subtitle: string }> = {
  1: {
    title: 'I. Cartografía y Contexto Territorial',
    subtitle: 'Planos axonométricos, delimitación geográfica y distribución urbana',
  },
  2: {
    title: 'II. Archivo Histórico Decimonónico',
    subtitle: 'Placas fotográficas y expediciones documentales del siglo XIX',
  },
  3: {
    title: 'III. Arquitectura y Volumetría Monumental',
    subtitle: 'Vistas generales, paramentos y composición lítica del yacimiento',
  },
  4: {
    title: 'IV. Epigrafía, Relieves y Anatomía Constructiva',
    subtitle: 'Detalles escultóricos, glifos, dinteles y estandarización del ornamento',
  },
};

/**
 * Normaliza cualquier entrada (CuratedWikiBatch o SomaSearchResult) en un array homogéneo de láminas
 */
function normalizeToPlates(input: CuratedWikiBatch | SomaSearchResult | SomaAsset[]): DossierPlateItem[] {
  // Caso 1: CuratedWikiBatch (Smart Curator)
  if ('imagenes' in input && Array.isArray(input.imagenes)) {
    return input.imagenes.map((img, idx) => ({
      id: `plate-${idx + 1}`,
      cdnUrl: img.cdnUrl,
      cleanTitle: img.cleanTitle || 'Registro Arqueológico',
      aiBrief: img.aiBrief || 'Documentación visual patrimonial.',
      credits: img.credits || 'Wikimedia Commons',
      secuenciaNarrativa: img.secuenciaNarrativa || 3,
      isStarGuest: Boolean(img.isStarGuest),
      geometry: img.geometry || { width: 1600, height: 1200, aspectRatio: 1.333 },
    }));
  }

  // Caso 2: SomaSearchResult (SOMA Engine)
  const assets: SomaAsset[] = Array.isArray(input)
    ? input
    : ('curatedBatch' in input && Array.isArray(input.curatedBatch) ? input.curatedBatch : []);

  return assets.map((asset, idx) => {
    const isStar = Boolean(asset.editorial?.isStarGuest) || (asset.geometry.aspectRatio >= 1.6 && idx < 3);
    const seq = (asset.editorial?.secuenciaNarrativa || (idx === 0 ? 1 : idx < 3 ? 2 : 3)) as 1 | 2 | 3 | 4;

    return {
      id: asset.id || `asset-${idx + 1}`,
      cdnUrl: asset.cdnUrl || asset.rawUrl,
      cleanTitle: asset.editorial?.cleanTitle || asset.title || 'Registro Arqueológico',
      aiBrief: asset.editorial?.aiBrief || asset.description || 'Ficha visual del monumento patrimonial.',
      credits: asset.license?.attributionPlainText || `${asset.author} · ${asset.license?.shortName || 'Dominio Público'}`,
      secuenciaNarrativa: seq,
      isStarGuest: isStar,
      geometry: {
        width: asset.geometry.width,
        height: asset.geometry.height,
        aspectRatio: asset.geometry.aspectRatio,
      },
    };
  });
}

/**
 * Ensambla el Layout Editorial completo respetando la arquitectura narrativa de 4 actos
 */
export function buildSimpleLayout(
  topic: string,
  input: CuratedWikiBatch | SomaSearchResult | SomaAsset[],
  customSubtitle?: string
): DossierLayout {
  const plates = normalizeToPlates(input);
  const pages: DossierPage[] = [];
  let pageIndex = 1;

  // 1. Portada Monumental
  pages.push({
    pageIndex: pageIndex++,
    type: 'cover',
    title: topic.trim(),
    subtitle: customSubtitle || 'Dossier de Evidencia Lítica y Cartografía Documental',
  });

  // Agrupamiento por secuencia narrativa (1 -> 2 -> 3 -> 4)
  const platesBySec: Record<1 | 2 | 3 | 4, DossierPlateItem[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const p of plates) {
    const s = [1, 2, 3, 4].includes(p.secuenciaNarrativa) ? p.secuenciaNarrativa : 3;
    platesBySec[s].push(p);
  }

  let starCount = 0;

  // 2. Iteración por cada acto narrativo
  for (const s of [1, 2, 3, 4] as const) {
    const secPlates = platesBySec[s];
    if (secPlates.length === 0) continue;

    // Hoja separadora de sección
    const secMeta = SECTION_TITLES[s];
    pages.push({
      pageIndex: pageIndex++,
      type: 'section-divider',
      title: secMeta.title,
      subtitle: secMeta.subtitle,
      secuenciaNarrativa: s,
    });

    // Láminas de la sección
    for (const plate of secPlates) {
      if (plate.isStarGuest) {
        starCount++;
        pages.push({
          pageIndex: pageIndex++,
          type: 'star-guest-full',
          title: plate.cleanTitle,
          subtitle: plate.aiBrief,
          secuenciaNarrativa: s,
          plate,
        });
      } else {
        pages.push({
          pageIndex: pageIndex++,
          type: 'plate',
          title: plate.cleanTitle,
          secuenciaNarrativa: s,
          plate,
        });
      }
    }
  }

  return {
    topic,
    subtitle: customSubtitle || 'Dossier de Evidencia Lítica y Cartografía Documental',
    dateGenerated: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }),
    totalPages: pages.length,
    totalPlates: plates.length,
    starGuestsCount: starCount,
    pages,
  };
}
