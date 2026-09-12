/**
 * src/lib/multivision.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sistema de Clases Multivisión para Imágenes
 * Resuelve la clase CSS adecuada basada en el prefijo del nombre de la imagen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function resolveMultivisionClass(src: string | { src: string } | null | undefined): string {
  if (!src) return 'img-nativa';
  const srcString = typeof src === 'object' ? src.src : src;
  const s = srcString.toLowerCase();
  
  if (s.includes('hero-') || s.includes('cover-') || s.includes('pano-')) {
    return 'img-panoramica';
  }
  if (s.includes('vert-') || s.includes('reel-') || s.includes('port-')) {
    return 'img-vertical';
  }
  if (s.includes('sq-') || s.includes('cuad-')) {
    return 'img-cuadrada';
  }
  if (s.includes('logo-') || s.includes('ui-') || s.includes('icon-')) {
    return ''; // UI no fuerza aspecto completo
  }
  
  return 'img-nativa'; // Regla de seguridad (Legacy)
}
