import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const promptFinal = data.prompt || '';

    // Obtención segura de variables en cualquier entorno
    let apiKey = import.meta.env.GEMINI_API_KEY;
    if (!apiKey && typeof process !== 'undefined' && process.env) {
      apiKey = process.env.GEMINI_API_KEY;
    }

    if (!apiKey) {
      throw new Error("No se encontró GEMINI_API_KEY en el servidor.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ 
        role: 'user', 
        parts: [{ text: promptFinal }] 
      }],
      config: {
        aspectRatio: '16:9'
      } as any,
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
    const base64Image = imagePart?.inlineData?.data;
    
    if (!base64Image) {
      throw new Error("La API no devolvió bytes de imagen.");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      image: `data:image/jpeg;base64,${base64Image}` 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("Error en la API de Google:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || String(error)
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
