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

  // ── 2. ESTADO HITL PENDIENTE (Cloud Run Stateless vía D1) ──────────────────
  const pendingState = await getHITLState(chatId);
  if (pendingState && pendingState.step === 'awaiting_params') {
    const hint = `Contexto acumulado: tema="${pendingState.tema || ''}", destino="${pendingState.destino || botContext}", red="${pendingState.red || ''}"`;
    const agentRes: AgentResult = await callGeminiAgent(cleanText, pendingState.history, hint);

    if (agentRes.type === 'tool_call') {
      await clearHITLState(chatId);
      const args = agentRes.args;
      return {
        type: 'execute_tool',
        toolName: agentRes.name,
        params: {
          tema: args.tema || pendingState.tema || cleanText,
          destino: args.destino || (pendingState.destino as any) || (botContext === 'social' ? 'social' : 'hemeroteca'),
          red: args.red || (pendingState.red as any) || (botContext === 'social' ? 'facebook' : undefined),
          modelo: args.modelo || 'flash',
          fuenteImg: args.fuenteImg || (photoUrl ? 'telegram' : 'wiki'),
          cantidadSecciones: args.cantidadSecciones || 3,
          photoUrl: photoUrl || pendingState.photoUrl,
        },
      };
    }

    if (agentRes.type === 'micro_prompt') {
      const updatedHistory = [
        ...pendingState.history,
        { role: 'user' as const, text: cleanText },
        { role: 'model' as const, text: agentRes.text },
      ];
      await setHITLState(chatId, {
        ...pendingState,
        history: updatedHistory,
      });
      return { type: 'micro_prompt', text: agentRes.text };
    }

    return { type: 'direct_answer', text: agentRes.text };
  }

  // ── 3. ZERO-SHOT / PARSING AGÉNTICO ────────────────────────────────────────
  const botHint = `Canal de origen: ${botContext}. Si el usuario pide redactar o publicar y no especifica destino, el default es ${botContext}.`;
  const agentRes: AgentResult = await callGeminiAgent(cleanText, [], botHint);

  if (agentRes.type === 'tool_call') {
    await clearHITLState(chatId);
    const args = agentRes.args;
    return {
      type: 'execute_tool',
      toolName: agentRes.name,
      params: {
        tema: args.tema || cleanText,
        destino: args.destino || (botContext === 'social' ? 'social' : 'hemeroteca'),
        red: args.red || (botContext === 'social' ? 'facebook' : undefined),
        modelo: args.modelo || 'flash',
        fuenteImg: args.fuenteImg || (photoUrl ? 'telegram' : 'wiki'),
        cantidadSecciones: args.cantidadSecciones || (botContext === 'social' ? 1 : 3),
        photoUrl,
      },
    };
  }

  if (agentRes.type === 'micro_prompt') {
    const newState: HITLState = {
      tema: cleanText,
      destino: botContext === 'social' ? 'social' : 'hemeroteca',
      step: 'awaiting_params',
      history: [
        { role: 'user', text: cleanText },
        { role: 'model', text: agentRes.text },
      ],
      photoUrl,
    };
    await setHITLState(chatId, newState);
    return { type: 'micro_prompt', text: agentRes.text };
  }

  return { type: 'direct_answer', text: agentRes.text };
}
