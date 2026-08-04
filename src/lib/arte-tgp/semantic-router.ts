/**
 * ROUTER SEMÁNTICO TGP V2
 * Analiza el título y concepto del ensayo mediante Gemini para inferir el modo narrativo,
 * tratamiento de sujeto, entorno y anclajes históricos con respaldo heurístico.
 */

import { GoogleGenAI } from '@google/genai';
import type { SemanticRoutingResult, NarrativeMode, SubjectTreatment, Environment } from './types';
import { MODEL_CONFIG } from './provider-adapter';

export interface SemanticRouterOptions {
  title: string;
  concept?: string;
  contextNotes?: string;
  apiKey?: string;
}

/**
 * Enrutador semántico con fallback heurístico determinista
 */
export async function runSemanticRouter(options: SemanticRouterOptions): Promise<SemanticRoutingResult> {
  const { title, concept = '', contextNotes = '', apiKey } = options;

  let key = apiKey || import.meta.env.GEMINI_API_KEY;
  if (!key && typeof process !== 'undefined' && process.env) {
    key = process.env.GEMINI_API_KEY;
  }

  // Fallback heurístico básico basado en palabras clave del título y concepto
  const fallbackResult: SemanticRoutingResult = inferHeuristicRouting(title, concept);

  if (!key) {
    return fallbackResult;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });

    const prompt = `You are the Visual Semantic Router for "The Great Puzzle Project" (TGP Hemeroteca).
Given the essay title, concept and notes, analyze and return a strictly valid JSON object matching this schema:
{
  "subjectSummary": "Concise summary of the visual focal point in English or Spanish",
  "physicalScene": "Concrete physical spatial scene description",
  "candidateNarrativeMode": "one of: observational-drama | historical-epic | psychological-closeup | night-expedition | archival-reconstruction | field-documentary | editorial-relic | material-surrealism",
  "candidateSubjectTreatment": "one of: evidential-object | observational-human | ritual-action | editorial-portrait | anonymous-figure | environmental-subject | archival-tableau | material-anomaly | architectural-subject | landscape-as-evidence",
  "candidateEnvironment": "one of: archaeological-field | institutional-archive | museum-clinical | lived-historic-interior | decayed-heritage | monumental-landscape | nocturnal-site | studio-material | urban-palimpsest | ritual-space | domestic-historical | industrial-archaeology",
  "candidateSceneConditions": ["array of: still, wind, rain, mist, dust, heat, cold, wet-ground, night, interior, exterior"],
  "historicalAnchors": {
    "categories": ["period", "material-culture", "architecture"],
    "details": "Historical period, material or architectural specifics"
  },
  "humanPresence": "one of: none | trace-only | distant-scale | hands-only | partial-body | single-observer | working-figure | small-group | crowd",
  "uncertainty": []
}

TITLE: ${title}
CONCEPT: ${concept}
NOTES: ${contextNotes}

Return ONLY the raw JSON without markdown code fences.`;

    const response = await ai.models.generateContent({
      model: MODEL_CONFIG.textModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const cleanJson = rawText.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      subjectSummary: parsed.subjectSummary || title,
      physicalScene: parsed.physicalScene || concept || title,
      candidateNarrativeMode: parsed.candidateNarrativeMode || fallbackResult.candidateNarrativeMode,
      candidateSubjectTreatment: parsed.candidateSubjectTreatment || fallbackResult.candidateSubjectTreatment,
      candidateEnvironment: parsed.candidateEnvironment || fallbackResult.candidateEnvironment,
      candidateSceneConditions: Array.isArray(parsed.candidateSceneConditions) ? parsed.candidateSceneConditions : ['still'],
      historicalAnchors: parsed.historicalAnchors || fallbackResult.historicalAnchors,
      humanPresence: parsed.humanPresence || fallbackResult.humanPresence,
      uncertainty: Array.isArray(parsed.uncertainty) ? parsed.uncertainty : [],
    };
  } catch (err) {
    console.warn('Error en Semantic Router LLM, usando fallback heurístico:', err);
    return fallbackResult;
  }
}

/**
 * Analizador heurístico determinista para cuando la API no esté disponible
 */
function inferHeuristicRouting(title: string, concept: string): SemanticRoutingResult {
  const combined = `${title} ${concept}`.toLowerCase();

  let mode: NarrativeMode = 'editorial-relic';
  let treatment: SubjectTreatment = 'evidential-object';
  let env: Environment = 'institutional-archive';

  if (combined.includes('noche') || combined.includes('nocturn') || combined.includes('oscur')) {
    mode = 'night-expedition';
    env = 'nocturnal-site';
  } else if (combined.includes('excavaci') || combined.includes('arqueol') || combined.includes('campo') || combined.includes('ruina')) {
    mode = 'field-documentary';
    treatment = 'landscape-as-evidence';
    env = 'archaeological-field';
  } else if (combined.includes('guerra') || combined.includes('batalla') || combined.includes('imperio') || combined.includes('monumento')) {
    mode = 'historical-epic';
    treatment = 'environmental-subject';
    env = 'monumental-landscape';
  } else if (combined.includes('manuscrito') || combined.includes('carta') || combined.includes('libro') || combined.includes('documento')) {
    mode = 'archival-reconstruction';
    treatment = 'archival-tableau';
    env = 'institutional-archive';
  } else if (combined.includes('retrato') || combined.includes('rostro') || combined.includes('mente') || combined.includes('mirada')) {
    mode = 'psychological-closeup';
    treatment = 'editorial-portrait';
    env = 'lived-historic-interior';
  }

  return {
    subjectSummary: title,
    physicalScene: concept || title,
    candidateNarrativeMode: mode,
    candidateSubjectTreatment: treatment,
    candidateEnvironment: env,
    candidateSceneConditions: ['still'],
    historicalAnchors: {
      categories: ['period', 'material-culture'],
      details: concept || title,
    },
    humanPresence: treatment === 'editorial-portrait' ? 'single-observer' : 'none',
    uncertainty: ['Inferencia heurística determinista'],
  };
}
