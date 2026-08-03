/**
 * REDACTOR DE PROMPTS VISUALES TGP V2
 * Sintetiza la dirección visual resuelta en un prompt en inglés (70-140 palabras)
 * optimizado para gemini-3.1-flash-image-preview, cerrando con la cláusula negativa dinámica.
 */

import { GoogleGenAI } from '@google/genai';
import type { ResolvedArtDirection } from './types';
import { MODEL_CONFIG, buildDynamicNegativeClause } from './provider-adapter';
import { buildDirectorBrief } from './build-director-brief';

/**
 * Generador de prompt mediante plantilla determinista (garantía de fallback inmediato y sin coste)
 */
export function buildTemplateImagePrompt(direction: ResolvedArtDirection): string {
  const {
    subjectSummary,
    physicalScene,
    subjectTreatment,
    environment,
    historicalAnchors,
    shotScale,
    cameraAngle,
    lensCharacter,
    focusStrategy,
    primaryComposition,
    lightingSource,
    lightingQuality,
    colorPalette,
    captureMedium,
    filmTreatment,
    materiality,
    imperfectionLevel,
    emittedNegativeConstraints,
  } = direction;

  const negativeClause = buildDynamicNegativeClause(emittedNegativeConstraints);

  const promptBody = [
    `Editorial still photograph of ${subjectSummary}.`,
    `Scene: ${physicalScene}, set in an authentic ${environment.replace(/-/g, ' ')}.`,
    `Subject treatment: ${subjectTreatment.replace(/-/g, ' ')} with historical fidelity to ${historicalAnchors.categories.join(', ')} (${historicalAnchors.details}).`,
    `Shot scale & optics: ${shotScale.replace(/-/g, ' ')}, ${cameraAngle.replace(/-/g, ' ')} view, captured with ${lensCharacter.replace(/-/g, ' ')} lens, ${focusStrategy.replace(/-/g, ' ')}.`,
    `Composition: ${primaryComposition.replace(/-/g, ' ')}.`,
    `Lighting & Palette: ${lightingQuality.replace(/-/g, ' ')} from ${lightingSource.replace(/-/g, ' ')}, graded in ${colorPalette.replace(/-/g, ' ')} tones.`,
    `Medium & Textures: ${captureMedium.replace(/-/g, ' ')} aesthetic with ${filmTreatment.replace(/-/g, ' ')}, showing genuine tactile materials (${materiality.join(', ')}), ${imperfectionLevel.replace(/-/g, ' ')} distress level.`,
    `Museum archive realism, ultra-detailed physical material textures, balanced contrast.`,
  ].join(' ');

  return `${promptBody}\n\n${negativeClause}`;
}

export interface PromptWriterOptions {
  direction: ResolvedArtDirection;
  apiKey?: string;
  useLLM?: boolean;
}

/**
 * Redacta el prompt visual final. Si useLLM es true, consulta al modelo Gemini para enriquecer
 * la prosa visual manteniendo fidelidad estricta al brief; si no, utiliza la plantilla directa.
 */
export async function buildFinalImagePrompt(options: PromptWriterOptions): Promise<string> {
  const { direction, apiKey, useLLM = true } = options;
  const fallback = buildTemplateImagePrompt(direction);

  let key = apiKey || import.meta.env.GEMINI_API_KEY;
  if (!key && typeof process !== 'undefined' && process.env) {
    key = process.env.GEMINI_API_KEY;
  }

  if (!useLLM || !key) {
    return fallback;
  }

  try {
    const brief = buildDirectorBrief(direction);
    const ai = new GoogleGenAI({ apiKey: key });

    const systemInstruction = `You are the Lead Art Director for "The Great Puzzle Project" (TGP Hemeroteca).
Your job is to translate a structured Art Direction Brief into a concise, evocative, hyper-detailed image generation prompt in English (between 70 and 130 words).
RULES:
1. ONLY describe the static visual scene, physical light, optics, genuine historical materials, and tangible atmosphere.
2. NO video terms, NO camera movement, NO narrative storytelling text, NO meta explanations.
3. Write continuous cinematic photographic prose.
4. Conclude with the exact negative exclusion clause provided in the brief.`;

    const response = await ai.models.generateContent({
      model: MODEL_CONFIG.textModel,
      contents: [{
        role: 'user',
        parts: [{
          text: `${systemInstruction}\n\nBRIEF:\n${brief.fullTextBrief}\n\nEmit the final prompt now:`
        }]
      }]
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text || text.length < 30) {
      return fallback;
    }

    // Si la respuesta del LLM no contiene la cláusula negativa, la anexamos
    const negativeClause = buildDynamicNegativeClause(direction.emittedNegativeConstraints);
    if (!text.includes('Strict exclusions') && !text.includes('do not generate')) {
      return `${text}\n\n${negativeClause}`;
    }

    return text;
  } catch (err) {
    console.warn('⚠️ Fallback a prompt por plantilla determinista:', err);
    return fallback;
  }
}
