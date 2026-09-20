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
  model: 'gemini-3.8-flash' | 'gemini-3.1-pro-preview' | 'gemini-2.5-pro' = 'gemini-3.8-flash',
  overrideSystemPrompt?: string,
  maxOutputTokens: number = 8192
): Promise<string> {
  const modelToUse = (model === 'gemini-2.5-pro' ? 'gemini-3.1-pro-preview' : model) as any;
  const history = getHistory(sessionId);
  const chat = genai.chats.create({
    model: modelToUse,
    config: { systemInstruction: overrideSystemPrompt || TGP_SYSTEM_PROMPT, temperature: 0.82, maxOutputTokens },
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

REGLAS DE INTERACCIÓN (HUMAN-IN-THE-LOOP ESTRICTO):
1. BOTS ESPECIALIZADOS (RESPETAR ESPECIALIDAD):
   - En canal 'social', el destino es SIEMPRE 'social'. Nunca preguntes si quiere Hemeroteca. Pregunta sólo la red (Facebook o TikTok).
   - En canal 'hemeroteca', el destino es SIEMPRE 'hemeroteca'. NUNCA preguntes por Redes ni por Alternative.
   - En canal 'omni' (Omni Bot), si no especificó destino, consulta primero: "> ¿Publicamos esto como ensayo en Hemeroteca (web) o en Redes Sociales?"
2. SECUENCIA DIALÉCTICA OBLIGATORIA (NO ASUMAS PARÁMETROS):
   - Paso 1 (Tema recibido): Pregunta siempre la Densidad del ensayo o publicación:
     "> ¿Qué densidad y formato deseas para este ensayo?"
     Opciones: 1. Breve (~800t) | 2. Profundo (~1500t) | 3. Tratado Premium (+4500t). Recuerda que puede añadir directivas en Modo Libre.
   - Paso 2 (Densidad elegida): NO asumas el motor ni publiques de inmediato. Pregunta sobre el Motor y Fuentes Visuales:
     "> Densidad configurada: [Densidad]. ¿Qué motor de inteligencia y fuentes visuales aplicamos?"
     Opciones: 1. Flash + Wikimedia | 2. Pro (Razonamiento profundo) + Wikimedia | 3. Pro (Solo texto) | O directivas en Modo Libre.
   - Paso 3 (Confirmación / Proceder): Si el usuario elige motor/imágenes, o escribe "proceder", "publicar", "adelante", "ok", o envía directivas adicionales en Modo Libre, ENTONCES invoca la función 'publicar'.
3. MODO LIBRE / DIRECTIVAS AD-HOC:
   - Si el usuario incluye instrucciones libres de estilo, citas, fuentes o enfoque (ej: "citá a Nestorio", "enfoque arqueosemiótico", "tono analítico"), captúralo SIEMPRE en 'modoLibrePrompt' y presérvalo en todo el flujo.
4. FORMATO OBLIGATORIO DE PREGUNTAS:
   - Toda pregunta dialéctica DEBE comenzar con '> ' para renderizar los teclados dinámicos en Telegram.
5. RESPUESTAS NUMÉRICAS Y DIRECTAS:
   - Si el usuario responde con números (ej: "1", "2", "3"), interpreta la opción correspondiente al paso actual, guarda la preferencia y avanza al siguiente paso dialéctico. NUNCA reinicies el tema ni asumas el fin del diálogo hasta completar las opciones o recibir confirmación.`;

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
  if (rawText.includes('>') || rawText.includes('?') || rawText.includes('¿')) {
    return { type: 'micro_prompt', text: rawText };
  }

  return { type: 'text', text: rawText };
}

