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
  
  let baseClass = 'img-nativa';

  if (s.includes('hero-') || s.includes('cover-') || s.includes('pano-')) {
    baseClass = 'img-panoramica';
  } else if (s.includes('vert-') || s.includes('reel-') || s.includes('port-')) {
    baseClass = 'img-vertical';
  } else if (s.includes('sq-') || s.includes('cuad-')) {
    baseClass = 'img-cuadrada';
  } else if (s.includes('logo-') || s.includes('ui-') || s.includes('icon-')) {
    baseClass = ''; // UI no fuerza aspecto completo
  }
  
  if (baseClass && (s.includes('-top') || s.includes('wiki'))) {
    baseClass += ' enfocar-rostro';
  }
  
  if (s.includes('mercurio') || s.includes('homero') || s.includes('saturno') || s.includes('wiki') || s.includes('busto') || s.includes('estatua') || s.includes('retrato') || s.includes('piramide')) {
    baseClass += ' !w-full !h-full object-contain! bg-[#08090a]';
  }
  
  return baseClass;
}
