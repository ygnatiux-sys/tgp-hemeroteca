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

En respuestas para el sidebar web, usá estas etiquetas cuando sea pertinente:
- <Analisis>contenido</Analisis> para bloques de análisis profundo
- <Codigo>bloque de código</Codigo> para ejemplos técnicos
- <Cita>texto</Cita> para citas o referencias clave`;

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
  model: 'gemini-3.8-flash' | 'gemini-2.5-pro' = 'gemini-3.8-flash',
  overrideSystemPrompt?: string
): Promise<string> {
  const history = getHistory(sessionId);
  const chat = genai.chats.create({
    model,
    config: { systemInstruction: overrideSystemPrompt || TGP_SYSTEM_PROMPT, temperature: 0.82, maxOutputTokens: 2048 },
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
  modelName: 'gemini-3.8-flash' | 'gemini-2.5-pro' = 'gemini-3.8-flash'
) {
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

REGLAS DE INTERACCIÓN (HUMAN-IN-THE-LOOP):
1. BOTS ESPECIALIZADOS (RESPETAR ESPECIALIDAD):
   - En canal 'social', el destino es SIEMPRE 'social'. Nunca preguntes si quiere Hemeroteca. Pregunta sólo la red (Facebook o TikTok), densidad o motor si no están claros.
   - En canal 'hemeroteca', el destino es SIEMPRE 'hemeroteca'. Nunca preguntes si quiere Redes. Pregunta sólo densidad o motor si no están claros.
   - En canal 'omni' (Omni Bot), si no especificó destino, consulta con elegancia: "> ¿Publicamos esto como ensayo en Hemeroteca (web) o lo adaptamos para Redes Sociales?"
2. TRÍADA DE DENSIDAD:
   - Breve (~800-1000t): Síntesis ágil, notas o copy.
   - Profundo Breve (~1500t): Ensayo conceptual TGP condensado (lectura 3-5 min).
   - Premium (+4500t): Tratado exhaustivo capitular con fuentes primarias y citas contextuales.
   Si no está clara la densidad, pregúntalo concisamente con '> '.
3. MODO LIBRE / DIRECTIVAS AD-HOC:
   - Si el usuario da instrucciones libres de estilo, citas o enfoque (ej: "citá a Nestorio", "enfoque arqueosemiótico"), captúralo en 'modoLibrePrompt'.
4. FORMATO OBLIGATORIO DE PREGUNTAS:
   - Toda pregunta para recopilar opciones DEBE comenzar estrictamente con '> ' (ej: "> ¿Preferís un ensayo condensado (~1500t) o un tratado Premium exhaustivo (+4500t)?").
5. Si los datos están claros o el usuario ya definió sus preferencias, invoca inmediatamente 'publicar'.`;

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
        description: 'Densidad y extensión del contenido: breve (~800-1000t), profundo_breve (~1500t ensayístico), o premium (+4500t tratado exhaustivo).',
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
    },
    required: ['tema', 'destino'],
  },
};

export type AgentResult =
  | { type: 'tool_call'; name: string; args: Record<string, any> }
  | { type: 'micro_prompt'; text: string }
  | { type: 'text'; text: string };

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
  if (rawText.startsWith('>')) {
    return { type: 'micro_prompt', text: rawText };
  }

  return { type: 'text', text: rawText };
}

