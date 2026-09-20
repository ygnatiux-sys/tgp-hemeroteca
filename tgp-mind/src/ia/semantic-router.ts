// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Semantic Router Agéntico (HITL)
// Clasifica intenciones entre Bypass, Diálogo HITL y Function Calling.
// Persistencia de estado en Cloudflare D1 para Cloud Run Statelessness.
// ─────────────────────────────────────────────────────────────────────────────

import { callGeminiAgent, AgentResult } from './gemini.js';
import { getHITLState, setHITLState, clearHITLState, HITLState } from '../storage/d1.js';

export type BotContext = 'omni' | 'social' | 'hemeroteca';

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

/**
 * Enruta semánticamente un mensaje entrante de Telegram.
 */
export async function routeIncomingMessage(input: RouteInput): Promise<RouteDecision> {
  const { chatId, text, hasPhoto, photoUrl, botContext } = input;
  const cleanText = text.trim();

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

  // ── 4. INICIO DE NUEVO TEMA (Paso 0: Tema Inmutable) ────────────────────────
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
