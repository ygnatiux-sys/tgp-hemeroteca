// ─────────────────────────────────────────────────────────────────────────────
// TGP HEMEROTECA — Utilidades de Extracción de Metadatos del Laboratorio Visual
// ─────────────────────────────────────────────────────────────────────────────

export interface MetadatosInforme {
  titulo: string;
  slug: string;
  categoria: string;
  excerpt: string;
  tags: string[];
}

export function cleanMd(str: string): string {
  return str.replace(/[*_#`]/g, '').trim();
}

export function extraerMetadatosInforme(
  texto: string,
  modo: 'flash' | 'pro' | null,
  archivoNombre: string,
): MetadatosInforme {
  let titulo = '';
  let categoria = 'Historia';
  let excerpt = '';
  let tags: string[] = [];

  if (modo === 'pro') {
    const matchH1 = texto.match(/\*\*Titular H1 Sugerido:\*\*\s*(.+)/i) || texto.match(/Titular H1 Sugerido:\s*(.+)/i);
    if (matchH1) titulo = cleanMd(matchH1[1]);

    const matchDek = texto.match(/\*\*Subtítulo \/ Dek:\*\*\s*(.+)/i) || texto.match(/Subtítulo \/ Dek:\s*(.+)/i);
    const matchExcerpt = texto.match(/\*\*Excerpt Editorial:\*\*\s*([\s\S]*?)(?=\n-|\n#|$)/i);
    if (matchExcerpt) {
      excerpt = cleanMd(matchExcerpt[1]);
    } else if (matchDek) {
      excerpt = cleanMd(matchDek[1]);
    }

    const matchCol = texto.match(/\*\*Colección Sugerida:\*\*\s*(.+)/i) || texto.match(/Colección Sugerida:\s*(.+)/i);
    if (matchCol) categoria = cleanMd(matchCol[1]);

    const matchTags = texto.match(/\*\*Tags para D1:\*\*\s*(.+)/i);
    if (matchTags) {
      tags = matchTags[1].split(',').map((t) => cleanMd(t)).filter(Boolean);
    }
  } else {
    const matchSujeto = texto.match(/\*\*Sujeto \/ Obra:\*\*\s*(.+)/i) || texto.match(/Sujeto \/ Obra:\s*(.+)/i);
    if (matchSujeto) titulo = cleanMd(matchSujeto[1]);

    const matchEpoca = texto.match(/\*\*Cultura & Época:\*\*\s*(.+)/i) || texto.match(/Cultura & Época:\s*(.+)/i);
    const matchAtmosfera = texto.match(/\*\*Atmósfera & Cromatismo:\*\*\s*(.+)/i) || texto.match(/Atmósfera & Cromatismo:\s*(.+)/i);
    if (matchAtmosfera) {
      excerpt = cleanMd(matchAtmosfera[1]);
    } else if (matchEpoca) {
      excerpt = cleanMd(matchEpoca[1]);
    }

    const matchCol = texto.match(/\*\*Colección TGP Recomendada:\*\*\s*(.+)/i) || texto.match(/Colección TGP Recomendada:\s*(.+)/i);
    if (matchCol) categoria = cleanMd(matchCol[1]);
  }

  if (!titulo) {
    titulo = archivoNombre ? archivoNombre.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Nuevo Ensayo Arqueosemiótico';
  }

  const slug = titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `post-${Date.now()}`;

  return { titulo, slug, categoria, excerpt, tags };
}
