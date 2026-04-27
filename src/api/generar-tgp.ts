import 'dotenv/config';
import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo, generarImagen, atmosfera } = body;

    if (!titulo) return new Response(JSON.stringify({ error: 'Falta el título.' }), { status: 400, headers });
    
    const API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en el servidor.' }), { status: 500, headers });

    // Inicializamos el nuevo SDK unificado (v1.0+)
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // --- BIFURCACIÓN LÓGICA OBLIGATORIA (Ruteo de API) ---
    if (generarImagen) {
      try {
        const stylePrompt = "Hyper-realistic photography, 8k resolution, cinematic lighting, highly detailed, photorealistic. NO illustration, NO cartoon, NO painting. ";
        let specificPrompt = "";
        
        if (atmosfera === 'museo') specificPrompt = "Museum artifact display, dramatic spotlight, dark background, sharp focus. ";
        else if (atmosfera === 'ruinas') specificPrompt = "Ancient historical ruins, golden hour, sun flare, weathered textures, atmospheric depth. ";
        else if (atmosfera === 'amanecer') specificPrompt = "Historical epic scene, dawn lighting, heavy mist, hyper-realistic, volumetric fog. ";
        else specificPrompt = "Cinematic conceptual art, deep symbolism, dramatic composition. ";

        const finalImagePrompt = stylePrompt + specificPrompt + "Subject: " + titulo;

        // Llamada al nuevo método especializado de generación de imágenes
        const response = await ai.models.generateImages({
          model: 'gemini-3.1-flash-image-preview',
          prompt: finalImagePrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '16:9'
          },
        });

        if (response.generatedImages?.[0]?.image?.imageBytes) {
          const base64Image = response.generatedImages[0].image.imageBytes;
          const imageUrl = `data:image/jpeg;base64,${base64Image}`;
          
          return new Response(JSON.stringify({ 
            success: true, 
            imageUrl, 
            imagePrompt: finalImagePrompt 
          }), { status: 200, headers });
        } else {
          throw new Error('El motor Nano Banana 2 no devolvió bytes de imagen válidos.');
        }

      } catch (errorImg: any) {
        console.error('⚠️ Error en Nano Banana 2:', errorImg.message);
        return new Response(JSON.stringify({ error: `Fallo en Nano Banana 2: ${errorImg.message}` }), { status: 500, headers });
      }
    } else {
      // --- MOTOR DE TEXTO (Gemini 1.5 Flash Latest) ---
      try {
        const responseTexto = await ai.models.generateContent({
          model: "gemini-1.5-flash-latest",
          systemInstruction: "Eres el motor cognitivo TGP y socio analítico de Xavier Benítez. Regla estricta: Identidad implícita. NUNCA declares tu rol, ni menciones 'Análisis Cognitivo', ni uses fórmulas autorreferenciales. Escribe directamente el ensayo de forma profunda. Tono: Dark Academia accesible — preciso, sobrio, agudo. Sin tono casual. Estructura: Apertura con tensión, desarrollo que articule historia/filosofía/simbolismo, y cierre reflexivo universal. Ve directo al núcleo.",
          contents: [{ role: 'user', parts: [{ text: `Escribe un ensayo profundo sobre: ${titulo}` }] }]
        });

        const content = responseTexto.text();

        return new Response(JSON.stringify({ success: true, content }), { status: 200, headers });
      } catch (errorText: any) {
        console.error('⚠️ Error en el motor de texto:', errorText.message);
        return new Response(JSON.stringify({ error: `Fallo en el motor de texto: ${errorText.message}` }), { status: 500, headers });
      }
    }

  } catch (error: any) {
    console.error('❌ Error fatal en el motor:', error.message);
    return new Response(JSON.stringify({ error: `Error del Sistema: ${error.message}` }), { status: 500, headers });
  }
};