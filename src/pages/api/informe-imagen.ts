/**
 * src/pages/api/informe-imagen.ts
 * 
 * Endpoint SSR para Análisis Multimodal de Imágenes con Gemini Vision.
 * Permite dos modos:
 *  - 'flash': Triage ágil (<2s), identificación, atmósfera y colección TGP (gemini-2.5-flash).
 *  - 'pro'  : Dossier erudito (5-10s), estratigrafía, hermenéutica y ficha editorial para D1 (gemini-3.1-pro-preview).
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { imageBase64, mimeType = 'image/jpeg', modo = 'flash', nombreArchivo = '' } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Falta la imagen en Base64 o el formato es inválido.' }), {
        status: 400,
        headers: HEADERS,
      });
    }

    // Limpiar data-URI si viene con prefijo (data:image/...;base64,XXXX)
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const env = (locals as any)?.runtime?.env;
    const API_KEY = env?.GEMINI_API_KEY || (process.env as any)?.GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en las variables de entorno.' }), {
        status: 500,
        headers: HEADERS,
      });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const isPro = modo === 'pro';

    // ── Instrucciones y modelo según el modo seleccionado ──────────────────────
    const systemInstruction = isPro
      ? `Eres el Arqueosemiólogo y Curador Jefe de The Great Puzzle Project (TGP Hemeroteca). 
Tu tarea es analizar visualmente la imagen proporcionada y generar un Dossier Erudito de Alta Densidad Cognitiva.
Debes estructurar tu respuesta en Markdown limpio, riguroso y literario con las siguientes 4 secciones obligatorias:

### 1. 🏛️ Identificación & Análisis Iconográfico
Describe minuciosamente la obra, artefacto o escena. Identifica la cultura, fecha probable, procedencia y los sujetos u objetos que componen el plano visual.

### 2. 🔬 Estratigrafía Visual, Técnica & Materialidad
Analiza el soporte físico (fresco, mármol, bronce, papiro, óleo), los pigmentos o materiales visibles, la técnica de ejecución y los signos de desgaste, erosión o restauración histórica.

### 3. 📜 Hermenéutica Simbólica & Paralelos Comparados
Interpreta el significado esotérico, ritual, político o mitológico de la imagen. Conéctala con arquetipos universales o paralelismos en otras civilizaciones si aplica.

### 4. ✍️ Ficha Editorial TGP (Para D1 & Keystatic)
- **Titular H1 Sugerido:** (Un título literario, memorable y monumental)
- **Subtítulo / Dek:** (Una frase condensada de alto impacto)
- **Excerpt Editorial:** (Un párrafo narrativo de 40 a 60 palabras listo para publicación)
- **Colección Sugerida:** (Elige una: Liminal, Heterodoxia, Anomalías, Apócrifa, Arqueología Secreta, Historia)
- **Tags para D1:** (5 a 8 etiquetas separadas por comas)

Usa un tono riguroso, poético y erudito, sin lugares comunes ni muletillas de IA.`
      : `Eres el Asistente de Triage Visual de TGP Hemeroteca.
Tu tarea es analizar rápidamente la imagen proporcionada y entregar una ficha técnica concisa, telegráfica y precisa en Markdown con exactamente 4 puntos:

- **Sujeto / Obra:** (Qué o quién aparece en la imagen)
- **Cultura & Época:** (Período histórico y procedencia estimada)
- **Atmósfera & Cromatismo:** (3 colores dominantes con su vibra visual y textura)
- **Colección TGP Recomendada:** (Asigna una: Liminal, Heterodoxia, Anomalías, Apócrifa, Arqueología Secreta o Historia)

Sé breve, directo y sin introducciones ni despedidas innecesarias.`;

    const userPrompt = `Analiza detalladamente esta imagen${nombreArchivo ? ` (Archivo: "${nombreArchivo}")` : ''}. Modo: ${isPro ? 'PRO (Dossier Erudito)' : 'FLASH (Síntesis Rápida)'}.`;

    // Selección de modelo con fallback resiliente
    const primaryModel = isPro ? 'gemini-3.1-pro-preview' : 'gemini-2.5-flash';
    const fallbackModel = isPro ? 'gemini-2.5-pro' : 'gemini-1.5-flash';

    let informeText = '';

    try {
      const response = await ai.models.generateContent({
        model: primaryModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: userPrompt },
            ],
          },
        ],
        config: {
          temperature: isPro ? 0.3 : 0.2,
          systemInstruction,
        },
      });

      informeText = response.text?.trim() || '';
    } catch (primaryErr: any) {
      console.warn(`[TGP Informe] Fallo en modelo primario (${primaryModel}):`, primaryErr?.message, `Intentando fallback con ${fallbackModel}...`);
      
      const responseFallback = await ai.models.generateContent({
        model: fallbackModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: userPrompt },
            ],
          },
        ],
        config: {
          temperature: isPro ? 0.3 : 0.2,
          systemInstruction,
        },
      });

      informeText = responseFallback.text?.trim() || '';
    }

    if (!informeText) {
      throw new Error('El modelo de Gemini no devolvió texto de análisis.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        modo,
        modelo: primaryModel,
        informe: informeText,
      }),
      { status: 200, headers: HEADERS }
    );
  } catch (err: any) {
    console.error('❌ Error en /api/informe-imagen:', err);
    return new Response(
      JSON.stringify({
        error: err?.message || 'Error interno al procesar el informe visual con IA.',
      }),
      { status: 500, headers: HEADERS }
    );
  }
};
