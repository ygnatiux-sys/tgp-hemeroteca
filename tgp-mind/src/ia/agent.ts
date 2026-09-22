// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Agent Orquestador Central (Bucle HITL Correcto)
//
// Flujo de ejecución REAL (no se interrumpe ningún request de API):
//
//  1. [user]     "Quiero un ensayo sobre Roma"
//  2. [model]    "¿Qué longitud preferís? 1. breve_1500  2. pro_4500"
//  3. [user]     "2"
//  4. [model]    🎬 Ficha TGP — Ensayo... (texto plano guiado por System Prompt)
//  5. [user]     "ok"
//  6. [model]    → functionCall: { name: 'generar_ensayo', args: {...} }
//  7. [Worker]   Ejecuta la función, guarda en D1 (resguardo_documental)
//  8. [function] → functionResponse: { name: 'generar_ensayo', response: {...} }
//  9. [model]    "Ensayo publicado. 🔗 https://..."
//
// La autorización humana (el "ok") ocurre en el paso 5 como turno de texto.
// El Worker recibe el Tool Call en el paso 6 y lo ejecuta sin pausas.
// ─────────────────────────────────────────────────────────────────────────────

import { genai } from './gemini.js';
import {
  getConversationHistory,
  appendUserText,
  appendModelText,
  appendFunctionCall,
  appendFunctionResponse,
  type GeminiTurn,
} from '../storage/d1.js';
import { TOOL_GENERAR_ENSAYO, ejecutarGenerarEnsayo } from './tools/tool-generar-ensayo.js';
import { TOOL_PUBLISH_SOCIAL, ejecutarPublishSocial } from './tools/tool-publish-social.js';
import { TOOL_CINEMATIC, ejecutarCinematicPipeline } from './tools/tool-cinematic.js';
import { TOOL_NEO4J, ejecutarNeo4jExtraction } from './tools/tool-neo4j.js';

// ── Tool: request_human_action (Fase 3 — Esqueleto listo) ────────────────────
// Usada cuando el bot necesita que el usuario realice una acción externa
// al chat (ej: "Autorizar Google Drive"). No ejecuta acciones de publicación:
// solo envía instrucciones + enlace de acción. No necesita confirmación previa.
export const TOOL_REQUEST_HUMAN_ACTION = {
  name: 'request_human_action',
  description: 'Solicita al usuario realizar una acción específica fuera del chat, como autorizar un servicio externo. Proporciona un enlace y una instrucción clara.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      action_type: {
        type: 'STRING' as const,
        description: 'Tipo de acción requerida (ej: "authorize_google_drive", "confirm_email").',
      },
      message: {
        type: 'STRING' as const,
        description: 'Instrucción legible para el usuario.',
      },
      url: {
        type: 'STRING' as const,
        description: 'URL a la que el usuario debe navegar para completar la acción.',
      },
    },
    required: ['action_type', 'message'],
  },
};

// ── System Prompts por identidad de bot ──────────────────────────────────────

const PROTOCOLO_FICHA_VISUAL = `
PROTOCOLO DE CONFIRMACIÓN VISUAL (Regla Primordial e Inquebrantable):

Tu ciclo de trabajo para cualquier publicación o generación es SIEMPRE:
  1. Recolecta los parámetros conversando en texto plano con el usuario.
  2. Cuando tengas TODOS los parámetros, imprime la Ficha Visual en texto plano.
  3. Espera que el usuario responda "ok", "sí" o "aprobado".
  4. Solo tras esa confirmación, emite el Tool Call correspondiente.

NUNCA emitas un Tool Call de publicación sin haber impreso primero la Ficha Visual
y recibido la confirmación explícita del usuario. Este protocolo nunca tiene excepciones.

Formato de Ficha Visual (texto plano Markdown):
---
🎬 **Ficha TGP — [Tipo de Publicación]**
📌 Tema: [tema]
📏 Longitud: [longitud]
⚙️  Motor: [motor]
📸 Fotos: [origen_fotos]
🌐 Destino: [destino / red]
🖼️  Imagen: [url_imagen o "pendiente"]
---
¿Confirmamos? Responde **ok** para ejecutar.
`.trim();

const REGLA_CONFIRMACION_PUBLICACION = `
REGLA DE CONFIRMACIÓN POST-PUBLICACIÓN (Obligatoria e Invariable):

Cuando cualquier herramienta de publicación (generar_ensayo, publish_social, generate_cinematic_pipeline)
devuelva un resultado exitoso, tu respuesta FINAL al usuario DEBE tener EXACTAMENTE este formato:

✅ Publicado con éxito.

[Copia aquí el texto del resultado de la herramienta sin parafrasear ni resumir]

NUNCA sustituyas los URLs reales por frases como "el ensayo ha quedado registrado" o similar.
Si el resultado de la herramienta contiene URLs (🌐 Ver en la Web, 📦 Commit GitHub), cópialos literalmente.
`.trim();

const BASE_SYSTEM_PROMPT = `Eres el motor cognitivo de TGP Project y el socio analítico de Xavier Benítez.
Tu función es reinterpretar la historia y la complejidad para comprender la condición humana.
Tono: Dark Academia accesible. Preciso, sobrio, agudo, con calidez humanista.
Modo por defecto: Directo, sin introducciones ni redundancias.
Nunca declares tu rol ni uses fórmulas autorreferenciales.
Tienes estrictamente prohibido imprimir etiquetas estructurales, pseudocódigo, XML o HTML en tu salida.

${PROTOCOLO_FICHA_VISUAL}

${REGLA_CONFIRMACION_PUBLICACION}`;

const SYSTEM_PROMPTS: Record<BotIdentity, string> = {
  redes: `${BASE_SYSTEM_PROMPT}
Especialidad: Social + Dark Academia. El destino es SIEMPRE social. Nunca preguntes sobre Hemeroteca.`,

  assistant: `${BASE_SYSTEM_PROMPT}
Especialidad: Investigación, análisis de grafos y redacción de ensayos históricos.`,

  omni: `${BASE_SYSTEM_PROMPT}
Especialidad: Generalista TGP. Puedes publicar en todos los destinos disponibles.`,

  liminal: `${BASE_SYSTEM_PROMPT}
Especialidad: Conversacional filosófico y generación de contenido cinemático.`,
};

// ── Asignación dinámica de Tools por identidad ───────────────────────────────
const TOOLS_BY_BOT: Record<BotIdentity, object[]> = {
  redes:     [TOOL_PUBLISH_SOCIAL, TOOL_REQUEST_HUMAN_ACTION],
  assistant: [TOOL_GENERAR_ENSAYO, TOOL_NEO4J, TOOL_REQUEST_HUMAN_ACTION],
  omni:      [TOOL_GENERAR_ENSAYO, TOOL_PUBLISH_SOCIAL, TOOL_CINEMATIC, TOOL_NEO4J, TOOL_REQUEST_HUMAN_ACTION],
  liminal:   [TOOL_GENERAR_ENSAYO, TOOL_CINEMATIC, TOOL_REQUEST_HUMAN_ACTION],
};

export type BotIdentity = 'redes' | 'assistant' | 'omni' | 'liminal';

// ── Router de ejecución de herramientas ──────────────────────────────────────

async function ejecutarTool(
  name: string,
  args: Record<string, any>,
  chatId: number,
): Promise<Record<string, any>> {
  try {
    let result: string;

    if (name === 'generar_ensayo') {
      // Pasamos todos los args sin cast restrictivo para aprovechar la normalización
      // tolerante de enums en tool-generar-ensayo.ts (solowiki -> solo_wiki, etc.)
      result = await ejecutarGenerarEnsayo({
        tema: String(args.tema || ''),
        longitud: args.longitud,
        motor: args.motor,
        origen_fotos: args.origen_fotos,
        chatId,
      });
    } else if (name === 'publish_social') {
      result = await ejecutarPublishSocial({
        tema: String(args.tema || ''),
        red: args.red as 'facebook' | 'tiktok',
        motor: args.motor as 'flash' | 'pro',
        url_imagen: String(args.url_imagen || ''),
        chatId,
      });
    } else if (name === 'generate_cinematic_pipeline') {
      result = await ejecutarCinematicPipeline({
        tema: String(args.tema || ''),
        estilo: String(args.estilo || ''),
        chatId,
      });
    } else if (name === 'extract_neo4j_entities') {
      result = await ejecutarNeo4jExtraction({
        texto: String(args.texto || ''),
        chatId,
      });
    } else if (name === 'request_human_action') {
      result = `Acción requerida del usuario: ${args.action_type}. Mensaje: ${args.message}`;
    } else {
      result = `Herramienta "${name}" no reconocida.`;
    }

    // Devolver resultado como objeto estructurado para que Gemini lo incluya literalmente
    console.log(`[Agent] Tool "${name}" completada. Resultado (primeros 200 chars): ${result.slice(0, 200)}`);
    return { result };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[Agent] CRASH en tool "${name}": ${errMsg}`);
    console.error(`[Agent] Args recibidos:`, JSON.stringify(args));
    return { error: errMsg };
  }
}

// ── Bucle de Ejecución Principal ─────────────────────────────────────────────
//
// CONTRATO DE SINCRONIZACIÓN:
//   1. appendUserText   — guardar lo que envió el usuario
//   2. getConversationHistory — cargar historial completo (texto + tool calls)
//   3. generateContent  — llamar a Gemini con el historial
//   4a. Si es texto:    appendModelText → devolver texto
//   4b. Si es Tool Call:
//       appendFunctionCall  — registrar que el modelo pidió ejecutar
//       ejecutarTool        — ejecutar la función localmente
//       appendFunctionResponse — registrar el resultado
//       (llamada adicional a Gemini para que genere su respuesta final en texto)
//
// La autorización humana ya ocurrió en los turnos de texto previos.
// El Worker ejecuta el Tool Call directamente sin pausas adicionales.

export async function processTelegramMessage(
  chatId: number,
  userText: string,
  botIdentity: BotIdentity,
  imageContextPrefix?: string,
): Promise<string> {
  // ── Paso 1: Guardar turno del usuario en D1 ────────────────────────────────
  // AISLAMIENTO: Se usa botIdentity como botId para que cada bot tenga su
  // propia memoria. La clave en D1 es "{chatId}:{botIdentity}" (ej: "123:omni").
  // Si userText está vacío, el webhook ya guardó el turno en D1 (foto+caption
  // fusionados). No guardamos de nuevo para evitar un turno duplicado.
  const textToSave = imageContextPrefix
    ? `${imageContextPrefix}\n\nUsuario: ${userText}`.trim()
    : userText.trim();

  if (textToSave) {
    console.log(`[Agent:${botIdentity}] Guardando turno usuario en D1 (${textToSave.length} chars) key="${chatId}:${botIdentity}"`);
    await appendUserText(chatId, textToSave, botIdentity);
  } else {
    // turno ya existe en D1 (guardado por webhook al interceptar la foto)
    console.log(`[Agent:${botIdentity}] Turno de usuario ya guardado en D1 por webhook. Saltando appendUserText.`);
  }

  // ── Paso 2: Cargar historial nativo de Gemini desde D1 ────────────────────────────────
  // Solo carga el historial de ESTE bot (botIdentity). Aislamiento garantizado.
  const history: GeminiTurn[] = await getConversationHistory(chatId, 12, botIdentity);

  // history ya incluye el turno del usuario recién guardado porque
  // appendUserText es síncrono antes de esta llamada.

  // ── Paso 3: Llamar a Gemini ────────────────────────────────────────────────
  const toolsForBot = TOOLS_BY_BOT[botIdentity];
  const response = await genai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: history as any,
    config: {
      systemInstruction: SYSTEM_PROMPTS[botIdentity],
      temperature: 0.2,
      maxOutputTokens: 16384,
      tools: toolsForBot.length > 0 ? [{ functionDeclarations: toolsForBot }] : undefined,
    },
  });

  // ── Paso 4a: Respuesta de texto ────────────────────────────────────────────────────
  const functionCalls = response.functionCalls;
  if (!functionCalls || functionCalls.length === 0) {
    const text = (response.text || '').trim();
    await appendModelText(chatId, text, botIdentity);
    return text;
  }

  // ── Paso 4b: Tool Call — Ejecutar (la autorización ya ocurrió vía "ok") ───
  const call = functionCalls[0];
  const toolName = call.name || '';
  const toolArgs = (call.args as Record<string, any>) || {};

  console.log(`[Agent:${botIdentity}] Tool Call recibido: ${toolName}`, toolArgs);

  // Guardar el functionCall emitido por el modelo (con aislamiento de bot)
  await appendFunctionCall(chatId, toolName, toolArgs, botIdentity);

  // Ejecutar la función localmente
  const toolResult = await ejecutarTool(toolName, toolArgs, chatId);

  // Guardar el functionResponse (con aislamiento de bot)
  await appendFunctionResponse(chatId, toolName, toolResult, botIdentity);

  // Llamada adicional a Gemini para la respuesta textual final (con historial aislado)
  const historyConResult: GeminiTurn[] = await getConversationHistory(chatId, 12, botIdentity);
  const finalResponse = await genai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: historyConResult as any,
    config: {
      systemInstruction: SYSTEM_PROMPTS[botIdentity],
      temperature: 0.2,
      maxOutputTokens: 4096,
      // Sin tools en la llamada de cierre: solo queremos texto de confirmación.
    },
  });

  const finalText = (finalResponse.text || `✅ ${toolName} ejecutado correctamente.`).trim();
  await appendModelText(chatId, finalText, botIdentity);
  return finalText;
}
