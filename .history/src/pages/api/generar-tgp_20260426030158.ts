import 'dotenv/config';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo, generarImagen } = body; // Eliminamos "calidad"

    if (!titulo) return new Response(JSON.stringify({ error: 'Falta el título.' }), { status: 400, headers });
    
    // Solo usamos una llave maestra (Asegúrate de que en tu .env se llame GEMINI_API_KEY y sea la de Pospago)
    const API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en el servidor.' }), { status: 500, headers });

    // --- 1. MOTOR DE TEXTO (Versión v1 Estable - 1.5 Pro) ---
    const urlTexto = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;

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
      throw new Error(dataTexto.error?.message || JSON.stringify(dataTexto));
    }

    const content = dataTexto.candidates[0].content.parts[0].text;

    // --- 2. MOTOR DE IMAGEN (Gemini 3 Flash Image / Nano Banana 2) ---
    let imagePath = null;

    if (generarImagen) {
      try {
        const urlImagen = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-image:predict?key=${API_KEY}`;
        
        const payloadImagen = {
          instances: [{ prompt: `Concept art, Dark Academia aesthetic, philosophical, deep historical symbolism, highly detailed. Subject: ${titulo}` }],
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
          console.warn('Imagen falló silente. Guardando solo texto.');
        }
      } catch (errorImg) {
        console.warn('Fallo en el fetch de la imagen:', errorImg);
      }
    }

    // --- 3. RESPUESTA FINAL ---
    return new Response(JSON.stringify({ content, imagePath }), { status: 200, headers });

  } catch (error: any) {
    console.error('❌ Error en el motor:', error.message);
    return new Response(JSON.stringify({ error: `Error del Sistema: ${error.message}` }), { status: 500, headers });
  }
};