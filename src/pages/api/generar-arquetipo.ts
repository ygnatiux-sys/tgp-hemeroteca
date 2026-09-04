export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT_HISTORIA_SIMBOLICA_TGP } from '../../config/prompts/prompt-historia-simbolica-tgp';
import { AGENTE_ERUDITO_ACADEMICO_PROMPT } from '../../config/geminiPrompts';

// El system prompt combina el rigor académico + las reglas de formato Markdown estricto
const SISTEMA_ARQUETIPOS = `${SYSTEM_PROMPT_HISTORIA_SIMBOLICA_TGP}

---

REGLAS ADICIONALES DE FORMATO Y REDACCIÓN (AGENTE ERUDITO ACADÉMICO):
${AGENTE_ERUDITO_ACADEMICO_PROMPT}`;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo } = body;

    if (!titulo) {
      return new Response(JSON.stringify({ error: 'Falta el título o arquetipo a analizar.' }), { status: 400, headers });
    }

    const geminiKey = env?.GEMINI_API_KEY || (process.env as any)?.GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en las variables de entorno de Cloudflare / servidor.' }), { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const prompt = `Analiza y redacta un ensayo erudito de historia cultural y estratificación simbólica sobre el Arquetipo o Tema: "${titulo}".
Aplica estrictamente todas las reglas de los 10 puntos, dividiendo el análisis en los 3 Niveles (Antecedente Material, Reformulación Esotérica, Recepción Psicológica posterior) y adjuntando las Notas de Control de Calidad al final.`;

    const responseTexto = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        systemInstruction: SISTEMA_ARQUETIPOS,
      }
    });

    const rawText = responseTexto.text?.trim() || '';
    if (!rawText) throw new Error('El motor no devolvió contenido.');

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      parsed = {
        volanta: 'ARQUETIPOS GLOBALES · SIMBOLISMO COMPARADO',
        excerpt: rawText.slice(0, 220) + '...',
        category: 'Arquetipos Globales',
        content: rawText,
        fuentes: '',
        notaControl: ''
      };
    }

    // Si existen fuentes devueltas por separado, las adjuntamos formateadas en lista limpia con viñetas
    let finalContent = (parsed.content || rawText).trim();

    if (parsed.fuentes && !finalContent.includes('## Fuentes')) {
      const fuentesRaw = String(parsed.fuentes).trim();
      let fuentesFormatted = fuentesRaw;
      if (!fuentesRaw.startsWith('*') && !fuentesRaw.startsWith('-')) {
        // Convertir fuentes separadas por comas o saltos en viñetas
        fuentesFormatted = fuentesRaw
          .split(/[\n,]+(?=[A-ZÁÉÍÓÚ][a-z]+,\s*[A-Z]\.)|(?<=\))\s*,\s*/g)
          .map((f: string) => f.trim())
          .filter(Boolean)
          .map((f: string) => `* ${f.replace(/^\*+\s*/, '')}`)
          .join('\n');
      }
      finalContent += `\n\n---\n\n## Fuentes & Lecturas Historiográficas\n\n${fuentesFormatted}`;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      volanta: parsed.volanta || 'ARQUETIPOS GLOBALES · SIMBOLISMO COMPARADO',
      excerpt: parsed.excerpt || (finalContent || '').slice(0, 220) + '...',
      category: parsed.category || 'Arquetipos Globales',
      content: finalContent
    }), { status: 200, headers });

  } catch (errorText: any) {
    console.error('[Error] Fallo en Motor de Arquetipos:', errorText);
    return new Response(JSON.stringify({ error: `Fallo en el Motor de Arquetipos: ${errorText.message}` }), { status: 500, headers });
  }
};
