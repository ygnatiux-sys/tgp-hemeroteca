/**
 * scripts/lib/sharp-profiles.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * SISTEMA DE PERFILES DE PROCESAMIENTO SHARP (TGP)
 *
 * Principio: Prohibido aplicar una resolución/configuración global a TODAS
 * las imágenes. Cada archivo se clasifica según su prefijo de nombre y recibe
 * la configuración Sharp que corresponde a su rol en el frontend.
 *
 * Fuente de verdad para optimizar-remotas.mjs, optimizar-r2.mjs y
 * sync-assets-r2.mjs. Cualquier cambio en calidad/dimensiones se hace aquí.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CATEGORÍAS:
 *
 *  ① HERO / VIEWPORT 100vw   → hero- | cover- | pano-
 *     Cabeceras de artículos, portadas (sin recorte, ancho máximo).
 *     2560px · webp q88 effort6 smartSubsample
 *
 *  ② INLINE / CONTENIDO      → img- | post- | figure-
 *     Imágenes dentro de párrafos (ancho de lectura).
 *     1200px · ratio original (inside) · webp q80 effort5
 *
 *  ③ THUMBNAILS / TARJETAS   → thumb- | card- | min-
 *     Grillas, tarjetas, previsualizaciones. Target sub-50 KB.
 *     800px · ratio original (inside) · webp q75 effort4
 *
 *  ④ VERTICAL / REEL         → vert- | reel- | port-
 *     Arte vertical, posters.
 *     1440px · ratio original (inside) · webp q85
 *
 *  ⑤ CUADRADO                → sq- | cuad-
 *     Arte 1:1, portadas cuadradas.
 *     1600px · ratio original (inside) · webp q85
 *
 *  ⑥ UI / LOGOS / ÍCONOS     → logo- | ui- | icon-
 *     Marca, avatares, SVGs rasterizados. Sin recorte ni alteración de ratio.
 *     Max 400px · fit:inside · webp q90 (o .png si necesita transparencia)
 *
 *  ⑦ FALLBACK (sin prefijo reconocido)
 *     Conservador: comportamiento seguro igual al perfil INLINE.
 *     1200px · ratio original (inside) · webp q80 effort5
 */

// ── DEFINICIÓN DE PERFILES ───────────────────────────────────────────────────

/** @typedef {{ width?: number, height?: number, fit?: string, withoutEnlargement?: boolean, position?: string }} ResizeOptions */
/** @typedef {{ quality: number, effort?: number, smartSubsample?: boolean }} WebpOptions */
/** @typedef {{ name: string, resize: ResizeOptions, webp: WebpOptions, preservePng?: boolean, log: string }} SharpProfile */

/** @type {SharpProfile[]} */
const PROFILES = [
  {
    name: 'hero',
    prefixes: ['hero-', 'cover-', 'pano-'],
    // Uso: .img-panoramica — viewport completo (sin recortes, respeta ratio)
    resize: {
      width: 2560,
      withoutEnlargement: true,
    },
    webp: { quality: 88, effort: 6, smartSubsample: true },
    log: '🎬 Hero/Pano · max 2560px · q88',
  },
  {
    name: 'inline',
    prefixes: ['img-', 'post-', 'figure-'],
    // Uso: imágenes dentro de artículo, ancho de lectura
    resize: {
      width: 1200,
      fit: 'inside',
      withoutEnlargement: true,
    },
    webp: { quality: 80, effort: 5 },
    log: '📄 Inline/Contenido · max 1200px · q80',
  },
  {
    name: 'thumb',
    prefixes: ['thumb-', 'card-', 'min-'],
    // Uso: grillas, tarjetas — target sub-50KB
    resize: {
      width: 800,
      fit: 'inside',
      withoutEnlargement: true,
    },
    webp: { quality: 75, effort: 4 },
    log: '🃏 Thumb/Card · max 800px · q75',
  },
  {
    name: 'vert',
    prefixes: ['vert-', 'reel-', 'port-'],
    resize: {
      width: 1440,
      withoutEnlargement: true,
    },
    webp: { quality: 85 },
    log: '📱 Vertical/Reel · max 1440px · q85',
  },
  {
    name: 'sq',
    prefixes: ['sq-', 'cuad-'],
    resize: {
      width: 1600,
      withoutEnlargement: true,
    },
    webp: { quality: 85 },
    log: '⬛ Cuadrado · max 1600px · q85',
  },
  {
    name: 'ui',
    prefixes: ['logo-', 'ui-', 'icon-'],
    // Uso: marca, logos — PROHIBIDO recortar o alterar ratio
    resize: {
      width: 400,
      fit: 'inside',          // nunca cover, nunca recorte
      withoutEnlargement: true,
    },
    webp: { quality: 90 },
    preservePng: true,        // respetar .png cuando requiere transparencia
    log: '🔰 UI/Logo · max 400px inside · q90',
  },
];

/** Perfil seguro para archivos sin prefijo reconocido (igual a inline) */
const FALLBACK_PROFILE = {
  name: 'fallback',
  resize: {
    width: 1200,
    fit: 'inside',
    withoutEnlargement: true,
  },
  webp: { quality: 80, effort: 5 },
  log: '📦 Fallback · max 1200px · q80',
};

// ── API PÚBLICA ───────────────────────────────────────────────────────────────

/**
 * Devuelve el perfil Sharp correspondiente al nombre de archivo.
 * La clasificación se basa únicamente en el prefijo del basename.
 *
 * @param {string} filename  — Nombre del archivo (solo basename, con extensión)
 * @returns {SharpProfile}
 */
export function getSharpProfile(filename) {
  const base = filename.toLowerCase();
  for (const profile of PROFILES) {
    if (profile.prefixes.some(prefix => base.startsWith(prefix))) {
      return profile;
    }
  }
  return FALLBACK_PROFILE;
}

/**
 * Devuelve un resumen legible de todos los perfiles (para logs de inicio).
 * @returns {string}
 */
export function printProfileSummary() {
  const lines = [
    '┌─ PERFILES SHARP ACTIVOS ────────────────────────────────────────────┐',
    `│  ① Hero/Pano   [hero- cover- pano-]   max 2560px inside · q88 effort6│`,
    `│  ② Inline      [img-  post-  figure-] max 1200px inside · q80 effort5│`,
    `│  ③ Thumb/Card  [thumb- card- min-]    max 800px  inside · q75 effort4│`,
    `│  ④ Vertical    [vert- reel- port-]    max 1440px inside · q85        │`,
    `│  ⑤ Cuadrado    [sq- cuad-]            max 1600px inside · q85        │`,
    `│  ⑥ UI/Logo     [logo-  ui-   icon-]   max 400px  inside · q90        │`,
    `│  ⑦ Fallback    (sin prefijo)          max 1200px inside · q80 effort5│`,
    '└─────────────────────────────────────────────────────────────────────┘',
  ];
  return lines.join('\n');
}

/**
 * Construye los parámetros completos de Sharp listos para encadenar.
 * Retorna { resizeOptions, webpOptions, profile }.
 *
 * @param {string} filename
 */
export function resolveSharpParams(filename) {
  const profile = getSharpProfile(filename);
  return {
    profile,
    resizeOptions: profile.resize,
    webpOptions: profile.webp,
  };
}
