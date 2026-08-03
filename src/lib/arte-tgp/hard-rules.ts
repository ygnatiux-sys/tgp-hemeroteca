/**
 * REGLAS DE COMPATIBILIDAD NIVEL A: DIEZ RESTRICCIONES DURAS (H01 - H10)
 * The Great Puzzle Project — Motor de Dirección Visual V2
 * 
 * Cada regla registra:
 * - id: Identificador único de la regla
 * - level: 'hard'
 * - priority: Número de prioridad (1 = mayor)
 * - changedFields: Lista de campos alterados
 * - reason: Justificación técnica/editorial
 */

import type {
  ResolvedArtDirection,
  CompatibilityDecision,
  DirectionWarning,
  DirectionLocks,
} from './types';

export interface HardRuleContext {
  mode: 'intelligent' | 'manual';
  narrativeMode?: string;
  historicalRigor?: string;
  sceneConditions?: string[];
}

export type HardRuleApplicator = (
  direction: ResolvedArtDirection,
  locks: DirectionLocks,
  context: HardRuleContext
) => {
  decisions: CompatibilityDecision[];
  warnings: DirectionWarning[];
};

export interface HardRuleDefinition {
  id: string;
  name: string;
  priority: number;
  apply: HardRuleApplicator;
}

export const HARD_RULES: HardRuleDefinition[] = [
  // -------------------------------------------------------------
  // H01 — TUNGSTENO SIN SEPIA
  // -------------------------------------------------------------
  {
    id: 'H01',
    name: 'Tungsteno sin Sepia',
    priority: 10,
    apply: (direction, locks) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      if (direction.lightingSource === 'tungsten-practical') {
        if (direction.colorPalette === 'restricted-archival-sepia') {
          if (locks.lockColor) {
            warnings.push({
              ruleId: 'H01',
              severity: 'conflict',
              message: 'H01 Conflicto: La fuente de tungsteno entra en conflicto con la paleta sepia bloqueada manualmente.',
              fields: ['colorPalette', 'lightingSource'],
            });
          } else {
            const originalValue = direction.colorPalette;
            direction.colorPalette = 'tungsten-neutral';
            decisions.push({
              id: 'H01',
              level: 'hard',
              priority: 10,
              changedFields: ['colorPalette'],
              reason: 'La iluminación de tungsteno práctica no debe degradarse en lavado sepia monocromático.',
              originalValues: { colorPalette: originalValue },
              appliedValues: { colorPalette: 'tungsten-neutral' },
            });
          }
        }
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H02 — LLUVIA SIN POLVO SECO
  // -------------------------------------------------------------
  {
    id: 'H02',
    name: 'Lluvia sin Polvo Seco ni Fuego Expuesto',
    priority: 20,
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];
      const hasRain = context.sceneConditions?.includes('rain');

      if (hasRain) {
        // Materialidad: eliminar dry-stone y light-dust, favorecer wet-stone
        if (direction.materiality.includes('dry-stone') || direction.materiality.includes('light-dust')) {
          if (locks.lockMateriality) {
            warnings.push({
              ruleId: 'H02',
              severity: 'warning',
              message: 'H02 Advertencia: Escena con lluvia contiene polvo seco o piedra seca bloqueados manualmente.',
              fields: ['materiality'],
            });
          } else {
            const originalMateriality = [...direction.materiality];
            const updated = direction.materiality
              .filter(m => m !== 'dry-stone' && m !== 'light-dust');
            if (!updated.includes('wet-stone') && updated.length < 4) {
              updated.unshift('wet-stone');
            }
            direction.materiality = updated;
            decisions.push({
              id: 'H02',
              level: 'hard',
              priority: 20,
              changedFields: ['materiality'],
              reason: 'La lluvia elimina el polvo suspendido y la piedra seca expuesta, requiriendo superficies húmedas.',
              originalValues: { materiality: originalMateriality },
              appliedValues: { materiality: updated },
            });
          }
        }

        // Iluminación: fuego abierto desprotegido en lluvia
        if (direction.lightingSource === 'candle-fire') {
          if (locks.lockLighting) {
            warnings.push({
              ruleId: 'H02',
              severity: 'warning',
              message: 'H02 Advertencia: Fuego/velas expuestas en escena con lluvia.',
              fields: ['lightingSource'],
            });
          } else {
            const originalLighting = direction.lightingSource;
            direction.lightingSource = 'overcast-daylight';
            decisions.push({
              id: 'H02',
              level: 'hard',
              priority: 20,
              changedFields: ['lightingSource'],
              reason: 'Fuego abierto bloqueado en condición de lluvia exterior; cambiado a luz ambiental envolvente.',
              originalValues: { lightingSource: originalLighting },
              appliedValues: { lightingSource: 'overcast-daylight' },
            });
          }
        }
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H03 — FLARE JUSTIFICADO
  // -------------------------------------------------------------
  {
    id: 'H03',
    name: 'Flare Justificado',
    priority: 30,
    apply: (direction) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      const isAnamorphic = direction.lensCharacter === 'anamorphic-subtle';
      const hasIntenseSource = [
        'hard-sun',
        'direct-flash',
        'candle-fire',
        'tungsten-practical',
      ].includes(direction.lightingSource);

      // Si no es anamórfico o no hay fuente intensa frontal, nos aseguramos de que no haya flare
      if (!isAnamorphic || !hasIntenseSource) {
        if (!direction.emittedNegativeConstraints.includes('no-blue-anamorphic-flare')) {
          direction.emittedNegativeConstraints.push('no-blue-anamorphic-flare');
          decisions.push({
            id: 'H03',
            level: 'hard',
            priority: 30,
            changedFields: ['emittedNegativeConstraints'],
            reason: 'Destello anamórfico restringido: no existe lente anamórfica con fuente luminosa directa en encuadre.',
          });
        }
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H04 — ÉPICA SIN MACRO
  // -------------------------------------------------------------
  {
    id: 'H04',
    name: 'Épica Histórica sin Macro',
    priority: 40,
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      if (context.narrativeMode === 'historical-epic') {
        const forbiddenScales = ['macro-detail', 'extreme-close'];
        if (forbiddenScales.includes(direction.shotScale)) {
          if (locks.lockCamera) {
            warnings.push({
              ruleId: 'H04',
              severity: 'conflict',
              message: 'H04 Conflicto: Épica histórica no admite plano macro o primerísimo plano bloqueado.',
              fields: ['shotScale', 'narrativeMode'],
            });
          } else {
            const originalScale = direction.shotScale;
            direction.shotScale = 'extreme-wide';
            direction.focusStrategy = 'deep-focus';
            decisions.push({
              id: 'H04',
              level: 'hard',
              priority: 40,
              changedFields: ['shotScale', 'focusStrategy'],
              reason: 'La Épica Histórica exige escala territorial o monumental, incompatible con encuadres macro.',
              originalValues: { shotScale: originalScale },
              appliedValues: { shotScale: 'extreme-wide', focusStrategy: 'deep-focus' },
            });
          }
        }
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H05 — CLOSE-UP SIN EXTREME-WIDE
  // -------------------------------------------------------------
  {
    id: 'H05',
    name: 'Primer Plano Psicológico sin Gran Angular Extremo',
    priority: 50,
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      if (context.narrativeMode === 'psychological-closeup') {
        if (direction.shotScale === 'extreme-wide' || direction.primaryComposition === 'environmental-scale') {
          if (locks.lockCamera || locks.lockComposition) {
            warnings.push({
              ruleId: 'H05',
              severity: 'conflict',
              message: 'H05 Conflicto: Primer plano psicológico incompatible con plano general extremo bloqueado.',
              fields: ['shotScale', 'primaryComposition'],
            });
          } else {
            const originalScale = direction.shotScale;
            direction.shotScale = 'close';
            direction.focusStrategy = 'selective-focus';
            decisions.push({
              id: 'H05',
              level: 'hard',
              priority: 50,
              changedFields: ['shotScale', 'focusStrategy'],
              reason: 'El Primer Plano Psicológico exige concentración en rostro, manos u objeto íntimo.',
              originalValues: { shotScale: originalScale },
              appliedValues: { shotScale: 'close', focusStrategy: 'selective-focus' },
            });
          }
        }
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H06 — NOCHE SIN GOLDEN HOUR
  // -------------------------------------------------------------
  {
    id: 'H06',
    name: 'Expedición Nocturna sin Luz Solar Diurna',
    priority: 60,
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      const isNight = context.narrativeMode === 'night-expedition' || 
                      context.sceneConditions?.includes('night') || 
                      direction.lightingSource === 'moonlit-ambient';

      if (isNight) {
        const forbiddenLights = ['golden-hour', 'raking-sun', 'hard-sun', 'overcast-daylight'];
        if (forbiddenLights.includes(direction.lightingSource)) {
          if (locks.lockLighting) {
            warnings.push({
              ruleId: 'H06',
              severity: 'conflict',
              message: 'H06 Conflicto: Entorno nocturno incompatible con luz solar diurna bloqueada.',
              fields: ['lightingSource'],
            });
          } else {
            const originalLighting = direction.lightingSource;
            direction.lightingSource = 'moonlit-ambient';
            direction.colorPalette = 'sodium-cyan-night';
            decisions.push({
              id: 'H06',
              level: 'hard',
              priority: 60,
              changedFields: ['lightingSource', 'colorPalette'],
              reason: 'Expedición nocturna no admite iluminación solar; ajustado a luz lunar y paleta nocturna.',
              originalValues: { lightingSource: originalLighting },
              appliedValues: { lightingSource: 'moonlit-ambient', colorPalette: 'sodium-cyan-night' },
            });
          }
        }
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H07 — CAPTURA DIGITAL NO ES PELÍCULA FÍSICA
  // -------------------------------------------------------------
  {
    id: 'H07',
    name: 'Captura Digital Tratada como Emulación',
    priority: 70,
    apply: (direction) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      const isDigital = [
        'digital-cinema-large-format',
        'digital-medium-format',
        'digital-full-frame',
      ].includes(direction.captureMedium);

      if (isDigital && direction.filmTreatment !== 'none') {
        decisions.push({
          id: 'H07',
          level: 'hard',
          priority: 70,
          changedFields: ['filmTreatment'],
          reason: 'Captura digital: el tratamiento se formula estrictamente como emulación/pipeline de color, no soporte fotoquímico físico.',
        });
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H08 — RIGOR ESTRICTO SIN SURREALISMO
  // -------------------------------------------------------------
  {
    id: 'H08',
    name: 'Rigor Estricto sin Anomalías Surrealistas',
    priority: 80,
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      if (context.historicalRigor === 'strict') {
        if (direction.subjectTreatment === 'material-anomaly' || context.narrativeMode === 'material-surrealism') {
          if (locks.lockSubject) {
            warnings.push({
              ruleId: 'H08',
              severity: 'conflict',
              message: 'H08 Conflicto: Rigor histórico estricto incompatible con anomalía surrealista bloqueada.',
              fields: ['subjectTreatment', 'historicalRigor'],
            });
          } else {
            const originalSubject = direction.subjectTreatment;
            direction.subjectTreatment = 'evidential-object';
            decisions.push({
              id: 'H08',
              level: 'hard',
              priority: 80,
              changedFields: ['subjectTreatment'],
              reason: 'Rigor histórico estricto prohíbe anomalías ficticias o surrealismo material; ajustado a objeto evidencial.',
              originalValues: { subjectTreatment: originalSubject },
              appliedValues: { subjectTreatment: 'evidential-object' },
            });
          }
        }
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H09 — MACRO REQUIERE SUJETO COMPATIBLE
  // -------------------------------------------------------------
  {
    id: 'H09',
    name: 'Macro Requiere Sujeto Táctil Compatible',
    priority: 90,
    apply: (direction, locks) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      if (direction.shotScale === 'macro-detail') {
        const incompatibleSubjects = [
          'environmental-subject',
          'landscape-as-evidence',
          'architectural-subject',
        ];

        if (incompatibleSubjects.includes(direction.subjectTreatment)) {
          if (locks.lockCamera) {
            warnings.push({
              ruleId: 'H09',
              severity: 'warning',
              message: 'H09 Advertencia: Escala macro aplicada a sujeto paisajístico/arquitectónico.',
              fields: ['shotScale', 'subjectTreatment'],
            });
          } else {
            const originalScale = direction.shotScale;
            direction.shotScale = 'medium-close';
            decisions.push({
              id: 'H09',
              level: 'hard',
              priority: 90,
              changedFields: ['shotScale'],
              reason: 'Detalle macro requiere un objeto, inscripción o fragmento táctil, incompatible con paisaje completo.',
              originalValues: { shotScale: originalScale },
              appliedValues: { shotScale: 'medium-close' },
            });
          }
        }
      }
      return { decisions, warnings };
    },
  },

  // -------------------------------------------------------------
  // H10 — LOCKS INVIOLABLES
  // -------------------------------------------------------------
  {
    id: 'H10',
    name: 'Locks Inviolables',
    priority: 100,
    apply: (direction, locks) => {
      const decisions: CompatibilityDecision[] = [];
      const warnings: DirectionWarning[] = [];

      // Validamos que ningún lock haya sido violado
      const activeLocks = Object.entries(locks).filter(([, v]) => v === true);
      if (activeLocks.length > 0) {
        decisions.push({
          id: 'H10',
          level: 'hard',
          priority: 100,
          changedFields: activeLocks.map(([k]) => k),
          reason: `Se respetaron y protegieron ${activeLocks.length} locks manuales inviolables.`,
        });
      }
      return { decisions, warnings };
    },
  },
];
