/**
 * ADAPTADOR LEGACY TGP V1 → V2
 * Mapea las claves de estilo V1 a la arquitectura de dirección visual V2 sin alterar archivos en disco.
 */

import type {
  LegacyVisualKey,
  NarrativeMode,
  VisualSensitivity,
  ResolvedArtDirection,
  ManualLabInput,
  IntelligentDirectorInput,
} from './types';
import { NARRATIVE_PRESETS } from './narrative-presets';

export interface LegacyStyleAdapterResult {
  v2Mode: 'intelligent' | 'manual';
  narrativeMode: NarrativeMode;
  visualSensitivity: VisualSensitivity;
  preferredPartial: Partial<ResolvedArtDirection>;
  legacyKey: LegacyVisualKey;
  label: string;
}

export const LEGACY_KEY_MAP: Record<LegacyVisualKey, LegacyStyleAdapterResult> = {
  'victorian-archeo': {
    legacyKey: 'victorian-archeo',
    label: 'Victorian Archeo',
    v2Mode: 'intelligent',
    narrativeMode: 'archival-reconstruction',
    visualSensitivity: 'classic',
    preferredPartial: {
      ...NARRATIVE_PRESETS['archival-reconstruction'].preferred,
      environment: 'institutional-archive',
      colorPalette: 'neutral-archive',
      materiality: ['aged-paper', 'waxed-wood', 'oxidized-metal'],
    },
  },

  'travel-senses': {
    legacyKey: 'travel-senses',
    label: 'Travel & Senses',
    v2Mode: 'intelligent',
    narrativeMode: 'field-documentary',
    visualSensitivity: 'classic',
    preferredPartial: {
      ...NARRATIVE_PRESETS['field-documentary'].preferred,
      environment: 'archaeological-field',
      lightingSource: 'golden-hour',
      filmTreatment: 'kodachrome-inspired',
      materiality: ['dry-stone', 'mud-clay', 'salt-air'],
    },
  },

  'dark-academia': {
    legacyKey: 'dark-academia',
    label: 'Dark Academia (Investigación)',
    v2Mode: 'intelligent',
    narrativeMode: 'observational-drama',
    visualSensitivity: 'classic',
    preferredPartial: {
      ...NARRATIVE_PRESETS['observational-drama'].preferred,
      environment: 'institutional-archive',
      colorPalette: 'neutral-archive',
      lightingSource: 'tungsten-practical',
      lightingQuality: 'restrained-chiaroscuro',
      materiality: ['aged-paper', 'waxed-wood', 'worn-velvet'],
    },
  },

  'italian-interiors': {
    legacyKey: 'italian-interiors',
    label: 'Italian Interiors',
    v2Mode: 'intelligent',
    narrativeMode: 'observational-drama',
    visualSensitivity: 'hybrid',
    preferredPartial: {
      ...NARRATIVE_PRESETS['observational-drama'].preferred,
      environment: 'lived-historic-interior',
      colorPalette: 'terracotta-neutral',
      lightingQuality: 'soft-wrap',
      materiality: ['worn-velvet', 'cracked-plaster', 'pigment-fresco'],
    },
  },

  'cine': {
    legacyKey: 'cine',
    label: 'Cine (Cinematográfico)',
    v2Mode: 'intelligent',
    narrativeMode: 'historical-epic',
    visualSensitivity: 'classic',
    preferredPartial: {
      ...NARRATIVE_PRESETS['historical-epic'].preferred,
      lensCharacter: 'anamorphic-subtle',
      lightingSource: 'mixed-practicals',
      captureMedium: 'digital-cinema-large-format',
      filmTreatment: 'soft-print-film',
    },
  },

  'editorial': {
    legacyKey: 'editorial',
    label: 'Editorial (Reliquia)',
    v2Mode: 'intelligent',
    narrativeMode: 'editorial-relic',
    visualSensitivity: 'classic',
    preferredPartial: {
      ...NARRATIVE_PRESETS['editorial-relic'].preferred,
    },
  },

  'concepto': {
    legacyKey: 'concepto',
    label: 'Concepto (Metáfora Visual)',
    v2Mode: 'intelligent',
    narrativeMode: 'material-surrealism',
    visualSensitivity: 'avant-garde',
    preferredPartial: {
      ...NARRATIVE_PRESETS['material-surrealism'].preferred,
    },
  },

  'personalizado': {
    legacyKey: 'personalizado',
    label: 'Estilo Personalizado (Manual)',
    v2Mode: 'manual',
    narrativeMode: 'observational-drama',
    visualSensitivity: 'classic',
    preferredPartial: {},
  },
};

/**
 * Convierte un input legacy (V1) en un input inteligente de V2
 */
export function adaptLegacyToV2Intelligent(
  title: string,
  concept: string,
  legacyKey: string
): IntelligentDirectorInput {
  const normalizedKey = (legacyKey in LEGACY_KEY_MAP ? legacyKey : 'editorial') as LegacyVisualKey;
  const adapter = LEGACY_KEY_MAP[normalizedKey];

  return {
    title,
    concept: concept || title,
    visualSensitivity: adapter.visualSensitivity,
    narrativeMode: adapter.narrativeMode,
    historicalRigor: 'documented-interpretive',
    sceneConditions: ['auto'],
    humanPresence: 'auto',
    visualRisk: 'balanced',
    aspectProfile: 'hero-16-9',
    toggles: {
      protectHistoricalAnchors: true,
      avoidAICliches: true,
      safeCropComposition: true,
      allowSingleConceptualAnomaly: adapter.narrativeMode === 'material-surrealism',
      generateDecisionReport: true,
      enableAdvancedOverrides: false,
    },
  };
}

/**
 * Convierte un input legacy (V1) a la configuración de Laboratorio Manual V2
 */
export function adaptLegacyToV2Manual(
  title: string,
  concept: string,
  legacyKey: string
): ManualLabInput {
  const normalizedKey = (legacyKey in LEGACY_KEY_MAP ? legacyKey : 'editorial') as LegacyVisualKey;
  const adapter = LEGACY_KEY_MAP[normalizedKey];
  const defaults = adapter.preferredPartial;

  return {
    subjectSummary: title,
    physicalScene: concept || title,
    subjectTreatment: defaults.subjectTreatment || 'evidential-object',
    environment: defaults.environment || 'institutional-archive',
    historicalAnchors: {
      categories: ['material-culture', 'period'],
      details: concept || title,
    },
    humanTrace: defaults.humanTrace || 'none',
    shotScale: defaults.shotScale || 'medium-wide',
    cameraAngle: defaults.cameraAngle || 'eye-level',
    cameraPosition: defaults.cameraPosition || 'centered-observer',
    lensCharacter: defaults.lensCharacter || 'spherical-clean',
    focusStrategy: defaults.focusStrategy || 'deep-focus',
    primaryComposition: defaults.primaryComposition || 'asymmetric-balance',
    secondaryComposition: defaults.secondaryComposition,
    lightingSource: defaults.lightingSource || 'overcast-daylight',
    lightingQuality: defaults.lightingQuality || 'soft-wrap',
    colorPalette: defaults.colorPalette || 'neutral-archive',
    captureMedium: defaults.captureMedium || 'digital-medium-format',
    filmTreatment: defaults.filmTreatment || 'none',
    materiality: defaults.materiality || ['aged-paper', 'waxed-wood'],
    imperfectionLevel: defaults.imperfectionLevel || 'restrained',
    aspectProfile: defaults.requestedAspectProfile || 'hero-16-9',
    selectedNegativeConstraints: defaults.selectedNegativeConstraints || ['no-plastic-skin', 'no-orange-teal'],
    locks: {},
    coherenceMode: 'warn',
  };
}
