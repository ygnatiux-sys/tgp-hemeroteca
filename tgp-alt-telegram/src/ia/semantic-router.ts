// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Semantic Router Agéntico (HITL)
// Clasifica intenciones entre Bypass, Diálogo HITL y Function Calling.
// Persistencia de estado en Cloudflare D1 para Cloud Run Statelessness.
// ─────────────────────────────────────────────────────────────────────────────

import { callGeminiAgent, AgentResult, buildDensityInstruction } from './gemini.js';
import { getHITLState, setHITLState, clearHITLState, HITLState } from '../storage/d1.js';

export type BotContext = 'omni' | 'social' | 'hemeroteca';

// ─────────────────────────────────────────────────────────────────────────────
// PARSER DE MENSAJE COMPLETO
// Detecta si el usuario envió todos los parámetros en un único mensaje.
// Ejemplos que activan inferencia directa (sin diálogo HITL):
//   "Flash, Hemeroteca, 1500t: El mito de Ícaro"
//   "Pro + Wiki, premium, hemeroteca: fascinum romano"
//   "Social TikTok, breve, flash: escarabajo egipcio"
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedParams {
  tema: string;
  destino?: 'hemeroteca' | 'alternative' | 'social';
  red?: 'facebook' | 'tiktok';
  modelo?: 'flash' | 'pro';
  densidad?: 'breve' | 'profundo_breve' | 'premium';
  fuenteImg?: 'wiki' | 'telegram' | 'none';
  modoLibrePrompt?: string;
  groundingMode?: boolean;
}

/**
 * Intenta extraer parámetros de un mensaje de texto libre.
 * Retorna null si el mensaje no contiene suficientes señales paramétricas.
 * Requiere mínimo: Tema + al menos 2 paramétros adicionales para activar.
 */
function parseMessageCompleto(text: string, botContext: BotContext): ParsedParams | null {
  const lower = text.toLowerCase();

  // Separar el tema del prefijo paramétrico (sep por ':', '->', '—')
  const separadores = [':', '->', '—', '–', ' sobre '];
  let temaRaw = '';
  let prefijo = lower;

  for (const sep of separadores) {
    const idx = text.indexOf(sep);
    if (idx > 2 && idx < text.length - 2) {
      prefijo = text.slice(0, idx).toLowerCase();
      temaRaw = text.slice(idx + sep.length).trim();
      break;
    }
  }

  // Sin separador claro, no es un mensaje parametrizado
  if (!temaRaw) return null;

  // Contar tokens encontrados para validar que hay suficiente señal
  let tokensFound = 0;
  const params: ParsedParams = { tema: temaRaw };

  // ── Detectar DESTINO ──────────────────────────────────────────────────────
  if (/hemeroteca/.test(prefijo)) { params.destino = 'hemeroteca'; tokensFound++; }
  else if (/alternative/.test(prefijo)) { params.destino = 'alternative'; tokensFound++; }
  else if (/social|tiktok|facebook|rrss|redes/.test(prefijo)) {
    params.destino = 'social'; tokensFound++;
    if (/tiktok/.test(prefijo)) params.red = 'tiktok';
    else if (/facebook|fb/.test(prefijo)) params.red = 'facebook';
  } else if (botContext === 'hemeroteca') {
    // En bots especializados, el destino está implícito
    params.destino = 'hemeroteca';
  } else if (botContext === 'social') {
    params.destino = 'social';
  }

  // ── Detectar DENSIDAD ─────────────────────────────────────────────────────
  if (/premium|tratado|\+4500|4500t|exhaustivo/.test(prefijo)) {
    params.densidad = 'premium'; params.groundingMode = true; tokensFound++;
  } else if (/profundo|1500|1500t|conceptual/.test(prefijo)) {
    params.densidad = 'profundo_breve'; tokensFound++;
  } else if (/breve|800|800t|ágil|short/.test(prefijo)) {
    params.densidad = 'breve'; tokensFound++;
  }

  // ── Detectar MOTOR ────────────────────────────────────────────────────────
  if (/flash/.test(prefijo)) {
    params.modelo = 'flash'; tokensFound++;
    params.fuenteImg = /sin\s+img|solo\s+texto|none/.test(prefijo) ? 'none' : 'wiki';
  } else if (/pro/.test(prefijo)) {
    params.modelo = 'pro'; tokensFound++;
    params.fuenteImg = /sin\s+img|solo\s+texto|none/.test(prefijo) ? 'none' : 'wiki';
  }

  // ── Detectar MODO LIBRE (directivas extra tras el tema) ───────────────────
  const modoLibreMatch = temaRaw.match(/(.+?)(?:\s*[,;]\s*(.+))?$/);
  if (modoLibreMatch && modoLibreMatch[2]) {
    params.tema = modoLibreMatch[1].trim();
    params.modoLibrePrompt = modoLibreMatch[2].trim();
  }

  // Requiere al menos 2 tokens detectados para considerarse mensaje completo
  // (evita falsos positivos en mensajes de diálogo que contengan palabras como "profundo")
  if (tokensFound < 2) return null;

  return params;
}

export interface RouteInput {
  chatId: number;
  text: string;
  hasPhoto: boolean;
  photoUrl?: string;
  botContext: BotContext;
}

export type RouteDecision =
  | {
      type: 'bypass';
      action: 'publish_defaults' | 'ingest_datalake';
      params: {
        tema: string;
        destino: 'hemeroteca' | 'alternative' | 'social';
        red?: 'facebook' | 'tiktok';
        modelo: 'flash' | 'pro';
        densidad?: 'breve' | 'profundo_breve' | 'premium';
        modoLibrePrompt?: string;
        fuenteImg: 'wiki' | 'telegram' | 'none';
        cantidadSecciones: number;
        photoUrl?: string;
      };
    }
  | {
      type: 'execute_tool';
      toolName: string;
      params: {
        tema: string;
        destino: 'hemeroteca' | 'alternative' | 'social';
        red?: 'facebook' | 'tiktok';
        modelo?: 'flash' | 'pro';
        densidad?: 'breve' | 'profundo_breve' | 'premium';
        modoLibrePrompt?: string;
        fuenteImg?: 'wiki' | 'telegram' | 'none';
        cantidadSecciones?: number;
        photoUrl?: string;
        groundingMode?: boolean;
      };
    }
  | {
      type: 'micro_prompt';
      text: string;
    }
  | {
      type: 'direct_answer';
      text: string;
    };

// ─────────────────────────────────────────────────────────────────────────────
// PARSER DE SLASH COMMANDS ENRIQUECIDOS
// Convierte mensajes tipo "/hemeroteca pro 1500t El mito de Ícaro"
// en params listos para execute_tool, sin ningún paso HITL.
//
// Tokens reconocidos (en cualquier orden tras el comando base):
//   Destino: /hemeroteca | /alternative | /social | /h | /a | /s
//   Motor:   pro | flash
//   Densidad: breve | 800t | profundo | 1500t | premium | 4500t | tratado
//   Red:     facebook | tiktok | fb | tt
//   Tema:    todo lo que no sea token reconocido
// ─────────────────────────────────────────────────────────────────────────────

function parseSlashCommand(
  text: string,
  botContext: BotContext,
  photoUrl?: string,
): ReturnType<typeof parseMessageCompleto> | null {
  // Extraer el comando base y el resto
  const [commandToken, ...rest] = text.slice(1).split(/\s+/);
  const cmd = commandToken.toLowerCase();

  // Determinar destino desde el comando
  let destino: ParsedParams['destino'];
  if (cmd === 'hemeroteca' || cmd === 'h' || cmd === 'hem') destino = 'hemeroteca';
  else if (cmd === 'alternative' || cmd === 'alt' || cmd === 'a') destino = 'alternative';
  else if (cmd === 'social' || cmd === 's' || cmd === 'redes') destino = 'social';
  // Si el comando es un motor directamente, el destino viene del botContext
  else if (cmd === 'pro' || cmd === 'flash') {
    destino = botContext === 'social' ? 'social' : 'hemeroteca';
    rest.unshift(cmd); // devolver el motor al pool de tokens
  }
  // Comando desconocido → no es un slash command TGP
  else return null;

  if (rest.length === 0) return null; // Sin tema → no podemos ejecutar

  const params: ParsedParams = { tema: '', destino };
  const temaTokens: string[] = [];

  for (const token of rest) {
    const t = token.toLowerCase().replace(/[:,]/g, '');

    // Motor
    if (t === 'pro') { params.modelo = 'pro'; continue; }
    if (t === 'flash') { params.modelo = 'flash'; continue; }

    // Densidad
    if (t === 'breve' || t === '800t') { params.densidad = 'breve'; continue; }
    if (t === 'profundo' || t === '1500t' || t === 'profundo_breve') { params.densidad = 'profundo_breve'; continue; }
    if (t === 'premium' || t === '4500t' || t === 'tratado' || t === 'exhaustivo') {
      params.densidad = 'premium';
      params.groundingMode = true;
      continue;
    }

    // Red social
    if (t === 'facebook' || t === 'fb') { params.red = 'facebook'; continue; }
    if (t === 'tiktok' || t === 'tt') { params.red = 'tiktok'; continue; }

    // Fuente de imagen
    if (t === 'wiki' || t === 'wikimedia') { params.fuenteImg = 'wiki'; continue; }
    if (t === 'notxt' || t === 'soloimg') { params.fuenteImg = 'wiki'; continue; }

    // Todo lo demás es el tema
    temaTokens.push(token);
  }

  if (temaTokens.length === 0) return null; // Sin tema → sin acción
  params.tema = temaTokens.join(' ').trim();

  // Defaults inteligentes
  if (!params.modelo) params.modelo = destino === 'social' ? 'flash' : 'pro';
  if (!params.densidad) params.densidad = 'profundo_breve';
  if (!params.fuenteImg) params.fuenteImg = photoUrl ? 'telegram' : 'wiki';

  const cantSecciones = params.densidad === 'premium' ? 7 : (params.densidad === 'breve' ? 2 : 4);

  return {
    tema: params.tema,
    destino: params.destino,
    red: params.red,
    modelo: params.modelo,
    densidad: params.densidad,
    fuenteImg: params.fuenteImg,
    modoLibrePrompt: params.modoLibrePrompt,
    groundingMode: params.groundingMode,
    ...(cantSecciones ? { cantidadSecciones: cantSecciones } : {}),
  } as any;
}

/**

 * Enruta semánticamente un mensaje entrante de Telegram.
 */
export async function routeIncomingMessage(input: RouteInput): Promise<RouteDecision> {
  const { chatId, text, hasPhoto, photoUrl, botContext } = input;
  const cleanText = text.trim();

  // ── 0. SLASH COMMANDS ENRIQUECIDOS (Fast Path Zero-Fricción) ─────────────────
  // Formato: /[destino|motor] [densidad?] [tema]
  // Ej: /hemeroteca pro 1500t El mito de Ícaro
  //     /flash breve escarabajo egipcio
  //     /social tiktok flash: El fascinum romano
  // Si se detecta un slash command con tema, se ejecuta directamente sin HITL.
  if (cleanText.startsWith('/') && !cleanText.startsWith('/start') && !cleanText.startsWith('/cancel')) {
    const slashParsed = parseSlashCommand(cleanText, botContext, photoUrl);
    if (slashParsed) {
      console.log(`[SemanticRouter] Slash command fast path:`, slashParsed);
      await clearHITLState(chatId, botContext);
      return { type: 'execute_tool', toolName: 'publicar', params: slashParsed as any };
    }
  }

  // ── 1. BYPASS: Foto sin texto complejo ─────────────────────────────────────
  if (hasPhoto && (!cleanText || cleanText.length < 5)) {
    if (botContext === 'omni') {
      return {
        type: 'bypass',
        action: 'ingest_datalake',
        params: {
          tema: cleanText || 'Ingesta de Archivo',
          destino: 'hemeroteca',
          modelo: 'flash',
          fuenteImg: 'telegram',
          cantidadSecciones: 1,
          photoUrl,
        },
      };
    }

    if (botContext === 'social') {
      return {
        type: 'bypass',
        action: 'publish_defaults',
        params: {
          tema: cleanText || 'Publicación Visual',
          destino: 'social',
          red: 'facebook',
          modelo: 'flash',
          fuenteImg: 'telegram',
          cantidadSecciones: 1,
          photoUrl,
        },
      };
    }

    // Default Hemeroteca
    return {
      type: 'bypass',
      action: 'publish_defaults',
      params: {
        tema: cleanText || 'Ensayo Visual de Archivo',
        destino: 'hemeroteca',
        modelo: 'flash',
        fuenteImg: 'telegram',
        cantidadSecciones: 1,
        photoUrl,
      },
    };
  }

  // ── 2. MANEJO DE CANCELACIÓN GLOBAL ─────────────────────────────────────────
  if (cleanText.toLowerCase() === 'cancelar' || cleanText.toLowerCase() === '/cancel' || cleanText.toLowerCase() === '❌ cancelar') {
    await clearHITLState(chatId, botContext);
    return { type: 'direct_answer', text: '🛑 Operación cancelada. El canal quedó libre para un nuevo tema.' };
  }

  // ── 3. ESTADO HITL PENDIENTE (Máquina de Estados Agéntica en D1) ───────────
  const pendingState = await getHITLState(chatId, botContext);
  if (pendingState) {
    const lower = cleanText.toLowerCase();

    // ── PASO 1: Selección de Destino (Omni Bot) ─────────────────────────────
    if (pendingState.step === 'awaiting_dest') {
      if (lower.includes('hemeroteca') || lower === '1' || lower.startsWith('1.')) {
        pendingState.destino = 'hemeroteca';
        pendingState.step = 'awaiting_density';
        await setHITLState(chatId, pendingState, botContext);
        return {
          type: 'micro_prompt',
          text: `> Destino fijado: **Hemeroteca TGP** para el tema *"${pendingState.tema}"*.\n\nPaso 2: ¿Qué densidad y formato deseas para el ensayo?\n\n1️⃣ Breve (~800t, síntesis ágil)\n2️⃣ Profundo (~1500t, ensayo conceptual TGP)\n3️⃣ Premium (+4500t, tratado exhaustivo capitular)\n\n💡 _Podés tocar un botón, responder con número (1, 2 o 3), o escribir en Modo Libre con directivas personalizadas._`,
        };
      } else if (lower.includes('alternative') || lower === '2' || lower.startsWith('2.')) {
        pendingState.destino = 'alternative';
        pendingState.step = 'awaiting_density';
        await setHITLState(chatId, pendingState, botContext);
        return {
          type: 'micro_prompt',
          text: `> Destino fijado: **Alternative Dual** para el tema *"${pendingState.tema}"*.\n\nPaso 2: ¿Qué densidad y formato deseas para el ensayo?\n\n1️⃣ Breve (~800t, síntesis ágil)\n2️⃣ Profundo (~1500t, ensayo conceptual TGP)\n3️⃣ Premium (+4500t, tratado exhaustivo capitular)\n\n💡 _Podés tocar un botón, responder con número (1, 2 o 3), o escribir en Modo Libre con directivas personalizadas._`,
        };
      } else if (lower.includes('redes') || lower.includes('social') || lower === '3' || lower.startsWith('3.')) {
        pendingState.destino = 'social';
        pendingState.step = 'awaiting_network';
        await setHITLState(chatId, pendingState, botContext);
        return {
          type: 'micro_prompt',
          text: `> Destino fijado: **Redes Sociales** para el tema *"${pendingState.tema}"*.\n\nPaso 2: ¿En qué plataforma publicamos la pieza?\n\n🔵 Facebook\n⚫ TikTok`,
        };
      }
    }

    // ── PASO 2A: Selección de Red Social ────────────────────────────────────
    if (pendingState.step === 'awaiting_network') {
      if (lower.includes('tiktok') || lower === '2') pendingState.red = 'tiktok';
      else pendingState.red = 'facebook';
      pendingState.step = 'awaiting_engine';
      await setHITLState(chatId, pendingState, botContext);
      return {
        type: 'micro_prompt',
        text: `> Red social configurada: **${pendingState.red.toUpperCase()}** para *"${pendingState.tema}"*.\n\nPaso 3: ¿Qué motor y formato visual aplicamos?\n\n1️⃣ Flash + Imagen\n2️⃣ Pro + Imagen (Mayor análisis conceptual)\n3️⃣ Pro (Solo texto copy)`,
      };
    }

    // ── PASO 2B: Selección de Densidad (Hemeroteca / Alternative) ────────────
    if (pendingState.step === 'awaiting_density') {
      if (lower.includes('breve') || lower === '1') {
        pendingState.densidad = 'breve';
      } else if (lower.includes('premium') || lower.includes('tratado') || lower === '3') {
        pendingState.densidad = 'premium';
      } else {
        pendingState.densidad = 'profundo_breve';
      }

      // Si el usuario añadió directivas libres (ej: "2. con citas a Nestorio")
      const directivaLibre = cleanText.replace(/^[123][.\s-]*/, '').trim();
      if (directivaLibre.length > 5) {
        pendingState.modoLibrePrompt = directivaLibre;
      }

      pendingState.step = 'awaiting_engine';
      await setHITLState(chatId, pendingState, botContext);
      return {
        type: 'micro_prompt',
        text: `> Densidad configurada: **${pendingState.densidad === 'premium' ? 'Tratado Premium (+4500t)' : (pendingState.densidad === 'breve' ? 'Breve (~800t)' : 'Profundo (~1500t)')}**${pendingState.modoLibrePrompt ? `\n✍️ Modo Libre: "${pendingState.modoLibrePrompt}"` : ''}.\n\nPaso 3: ¿Qué motor de redacción y formato visual aplicamos?\n\n1️⃣ Flash + Wikimedia (~2s, ágil)\n2️⃣ Pro + Wikimedia (Razonamiento profundo TGP)\n3️⃣ Pro (Solo Texto Puro)`,
      };
    }

    // ── PASO 3: Selección de Motor e Imágenes ────────────────────────────────
    if (pendingState.step === 'awaiting_engine') {
      if (lower.includes('flash') || lower === '1') {
        pendingState.modelo = 'flash';
        pendingState.fuenteImg = 'wiki';
      } else if (lower.includes('solo texto') || lower.includes('sin imagenes') || lower === '3') {
        pendingState.modelo = 'pro';
        pendingState.fuenteImg = 'none';
      } else {
        pendingState.modelo = 'pro';
        pendingState.fuenteImg = 'wiki';
      }

      // Avanzar a Ficha Técnica de Confirmación
      pendingState.step = 'awaiting_confirm';
      await setHITLState(chatId, pendingState, botContext);

      const destinoLabel = pendingState.destino === 'hemeroteca'
        ? 'Hemeroteca Keystatic (thegreatpuzzleproject.com)'
        : (pendingState.destino === 'alternative' ? 'Alternative Dual (webfinal2026)' : `Redes Sociales (${pendingState.red || 'Facebook'})`);

      const densidadLabel = pendingState.densidad === 'premium'
        ? 'Premium Tratado (+4500t con fuentes primarias)'
        : (pendingState.densidad === 'breve' ? 'Breve (~800-1000t síntesis)' : 'Profundo Breve (~1500t estándar TGP)');

      const motorLabel = `${pendingState.modelo === 'flash' ? 'Gemini Flash' : 'Gemini Pro'} (${pendingState.fuenteImg === 'none' ? 'Texto Puro' : 'Wikimedia Commons + R2'})`;

      return {
        type: 'micro_prompt',
        text: `📋 **Ficha de Publicación TGP Mind:**\n• 📌 **Tema:** ${pendingState.tema}\n• 🎯 **Destino:** ${destinoLabel}\n• ⚖️ **Densidad:** ${densidadLabel}\n• 🧠 **Motor:** ${motorLabel}\n• ✍️ **Modo Libre:** ${pendingState.modoLibrePrompt ? `"${pendingState.modoLibrePrompt}"` : 'Ninguna (directiva estándar)'}\n\n¿Confirmamos y procedemos al commit?`,
      };
    }

    // ── PASO 4: Confirmación Final con Tilde ──────────────────────────────────
    if (pendingState.step === 'awaiting_confirm') {
      const esConfirmacion = lower.includes('confirmar') || lower.includes('publicar') || lower.includes('proceder') || lower === 'si' || lower === 'ok' || lower === 'adelante' || lower === '1';

      if (esConfirmacion) {
        await clearHITLState(chatId, botContext);
        const cantSecciones = pendingState.densidad === 'premium' ? 7 : (pendingState.densidad === 'breve' ? 2 : 4);
        // groundingMode automático para Tier 3 Premium
        const groundingMode = pendingState.densidad === 'premium';

        return {
          type: 'execute_tool',
          toolName: 'publicar',
          params: {
            tema: pendingState.tema,
            destino: pendingState.destino || (botContext === 'social' ? 'social' : 'hemeroteca'),
            red: pendingState.red,
            modelo: pendingState.modelo || 'pro',
            densidad: pendingState.densidad || 'profundo_breve',
            modoLibrePrompt: pendingState.modoLibrePrompt,
            fuenteImg: pendingState.fuenteImg || (photoUrl ? 'telegram' : 'wiki'),
            cantidadSecciones: cantSecciones,
            photoUrl: pendingState.photoUrl || photoUrl,
            groundingMode,
          },
        };
      }

      // Si el usuario escribe texto en este paso, se toma como ajuste de Modo Libre
      pendingState.modoLibrePrompt = (pendingState.modoLibrePrompt ? `${pendingState.modoLibrePrompt}; ` : '') + cleanText;
      await setHITLState(chatId, pendingState, botContext);

      return {
        type: 'micro_prompt',
        text: `✏️ **Modo Libre actualizado:** "${pendingState.modoLibrePrompt}"\n\n📋 **Ficha de Publicación:**\n• 📌 **Tema:** ${pendingState.tema}\n• 🎯 **Destino:** ${pendingState.destino}\n• ⚖️ **Densidad:** ${pendingState.densidad}\n• 🧠 **Motor:** ${pendingState.modelo}\n\n¿Confirmamos y procedemos al commit?`,
      };
    }
  }

  // ── 4. INICIO DE NUEVO TEMA — Inferencia Directa + HITL Fallback ────────────

  // FAST PATH: Si el mensaje contiene suficientes parámetros inline, no preguntamos nada
  const parsedCompleto = parseMessageCompleto(cleanText, botContext);
  if (parsedCompleto && parsedCompleto.tema && parsedCompleto.destino) {
    console.log(`[SemanticRouter] Inferencia directa activada:`, parsedCompleto);
    await clearHITLState(chatId, botContext); // estado limpio

    const cantSecciones = parsedCompleto.densidad === 'premium'
      ? 7
      : (parsedCompleto.densidad === 'breve' ? 2 : 4);

    return {
      type: 'execute_tool',
      toolName: 'publicar',
      params: {
        tema: parsedCompleto.tema,
        destino: parsedCompleto.destino,
        red: parsedCompleto.red,
        modelo: parsedCompleto.modelo || (parsedCompleto.destino === 'social' ? 'flash' : 'pro'),
        densidad: parsedCompleto.densidad || 'profundo_breve',
        modoLibrePrompt: parsedCompleto.modoLibrePrompt,
        fuenteImg: parsedCompleto.fuenteImg || (photoUrl ? 'telegram' : 'wiki'),
        cantidadSecciones: cantSecciones,
        photoUrl,
        groundingMode: parsedCompleto.groundingMode,
      },
    };
  }

  // HITL FALLBACK: Faltan parámetros → diálogo progresivo
  if (botContext === 'omni') {
    const newState: HITLState = {
      tema: cleanText,
      step: 'awaiting_dest',
      photoUrl,
    };
    await setHITLState(chatId, newState, botContext);
    return {
      type: 'micro_prompt',
      text: `> 🎯 Iniciando protocolo Omni para: **"${cleanText}"**.\n\nPaso 1/3: ¿A qué destino enviamos este contenido?\n\n1️⃣ Hemeroteca (thegreatpuzzleproject.com)\n2️⃣ Alternative (Webfinal Dual)\n3️⃣ Redes Sociales (Facebook / TikTok)`,
    };
  }

  if (botContext === 'social') {
    const newState: HITLState = {
      tema: cleanText,
      destino: 'social',
      step: 'awaiting_network',
      photoUrl,
    };
    await setHITLState(chatId, newState, botContext);
    return {
      type: 'micro_prompt',
      text: `> 🎯 Iniciando protocolo Redes para: **"${cleanText}"**.\n\n¿En qué plataforma publicamos la pieza?\n\n🔵 Facebook\n⚫ TikTok`,
    };
  }

  // Xavier-Assistant / Hemeroteca especializado
  const newState: HITLState = {
    tema: cleanText,
    destino: 'hemeroteca',
    step: 'awaiting_density',
    photoUrl,
  };
  await setHITLState(chatId, newState, botContext);
  return {
    type: 'micro_prompt',
    text: `> 🎯 Iniciando protocolo Hemeroteca para: **"${cleanText}"**.\n\nPaso 1/2: ¿Qué densidad y formato deseas para el ensayo?\n\n1️⃣ Breve (~800t, síntesis ágil)\n2️⃣ Profundo (~1500t, ensayo conceptual TGP)\n3️⃣ Premium (+4500t, tratado capitular exhaustivo)\n\n💡 _Podés tocar un botón, responder con el número (1, 2 o 3), o escribir en Modo Libre añadiendo directivas (ej: "2. enfocar en citas históricas")._`,
  };
}
