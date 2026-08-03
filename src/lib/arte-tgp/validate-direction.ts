/**
 * VALIDADOR DE DIRECCIÓN VISUAL TGP V2
 * Comprueba límites estrictos (máx 2 composiciones, máx 4 materiales, máx 6 negativas, safe crop)
 */

import type {
  ResolvedArtDirection,
  DirectionWarning,
  AspectProfile,
  NegativeConstraint,
  ProviderCapabilities,
} from './types';

export const DEFAULT_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  modelId: 'gemini-3.1-flash-image-preview',
  supportedAspectRatios: ['16:9', '1:1', '3:4', '4:3', '9:16'],
  supportedResolutions: ['1024x1024', '1280x720', '1920x1080'],
  supportsNegativePrompt: false, // El SDK @google/genai generateContent no tiene negativePrompt nativo
  supportsReferenceImages: false,
  supportsSeed: false,
  supportsSafetySettings: true,
};

export interface AspectRatioResolution {
  providerAspectRatio: string;
  safeCropRequired: boolean;
  notes?: string;
}

/**
 * Mapea el perfil de aspecto solicitado al soporte real del proveedor con zona segura si aplica.
 */
export function resolveAspectRatio(
  requestedProfile: AspectProfile,
  capabilities: ProviderCapabilities = DEFAULT_PROVIDER_CAPABILITIES
): AspectRatioResolution {
  const supported = capabilities.supportedAspectRatios;

  switch (requestedProfile) {
    case 'hero-16-9':
      return {
        providerAspectRatio: supported.includes('16:9') ? '16:9' : '1:1',
        safeCropRequired: false,
      };

    case 'article-3-2':
      if (supported.includes('3:2')) {
        return { providerAspectRatio: '3:2', safeCropRequired: false };
      }
      // Fallback a 16:9 con safe crop
      return {
        providerAspectRatio: '16:9',
        safeCropRequired: true,
        notes: '3:2 no admitido nativamente; mapeado a 16:9 con encuadre de recorte seguro.',
      };

    case 'ultrawide-21-9':
      if (supported.includes('21:9')) {
        return { providerAspectRatio: '21:9', safeCropRequired: false };
      }
      return {
        providerAspectRatio: '16:9',
        safeCropRequired: true,
        notes: '21:9 no admitido nativamente; mapeado a 16:9 con safe crop panorámico.',
      };

    case 'editorial-4-5':
      if (supported.includes('4:5')) {
        return { providerAspectRatio: '4:5', safeCropRequired: false };
      }
      if (supported.includes('3:4')) {
        return {
          providerAspectRatio: '3:4',
          safeCropRequired: true,
          notes: '4:5 mapeado a 3:4 con safe crop.',
        };
      }
      return { providerAspectRatio: '1:1', safeCropRequired: true };

    case 'mobile-9-16':
      if (supported.includes('9:16')) {
        return { providerAspectRatio: '9:16', safeCropRequired: false };
      }
      return { providerAspectRatio: '3:4', safeCropRequired: true };

    case 'square-1-1':
    default:
      return {
        providerAspectRatio: supported.includes('1:1') ? '1:1' : '16:9',
        safeCropRequired: false,
      };
  }
}

/**
 * Filtra y prioriza las restricciones negativas dinámicas para emitir un máximo operativo de 6.
 */
export function filterDynamicNegativeConstraints(
  direction: ResolvedArtDirection
): NegativeConstraint[] {
  const selected = new Set<NegativeConstraint>([
    ...direction.selectedNegativeConstraints,
    ...direction.emittedNegativeConstraints,
  ]);

  const hasHuman = direction.humanTrace !== 'none' || direction.subjectTreatment === 'observational-human' || direction.subjectTreatment === 'editorial-portrait';
  const hasArchitecture = direction.environment === 'archaeological-field' || direction.environment === 'lived-historic-interior' || direction.environment === 'institutional-archive';
  const isAnamorphic = direction.lensCharacter === 'anamorphic-subtle';

  // Descartamos irrelevantes
  if (!hasHuman) selected.delete('no-plastic-skin');
  if (!hasArchitecture) selected.delete('no-decorative-ruins');
  if (!isAnamorphic) selected.delete('no-blue-anamorphic-flare');

  // Máximo 6 ordenadas por relevancia
  return Array.from(selected).slice(0, 6);
}

/**
 * Valida límites y coherencia de una dirección resuelta.
 */
export function validateResolvedDirection(direction: ResolvedArtDirection): DirectionWarning[] {
  const warnings: DirectionWarning[] = [...direction.warnings];

  // 1. Límite de composiciones: máximo 2
  if (direction.primaryComposition === direction.secondaryComposition) {
    direction.secondaryComposition = undefined;
  }

  // 2. Límite de materiales: máximo 4
  if (direction.materiality.length > 4) {
    warnings.push({
      ruleId: 'V_MAT_LIMIT',
      severity: 'warning',
      message: `Se truncó la lista de materiales de ${direction.materiality.length} a los 4 prioritarios.`,
      fields: ['materiality'],
    });
    direction.materiality = direction.materiality.slice(0, 4);
  }

  // 3. Negative constraints: filtrar a 6
  direction.emittedNegativeConstraints = filterDynamicNegativeConstraints(direction);

  return warnings;
}
