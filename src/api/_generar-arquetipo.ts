import 'dotenv/config';
import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT_HISTORIA_SIMBOLICA_TGP } from '../config/prompts/prompt-historia-simbolica-tgp';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo } = body;

    if (!titulo) return new Response(JSON.stringify({ error: 'Falta el título o arquetipo a analizar.' }), { status: 400, headers });
    
    const API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en el servidor.' }), { status: 500, headers });

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `Analiza y redacta un ensayo erudito de historia cultural y estratificación simbólica sobre el Arquetipo o Tema: "${titulo}".
Aplica estrictamente todas las reglas de los 10 puntos, dividiendo el análisis en los 3 Niveles (Antecedente Material, Reformulación Esotérica, Recepción Psicológica posterior) y adjuntando las Notas de Control de Calidad al final.`;

    const responseTexto = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        systemInstruction: SYSTEM_PROMPT_HISTORIA_SIMBOLICA_TGP,
      }
    });

    const rawText = responseTexto.text?.trim() || '';
    if (!rawText) throw new Error("El motor no devolvió contenido.");

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      parsed = {
        volanta: "ARQUETIPOS GLOBALES · SIMBOLISMO COMPARADO",
        excerpt: rawText.slice(0, 220) + '...',
        category: 'Arquetipos Globales',
        content: rawText,
        fuentes: "",
        notaControl: ""
      };
    }

    // Si existen fuentes o nota de control devueltas por separado, las adjuntamos al final del contenido
    let finalContent = parsed.content || rawText;
    if (parsed.fuentes) {
      finalContent += `\n\n## Fuentes & Lecturas Historiográficas\n${parsed.fuentes}`;
    }
    if (parsed.notaControl) {
      finalContent += `\n\n> [!NOTE]\n> **Nota de Control de Calidad Historiográfica**\n> ${parsed.notaControl}`;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      volanta: parsed.volanta || "ARQUETIPOS GLOBALES · SIMBOLISMO COMPARADO",
      excerpt: parsed.excerpt || (finalContent || '').slice(0, 220) + '...',
      category: parsed.category || 'Arquetipos Globales',
      content: finalContent
    }), { status: 200, headers });

  } catch (errorText: any) {
    console.error('[Error] Fallo en Motor de Arquetipos:', errorText);
    return new Response(JSON.stringify({ error: `Fallo en el Motor de Arquetipos: ${errorText.message}` }), { status: 500, headers });
  }
};
