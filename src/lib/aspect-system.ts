/**
 * src/lib/aspect-system.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cerebro central del Sistema de Aspect Ratios Inmersivos de TGP Hemeroteca.
 *
 * TRES CONTENEDORES OFICIALES:
 * 1. BENTO ULTRA (Univisium 2:1 / 18:9)       → Franjas maestras de colección y banners.
 * 2. PANORÁMICO (IMAX Digital 19:10 / 1.90:1) → Paisajes, vistas aéreas, arqueología horizontal.
 * 3. MONUMENTAL (Canvas Pro 16:10 / 1.60:1)   → Bustos, retratos, monolitos, fauna y esculturas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ImmersiveVariant = 'monumental' | 'panoramico' | 'bento-ultra';

/**
 * Regex canónico para detectar sujetos con verticalidad anatómica o escultórica
 * (bustos, retratos de filósofos, fauna, deidades, esfinges, monolitos).
 */
const PORTRAIT_SUBJECT_REGEX =
  /olmeca|cabeza|monolito|aguara|hegel|homero|saturno|busto|estatua|retrato|filosofia|moctezuma|gengis|tatu|rostro|portrait|escultura|venus|urano|arquetipo|personaje|fauna|animal|tero|perdiz|tapir|vaca|hunza|buda|platon|espartaco|marco aurelio|jung|esfinge|giza|sadhguru|sanson|orixa|orixas|puma|dioses|momia|faraon|catacumba/i;

/**
 * Determina el contenedor inmersivo ideal según el sujeto del ensayo o posteo.
 */
export function resolveImmersiveVariant(
  entry?: any,
  slug?: string
): 'monumental' | 'panoramico' {
  // Override explícito si en el futuro se define en metadatos
  if (entry?.aspectRatio === 'panoramico' || entry?.aspectRatio === 'monumental') {
    return entry.aspectRatio;
  }

  const textToScan = `${entry?.title || ''} ${slug || ''} ${entry?.category || ''} ${entry?.dek || ''}`;
  return PORTRAIT_SUBJECT_REGEX.test(textToScan) ? 'monumental' : 'panoramico';
}

/**
 * Clases CSS Tailwind responsivas para cada contenedor:
 * - Móvil: Proporción 4:3 (panorámico) o 4:5 (monumental) para máxima presencia sin franjas invisibles.
 * - Escritorio (sm+): 19:10 para panorámico y 16:10 para monumental.
 */
export const IMMERSIVE_CLASSES = {
  // Para bustos, estatuas y figuras humanas (protección de cabeza y mentón)
  monumental: {
    container: 'aspect-4/5 sm:aspect-16/10 min-h-[460px] md:min-h-[560px] max-h-[82vh]',
    imgClass: 'object-cover',
    imgStyle: 'object-position: 50% 20%;', // Anclaje superior para nunca decapitar el busto
  },
  // Para paisajes, horizontes y yacimientos arqueológicos abiertos
  panoramico: {
    container: 'aspect-4/3 sm:aspect-19/10 min-h-[380px] md:min-h-[480px] max-h-[72vh]',
    imgClass: 'object-cover',
    imgStyle: 'object-position: 50% 38%;',
  },
  // Para franjas de colecciones tipo Bento Ultra (Univisium 2:1 / 18:9)
  bentoUltra: {
    container: 'aspect-4/3 sm:aspect-2/1 min-h-[420px] md:min-h-[460px] max-h-[76vh]',
    imgClass: 'object-cover',
    imgStyle: 'object-position: 50% 28%;',
  },
};
