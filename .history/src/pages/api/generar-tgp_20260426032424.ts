import 'dotenv/config';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo, generarImagen } = body;

    if (!titulo) return new Response(JSON.stringify({ error: 'Falta el título.' }), { status: 400, headers });
    
    const API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en el servidor.' }), { status: 500, headers });

    // --- 1. MOTOR DE TEXTO (Gemini 1.5 Pro - Versión Estable 002 para Producción) ---
    // Usamos v1 en lugar de v1beta para máxima estabilidad en cuentas PAYG.
    const urlTexto = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-002:generateContent?key=${API_KEY}`;

    const instruccion = 'Eres el motor cognitivo TGP y socio analítico de Xavier Benítez. Tu función es redactar textos orientados al análisis cultural, histórico y filosófico bajo el formato de ensayo argentino contemporáneo. Tono: Dark Academia accesible — preciso, sobrio, agudo. Sin tono casual. Estructura: Apertura con tensión, desarrollo que articule historia/filosofía/simbolismo, y cierre reflexivo universal. Ve directo al núcleo.';

    const payloadTexto = {
      contents: [{
        parts: [{ text: `${instruccion}\n\nAnaliza y escribe un ensayo profundo sobre el siguiente tema: ${titulo}` }]
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

    // --- 2. MOTOR DE IMAGEN (Imagen 3 - El "Nano Banana 2" oficial) ---
    let imagePath = null;

    if (generarImagen) {
      try {
        // Para generación de imágenes pura en API Google AI, el modelo es imagen-3
        const urlImagen = `https://generativelanguage.googleapis.com/v1/models/imagen-3:predict?key=${API_KEY}`;
        
        const payloadImagen = {
          instances: [{ 
            prompt: `Concept art, Dark Academia aesthetic, philosophical, deep historical symbolism, highly detailed, oil painting texture, moody lighting. Subject: ${titulo}` 
          }],
          parameters: { sampleCount: 1 }
        };

        const apiResponseImagen = await fetch(urlImagen, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadImagen)
        });

        const dataImagen = await apiResponseImagen.json();
        
        if (apiResponseImagen.ok && dataImagen.predictions && dataImagen.predictions.length > 0) {
          imagePath = dataImagen.predictions[0].bytesBase64Encoded || null;
        } else {
          console.warn('Imagen falló o requiere permisos adicionales en Google Cloud.');
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