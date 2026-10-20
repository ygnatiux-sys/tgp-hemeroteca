// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Destilador Editorial Antiliteralidad (Editorial Sanitizer)
// Doctrina y Estilo: Xavier Benítez (The Great Puzzle Project)
// Motor: @google/genai con gemini-2.5-flash y Structured Outputs
// ─────────────────────────────────────────────────────────────────────────────

import { genai } from './gemini.js';
import { generarSlug } from '../servicios/publicacion.js';

export type TargetSilo = 'alternative' | 'hemeroteca' | 'magazine';

export interface EditorialBriefSanitized {
  cleanTitle: string;
  subtitle: string;
  targetSilo: TargetSilo;
  cleanTopicPrompt: string;
  slug: string;
  category: string;
}

const SYSTEM_INSTRUCTION_SANITIZER = `Eres el Editor Jefe de The Great Puzzle Project (TGP), guardián del canon intelectual y estilístico de Xavier Benítez.
Tu tarea es sanitizar y desglosar instrucciones crudas y coloquiales de chat enviadas por el director para convertirlas en fichas editoriales rigurosas.

REGLAS ESTRICTAS DE FILTRADO Y ANTILITERALIDAD:
1. PURGA COLOQUIAL Y DE ERRORES:
   - Elimina por completo muletillas, órdenes de chat y errores de tipeo (ej: "me pods hacer", "un brief sobre", "pra educación", "en mi web Alternative", "dame luego la url", "hola che", "q opinas").
   - NUNCA uses la frase del usuario como título.

2. DOCTRINA XAVIER BENÍTEZ (VETOS ABSOLUTOS DE ESTILO):
   - PROHIBIDO EL CLICHÉ ESOTÉRICO: Jamás uses "sabiduría ancestral", "un misterio que desafía a la ciencia", "desde tiempos inmemoriales", "secretos ocultos" ni "enigmas del pasado".
   - TONO: Rioplatense culto, bisturí conceptual, arqueología de la conciencia y anomalía material (Dark Academia rigurosa).
   - El título debe evocar la fricción material, técnica o política del caso (ej: "Uxmal y la Geometría Puuc: El Poder Hidráulico en las Tierras Bajas" en lugar de "Los mayas de Uxmal").

3. DETECCIÓN DE SILO:
   - "alternative" si menciona "alternative", "historia alternativa", "web alternative", o si aborda cronologías disidentes / arqueología alternativa.
   - "hemeroteca" si menciona "hemeroteca", "archivo", "ensayo general" o es un análisis historiográfico estándar.
   - "magazine" si menciona "magazine", "revista", "formato breve".
   - Por defecto: "alternative" si el contexto sugiere publicaciones de exploración abierta, o "hemeroteca" si es formal.`.trim();

/**
 * Sanitiza una instrucción cruda de chat y devuelve una ficha editorial estructurada y limpia.
 */
export async function sanitizeEditorialPrompt(rawUserPrompt: string): Promise<EditorialBriefSanitized> {
  const promptLimpio = String(rawUserPrompt || '').trim();

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Sanitiza la siguiente instrucción cruda de chat del director Xavier Benítez y devuelve los campos editoriales canónicos:\n"${promptLimpio}"`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_SANITIZER,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT' as any,
          properties: {
            cleanTitle: {
              type: 'STRING' as any,
              description: 'Título ensayístico riguroso bajo doctrina TGP (cero clichés, cero muletillas).',
            },
            subtitle: {
              type: 'STRING' as any,
              description: 'Bajada conceptual densa de 1 oración.',
            },
            targetSilo: {
              type: 'STRING' as any,
              enum: ['alternative', 'hemeroteca', 'magazine'],
              description: 'Silo web destino de la publicación.',
            },
            cleanTopicPrompt: {
              type: 'STRING' as any,
              description: 'Instrucción temática depurada para el motor de redacción e imagen sin muletillas de chat.',
            },
            category: {
              type: 'STRING' as any,
              description: 'Categoría conceptual (ej. Arqueología Puuc, Cronologías Disidentes, Epigrafía, Arquitectura Lítica).',
            },
          },
          required: ['cleanTitle', 'subtitle', 'targetSilo', 'cleanTopicPrompt', 'category'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const cleanTitle = (parsed.cleanTitle || 'Ensayo Histórico TGP').trim();
    const slug = generarSlug(cleanTitle);

    return {
      cleanTitle,
      subtitle: (parsed.subtitle || '').trim(),
      targetSilo: (parsed.targetSilo as TargetSilo) || 'alternative',
      cleanTopicPrompt: (parsed.cleanTopicPrompt || cleanTitle).trim(),
      slug: slug || `post-${Date.now()}`,
      category: (parsed.category || 'Arqueología & Tesis').trim(),
    };
  } catch (err: any) {
    console.warn('[Editorial Sanitizer] Fallo en inferencia estructurada, aplicando heurística de respaldo:', err?.message);

    // Heurística de respaldo determinista
    const isAlternative = /alternative|web alternative/i.test(promptLimpio);
    const targetSilo: TargetSilo = isAlternative ? 'alternative' : 'hemeroteca';

    // Limpieza de muletillas básica
    let sanitizedText = promptLimpio
      .replace(/^@[\w\s.-]+\s+/i, '')
      .replace(/me\s+pods\s+hacer|me\s+puedes\s+hacer|hacer\s+un\s+brief|sobre\s+los|pra\s+educaci[oó]n|en\s+m[ií]\s+web\s+alternative|dame\s+luego\s+la\s+url\s+final/gi, '')
      .replace(/[.,;:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!sanitizedText || sanitizedText.length < 5) sanitizedText = 'Exploración Documental Arqueológica';

    const cleanTitle = sanitizedText
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    return {
      cleanTitle,
      subtitle: 'Análisis estratigráfico y arqueología de la memoria.',
      targetSilo,
      cleanTopicPrompt: sanitizedText,
      slug: generarSlug(cleanTitle) || `post-${Date.now()}`,
      category: 'Historia Alternativa & Tesis',
    };
  }
}
