/**
 * ADAPTADOR DE PROVEEDOR DE IMAGEN Y MODELOS TGP V2
 * Centraliza configuraciones de modelos de Gemini, llamadas al SDK @google/genai y cláusulas negativas.
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import type {
  ProviderCapabilities,
  ProviderImageRequest,
  ProviderImageResponse,
  NormalizedProviderError,
  NegativeConstraint,
} from './types';

// ==========================================
// 1. CONFIGURACIÓN CENTRALIZADA DE MODELOS
// ==========================================
export const MODEL_CONFIG = {
  textModel: 'gemini-3-flash-preview',
  imageModel: 'gemini-3.1-flash-image-preview',
  fallbackTextModel: 'gemini-2.5-flash',
};

export const PROVIDER_CAPABILITIES: ProviderCapabilities = {
  modelId: MODEL_CONFIG.imageModel,
  supportedAspectRatios: ['16:9', '1:1', '3:4', '4:3', '9:16'],
  supportedResolutions: ['1024x1024', '1280x720', '1920x1080'],
  supportsNegativePrompt: false, // El SDK generateContent no recibe negativePrompt separado
  supportsReferenceImages: false,
  supportsSeed: false,
  supportsSafetySettings: true,
};

// ==========================================
// 2. CONSTRUCTOR DE CLÁUSULA NEGATIVA DINÁMICA
// ==========================================

const NEGATIVE_CONSTRAINT_TRANSLATIONS: Record<NegativeConstraint, string> = {
  'no-sepia': 'monochromatic sepia wash, aged yellow tint filter',
  'no-steampunk': 'steampunk gears, brass goggles, fictional Victorian fantasy',
  'no-fantasy-costume': 'cosplay fantasy garments, renaissance fair costumes',
  'no-blue-anamorphic-flare': 'unmotivated blue streak lens flare, JJ Abrams lighting',
  'no-perfect-symmetry': 'robotic artificial symmetry, uncanny mathematical framing',
  'no-excessive-bokeh': 'extreme blurry bokeh, melted indistinct background',
  'no-unmotivated-volumetric-dust': 'theatrical artificial fog, mystical floating dust rays',
  'no-plastic-skin': 'airbrushed plastic skin, doll face, oversmoothed AI complexion',
  'no-anachronism': 'anachronistic materials, modern items in historical context',
  'no-illegible-text': 'gibberish text, mangled letters, pseudowriting',
  'no-over-sharpening': 'artificial digital sharpening halos, aggressive edge enhancement',
  'no-orange-teal': 'generic Hollywood orange and teal hyper-grading',
  'no-generic-dark-academia': 'stereotypical Pinterest dark academia collage',
  'no-tourist-postcard': 'cheesy travel postcard look, flat oversaturated lighting',
  'no-decorative-ruins': 'romanticized stage-set ruins, fantasy overgrown stone',
  'no-glowing-symbols': 'magical glowing glyphs, sci-fi energy effects',
  'no-floating-particles': 'sparkles, glitter, ungrounded floating embers',
  'no-empty-cinematic-spectacle': 'hollow blockbuster cinematic clutter, CGI explosion look',
  'no-unmotivated-lens-flare': 'random stray lens flares with no optical source',
};

/**
 * Ensambla una cláusula negativa en lenguaje natural (máx 6 restricciones) para incluir al final del prompt.
 */
export function buildDynamicNegativeClause(constraints: NegativeConstraint[]): string {
  if (!constraints || constraints.length === 0) {
    return 'Strict exclusions: Avoid artificial CGI gloss, oversaturated plastic skin, modern anachronisms, and unmotivated fantasy elements.';
  }

  const terms = constraints
    .slice(0, 6)
    .map(c => NEGATIVE_CONSTRAINT_TRANSLATIONS[c] || c.replace('no-', 'no '))
    .join(', ');

  return `Strict exclusions (do not generate): ${terms}. Maintain photographic material realism and physical optical discipline.`;
}

// ==========================================
// 3. NORMALIZADOR DE ERRORES DEL PROVEEDOR
// ==========================================

export function normalizeProviderError(error: any): NormalizedProviderError {
  const msg = error?.message || String(error);

  if (msg.includes('SAFETY') || msg.includes('blocked') || msg.includes('HARM')) {
    return {
      type: 'safety',
      message: 'La generación fue bloqueada por filtros de seguridad del proveedor.',
      providerReason: msg,
      retryable: false,
      rawMetadata: error,
    };
  }

  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('429')) {
    return {
      type: 'quota',
      message: 'Se ha superado la cuota de peticiones a la API de Gemini.',
      providerReason: msg,
      retryable: true,
      rawMetadata: error,
    };
  }

  if (msg.includes('API_KEY') || msg.includes('UNAUTHENTICATED') || msg.includes('401')) {
    return {
      type: 'authentication',
      message: 'Error de autenticación: GEMINI_API_KEY inválida o ausente.',
      providerReason: msg,
      retryable: false,
      rawMetadata: error,
    };
  }

  if (msg.includes('INVALID_ARGUMENT') || msg.includes('400')) {
    return {
      type: 'invalid-request',
      message: 'Parámetros de petición no soportados por el modelo.',
      providerReason: msg,
      retryable: false,
      rawMetadata: error,
    };
  }

  return {
    type: 'provider',
    message: msg || 'Error desconocido al materializar la imagen.',
    retryable: true,
    rawMetadata: error,
  };
}

// ==========================================
// 4. LLAMADA DIRECTA AL MODELO DE IMAGEN
// ==========================================

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: string;
  slug?: string | null;
  apiKey?: string;
}

export async function generateImageWithGemini(
  options: GenerateImageOptions
): Promise<ProviderImageResponse> {
  const { prompt, aspectRatio = '16:9', slug = null } = options;

  let apiKey = options.apiKey || import.meta.env.GEMINI_API_KEY;
  if (!apiKey && typeof process !== 'undefined' && process.env) {
    apiKey = process.env.GEMINI_API_KEY;
  }

  if (!apiKey) {
    return {
      success: false,
      error: 'No se encontró GEMINI_API_KEY en el servidor.',
      normalizedError: {
        type: 'authentication',
        message: 'GEMINI_API_KEY ausente en variables de entorno.',
        retryable: false,
      },
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: MODEL_CONFIG.imageModel,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      config: {
        aspectRatio: aspectRatio,
      } as any,
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
    const base64Image = imagePart?.inlineData?.data;

    if (!base64Image) {
      throw new Error('La API de Gemini no devolvió datos binarios de imagen.');
    }

    let coverImagePath: string | null = null;

    // Si se especificó slug, guardamos la imagen en assets
    if (slug) {
      try {
        const buffer = Buffer.from(base64Image, 'base64');
        const assetDir = path.join(process.cwd(), 'src', 'assets', 'ensayos', slug);
        if (!fs.existsSync(assetDir)) {
          fs.mkdirSync(assetDir, { recursive: true });
        }
        const imgFile = path.join(assetDir, 'coverImage.jpeg');
        fs.writeFileSync(imgFile, buffer);
        coverImagePath = `/src/assets/ensayos/${slug}/coverImage.jpeg`;
      } catch (saveErr: any) {
        console.warn('No se pudo guardar la imagen en assets:', saveErr.message);
      }
    }

    return {
      success: true,
      image: `data:image/jpeg;base64,${base64Image}`,
      coverImagePath,
    };
  } catch (error: any) {
    console.error('Error en generador de imagen:', error);
    const normalized = normalizeProviderError(error);
    return {
      success: false,
      error: normalized.message,
      normalizedError: normalized,
    };
  }
}
