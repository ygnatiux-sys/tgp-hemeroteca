/**
 * PREFERENCIAS FUERTES (P01 - P08) Y SUGERENCIAS CREATIVAS (Nivel B y C)
 * The Great Puzzle Project — Motor de Dirección Visual V2
 * 
 * Estas reglas ordenan candidatos y optimizan armonía estética sin invalidar selecciones manuales.
 */

import type {
  ResolvedArtDirection,
  CompatibilityDecision,
  DirectionLocks,
} from './types';

export interface PreferenceApplicatorContext {
  mode: 'intelligent' | 'manual';
  narrativeMode?: string;
  historicalRigor?: string;
  sceneConditions?: string[];
  aspectProfile?: string;
}

export type PreferenceApplicator = (
  direction: ResolvedArtDirection,
  locks: DirectionLocks,
  context: PreferenceApplicatorContext
) => CompatibilityDecision[];

export interface PreferenceDefinition {
  id: string;
  name: string;
  apply: PreferenceApplicator;
}

export const PREFERENCES: PreferenceDefinition[] = [
  // -------------------------------------------------------------
  // P01 — VIENTO VISIBLE EN SUS EFECTOS
  // -------------------------------------------------------------
  {
    id: 'P01',
    name: 'Efectos Físicos de Viento',
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      const hasWind = context.sceneConditions?.includes('wind');

      if (hasWind) {
        if (!locks.lockComposition && direction.primaryComposition === 'central-iconic') {
          direction.primaryComposition = 'asymmetric-balance';
          decisions.push({
            id: 'P01',
            level: 'preference',
            priority: 15,
            changedFields: ['primaryComposition'],
            reason: 'Viento: Se favorece equilibrio asimétrico para acentuar dinamismo natural.',
          });
        }
        if (!locks.lockCamera && direction.cameraPosition === 'centered-observer') {
          direction.cameraPosition = 'off-axis';
          decisions.push({
            id: 'P01',
            level: 'preference',
            priority: 16,
            changedFields: ['cameraPosition'],
            reason: 'Viento: Cámara fuera de eje para captar desplazamiento de telas y atmósfera.',
          });
        }
      }
      return decisions;
    },
  },

  // -------------------------------------------------------------
  // P02 — ARCHIVO INSTITUCIONAL FUNCIONAL
  // -------------------------------------------------------------
  {
    id: 'P02',
    name: 'Archivo Funcional vs Biblioteca Gótica',
    apply: (direction, locks) => {
      const decisions: CompatibilityDecision[] = [];
      if (direction.environment === 'institutional-archive') {
        if (!direction.emittedNegativeConstraints.includes('no-generic-dark-academia')) {
          direction.emittedNegativeConstraints.push('no-generic-dark-academia');
          decisions.push({
            id: 'P02',
            level: 'preference',
            priority: 25,
            changedFields: ['emittedNegativeConstraints'],
            reason: 'Archivo institucional: Evita clichés de biblioteca gótica genérica o polvo teatral.',
          });
        }
      }
      return decisions;
    },
  },

  // -------------------------------------------------------------
  // P03 — MUSEO CLÍNICO Y CONSERVACIÓN
  // -------------------------------------------------------------
  {
    id: 'P03',
    name: 'Museo Clínico y Nitidez de Conservación',
    apply: (direction) => {
      const decisions: CompatibilityDecision[] = [];
      if (direction.environment === 'museum-clinical') {
        const negativeToAdd = ['no-unmotivated-volumetric-dust', 'no-sepia'];
        negativeToAdd.forEach(neg => {
          if (!direction.emittedNegativeConstraints.includes(neg as any)) {
            direction.emittedNegativeConstraints.push(neg as any);
          }
        });
        decisions.push({
          id: 'P03',
          level: 'preference',
          priority: 35,
          changedFields: ['emittedNegativeConstraints'],
          reason: 'Museo clínico: Luz neutra, nitidez de conservación y exclusión de polvo y humo.',
        });
      }
      return decisions;
    },
  },

  // -------------------------------------------------------------
  // P04 — DOCUMENTAL DE CAMPO (FIELD DOCUMENTARY)
  // -------------------------------------------------------------
  {
    id: 'P04',
    name: 'Documental de Campo Orgánico',
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      if (context.narrativeMode === 'field-documentary') {
        if (!locks.lockLighting && direction.lightingQuality === 'specular-editorial') {
          direction.lightingQuality = 'ambient-unbeautified';
          decisions.push({
            id: 'P04',
            level: 'preference',
            priority: 45,
            changedFields: ['lightingQuality'],
            reason: 'Documental de campo: Se favorece luz ambiental sin embellecer ni retoques de estudio.',
          });
        }
      }
      return decisions;
    },
  },

  // -------------------------------------------------------------
  // P05 — RELIQUIA EDITORIAL (EDITORIAL RELIC)
  // -------------------------------------------------------------
  {
    id: 'P05',
    name: 'Reliquia Editorial con Espacio Negativo',
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      if (context.narrativeMode === 'editorial-relic') {
        if (!locks.lockComposition && !direction.secondaryComposition) {
          direction.secondaryComposition = 'negative-space-for-title';
          decisions.push({
            id: 'P05',
            level: 'preference',
            priority: 55,
            changedFields: ['secondaryComposition'],
            reason: 'Reliquia editorial: Se activa espacio negativo reservado para tipografía y diagramación.',
          });
        }
      }
      return decisions;
    },
  },

  // -------------------------------------------------------------
  // P06 — FORMATO VERTICAL MÓVIL (MOBILE 9:16)
  // -------------------------------------------------------------
  {
    id: 'P06',
    name: 'Zona Segura Vertical en Formato Móvil',
    apply: (direction, locks) => {
      const decisions: CompatibilityDecision[] = [];
      if (direction.requestedAspectProfile === 'mobile-9-16') {
        direction.safeCropRequired = true;
        if (!locks.lockComposition && direction.primaryComposition !== 'mobile-safe-vertical') {
          direction.secondaryComposition = 'mobile-safe-vertical';
          decisions.push({
            id: 'P06',
            level: 'preference',
            priority: 65,
            changedFields: ['safeCropRequired', 'secondaryComposition'],
            reason: 'Formato vertical 9:16: Sujeto protegido en zona central vertical.',
          });
        }
      }
      return decisions;
    },
  },

  // -------------------------------------------------------------
  // P07 — HERO 16:9 WEB
  // -------------------------------------------------------------
  {
    id: 'P07',
    name: 'Hero 16:9 con Espacio Seguro para Título',
    apply: (direction, locks) => {
      const decisions: CompatibilityDecision[] = [];
      if (direction.requestedAspectProfile === 'hero-16-9') {
        if (!locks.lockComposition && direction.primaryComposition === 'central-iconic') {
          direction.secondaryComposition = 'negative-space-for-title';
          decisions.push({
            id: 'P07',
            level: 'preference',
            priority: 75,
            changedFields: ['secondaryComposition'],
            reason: 'Hero 16:9: Espacio asimétrico reservado para volanta y título del post.',
          });
        }
      }
      return decisions;
    },
  },

  // -------------------------------------------------------------
  // P08 — MATERIAL SURREALISM: EXACTAMENTE UNA ANOMALÍA
  // -------------------------------------------------------------
  {
    id: 'P08',
    name: 'Surrealismo Material con Física Creíble',
    apply: (direction, locks, context) => {
      const decisions: CompatibilityDecision[] = [];
      if (context.narrativeMode === 'material-surrealism' || direction.subjectTreatment === 'material-anomaly') {
        const sciFiNegatives = ['no-glowing-symbols', 'no-floating-particles', 'no-fantasy-costume'];
        sciFiNegatives.forEach(neg => {
          if (!direction.emittedNegativeConstraints.includes(neg as any)) {
            direction.emittedNegativeConstraints.push(neg as any);
          }
        });
        decisions.push({
          id: 'P08',
          level: 'preference',
          priority: 85,
          changedFields: ['emittedNegativeConstraints'],
          reason: 'Surrealismo material: Se restringen brillos mágicos o clichés de ciencia ficción para preservar verosimilitud fotográfica.',
        });
      }
      return decisions;
    },
  },
];
