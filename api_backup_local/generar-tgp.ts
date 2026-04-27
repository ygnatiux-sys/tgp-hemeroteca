import 'dotenv/config';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo, generarImagen, atmosfera } = body;

    if (!titulo) return new Response(JSON.stringify({ error: 'Falta el título.' }), { status: 400, headers });
    
    const API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en el servidor.' }), { status: 500, headers });

    // --- 1. MOTOR DE TEXTO (Gemini 3.1 Flash Image Preview) ---
    const urlTexto = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${API_KEY}`;

    const payloadTexto = {
      systemInstruction: {
        parts: [{ text: "Eres el motor cognitivo TGP y socio analítico de Xavier Benítez. Regla estricta: Identidad implícita. NUNCA declares tu rol, ni menciones 'Análisis Cognitivo', ni uses fórmulas autorreferenciales. Escribe directamente el ensayo de forma profunda. Tono: Dark Academia accesible — preciso, sobrio, agudo. Sin tono casual. Estructura: Apertura con tensión, desarrollo que articule historia/filosofía/simbolismo, y cierre reflexivo universal. Ve directo al núcleo." }]
      },
      contents: [{
        parts: [{ text: `Escribe un ensayo profundo sobre: ${titulo}` }]
      }]
    };

    const apiResponseTexto = await fetch(urlTexto, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadTexto)
    });

    const dataTexto = await apiResponseTexto.json();

    if (!apiResponseTexto.ok) {
      throw new Error(dataTexto.error?.message || 'Error en la generación de texto');
    }

    const content = dataTexto.candidates[0].content.parts[0].text;

    // --- 2. MOTOR DE IMAGEN (Nano Banana 2 - Gemini 3.1 Flash Image Preview) ---
    let imagePath = null;

    if (generarImagen) {
      try {
        const stylePrompt = "Hyper-realistic photography, 8k resolution, cinematic lighting, highly detailed, photorealistic. NO illustration, NO cartoon, NO painting. ";
        let specificPrompt = "";
        
        if (atmosfera === 'museo') {
          specificPrompt = "Museum artifact display, dramatic spotlight, dark background, sharp focus. ";
        } else if (atmosfera === 'ruinas') {
          specificPrompt = "Ancient historical ruins, golden hour, sun flare, weathered textures, atmospheric depth. ";
        } else if (atmosfera === 'amanecer') {
          specificPrompt = "Historical epic scene, dawn lighting, heavy mist, hyper-realistic, volumetric fog. ";
        } else {
          specificPrompt = "Cinematic conceptual art, deep symbolism, dramatic composition. ";
        }

        const finalImagePrompt = stylePrompt + specificPrompt + "Subject: " + titulo;

        // --- Intento 1: gemini-3.1-flash-image-preview (:generateContent) ---
        const urlImagen1 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${API_KEY}`;
        const payloadImagen1 = {
          contents: [{ parts: [{ text: finalImagePrompt }] }]
        };

        const apiResponse1 = await fetch(urlImagen1, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadImagen1)
        });

        const data1 = await apiResponse1.json();
        
        if (apiResponse1.ok && data1.candidates?.[0]?.content?.parts) {
          const imagePart = data1.candidates[0].content.parts.find((p: any) => p.inlineData);
          if (imagePart) {
            imagePath = `data:image/jpeg;base64,${imagePart.inlineData.data}`;
          }
        }

        // --- PLAN B: Fallback a imagen-3.0-generate-001 (:predict) ---
        if (!imagePath) {
          console.warn('⚠️ Intento 1 falló o no devolvió imagen. Iniciando Plan B (Imagen 3.0)...');
          const urlImagen2 = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${API_KEY}`;
          const payloadImagen2 = {
            instances: [{ prompt: finalImagePrompt }],
            parameters: { sampleCount: 1 }
          };

          const apiResponse2 = await fetch(urlImagen2, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadImagen2)
          });

          const data2 = await apiResponse2.json();

          if (apiResponse2.ok && data2.predictions?.[0]?.bytesBase64Encoded) {
            imagePath = `data:image/jpeg;base64,${data2.predictions[0].bytesBase64Encoded}`;
            console.log('✅ Plan B exitoso.');
          } else {
            console.error('❌ Plan B también falló:', data2.error || 'Respuesta vacía');
          }
        }
      } catch (errorImg) {
        console.warn('Fallo en el fetch de la imagen:', errorImg);
      }
    }

    return new Response(JSON.stringify({ content, imagePath }), { status: 200, headers });

  } catch (error: any) {
    console.error('❌ Error en el motor:', error.message);
    return new Response(JSON.stringify({ error: `Error del Sistema: ${error.message}` }), { status: 500, headers });
  }
};