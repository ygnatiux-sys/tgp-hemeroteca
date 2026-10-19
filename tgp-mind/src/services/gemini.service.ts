// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Servicio Unificado de Gemini AI (Flash 0.3 vs Pro Ensayos)
// ─────────────────────────────────────────────────────────────────────────────
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config/env.js';
import {
  getPromptEngineConfig,
  SNACK_HOOK_SYSTEM_PROMPT,
  PRODUCTION_ESSAY_SYSTEM_PROMPT,
} from '../ia/prompt-engine.js';
import { getHistory, pushToHistory, HistoryEntry } from '../ia/gemini.js';

export const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
export const googleAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface MultimodalPart {
  inlineData?: {
    mimeType: string;
    data: string; // Base64
  };
  text?: string;
}

export interface GenerationOptions {
  model?: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3.8-flash';
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  inlineData?: { mimeType: string; data: string };
}

/**
 * Genera contenido de texto o multimodal respetando los parámetros de modelo y temperatura.
 */
export async function generateContent(
  prompt: string,
  options: GenerationOptions = {}
): Promise<{ text: string; model: string; usage?: any }> {
  const model = options.model || 'gemini-2.5-flash';
  const temperature = options.temperature ?? 0.3;
  const maxOutputTokens = options.maxOutputTokens || 4096;
  const systemInstruction = options.systemInstruction || SNACK_HOOK_SYSTEM_PROMPT;

  const contents: any[] = [{ text: prompt }];

  if (options.inlineData) {
    contents.push({
      inlineData: {
        mimeType: options.inlineData.mimeType,
        data: options.inlineData.data,
      },
    });
  }

  const response = await genai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature,
      maxOutputTokens,
    },
  });

  return {
    text: response.text || '',
    model,
    usage: response.usageMetadata,
  };
}

/**
 * Generación de Snack / Hook / Consulta de Bot:
 * Estrictamente en Gemini 2.5 Flash a temperatura 0.3 (tono analítico, sobrio).
 */
export async function generateSnack(
  topic: string,
  extraDirectives = '',
  inlineData?: { mimeType: string; data: string }
): Promise<string> {
  const userPrompt = extraDirectives
    ? `Tema: ${topic}\n\nDirectivas adicionales:\n${extraDirectives}`
    : `Genera un Snack/Hook analítico de alta densidad sobre: ${topic}`;

  const res = await generateContent(userPrompt, {
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxOutputTokens: 1200,
    systemInstruction: SNACK_HOOK_SYSTEM_PROMPT,
    inlineData,
  });

  return res.text;
}

/**
 * Generación de Ensayo de Producción:
 * Reservado exclusivamente para Gemini 2.5 Pro con la arquitectura de 7 pasos.
 */
export async function generateProductionEssay(
  topic: string,
  modoLibrePrompt = ''
): Promise<string> {
  const userPrompt = `Escribe un ensayo reflexivo, denso y profundo para Hemeroteca TGP sobre: "${topic.trim()}".
Aplica estrictamente la arquitectura en 7 pasos y el anclaje material.${
    modoLibrePrompt.trim() ? `\n\nDirectiva del autor:\n${modoLibrePrompt.trim()}` : ''
  }`;

  const res = await generateContent(userPrompt, {
    model: 'gemini-2.5-pro',
    temperature: 0.65,
    maxOutputTokens: 8192,
    systemInstruction: PRODUCTION_ESSAY_SYSTEM_PROMPT,
  });

  return res.text;
}

/**
 * Wrapper de chat retrocompatible con index.ts / TgpMindSidebar.
 */
export async function callChatGemini(
  sessionId: string,
  userMessage: string,
  usePro = false,
  overrideSystemPrompt?: string
): Promise<{ text: string; model: string }> {
  const model = usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
  const temperature = usePro ? 0.65 : 0.3;
  const systemInstruction = overrideSystemPrompt || (usePro ? PRODUCTION_ESSAY_SYSTEM_PROMPT : SNACK_HOOK_SYSTEM_PROMPT);

  const history = getHistory(sessionId);
  const chat = genai.chats.create({
    model,
    config: {
      systemInstruction,
      temperature,
      maxOutputTokens: usePro ? 8192 : 2048,
    },
    history: history.length > 0 ? history : undefined,
  });

  pushToHistory(sessionId, 'user', userMessage);
  const response = await chat.sendMessage({ message: userMessage });
  const responseText = response.text ?? '';
  pushToHistory(sessionId, 'model', responseText);

  return { text: responseText, model };
}
