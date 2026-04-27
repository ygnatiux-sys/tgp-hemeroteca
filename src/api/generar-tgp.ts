import 'dotenv/config';
import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo, generarImagen, estilo } = body;

    if (!titulo) return new Response(JSON.stringify({ error: 'Falta el título.' }), { status: 400, headers });
    
    const API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en el servidor.' }), { status: 500, headers });

    // Inicializamos el nuevo SDK unificado (v1.0+)
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // --- BIFURCACIÓN LÓGICA OBLIGATORIA (Ruteo de API) ---
    if (generarImagen) {
      try {
        let finalImagePrompt = "";
        
        // Cargar estilo dinámico desde la colección direccionArte
        const stylePath = path.join(process.cwd(), 'src', 'content', 'estilos-visuales', `${estilo}.json`);
        
        let styleConfig;
        if (fs.existsSync(stylePath)) {
          const fileContent = fs.readFileSync(stylePath, 'utf-8');
          styleConfig = JSON.parse(fileContent);
          
          // Ensamblaje de Micro-Dirección
          finalImagePrompt = `${styleConfig.formatoCamara} Subject: ${titulo}. ${styleConfig.iluminacion} ${styleConfig.colorTextura} ${styleConfig.descripcionEstetica}`;
        } else {
          // Fallback por si el estilo no existe o es una atmósfera antigua
          finalImagePrompt = `Cinematic conceptual photography. Subject: ${titulo}. Moody lighting, sharp focus, photorealistic film still.`;
        }

        // Inyectamos instrucción de formato 16:9 explícita
        finalImagePrompt += " --ar 16:9, panoramic wide shot, landscape orientation";

        // Usamos generateContent para Nano Banana 2 (basado en el soporte del modelo)
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: [{ role: 'user', parts: [{ text: finalImagePrompt }] }],
          config: {
            responseMimeType: 'image/jpeg',
            aspectRatio: '16:9'
          },
        });

        const candidate = response.candidates?.[0];
        const imagePart = candidate?.content?.parts?.find(p => p.inlineData);

        if (imagePart?.inlineData?.data) {
          const base64Image = imagePart.inlineData.data;
          const imageUrl = `data:image/jpeg;base64,${base64Image}`;
          
          return new Response(JSON.stringify({ 
            success: true, 
            imageUrl, 
            imagePrompt: finalImagePrompt 
          }), { status: 200, headers });
        } else {
          throw new Error('El motor Nano Banana 2 no devolvió bytes de imagen válidos o la cuota está agotada.');
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
          contents: [{ role: 'user', parts: [{ text: `Escribe un ensayo profundo sobre: ${titulo}` }] }],
          config: {
            systemInstruction: "Eres el motor cognitivo TGP. Tu objetivo es producir ensayos de alta profundidad filosófica y análisis cultural agudo. Regla estricta: Identidad implícita. NUNCA declares tu rol ni uses fórmulas autorreferenciales. Escribe directamente el ensayo. Tono: Dark Academia — preciso, sobrio, erudito pero accesible. Estructura: Apertura con tensión intelectual, desarrollo articulando historia/filosofía/simbolismo, y cierre reflexivo universal. Ve directo al núcleo del análisis cultural.",
          }
        });

        const content = responseTexto.text;
        if (!content) throw new Error("El motor de texto no devolvió contenido.");

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