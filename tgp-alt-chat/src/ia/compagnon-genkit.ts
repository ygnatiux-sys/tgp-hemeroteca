// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Cerebro Compagnon Genkit / Gemini 2.5 (Estilo Argentino & Cálido)
//
// Responsabilidades:
//   1. Orquestar el diálogo con tono Compagnon: cómplice intelectual, agudo,
//      cálido y directo (Dark Academia accesible con voseo argentino natural).
//   2. Invocar las 9 herramientas nativas de código sin bucles de if/else rígidos.
//   3. Retornar OBLIGATORIAMENTE la tríada de URLs mandatadas:
//      - Ensayos: Hemeroteca/Alternative URL + Storage R2 URL + Colección URL + GitHub Commit.
//      - Redes: URL de Red Social (Zernio) + Storage R2 URL + Estado de Resguardo.
//   4. Sincronizar working_state en Cloud Firestore (o fallback D1).
//   5. Cero cuelgues: Captura segura de errores con cierre de turnos sintéticos.
// ─────────────────────────────────────────────────────────────────────────────

import { genai } from './gemini.js';
import {
  getCompanionSession,
  appendCompanionTurn,
  updateWorkingState,
  sanitizeTurns,
  getFoundationalContext,
  type WorkingState,
} from '../storage/companion-memory.js';

import { TOOL_GENERAR_ENSAYO, ejecutarGenerarEnsayo } from './tools/tool-generar-ensayo.js';
import { TOOL_PUBLISH_SOCIAL, ejecutarPublishSocial } from './tools/tool-publish-social.js';
import { TOOL_CINEMATIC, ejecutarCinematicPipeline } from './tools/tool-cinematic.js';
import { TOOL_NEO4J, ejecutarNeo4jExtraction } from './tools/tool-neo4j.js';
import { TOOL_QUERY_PANLINGUA, ejecutarQueryPanlingua } from './tools/tool-panlingua.js';
import { wikimediaTool } from '../core/tools/wikimediaTool.js';
import { nanoBananaTool } from '../core/tools/nanoBananaTool.js';
import { generarMarkdoc, publicarEntradaKeystaticGitHub } from '../servicios/publicacion.js';
import { registrarResguardoD1 } from '../storage/d1.js';
import { CODICE_XAVIER_BENITEZ, CATALOGO_TESIS_OBRA_XAVIER_BENITEZ } from './codice-xavier-benitez.js';

export type BotIdentity = 'omni' | 'redes' | 'assistant' | 'liminal';

const generarAudioDocumentalR2 = async (..._args: any[]): Promise<any> => ({
  success: false,
  error: 'Audio documental desactivado en servicio Chat',
});

// ── Herramienta Nativa: Síntesis de Audio Documental TTS ────────────────────
const TOOL_GENERATE_AUDIO = {
  name: 'generate_audio_documental',
  description: 'Sintetiza un ensayo en audio documental neuronal, concatenando fragmentos y alojando el MP3 en Cloudflare R2.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      titulo: { type: 'STRING' as const, description: 'Título del ensayo.' },
      texto: { type: 'STRING' as const, description: 'Texto del ensayo a sintetizar (si se omite usa el último del historial).' },
    },
    required: ['titulo'],
  },
};

// ── Herramienta Nativa: Publicación GitOps Directa ──────────────────────────
const TOOL_PUBLICAR_KEYSTATIC = {
  name: 'publicar_keystatic',
  description: 'Publica un ensayo en GitHub Keystatic (Hemeroteca o Alternative) con commit atómico.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      titulo: { type: 'STRING' as const, description: 'Título del ensayo.' },
      destino: {
        type: 'STRING' as const,
        enum: ['hemeroteca', 'alternative'],
        description: 'Destino del ensayo: "hemeroteca" (ensayos-cinematicos) o "alternative" (historia-alternativa).',
      },
      categoria: { type: 'STRING' as const, description: 'Colección o categoría destacada.' },
      texto: { type: 'STRING' as const, description: 'Texto completo del ensayo.' },
      coverUrl: { type: 'STRING' as const, description: 'URL de la imagen en R2.' },
    },
    required: ['titulo', 'destino'],
  },
};

// ── Herramienta Nativa: Wikimedia Commons Photo ─────────────────────────────
const TOOL_WIKIMEDIA = {
  name: 'search_wikimedia_photo',
  description: 'Busca una fotografía histórica de alta calidad en Wikimedia Commons.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      query: { type: 'STRING' as const, description: 'Término de búsqueda histórico, arqueológico o simbólico.' },
    },
    required: ['query'],
  },
};

// ── Herramienta Nativa: Nano Banana Cover ────────────────────────────────────
const TOOL_NANO_BANANA = {
  name: 'generate_nano_banana_cover',
  description: 'Genera una portada fotográfica cinematográfica artística TGP con alta calidad visual.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      title: { type: 'STRING' as const, description: 'Título del ensayo.' },
      concept: { type: 'STRING' as const, description: 'Concepto visual central.' },
      visualSensitivity: { type: 'STRING' as const, enum: ['auto', 'avant-garde', 'classic', 'hybrid'] },
      narrativeMode: { type: 'STRING' as const, enum: ['auto', 'historical-epic', 'psychological-closeup', 'night-expedition', 'archival-reconstruction'] },
      historicalRigor: { type: 'STRING' as const, enum: ['strict', 'documented-interpretive', 'editorial', 'conceptual'] },
      visualRisk: { type: 'STRING' as const, enum: ['restrained', 'balanced', 'bold', 'experimental'] },
    },
    required: ['title', 'concept'],
  },
};

// ── Herramienta: Solicitud de Acción Humana ─────────────────────────────────
export const TOOL_REQUEST_HUMAN_ACTION = {
  name: 'request_human_action',
  description: 'Solicita al usuario una acción externa o validación especial.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      action_type: { type: 'STRING' as const, description: 'Tipo de acción requerida.' },
      message: { type: 'STRING' as const, description: 'Instrucción amigable para el usuario.' },
      url: { type: 'STRING' as const, description: 'URL a visitar si aplica.' },
    },
    required: ['action_type', 'message'],
  },
};

// ── Asignación de Herramientas por Identidad ─────────────────────────────────
const TOOLS_BY_BOT: Record<BotIdentity, object[]> = {
  redes: [TOOL_PUBLISH_SOCIAL, TOOL_GENERATE_AUDIO, TOOL_REQUEST_HUMAN_ACTION],
  assistant: [TOOL_GENERAR_ENSAYO, TOOL_PUBLICAR_KEYSTATIC, TOOL_GENERATE_AUDIO, TOOL_NEO4J, TOOL_REQUEST_HUMAN_ACTION],
  omni: [
    TOOL_GENERAR_ENSAYO,
    TOOL_PUBLICAR_KEYSTATIC,
    TOOL_PUBLISH_SOCIAL,
    TOOL_GENERATE_AUDIO,
    TOOL_CINEMATIC,
    TOOL_NEO4J,
    TOOL_WIKIMEDIA,
    TOOL_NANO_BANANA,
    TOOL_REQUEST_HUMAN_ACTION,
  ],
  liminal: [
    TOOL_QUERY_PANLINGUA,
    TOOL_GENERAR_ENSAYO,
    TOOL_PUBLICAR_KEYSTATIC,
    TOOL_GENERATE_AUDIO,
    TOOL_CINEMATIC,
    TOOL_WIKIMEDIA,
    TOOL_NANO_BANANA,
    TOOL_REQUEST_HUMAN_ACTION,
  ],
};

// ── System Prompts con Tono Argentino Cálido y Compagnon Intelectual ────────
const BASE_COMPAGNON_PROMPT = `
Sos el "Compagnon" intelectual y socio analítico de Xavier Benítez en TGP Project.
Tu voz es la de un colega brillante, cálido, cómplice y con estilo argentino natural (usá voseo rioplatense sutil y respetuoso: "che", "mirá", "vamos con esto", "fijate", sin caer en la exageración folclórica ni en la burocracia robótica).
Tono: Dark Academia accesible. Pensamiento riguroso, reflexivo, con calidez humana y agudeza crítica.

REGLAS OBLIGATORIAS DE ENTREGA DE RESULTADOS:
1. Siempre que se genere o publique un Ensayo (Hemeroteca o Alternative), es MANDATORIO e INVARIABLE incluir al pie:
   - 🏛️ **Ensayo Web:** [Abrir Ensayo en TGP](https://thegreatpuzzleproject.com/ensayos-cinematicos/[slug]) (o link a Alternative)
   - 🖼️ **Storage R2:** [Ver Portada en Storage R2]([url_imagen])
   - 📂 **Colección Destacada:** [Ver Colección en Hemeroteca](https://thegreatpuzzleproject.com/colecciones/[categoria])
   - 📦 **Commit GitHub:** [Ver Commit [sha]]([commitUrl])

2. Siempre que se publique un post en Redes Sociales (Facebook o TikTok con Zernio), es MANDATORIO incluir:
   - 🌐 **Publicación en Red:** [Ver Post en Red Social]([url_post])
   - 🖼️ **Storage R2:** [Ver Imagen en Storage R2]([url_imagen])
   - 📦 **Estado de Resguardo:** Registrado con éxito en el Data Lake.

3. Si el usuario te pide un ensayo, redactalo con estructura magistral (título evocador #, subtítulos ##, prosa profunda y fuentes).
4. No uses fórmulas vacías como "como modelo de lenguaje". Hablá de igual a igual, con entusiasmo intelectual.
`.trim();

const PROMPTS_BY_BOT: Record<BotIdentity, string> = {
  redes: `${BASE_COMPAGNON_PROMPT}
Especialidad: Curador y estratega de redes sociales (Facebook y TikTok).
Sabés sintetizar la complejidad histórica en copys magnéticos, provocadores y con misterio. Siempre usá Zernio para publicar.`,

  assistant: `${BASE_COMPAGNON_PROMPT}
Especialidad: Investigación histórica profunda, linajes conceptuales y grafos de conocimiento.
Tu foco es descubrir las conexiones ocultas en los documentos y la historiografía.`,

  omni: `${BASE_COMPAGNON_PROMPT}
Especialidad: Orquestador general TGP. Podés investigar, redactar ensayos cinemáticos, publicar en redes o conectar con la Hemeroteca y Alternative según lo que pida el usuario.`,

  liminal: `${BASE_COMPAGNON_PROMPT}
Especialidad: Filosofía del lenguaje, cosmogonías antiguas y exploradora lingüística con Panlingua D1.
Tenés acceso a la base de más de 314 idiomas del mundo. Consultá Panlingua ante cualquier duda lingüística y redactá con profundidad ontológica.`,
};

// ── Ejecutor de Herramientas ────────────────────────────────────────────────
async function ejecutarCompagnonTool(
  name: string,
  args: Record<string, any>,
  chatId: number,
  sessionWorkingState: WorkingState,
  botIdentity: BotIdentity,
): Promise<{ result?: string; error?: string; updatedState?: Partial<WorkingState> }> {
  try {
    console.log(`[Compagnon Tool] Invocando "${name}" con args:`, JSON.stringify(args).slice(0, 200));

    // 1. GENERAR ENSAYO
    if (name === 'generar_ensayo') {
      const tema = String(args.tema || sessionWorkingState.topic || 'Historia Antigua');
      const resultado = await ejecutarGenerarEnsayo({
        tema,
        longitud: args.longitud || 'breve_1500',
        motor: args.motor || 'flash',
        origen_fotos: args.origen_fotos || 'solo_wiki',
        chatId,
      });

      // Extraer datos para el working_state
      const slugMatch = resultado.match(/ensayos-cinematicos\/([a-z0-9-]+)/i);
      const imgMatch = resultado.match(/https:\/\/storage\.thegreatpuzzleproject\.com\/[^\s\)\"]+/i);
      const slug = slugMatch ? slugMatch[1] : 'ensayo-' + Date.now();
      const imageUrl = imgMatch ? imgMatch[0] : sessionWorkingState.lastImageUrl;

      return {
        result: resultado,
        updatedState: {
          topic: tema,
          lastSlug: slug,
          lastImageUrl: imageUrl,
          lastAction: 'generar_ensayo',
        },
      };
    }

    // 2. PUBLICAR EN REDES (ZERNIO)
    if (name === 'publish_social') {
      const red = (args.red || 'facebook') as 'facebook' | 'tiktok';
      const tema = String(args.tema || sessionWorkingState.topic || '');
      const imageUrl = String(args.url_imagen || sessionWorkingState.lastImageUrl || '');

      const resultado = await ejecutarPublishSocial({
        tema,
        red,
        motor: args.motor || 'flash',
        url_imagen: imageUrl,
        chatId,
      });

      return {
        result: resultado,
        updatedState: {
          lastAction: `publish_social_${red}`,
          targetDestination: red,
        },
      };
    }

    // 3. SÍNTESIS DE AUDIO DOCUMENTAL TTS
    if (name === 'generate_audio_documental') {
      const texto = String(args.texto || sessionWorkingState.lastDraft || '');
      const titulo = String(args.titulo || sessionWorkingState.lastTitle || 'Ensayo Documental TGP');

      if (!texto) {
        return { error: 'No encontré un texto para sintetizar. Generá o pasame el ensayo primero.' };
      }

      const audioRes = await generarAudioDocumentalR2(texto, titulo, chatId);
      if (!audioRes.success || !audioRes.audioUrl) {
        return { error: audioRes.error || 'Fallo al sintetizar audio.' };
      }

      const resTexto = [
        `🎧 *Audio Documental Generado con Éxito*`,
        ``,
        `🔊 **Storage R2:** [Escuchar / Descargar Audio](${audioRes.audioUrl})`,
        `📁 **Key:** \`audios/${audioRes.audioId}.mp3\``,
        `🏛️ Título: *${titulo}*`,
      ].join('\n');

      return {
        result: resTexto,
        updatedState: {
          lastAudioUrl: audioRes.audioUrl,
          lastAction: 'generate_audio_documental',
        },
      };
    }

    // 4. PUBLICAR KEYSTATIC DIRECTO (HEMEROTECA O ALTERNATIVE)
    if (name === 'publicar_keystatic') {
      const titulo = String(args.titulo || sessionWorkingState.lastTitle || 'Ensayo TGP');
      const destino = (args.destino || 'hemeroteca') as 'hemeroteca' | 'alternative';
      const categoria = String(args.categoria || sessionWorkingState.lastCollection || 'misterios-arqueologia');
      const texto = String(args.texto || sessionWorkingState.lastDraft || '');
      const coverUrl = String(args.coverUrl || sessionWorkingState.lastImageUrl || '');

      if (!texto) {
        return { error: 'No hay texto de ensayo cargado para publicar.' };
      }

      const { slug, contenidoMdoc } = generarMarkdoc({
        titulo,
        secciones: [{ parrafo: texto }],
      });

      const ghToken = process.env.GITHUB_TOKEN_HEMEROTECA || process.env.GITHUB_TOKEN || '';
      const ghRepo = destino === 'alternative'
        ? (process.env.GITHUB_REPO || 'ygnatiux-sys/tgp-webfinal2026')
        : (process.env.GITHUB_REPO_HEMEROTECA || 'ygnatiux-sys/tgp-hemeroteca');

      const coleccionFolder = destino === 'alternative' ? 'ensayos' : 'ensayos-cinematicos';

      const commitSha = await publicarEntradaKeystaticGitHub({
        coleccion: coleccionFolder,
        slug,
        indexJson: {
          title: titulo,
          coverImage: coverUrl,
          category: categoria,
          generadorTexto: JSON.stringify({ text: contenidoMdoc, image: coverUrl }),
        },
        contentMdoc: contenidoMdoc,
        token: ghToken,
        repoFull: ghRepo,
        mensajeCommit: `docs(${destino}): publicar ensayo "${titulo}" vía Compagnon Telegram`,
      });

      const commitUrl = `https://github.com/${ghRepo}/commit/${commitSha}`;
      const postUrl = destino === 'alternative'
        ? `https://alternative.thegreatpuzzleproject.com/ensayos/${slug}`
        : `https://thegreatpuzzleproject.com/ensayos-cinematicos/${slug}`;
      const coleccionUrl = `https://thegreatpuzzleproject.com/colecciones/${categoria}`;

      const resTexto = [
        `✅ *¡Publicado con éxito en TGP ${destino === 'alternative' ? 'Alternative' : 'Hemeroteca'}!*`,
        ``,
        `🏛️ **Ensayo Web:** [Abrir Ensayo](${postUrl})`,
        coverUrl ? `🖼️ **Storage R2:** [Ver Portada en Storage R2](${coverUrl})` : '',
        `📂 **Colección Destacada:** [Ver Colección](${coleccionUrl})`,
        `📦 **Commit GitHub:** [Ver Commit ${commitSha.slice(0, 7)}](${commitUrl})`,
      ].filter(Boolean).join('\n');

      return {
        result: resTexto,
        updatedState: {
          lastSlug: slug,
          lastDraft: texto,
          lastTitle: titulo,
          lastCollection: categoria,
          lastAction: `publicar_${destino}`,
        },
      };
    }

    // 5. PANLINGUA D1
    if (name === 'query_panlingua') {
      const intent = (args.intent || 'buscar_concepto') as any;
      const res = await ejecutarQueryPanlingua({ ...args, intent, chatId });
      return { result: typeof res === 'string' ? res : JSON.stringify(res) };
    }

    // 6. WIKIMEDIA PHOTO
    if (name === 'search_wikimedia_photo') {
      const toolRes = await wikimediaTool.execute({ query: args.query });
      const firstImg = toolRes?.results?.[0]?.url;
      return {
        result: firstImg
          ? `Foto encontrada en Wikimedia Commons: ${firstImg}\nDescripción: ${toolRes?.results?.[0]?.description || ''}`
          : 'No se encontraron imágenes para esa búsqueda en Wikimedia Commons.',
        updatedState: firstImg ? { lastImageUrl: firstImg } : undefined,
      };
    }

    // 7. NANO BANANA COVER
    if (name === 'generate_nano_banana_cover') {
      const nanoRes = await nanoBananaTool.execute(args);
      const imgUrl = nanoRes?.imageUrl;
      return {
        result: imgUrl
          ? `Portada artística generada con Nano Banana: ${imgUrl}`
          : 'No se pudo generar la portada artística.',
        updatedState: imgUrl ? { lastImageUrl: imgUrl } : undefined,
      };
    }

    // 8. CINEMATIC PIPELINE
    if (name === 'generate_cinematic_pipeline') {
      const res = await ejecutarCinematicPipeline({
        tema: String(args.tema || ''),
        estilo: String(args.estilo || ''),
        chatId,
      });
      return { result: res };
    }

    // 9. NEO4J EXTRACTION
    if (name === 'extract_neo4j_entities') {
      const res = await ejecutarNeo4jExtraction({
        texto: String(args.texto || sessionWorkingState.lastDraft || ''),
        chatId,
      });
      return { result: res };
    }

    // 10. REQUEST HUMAN ACTION
    if (name === 'request_human_action') {
      return { result: `Acción externa solicitada: ${args.action_type}. ${args.message}` };
    }

    return { error: `Herramienta "${name}" no reconocida.` };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[Compagnon Tool Error] Falló "${name}":`, err);
    return { error: errMsg };
  }
}

// ── Bucle Principal Compagnon ───────────────────────────────────────────────
export async function processCompagnonMessage(
  chatId: number,
  userText: string,
  botIdentity: BotIdentity,
  imageContextPrefix?: string,
): Promise<{ text: string; workingState: WorkingState }> {
  // 1. Obtener la sesión viva con su working_state y turnos limpios
  const session = await getCompanionSession(chatId, botIdentity);

  const textToSave = imageContextPrefix
    ? `${imageContextPrefix}\n\nUsuario: ${userText}`.trim()
    : userText.trim();

  // 2. Registrar turno del usuario
  if (textToSave) {
    await appendCompanionTurn(chatId, botIdentity, {
      role: 'user',
      parts: [{ text: textToSave }],
    });
  }

  // 3. Preparar historial saneado para Gemini 2.5
  const freshSession = await getCompanionSession(chatId, botIdentity);
  const cleanHistory = freshSession.recent_turns;

  const safeContents = cleanHistory.length > 0
    ? cleanHistory
    : [{ role: 'user' as const, parts: [{ text: textToSave || 'Hola' }] }];

  console.log(`[Compagnon:${botIdentity}] Procesando mensaje con ${safeContents.length} turnos saneados...`);

  const toolsForBot = TOOLS_BY_BOT[botIdentity];
  const foundational = await getFoundationalContext();

  const enrichedSystemInstruction = `${PROMPTS_BY_BOT[botIdentity]}

---
[CÓDICE MAESTRO: ARQUITECTURA COGNITIVA, DOCTRINA Y ESTILO DE XAVIER BENÍTEZ (TGP)]:
${foundational.doctrina_codice_maestro || CODICE_XAVIER_BENITEZ}

---
[CATÁLOGO DE TESIS, OBRAS TRONCALES Y METODOLOGÍA]:
${CATALOGO_TESIS_OBRA_XAVIER_BENITEZ}

---
[CONTEXTO FUNDACIONAL Y PENSAMIENTO ARGENTINO (XAVIER BENÍTEZ)]:
${foundational.pensamiento_filosofico}

[DIRECTRICES ONTOLÓGICAS]:
${foundational.manifiesto_fundacional.slice(0, 1500)}`.trim();

  // 4. Llamada a Gemini Flash con herramientas nativas + grounding académico
  let response: any;
  const configuredTools: any[] = [];
  if (toolsForBot.length > 0) {
    configuredTools.push({ functionDeclarations: toolsForBot });
  } else {
    // Grounding académico de Google Search para precisión fáctica en consultas generales
    configuredTools.push({ googleSearch: {} });
  }

  try {
    response = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: safeContents as any,
      config: {
        systemInstruction: enrichedSystemInstruction,
        temperature: 0.25,
        maxOutputTokens: 16384,
        tools: configuredTools.length > 0 ? configuredTools : undefined,
      },
    });
  } catch (toolCombErr: any) {
    console.warn('[Compagnon Agent] Fallback seguro tras error en tools:', toolCombErr?.message);
    response = await genai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: safeContents as any,
      config: {
        systemInstruction: enrichedSystemInstruction,
        temperature: 0.25,
        maxOutputTokens: 16384,
        tools: toolsForBot.length > 0 ? [{ functionDeclarations: toolsForBot }] : undefined,
      },
    });
  }

  // 5a. Si fue respuesta directa de texto
  const functionCalls = response.functionCalls;
  if (!functionCalls || functionCalls.length === 0) {
    let responseText = (response.text || '').trim();
    if (!responseText) {
      responseText = 'Mirá, no pude generar una respuesta clara en este momento. Si querés probamos de nuevo o escribí /menu.';
    }

    // Detectar si el texto contiene un borrador de ensayo para guardarlo en working_state
    if (responseText.includes('# ') && responseText.length > 500) {
      const titleMatch = responseText.match(/^#+\s*(.+)$/m);
      await updateWorkingState(chatId, botIdentity, {
        lastDraft: responseText,
        lastTitle: titleMatch ? titleMatch[1].replace(/[*_#]/g, '').trim() : 'Ensayo TGP',
      });
    }

    await appendCompanionTurn(chatId, botIdentity, {
      role: 'model',
      parts: [{ text: responseText }],
    });

    return { text: responseText, workingState: freshSession.working_state };
  }

  // 5b. Si hubo llamada a Herramienta (Native Tool Call)
  const call = functionCalls[0];
  const toolName = call.name || '';
  const toolArgs = (call.args as Record<string, any>) || {};

  console.log(`[Compagnon:${botIdentity}] 🛠️ Herramienta llamada: ${toolName}`, toolArgs);

  // Registrar el functionCall en el historial
  await appendCompanionTurn(chatId, botIdentity, {
    role: 'model',
    parts: [{ functionCall: { name: toolName, args: toolArgs } }],
  });

  // Ejecutar la herramienta en código
  const toolExecution = await ejecutarCompagnonTool(
    toolName,
    toolArgs,
    chatId,
    freshSession.working_state,
    botIdentity,
  );

  // Actualizar working_state si la herramienta devolvió estado fresco
  if (toolExecution.updatedState) {
    await updateWorkingState(chatId, botIdentity, toolExecution.updatedState);
  }

  // Registrar functionResponse (Auto-sanación: siempre devuelve respuesta válida, nunca cuelga)
  const funcResponsePayload = toolExecution.result
    ? { result: toolExecution.result }
    : { error: toolExecution.error || 'La herramienta no devolvió resultado.' };

  await appendCompanionTurn(chatId, botIdentity, {
    role: 'function',
    parts: [{ functionResponse: { name: toolName, response: funcResponsePayload } }],
  });

  // Formatear respuesta final para el chat
  let finalText: string;
  if (toolExecution.result) {
    finalText = toolExecution.result.startsWith('✅') || toolExecution.result.startsWith('🎧') || toolExecution.result.startsWith('🏛️')
      ? toolExecution.result
      : `✅ Acción completada:\n\n${toolExecution.result}`;
  } else {
    finalText = `⚠️ Hubo un detalle al ejecutar ${toolName}: ${toolExecution.error || 'Error desconocido'}.\nProbemos de nuevo o avisame cómo seguimos.`;
  }

  await appendCompanionTurn(chatId, botIdentity, {
    role: 'model',
    parts: [{ text: finalText }],
  });

  const finalSession = await getCompanionSession(chatId, botIdentity);
  return { text: finalText, workingState: finalSession.working_state };
}
