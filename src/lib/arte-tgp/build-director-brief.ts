/**
 * CONSTRUCTOR DEL BRIEF DE DIRECCIÓN DE ARTE TGP V2
 * Sintetiza la dirección visual resuelta en un informe estructurado y legible.
 */

import type { ResolvedArtDirection } from './types';
import { buildDynamicNegativeClause } from './provider-adapter';

export interface DirectorBriefResult {
  fullTextBrief: string;
  summary: string;
  technicalSpecs: {
    lensAndFraming: string;
    lightingAndColor: string;
    captureAndTexture: string;
    exclusions: string;
  };
}

/**
 * Genera el brief de dirección de arte a partir de la dirección resuelta.
 */
export function buildDirectorBrief(direction: ResolvedArtDirection): DirectorBriefResult {
  const {
    subjectSummary,
    physicalScene,
    subjectTreatment,
    environment,
    historicalAnchors,
    humanTrace,
    shotScale,
    cameraAngle,
    cameraPosition,
    lensCharacter,
    focusStrategy,
    primaryComposition,
    secondaryComposition,
    lightingSource,
    lightingQuality,
    colorPalette,
    captureMedium,
    filmTreatment,
    materiality,
    imperfectionLevel,
    requestedAspectProfile,
    providerAspectRatio,
    safeCropRequired,
    emittedNegativeConstraints,
  } = direction;

  const negativeClause = buildDynamicNegativeClause(emittedNegativeConstraints);

  const lensAndFraming = `${shotScale}, ángulo ${cameraAngle}, posición ${cameraPosition}, lente ${lensCharacter}, enfoque ${focusStrategy}, composición principal ${primaryComposition}${secondaryComposition ? ` + secundaria ${secondaryComposition}` : ''}`;
  const lightingAndColor = `Luz ${lightingSource} (${lightingQuality}), paleta ${colorPalette}`;
  const captureAndTexture = `Medio ${captureMedium}, tratamiento ${filmTreatment}, imperfección ${imperfectionLevel}, materiales clave: ${materiality.join(', ')}`;

  const fullTextBrief = `
[DIRECCIÓN VISUAL TGP V2]
- Concepto y Sujeto: ${subjectSummary}
- Escena Física: ${physicalScene}
- Tratamiento de Sujeto: ${subjectTreatment} | Entorno: ${environment}
- Anclajes Históricos: ${historicalAnchors.categories.join(', ')} (${historicalAnchors.details})
- Presencia Humana: ${humanTrace}
- Cámara y Encuadre: ${lensAndFraming}
- Iluminación y Color: ${lightingAndColor}
- Captura y Materialidad: ${captureAndTexture}
- Proporción: ${requestedAspectProfile} (Provider: ${providerAspectRatio}${safeCropRequired ? ' [Safe Crop Requerido]' : ''})
- Restricciones Negativas: ${negativeClause}
`.trim();

  return {
    fullTextBrief,
    summary: `${subjectSummary} (${environment} / ${subjectTreatment})`,
    technicalSpecs: {
      lensAndFraming,
      lightingAndColor,
      captureAndTexture,
      exclusions: negativeClause,
    },
  };
}
