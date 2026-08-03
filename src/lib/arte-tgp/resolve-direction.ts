/**
 * RESOLVER DETERMINISTA TYPESCRIPT TGP V2
 * Motor de compatibilidad, reglas duras, preferencias, locks y modos de coherencia (off / warn / correct).
 */

import type {
  ResolvedArtDirection,
  IntelligentDirectorInput,
  ManualLabInput,
  ProviderCapabilities,
  CompatibilityDecision,
  DirectionWarning,
  DirectionLocks,
  NarrativeMode,
} from './types';
import { NARRATIVE_PRESETS } from './narrative-presets';
import { HARD_RULES } from './hard-rules';
import { PREFERENCES } from './preferences';
import {
  DEFAULT_PROVIDER_CAPABILITIES,
  resolveAspectRatio,
  validateResolvedDirection,
} from './validate-direction';

/**
 * Resuelve la dirección visual en MODO INTELIGENTE (Combinador)
 */
export function resolveIntelligentDirection(
  input: IntelligentDirectorInput,
  capabilities: ProviderCapabilities = DEFAULT_PROVIDER_CAPABILITIES
): ResolvedArtDirection {
  const decisions: CompatibilityDecision[] = [];
  const warnings: DirectionWarning[] = [];
  const locks: DirectionLocks = {}; // En modo inteligente no hay locks iniciales de usuario salvo overrides

  const narrativeKey = (input.narrativeMode === 'auto' ? 'editorial-relic' : input.narrativeMode) as Exclude<NarrativeMode, 'auto'>;
  const preset = NARRATIVE_PRESETS[narrativeKey] || NARRATIVE_PRESETS['editorial-relic'];
  const p = preset.preferred;

  // Aspect ratio calculation
  const aspectRes = resolveAspectRatio(input.aspectProfile, capabilities);

  // Construcción del objeto base resuelto a partir del preset inteligente
  const resolved: ResolvedArtDirection = {
    version: '2.0',
    mode: 'intelligent',

    subjectSummary: input.title,
    physicalScene: input.concept || input.title,

    subjectTreatment: p.subjectTreatment || 'evidential-object',
    environment: p.environment || 'institutional-archive',
    historicalAnchors: {
      categories: ['period', 'material-culture'],
      details: input.contextNotes || input.concept || input.title,
    },
    humanTrace: input.humanPresence === 'auto' ? (p.humanTrace || 'none') : (input.humanPresence as any),

    shotScale: p.shotScale || 'medium',
    cameraAngle: p.cameraAngle || 'eye-level',
    cameraPosition: p.cameraPosition || 'centered-observer',
    lensCharacter: p.lensCharacter || 'spherical-clean',
    focusStrategy: p.focusStrategy || 'deep-focus',
    primaryComposition: p.primaryComposition || 'asymmetric-balance',
    secondaryComposition: p.secondaryComposition,

    lightingSource: p.lightingSource || 'overcast-daylight',
    lightingQuality: p.lightingQuality || 'soft-wrap',
    colorPalette: p.colorPalette || 'neutral-archive',

    captureMedium: p.captureMedium || 'digital-medium-format',
    filmTreatment: p.filmTreatment || 'none',
    materiality: p.materiality ? [...p.materiality] : ['dry-stone', 'aged-paper'],
    imperfectionLevel: p.imperfectionLevel || 'human',

    requestedAspectProfile: input.aspectProfile,
    providerAspectRatio: aspectRes.providerAspectRatio,
    safeCropRequired: aspectRes.safeCropRequired,

    selectedNegativeConstraints: p.selectedNegativeConstraints ? [...p.selectedNegativeConstraints] : ['no-plastic-skin', 'no-orange-teal'],
    emittedNegativeConstraints: [],

    locks,
    decisions: [],
    warnings: [],
    providerCapabilities: capabilities,
  };

  // Aplicamos sensibilidad vanguardista o híbrida si aplica
  if (input.visualSensitivity === 'avant-garde') {
    resolved.primaryComposition = 'edge-crop';
    resolved.cameraPosition = 'off-axis';
    decisions.push({
      id: 'SENS_AVANT_GARDE',
      level: 'creative',
      priority: 5,
      changedFields: ['primaryComposition', 'cameraPosition'],
      reason: 'Sensibilidad Vanguardista: Encuadre al borde y cámara fuera de eje.',
    });
  } else if (input.visualSensitivity === 'hybrid') {
    resolved.secondaryComposition = 'asymmetric-balance';
    decisions.push({
      id: 'SENS_HYBRID',
      level: 'creative',
      priority: 5,
      changedFields: ['secondaryComposition'],
      reason: 'Sensibilidad Híbrida: Base clásica con equilibrio asimétrico contemporáneo.',
    });
  }

  // Ejecutamos las 10 Hard Rules (Modo Inteligente siempre aplica correcciones duras)
  const ruleContext = {
    mode: 'intelligent' as const,
    narrativeMode: input.narrativeMode,
    historicalRigor: input.historicalRigor,
    sceneConditions: input.sceneConditions,
  };

  for (const rule of HARD_RULES) {
    const result = rule.apply(resolved, locks, ruleContext);
    decisions.push(...result.decisions);
    warnings.push(...result.warnings);
  }

  // Ejecutamos Preferencias Fuertes
  for (const pref of PREFERENCES) {
    const prefDecisions = pref.apply(resolved, locks, ruleContext);
    decisions.push(...prefDecisions);
  }

  resolved.decisions = decisions;
  resolved.warnings = warnings;

  // Validación final de límites
  validateResolvedDirection(resolved);

  return resolved;
}

/**
 * Resuelve la dirección visual en MODO LABORATORIO MANUAL
 */
export function resolveManualDirection(
  input: ManualLabInput,
  capabilities: ProviderCapabilities = DEFAULT_PROVIDER_CAPABILITIES
): ResolvedArtDirection {
  const decisions: CompatibilityDecision[] = [];
  const warnings: DirectionWarning[] = [];
  const locks = input.locks || {};

  const aspectRes = resolveAspectRatio(input.aspectProfile, capabilities);

  const resolved: ResolvedArtDirection = {
    version: '2.0',
    mode: 'manual',

    subjectSummary: input.subjectSummary,
    physicalScene: input.physicalScene,

    subjectTreatment: input.subjectTreatment,
    environment: input.environment,
    historicalAnchors: input.historicalAnchors,
    humanTrace: input.humanTrace,

    shotScale: input.shotScale,
    cameraAngle: input.cameraAngle,
    cameraPosition: input.cameraPosition,
    lensCharacter: input.lensCharacter,
    focusStrategy: input.focusStrategy,
    primaryComposition: input.primaryComposition,
    secondaryComposition: input.secondaryComposition,

    lightingSource: input.lightingSource,
    lightingQuality: input.lightingQuality,
    colorPalette: input.colorPalette,

    captureMedium: input.captureMedium,
    filmTreatment: input.filmTreatment,
    materiality: [...input.materiality],
    imperfectionLevel: input.imperfectionLevel,

    requestedAspectProfile: input.aspectProfile,
    providerAspectRatio: aspectRes.providerAspectRatio,
    safeCropRequired: aspectRes.safeCropRequired,

    selectedNegativeConstraints: [...input.selectedNegativeConstraints],
    emittedNegativeConstraints: [],

    locks,
    decisions: [],
    warnings: [],
    providerCapabilities: capabilities,
  };

  const mode = input.coherenceMode || 'warn';

  // 1. MODO 'off': no modifica nada, no muestra advertencias ni correcciones
  if (mode === 'off') {
    resolved.decisions = [];
    resolved.warnings = [];
    validateResolvedDirection(resolved);
    return resolved;
  }

  // 2. MODO 'warn' o 'correct': evaluamos reglas
  const ruleContext = {
    mode: 'manual' as const,
  };

  if (mode === 'warn') {
    // Modo WARN: Creamos un clon temporal para detectar qué cambiaría y emitir solo advertencias
    const tempClone = JSON.parse(JSON.stringify(resolved));
    for (const rule of HARD_RULES) {
      const result = rule.apply(tempClone, locks, ruleContext);
      // Trasladamos los cambios sugeridos como warnings
      for (const dec of result.decisions) {
        warnings.push({
          ruleId: dec.id,
          severity: 'warning',
          message: `${dec.id} [${dec.reason}]`,
          fields: dec.changedFields,
        });
      }
      warnings.push(...result.warnings);
    }
  } else if (mode === 'correct') {
    // Modo CORRECT: Aplica restricciones duras respetando estrictamente los locks
    for (const rule of HARD_RULES) {
      const result = rule.apply(resolved, locks, ruleContext);
      decisions.push(...result.decisions);
      warnings.push(...result.warnings);
    }
  }

  resolved.decisions = decisions;
  resolved.warnings = warnings;

  validateResolvedDirection(resolved);

  return resolved;
}
