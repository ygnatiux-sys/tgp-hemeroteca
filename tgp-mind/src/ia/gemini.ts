// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo Gemini AI
// Extraído de index.ts para modularización progresiva.
// Contiene: clientes GoogleGenAI/GoogleGenerativeAI, historial de conversación,
//           callGemini(), crearModeloEnsayo() y TGP_SYSTEM_PROMPT.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';

// ── Clave API (leída desde el entorno, saneada) ───────────────────────────────
export const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();

// ── System Prompt TGP ─────────────────────────────────────────────────────────
export const TGP_SYSTEM_PROMPT = `Eres el motor cognitivo de TGP Project y el socio analítico de Xavier Benítez. Tu función es reinterpretar la historia y la complejidad para comprender la condición humana, con un enfoque filosófico, histórico y crítico.

REGLAS DE INTERACCIÓN:

Identidad implícita: Nunca declares tu rol ni uses fórmulas autorreferenciales (ej: 'Como IA...').

Tono: Dark Academia accesible. Preciso, sobrio, agudo, con calidez humanista. Cero estéticas superficiales, 'hippies' o mecánicas.

Rigor dialéctico: Cuestiona premisas con respeto y curiosidad para elevar el nivel del análisis.

Modo por defecto: Directo, sin introducciones ni redundancias. Ve al núcleo conceptual inmediatamente.

Estilo de escritura: Ensayo argentino contemporáneo. Combina claridad, densidad conceptual y ritmo narrativo.

Cuando se te solicite explícitamente el 'Modo TGP', estructura tu respuesta así:
1) Gancho visual
2) Contexto claro
3) Concepto técnico clave
4) Cierre humano y universal

Si no se solicita el Modo TGP, responde en tu tono directo habitual.

CIERRE LÓGICO Y LIMPIEZA:
1. Termina siempre con un cierre concluyente. Nunca dejes oraciones sin terminar o párrafos inconclusos.
2. Tienes estrictamente prohibido imprimir etiquetas estructurales, pseudocódigo, XML o HTML (como <Analisis>, <Pensamiento>, etc.) en tu salida. Entrega exclusivamente la prosa final.`;

// ── Gemini Client (conversacional) ───────────────────────────────────────────
export const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ── Historial de conversación en memoria ─────────────────────────────────────
export type HistoryEntry = { role: 'user' | 'model'; parts: Array<{ text: string }> };
const conversationHistory = new Map<string, HistoryEntry[]>();
export const MAX_TURNS = 20;

export function getHistory(sessionId: string): HistoryEntry[] {
  if (!conversationHistory.has(sessionId)) conversationHistory.set(sessionId, []);
  return conversationHistory.get(sessionId)!;
}

export function pushToHistory(sessionId: string, role: 'user' | 'model', text: string) {
  const history = getHistory(sessionId);
  history.push({ role, parts: [{ text }] });
  if (history.length > MAX_TURNS * 2) history.splice(0, 2);
}

// ── Llamada a Gemini con contexto ─────────────────────────────────────────────
export async function callGemini(
  sessionId: string,
  userMessage: string,
  model: 'gemini-3.8-flash' | 'gemini-3.1-pro-preview' | 'gemini-2.5-pro' = 'gemini-3.8-flash',
  overrideSystemPrompt?: string,
  // REGLA: Nunca usar maxOutputTokens < 16384 para controlar extensión.
  // El control de longitud se hace inyectando directivas en el system prompt.
  // Valores bajos provocan cortes abruptos a mitad de oración.
  maxOutputTokens: number = 16384
): Promise<string> {
  const modelToUse = (model === 'gemini-2.5-pro' ? 'gemini-3.1-pro-preview' : model) as any;
  const history = getHistory(sessionId);
  const chat = genai.chats.create({
    model: modelToUse,
    config: { systemInstruction: overrideSystemPrompt || TGP_SYSTEM_PROMPT, temperature: 0.82, maxOutputTokens: maxOutputTokens },
    history: history.length > 0 ? history : undefined,
  });
  pushToHistory(sessionId, 'user', userMessage);
  const response = await chat.sendMessage({ message: userMessage });
  const responseText = response.text ?? '';
  pushToHistory(sessionId, 'model', responseText);
  return responseText;
}

// ── Fábrica de Modelos con Structured Outputs (dinámica por secciones) ───────
export const googleAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export function crearModeloEnsayo(
  cantidadImg: number,
  modelName: string = 'gemini-3.8-flash'
) {
  const modelToUse = modelName === 'gemini-2.5-pro' ? 'gemini-3.1-pro-preview' : modelName;
  const esquema: ResponseSchema = {
    description: `Ensayo cinemático compuesto por exactamente ${cantidadImg} secciones.`,
    type: SchemaType.OBJECT,
    properties: {
      titulo: { type: SchemaType.STRING, description: 'Título del ensayo cinemático', nullable: false },
      secciones: {
        type: SchemaType.ARRAY,
        description: `Arreglo con exactamente ${cantidadImg} secciones del ensayo cinemático`,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            busqueda_wikimedia: {
              type: SchemaType.STRING,
              description: 'Término de búsqueda preciso en inglés o español para Wikimedia Commons',
              nullable: false,
            },
            parrafo: {
              type: SchemaType.STRING,
              description: 'Párrafo analítico y narrativo de la sección del ensayo',
              nullable: false,
            },
          },
          required: ['busqueda_wikimedia', 'parrafo'],
        },
      },
    },
    required: ['titulo', 'secciones'],
  };
  return googleAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json', responseSchema: esquema },
  });
}

// ── Agentic HITL & Function Calling ──────────────────────────────────────────
export const AGENT_SYSTEM_PROMPT = `Eres el asistente agéntico de publicación e investigación para el ecosistema TGP Mind.
Tu objetivo es dialogar con Xavier Benítez de forma analítica, sobria y dialéctica (Dark Academia accesible), transformando sus intenciones en publicaciones concretas mediante la función 'publicar'.

REGLA PRIMORDIAL — INFERENCIA DIRECTA (Reducción de Fricción):
Si en un único mensaje el usuario provee TODOS los parámetros necesarios (Destino, Densidad, Motor y Tema), debes invocar INMEDIATAMENTE la función 'publicar' sin hacer ninguna pregunta.
Ejemplos de mensajes completos que activan publicación directa:
  - "Flash, Hemeroteca, 1500t: El mito de Ícaro"
  - "Pro + Wiki, ensayo profundo sobre fascinum romano para Hemeroteca"
  - "Social TikTok, breve, flash: escarabajo egipcio"
Si faltan parámetros, usa el diálogo HITL progresivo como fallback (ver reglas abajo).

REGLAS DE INTERACCIÓN (HITL PROGRESIVO — solo cuando faltan parámetros):
1. BOTS ESPECIALIZADOS (RESPETAR ESPECIALIDAD):
   - En canal 'social', el destino es SIEMPRE 'social'. Nunca preguntes si quiere Hemeroteca. Pregunta sólo la red (Facebook o TikTok).
   - En canal 'hemeroteca', el destino es SIEMPRE 'hemeroteca'. NUNCA preguntes por Redes ni por Alternative.
   - En canal 'omni' (Omni Bot), si no especificó destino, consulta primero: "> ¿Publicamos esto como ensayo en Hemeroteca (web) o en Redes Sociales?"
2. SECUENCIA DIALÉCTICA (FALLBACK si faltan parámetros):
   - Si falta Densidad: Pregunta "> ¿Qué densidad? 1. Breve (~800t) | 2. Profundo (~1500t) | 3. Tratado Premium (+4500t)".
   - Si falta Motor: Pregunta "> ¿Qué motor? 1. Flash + Wiki | 2. Pro + Wiki | 3. Pro (solo texto)".
   - Una vez completos todos los parámetros, invoca 'publicar' directamente.
3. MODO LIBRE / DIRECTIVAS AD-HOC:
   - Si el usuario incluye instrucciones libres de estilo, citas, fuentes o enfoque, captúralo en 'modoLibrePrompt' y presérvalo en todo el flujo.
4. FORMATO OBLIGATORIO DE PREGUNTAS:
   - Toda pregunta dialéctica DEBE comenzar con '> ' para renderizar los teclados dinámicos en Telegram.
5. RESPUESTAS NUMÉRICAS:
   - Si el usuario responde con números ("1", "2", "3"), interpreta la opción del paso actual y avanza.

CIERRE LÓGICO Y LIMPIEZA:
1. Termina siempre con un cierre concluyente. Nunca dejes oraciones sin terminar o párrafos inconclusos.
2. Tienes estrictamente prohibido imprimir etiquetas estructurales, pseudocódigo, XML o HTML (como <Analisis>, <Pensamiento>, etc.) en tu salida. Entrega exclusivamente la prosa final.`;

export const PUBLICAR_TOOL_DECLARATION = {
  name: 'publicar',
  description: 'Publica o programa un contenido en la Hemeroteca Keystatic, Alternative o Redes Sociales (Facebook/TikTok via Zernio).',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      tema: {
        type: 'STRING' as const,
        description: 'Tema central, título o contenido del ensayo o post.',
      },
      destino: {
        type: 'STRING' as const,
        description: 'Destino de publicación: hemeroteca (ensayo dual), alternative, o social (Facebook/TikTok)',
        enum: ['hemeroteca', 'alternative', 'social'],
      },
      red: {
        type: 'STRING' as const,
        description: 'Red social específica si el destino es social.',
        enum: ['facebook', 'tiktok'],
      },
      modelo: {
        type: 'STRING' as const,
        description: 'Modelo de redacción: flash (rápido/ágil) o pro (ensayo denso/profundo).',
        enum: ['flash', 'pro'],
      },
      densidad: {
        type: 'STRING' as const,
        description: 'Densidad y extensión del contenido: breve (~800-1000t), profundo_breve (~1500t ensayístico), o premium (+4500t tratado exhaustivo con fuentes primarias).',
        enum: ['breve', 'profundo_breve', 'premium'],
      },
      modoLibrePrompt: {
        type: 'STRING' as const,
        description: 'Instrucción o directiva libre personalizada dada por el usuario (Modo Libre / Custom Override).',
      },
      fuenteImg: {
        type: 'STRING' as const,
        description: 'Fuente de imagen: wiki (Wikimedia), telegram (foto enviada), o none (sin imagen).',
        enum: ['wiki', 'telegram', 'none'],
      },
      cantidadSecciones: {
        type: 'INTEGER' as const,
        description: 'Cantidad de secciones para ensayos en Hemeroteca (1, 3 o 5).',
      },
      groundingMode: {
        type: 'BOOLEAN' as const,
        description: 'Activa el modo Grounded para Tier 3 Premium: obliga a incluir fuentes históricas primarias reales y citas precisas, evitando alucinaciones en tratados eruditos.',
      },
    },
    required: ['tema', 'destino'],
  },
};

export type AgentResult =
  | { type: 'tool_call'; name: string; args: Record<string, any> }
  | { type: 'micro_prompt'; text: string }
  | { type: 'text'; text: string };

/**
 * Construye la directiva estructural de extensión que se inyecta en el system prompt.
 * Nunca uses maxOutputTokens < 8192 para controlar longitud: causa cortes abruptos.
 * El control real de extensión se hace vía instrucciones semánticas en el prompt.
 */
export function buildDensityInstruction(densidad?: string, groundingMode?: boolean): string {
  let directive = '';

  switch (densidad) {
    case 'breve':
      directive = 'RESTRICCIÓN DE EXTENSIÓN (Tier 1 — Breve): Limita tu respuesta a exactamente 3 párrafos y un máximo de 500 palabras. Síntesis ágil, sin desarrollo capitular. Cada párrafo debe ser autónomo y denso conceptualmente.';
      break;

    case 'profundo_breve':
      directive = 'RESTRICCIÓN DE EXTENSIÓN (Tier 2 — Profundo): Desarrolla exactamente 4 secciones con subtítulo (## Markdown). Mínimo 1200 palabras, máximo 1600 palabras. Incluye un párrafo de apertura gancho, desarrollo conceptual, derivación arqueosemiótica y cierre universal.';
      break;

    case 'premium':
      // Tier 3: extensión libre + grounding obligatorio
      directive = 'RESTRICCIÓN DE EXTENSIÓN (Tier 3 — Tratado Premium): Desarrolla un tratado exhaustivo de mínimo 4500 palabras estructurado en 7 secciones capitulares con subtítulos ## Markdown. Sin límite superior de extensión.';
      if (groundingMode) {
        directive += '\n\nMODO GROUNDED ACTIVADO (Anti-Alucinación Erudita): Es OBLIGATORIO incluir en cada sección al menos una fuente histórica primaria real y verificable (autor, obra, año o período). Usa exclusivamente fuentes primarias: inscripciones epigráficas, textos clásicos (Heródoto, Plinio, Tácito, etc.), hallazgos arqueológicos con referencias precisas. Jamás inventes datos, fechas o autores. Si no tienes certeza sobre un dato, explicítalo con "(fuente no verificada)" o apoya en fuentes secundarias académicas sólidas.';
      }
      break;

    default:
      directive = '';
  }

  return directive;
}

export async function callGeminiAgent(
  userPrompt: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = [],
  contextHint?: string
): Promise<AgentResult> {
  const contents: any[] = [
    ...history.map((h) => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })),
    {
      role: 'user',
      parts: [{ text: contextHint ? `[Contexto previo: ${contextHint}]\n${userPrompt}` : userPrompt }],
    },
  ];

  const response = await genai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents,
    config: {
      systemInstruction: AGENT_SYSTEM_PROMPT,
      temperature: 0.2,
      maxOutputTokens: 16384, // Elevado a margen seguro para evitar corte duro
      tools: [
        {
          functionDeclarations: [PUBLICAR_TOOL_DECLARATION as any],
        },
      ],
    },
  });

  const functionCalls = response.functionCalls;
  if (functionCalls && functionCalls.length > 0) {
    const call = functionCalls[0];
    return {
      type: 'tool_call',
      name: call.name || 'publicar',
      args: (call.args as Record<string, any>) || {},
    };
  }

  const rawText = (response.text || '').trim();
  if (rawText.includes('>') || rawText.includes('?') || rawText.includes('¿')) {
    return { type: 'micro_prompt', text: rawText };
  }

  return { type: 'text', text: rawText };
}

