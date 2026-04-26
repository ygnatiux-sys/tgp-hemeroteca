import 'dotenv/config';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo, calidad } = body;

    if (!titulo) return new Response(JSON.stringify({ error: 'Falta el título.' }), { status: 400, headers });
    
    // Jerarquía de llaves para mayor robustez
    let API_KEY: string | undefined;
    let url: string;

    if (calidad === 'premium') {
      const PREMIUM_KEY = import.meta.env.GEMINI_API_KEY_PREMIUM || process.env.GEMINI_API_KEY_PREMIUM;
      if (!PREMIUM_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY_PREMIUM' }), { status: 500, headers });
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${PREMIUM_KEY}`;
    } else {
      const FREE_KEY = import.meta.env.GEMINI_API_KEY_FREE || process.env.GEMINI_API_KEY_FREE || import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!FREE_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY_FREE' }), { status: 500, headers });
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${FREE_KEY}`;
    }

    const instruccion = 'Eres el motor cognitivo TGP y socio analítico de Xavier Benítez. Tu función es redactar textos orientados al análisis cultural, histórico y filosófico bajo el formato de ensayo argentino contemporáneo. Tono: Dark Academia accesible — preciso, sobrio, agudo. Sin tono casual. Estructura: Apertura con tensión, desarrollo que articule historia/filosofía/simbolismo, y cierre reflexivo universal. Ve directo al núcleo.';

    // Unificamos el payload metiendo la instrucción en el prompt para evitar errores de 'systemInstruction' en v1
    const payload = {
      contents: [{
        parts: [{ text: `${instruccion}\n\nAnaliza y escribe un ensayo profundo sobre el siguiente tema: ${titulo}` }]
      }]
    };

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      throw new Error(data.error?.message || JSON.stringify(data));
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini no devolvió resultados (posible bloqueo de seguridad).');
    }

    const content = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ content, imagePath: null }), { status: 200, headers });

  } catch (error: any) {
    console.error('❌ Error en el motor unificado:', error.message);
    return new Response(JSON.stringify({ error: `Error de Conexión: ${error.message}` }), { status: 500, headers });
  }
};
