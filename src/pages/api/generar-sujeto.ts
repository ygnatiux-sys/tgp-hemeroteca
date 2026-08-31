export const prerender = false;

import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';

export const POST: APIRoute = async ({ request, locals }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const conceptoBase = body.conceptoBase;

    if (!conceptoBase || typeof conceptoBase !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'El parámetro conceptoBase es requerido.' }),
        { status: 400, headers }
      );
    }

    const geminiKey = (locals as any)?.runtime?.env?.GEMINI_API_KEY || (process.env as any)?.GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY no encontrada en el servidor.' }),
        { status: 500, headers }
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `Translate and expand the following subject concept into clear, highly descriptive English. 
Describe ONLY the physical subject, object, or main scene structure. 
Do NOT include camera settings, lenses, lighting techniques, film stock, color grading, or artistic style keywords.

User Concept: "${conceptoBase}"`
        }]
      }],
      config: {
        systemInstruction: 'You are a prompt engineering assistant specializing in subject isolation. Output purely the physical subject description in concise, vivid English.'
      }
    });

    const sujetoIA = response.text?.trim() || conceptoBase;

    return new Response(JSON.stringify({ success: true, sujetoIA }), { status: 200, headers });
  } catch (error: any) {
    console.error('Error en /api/generar-sujeto:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || String(error) }),
      { status: 500, headers }
    );
  }
};
