/**
 * PRESETS EDITORIALES DE DIRECCIÓN DE ARTE — MOTOR NANO BANANA
 *
 * Cada preset define la técnica fotográfica pura en inglés (Cámara, Iluminación, Color)
 * para evitar la dilución semántica (token bleed) con el sujeto de la escena.
 */

export interface EditorialPreset {
  label: string;
  camara: string;
  iluminacion: string;
  color: string;
}

export const PRESETS_ARTE: Record<string, EditorialPreset> = {
  'archivo-museo': {
    label: '🏛️ Archivo Museo (Hasselblad Macro)',
    camara: 'Shot on Hasselblad H6D-100c, 100mm macro lens, f/8, tack-sharp focus.',
    iluminacion: 'Museum archival lighting, polarized cross-lighting to reveal surface texture, pitch-black background.',
    color: 'True-to-life color grading, high micro-contrast, non-reflective matte finish.',
  },
  'expedicion-90s': {
    label: '🌍 Expedición 90s (Kodak Portra 35mm)',
    camara: 'Shot on 35mm film, Kodak Portra 400, Leica M6, 35mm Summicron lens, f/2.8.',
    iluminacion: 'Natural golden hour sunlight, harsh shadows, diffuse atmospheric dust.',
    color: 'Subtle film grain, warm nostalgic tones, slight halation on highlights, vivid lifelike colors.',
  },
  'dark-academia': {
    label: '📚 Dark Academia (Claroscuro Editorial)',
    camara: 'Editorial still-life cinematography, medium format, shallow depth of field.',
    iluminacion: 'Striking chiaroscuro, single shaft of volumetric window light, dusty atmosphere, deep inky shadows.',
    color: 'Sepia-toned warmth, underexposed by 1 stop, rich copper and obsidian palette, archival print texture.',
  },
  'cine': {
    label: '🎬 Cine (Panavision Anamorphic)',
    camara: 'Cinematic wide establishing sequence, 1970s Panavision anamorphic lens, filmed on Arri Alexa 65.',
    iluminacion: 'Practical firelight mixed with cool ambient moonlight (dual color lighting), long dramatic shadows.',
    color: 'Kodak Vision3 500T film stock, visceral muddy textures, subtle chromatic aberration at the edges, anamorphic blue lens flare.',
  },
  'concepto': {
    label: '🧊 Concepto (Surrealismo Geométrico)',
    camara: 'Avant-garde cinematic surrealism, medium format portrait orientation.',
    iluminacion: 'Volumetric lighting piercing through ethereal geometric fog, deep dramatic contrast.',
    color: 'Bleach bypass film process look (desaturated but high contrast), solemn muted tones, earthy monochrome spectrum.',
  },
  'editorial': {
    label: '📰 Editorial (Vogue Still Life)',
    camara: 'High-end editorial still life macro cinematography, Leica 100mm f/2.8 lens.',
    iluminacion: 'Striking Chiaroscuro lighting, subtle Gobo shadow (pattern of an ancient window) cast over the subject, suspended dust particles illuminated by the light beam.',
    color: 'Dark Academia color palette, Vogue aesthetic, 35mm film grain, subtle halation around highlights.',
  },
};

export type LineaEditorialKey = keyof typeof PRESETS_ARTE;
