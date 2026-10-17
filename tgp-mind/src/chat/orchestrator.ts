// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Orquestador Semántico Autónomo (Cero Memoria / Stateless)
// Procesa lenguaje natural de Google Chat y Dialogflow CX, encadenando herramientas.
// ─────────────────────────────────────────────────────────────────────────────

import { genai } from '../ia/gemini.js';
import { getChatToolDeclarations, executeChatTool } from './tool-registry.js';

const SYSTEM_INSTRUCTION_ORQUESTADOR = `Eres el Asistente Orquestador Autónomo de TGP Mind, integrado con Google Chat y Dialogflow CX para asistir al director Xavier Benítez.
Tu misión es interpretar instrucciones en lenguaje natural y ejecutar automáticamente las herramientas necesarias en el orden óptimo, sin que el usuario deba recordar nombres de comandos o scripts.

PRINCIPIOS OPERATIVOS:
1. ENCADENAMIENTO AUTÓNOMO:
   - Si la solicitud involucra procesar imágenes y publicar un post, primero ejecuta "convert_and_upload_r2" para obtener las URLs definitivas en R2 y luego suministra esas URLs a "publish_keystatic_post".
   - Si la solicitud pide revisar si ya existe un post, ejecuta primero "check_keystatic_post".
   - Si piden redactar un texto nuevo, recurre a "generate_essay_draft".
   - Si piden generar una portada cinematográfica de IA, usa "generate_ai_cover".
   - Si consultan sobre vocabulario o lenguas del mundo, usa "query_panlingua_d1".
   - Si solicitan fotos históricas o de patrimonio, usa "search_wikimedia".

2. TONO Y PRESENTACIÓN:
   - Tono: Dark Academia accesible, sobrio, preciso, ejecutivo y resolutivo.
   - En tu respuesta final, resume claramente qué acciones realizaste con viñetas concisas.
   - SIEMPRE formatea enlaces como hipervínculos Markdown activos: [Texto Descriptivo](https://url). NUNCA dejes URLs crudas ni bloques de código planos para copiar y pegar.
   - Cero etiquetas estructurales de pensamiento o XML en tu respuesta final.`.trim();

export interface OrchestratorOptions {
  user?: string;
  channel?: string;
  maxSteps?: number;
}

export interface OrchestrationResult {
  text: string;
  toolsExecuted: string[];
  stepsCount: number;
}

/**
 * Procesa un mensaje en lenguaje natural resolviendo el ciclo agéntico de Function Calling
 * en memoria efímera sin acoplar estado en disco (Stateless / Cero Memoria).
 */
export async function runChatOrchestrator(
  prompt: string,
  options: OrchestratorOptions = {}
): Promise<OrchestrationResult> {
  const maxSteps = options.maxSteps || 5;
  const userName = options.user || 'Director';
  const toolsExecuted: string[] = [];

  const initialPrompt = options.user
    ? `[Usuario: ${userName}]: ${prompt}`
    : prompt;

  const toolDeclarations = getChatToolDeclarations();
  const contents: any[] = [
    { role: 'user', parts: [{ text: initialPrompt }] },
  ];

  console.log(`[Orchestrator] Nueva solicitud de ${userName}: "${prompt.slice(0, 120)}..."`);

  let currentStep = 0;
  let finalText = '';

  while (currentStep < maxSteps) {
    currentStep++;
    console.log(`[Orchestrator] Paso ${currentStep}/${maxSteps} en ejecución...`);

    const response = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents as any,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_ORQUESTADOR,
        temperature: 0.2,
        maxOutputTokens: 16384,
        tools: toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations as any }] : undefined,
      },
    });

    const functionCalls = response.functionCalls;

    // Si Gemini no llamó a ninguna herramienta, nos devolvió la respuesta final
    if (!functionCalls || functionCalls.length === 0) {
      finalText = (response.text || '').trim();
      break;
    }

    // 1. Preservar el turno del modelo con su thoughtSignature y functionCalls intactos
    const candidateContent = response.candidates?.[0]?.content;
    if (candidateContent) {
      contents.push(candidateContent);
    } else {
      contents.push({
        role: 'model',
        parts: functionCalls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
      });
    }

    // 2. Ejecutar las herramientas solicitadas por el modelo
    const functionResponseParts: any[] = [];
    for (const call of functionCalls) {
      const toolName = call.name || '';
      const toolArgs = (call.args as Record<string, any>) || {};
      toolsExecuted.push(toolName);

      console.log(`[Orchestrator] Invocando tool: "${toolName}" con args:`, JSON.stringify(toolArgs).slice(0, 200));
      const toolResult = await executeChatTool(toolName, toolArgs);

      functionResponseParts.push({
        functionResponse: { name: toolName, response: toolResult },
      });
    }

    // 3. Registrar el turno de respuestas para que Gemini continúe o sintetice
    contents.push({
      role: 'user',
      parts: functionResponseParts,
    });
  }

  if (!finalText) {
    // Si agotó los pasos ejecutando herramientas, realizar una síntesis final directa sin tools
    try {
      const finalSynthesis = await genai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contents as any,
        config: {
          systemInstruction: 'Sintetiza de forma sobria, clara y ejecutiva los resultados obtenidos de las herramientas para responder al usuario. Usa hipervínculos Markdown activos [Texto](url).',
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      });
      finalText = (finalSynthesis.text || '').trim();
    } catch (synthErr: any) {
      console.warn('[Orchestrator] Falló síntesis final de fallback:', synthErr?.message);
    }

    if (!finalText) {
      finalText = `✅ Tareas completadas: ${toolsExecuted.join(', ') || 'Solicitud procesada con éxito.'}`;
    }
  }

  console.log(`[Orchestrator] Finalizado en ${currentStep} pasos. Tools: [${toolsExecuted.join(', ')}]`);

  return {
    text: finalText,
    toolsExecuted,
    stepsCount: currentStep,
  };
}
