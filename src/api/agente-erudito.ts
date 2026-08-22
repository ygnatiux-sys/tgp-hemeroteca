import 'dotenv/config';
import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';
import {
  ERUDITO_DIVULGATIVO_PROMPT,
  AGENTE_ERUDITO_ACADEMICO_PROMPT,
} from '../config/geminiPrompts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { modo = 'divulgativo', titulo = '', textoActual = '' } = body;

    const API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en el servidor.' }), { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // ── Seleccionar prompt y construir el mensaje del usuario ──────────
    let systemInstruction: string;
    let userMessage: string;
    let temperature: number;

    if (modo === 'academico') {
      if (!textoActual.trim()) {
        return new Response(JSON.stringify({ error: 'El modo académico requiere texto existente para reformatear.' }), { status: 400, headers });
      }
      systemInstruction = AGENTE_ERUDITO_ACADEMICO_PROMPT;
      temperature = 0.20;
      userMessage = `Formatea el siguiente texto con estándar tipográfico impecable para TGP Hemeroteca. Corrige la redacción si detectas prosa mecánica o genérica. Devuelve únicamente el Markdown final:\n\n${textoActual}`;
    } else {
      systemInstruction = ERUDITO_DIVULGATIVO_PROMPT;
      temperature = 0.62;
      const tema = titulo.trim()
        ? `"${titulo}"`
        : (textoActual.trim() ? `el tema central de este texto:\n\n${textoActual.slice(0, 600)}` : 'el arquetipo o tema detectado en el contexto actual');
      userMessage = `Redacta un ensayo magistral de historia cultural y pensamiento simbólico sobre ${tema}. Aplica todas las reglas de estructura, tono divulgativo-erudito y formato Markdown estricto definidas en tu identidad. El ensayo debe tener entre 900 y 2.000 palabras.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      config: {
        temperature,
        systemInstruction,
      },
    });

    const content = response.text?.trim() || '';
    if (!content) throw new Error('El agente no devolvió contenido.');

    return new Response(JSON.stringify({ success: true, content }), { status: 200, headers });

  } catch (err: any) {
    console.error('[AgenteErudito] Error:', err);
    return new Response(JSON.stringify({ error: `Fallo del Agente Erudito: ${err.message}` }), { status: 500, headers });
  }
};