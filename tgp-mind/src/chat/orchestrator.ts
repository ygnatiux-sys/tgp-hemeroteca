// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Orquestador Semántico Autónomo (Cero Memoria / Stateless)
// Procesa lenguaje natural de Google Chat y Dialogflow CX, encadenando herramientas.
// ─────────────────────────────────────────────────────────────────────────────

import { genai } from '../ia/gemini.js';
import { getChatToolDeclarations, executeChatTool } from './tool-registry.js';
import { sanitizeEditorialPrompt, type EditorialBriefSanitized } from '../ia/editorial-sanitizer.js';
import { buildGoogleChatCardV2 } from './cards-v2-builder.js';
import {
  getCompanionSession,
  appendCompanionTurn,
  updateWorkingState,
  getFoundationalContext,
} from '../storage/companion-memory.js';

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
   - Tono: Dark Academia accesible, sobrio, preciso, ejecutivo y resolutivo con calidez argentina sutil.
   - En tu respuesta final, resume claramente qué acciones realizaste con viñetas concisas.
   - SIEMPRE formatea enlaces como hipervínculos Markdown activos: [Texto Descriptivo](https://url). NUNCA dejes URLs crudas ni bloques de código planos para copiar y pagar.
   - Cero etiquetas estructurales de pensamiento o XML en tu respuesta final.`.trim();

export interface OrchestratorOptions {
  user?: string;
  channel?: string;
  maxSteps?: number;
  sessionId?: string;
}

export interface OrchestrationResult {
  text: string;
  toolsExecuted: string[];
  stepsCount: number;
  editorialBrief?: EditorialBriefSanitized;
  cardV2?: any;
  metadata?: {
    publicUrl?: string;
    vaultUrl?: string;
    r2Url?: string;
    githubUrl?: string;
    heroImageUrl?: string;
  };
}

/**
 * Procesa un mensaje en lenguaje natural resolviendo el ciclo agéntico de Function Calling
 * manteniendo memoria conversacional en Cloud Firestore para que Google Chat no pierda contexto.
 */
export async function runChatOrchestrator(
  prompt: string,
  options: OrchestratorOptions = {}
): Promise<OrchestrationResult> {
  const maxSteps = options.maxSteps || 5;
  const userName = options.user || 'Director';
  const sessionId = options.sessionId || 'googlechat_default';
  const toolsExecuted: string[] = [];

  const isEditorialIntent = /brief|post|ensayo|articulo|publica|sube|nota|capitulo/i.test(prompt);
  let editorialBrief: EditorialBriefSanitized | undefined;

  if (isEditorialIntent) {
    try {
      editorialBrief = await sanitizeEditorialPrompt(prompt);
      console.log(`[Orchestrator] Ficha editorial sanitizada: "${editorialBrief.cleanTitle}" [${editorialBrief.targetSilo}]`);
    } catch (sanErr: any) {
      console.warn('[Orchestrator] Aviso sanitizador:', sanErr?.message);
    }
  }

  const editorialInjection = editorialBrief
    ? `\n\n[DIRECTIVA EDITORIAL CANÓNICA TGP - APLICAR ESTOS DATOS Y NINGÚN CLICHÉ]:
- Título Oficial: "${editorialBrief.cleanTitle}"
- Subtítulo / Tesis: "${editorialBrief.subtitle}"
- Silo Destino: "${editorialBrief.targetSilo}"
- Slug Canónico: "${editorialBrief.slug}"
- Instrucción Depurada: "${editorialBrief.cleanTopicPrompt}"
- Veto: NUNCA uses la frase del usuario ("${prompt}") como título.`
    : '';

  const initialPrompt = options.user
    ? `[Usuario: ${userName}]: ${prompt}${editorialInjection}`
    : `${prompt}${editorialInjection}`;

  // 1. Cargar historial previo de Firestore / Memoria viva
  const session = await getCompanionSession(sessionId, 'googlechat');
  const cleanHistory = [...session.recent_turns];

  // Registrar turno de usuario en la memoria
  await appendCompanionTurn(sessionId, 'googlechat', {
    role: 'user',
    parts: [{ text: initialPrompt }],
  });

  const toolDeclarations = getChatToolDeclarations();
  const contents: any[] = cleanHistory.length > 0
    ? [...cleanHistory, { role: 'user', parts: [{ text: initialPrompt }] }]
    : [{ role: 'user', parts: [{ text: initialPrompt }] }];

  console.log(`[Orchestrator] Nueva solicitud de ${userName} (${sessionId}): "${prompt.slice(0, 120)}..." (historial: ${cleanHistory.length} turnos)`);

  const foundational = await getFoundationalContext();
  const enrichedSystemInstruction = `${SYSTEM_INSTRUCTION_ORQUESTADOR}

---
[CÓDICE MAESTRO: ARQUITECTURA COGNITIVA, DOCTRINA Y ESTILO DE XAVIER BENÍTEZ (TGP)]:
${foundational.doctrina_codice_maestro}

---
[CONTEXTO FUNDACIONAL Y PENSAMIENTO ARGENTINO (XAVIER BENÍTEZ)]:
${foundational.pensamiento_filosofico}

[DIRECTRICES ONTOLÓGICAS]:
${foundational.manifiesto_fundacional.slice(0, 1500)}`.trim();

  let currentStep = 0;
  let finalText = '';
  const capturedMetadata: {
    publicUrl?: string;
    vaultUrl?: string;
    r2Url?: string;
    githubUrl?: string;
    heroImageUrl?: string;
  } = {};

  while (currentStep < maxSteps) {
    currentStep++;
    console.log(`[Orchestrator] Paso ${currentStep}/${maxSteps} en ejecución...`);

    const response = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents as any,
      config: {
        systemInstruction: enrichedSystemInstruction,
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

      // Si la tool es publish_keystatic_post y tenemos ficha editorial, inyectar silo y título si faltan
      if (toolName === 'publish_keystatic_post' && editorialBrief) {
        if (!toolArgs.titulo) toolArgs.titulo = editorialBrief.cleanTitle;
        if (!toolArgs.slug) toolArgs.slug = editorialBrief.slug;
        if (!toolArgs.silo) toolArgs.silo = editorialBrief.targetSilo;
      }

      console.log(`[Orchestrator] Invocando tool: "${toolName}" con args:`, JSON.stringify(toolArgs).slice(0, 200));
      const toolResult = await executeChatTool(toolName, toolArgs);

      if (toolResult?.publicUrl) capturedMetadata.publicUrl = toolResult.publicUrl;
      if (toolResult?.vaultUrl) capturedMetadata.vaultUrl = toolResult.vaultUrl;
      if (toolResult?.r2Url) capturedMetadata.r2Url = toolResult.r2Url;
      if (toolResult?.githubUrl) capturedMetadata.githubUrl = toolResult.githubUrl;
      if (toolResult?.imageUrl) capturedMetadata.heroImageUrl = toolResult.imageUrl;
      if (toolResult?.uploaded?.[0]?.r2Url) capturedMetadata.r2Url = toolResult.uploaded[0].r2Url;

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

  // Persistir la respuesta del modelo en la memoria viva para el próximo turno
  if (finalText) {
    await appendCompanionTurn(sessionId, 'googlechat', {
      role: 'model',
      parts: [{ text: finalText }],
    }).catch(() => {});
  }

  let cardV2: any = null;
  if (isEditorialIntent || toolsExecuted.includes('publish_keystatic_post') || toolsExecuted.includes('generate_essay_draft')) {
    const silo = editorialBrief?.targetSilo || 'alternative';
    const slug = editorialBrief?.slug || 'post-reciente';
    const cleanTitle = editorialBrief?.cleanTitle || 'Entrega Editorial TGP';

    cardV2 = buildGoogleChatCardV2({
      status: 'published',
      title: cleanTitle,
      subtitle: editorialBrief?.subtitle || 'Tesis conceptual y arqueología de la memoria.',
      silo,
      excerpt: finalText.slice(0, 300),
      slug,
      publicUrl: capturedMetadata.publicUrl,
      vaultUrl: capturedMetadata.vaultUrl,
      r2Url: capturedMetadata.r2Url,
      githubUrl: capturedMetadata.githubUrl,
      heroImageUrl: capturedMetadata.heroImageUrl,
    });
  }

  console.log(`[Orchestrator] Finalizado en ${currentStep} pasos. Tools: [${toolsExecuted.join(', ')}]`);

  return {
    text: finalText,
    toolsExecuted,
    stepsCount: currentStep,
    editorialBrief,
    cardV2,
    metadata: capturedMetadata,
  };
}

