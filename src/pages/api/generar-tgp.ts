export const prerender = false;

import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';

const CATEGORIAS_TGP = [
  'Historia', 'Antropología', 'Sociología', 'Arqueología', 'Historia Antigua',
  'Historia de las Religiones', 'Deep History', 'Arqueosemiótica', 'Neurognosis',
  'Palimpsesto', 'Convergencias Simbólicas', 'Etnografía', 'Filosofía',
  'Historia Excluida', 'Teorías Alternativas', 'Historiografía', 'Historia de la Cultura',
  'Historia de las Ideas', 'Epistemología', 'Historia Natural', 'Geología',
  'Simbolismo Comparado', 'Análisis del Discurso', 'Hermenéutica', 'Exégesis',
  'Biografías', 'Dossiers', 'Cahiers', 'Ensayos', 'Bitácora'
];

// Carga estática bundled de estilos visuales para compatibilidad total con Cloudflare Workers
const visualStyles = import.meta.glob<{ default: any }>('/src/content/estilos-visuales/*.json', { eager: true });

export const POST: APIRoute = async ({ request, locals }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { titulo, generarImagen, estilo } = body;

    if (!titulo) {
      return new Response(JSON.stringify({ error: 'Falta el título.' }), { status: 400, headers });
    }

    const geminiKey = (locals as any)?.runtime?.env?.GEMINI_API_KEY || (process.env as any)?.GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en las variables de entorno de Cloudflare / servidor.' }), { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // --- BIFURCACIÓN LÓGICA OBLIGATORIA (Ruteo de API) ---
    if (generarImagen) {
      try {
        let finalImagePrompt = '';
        
        // Cargar estilo dinámico desde la colección
        let styleConfig: any = null;
        if (estilo) {
          for (const [pathKey, module] of Object.entries(visualStyles)) {
            if (pathKey.endsWith(`/${estilo}.json`)) {
              styleConfig = (module as any).default || module;
              break;
            }
          }
        }

        if (styleConfig) {
          finalImagePrompt = `${styleConfig.formatoCamara || ''} Subject: ${titulo}. ${styleConfig.iluminacion || ''} ${styleConfig.colorTextura || ''} ${styleConfig.descripcionEstetica || ''}`.trim();
        } else {
          finalImagePrompt = `Cinematic conceptual photography. Subject: ${titulo}. Moody lighting, sharp focus, photorealistic film still.`;
        }

        finalImagePrompt += ' --ar 16:9, panoramic wide shot, landscape orientation';

        // --- PASO A: EL DIRECTOR DE ARTE (Gemini 3.6 Flash) ---
        const responseDirector = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: [{ 
            role: 'user', 
            parts: [{ 
              text: `Actúa como un director de arte. Transforma este concepto en un prompt ultradetallado ensamblado por capas para una imagen cinematográfica de alta calidad. 
              Concepto: ${finalImagePrompt}. 
              Devuelve strictly un JSON con la llave "imagePrompt".` 
            }] 
          }],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const dirText = responseDirector.text;
        if (!dirText) throw new Error('El Director de Arte no devolvió contenido.');
        const dirJson = JSON.parse(dirText);
        const detailedPrompt = dirJson.imagePrompt || finalImagePrompt;

        // --- PASO B: LA MATERIALIZACIÓN (Nano Banana 2: Gemini 3.1 Flash Image Preview) ---
        const responseImagen = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: [{ 
            role: 'user', 
            parts: [{ text: detailedPrompt }] 
          }],
          config: {
            aspectRatio: '16:9'
          } as any,
        });

        const candidate = responseImagen.candidates?.[0];
        const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);

        if (imagePart?.inlineData?.data) {
          const imageUrl = `data:image/jpeg;base64,${imagePart.inlineData.data}`;
          return new Response(JSON.stringify({ 
            success: true, 
            imageUrl, 
            imagePrompt: detailedPrompt 
          }), { status: 200, headers });
        } else {
          return new Response(JSON.stringify({ 
            success: true, 
            imageUrl: null, 
            imagePrompt: detailedPrompt,
            warning: 'El modelo de materialización no devolvió bytes de imagen. Se muestra la dirección de arte.' 
          }), { status: 200, headers });
        }

      } catch (errorImg: any) {
        console.error('[Error] Fallo nativo en Nano Banana 2:', errorImg);
        return new Response(JSON.stringify({ error: `Fallo en el Motor de Arte: ${errorImg.message}` }), { status: 500, headers });
      }
    } else {
      // --- MOTOR DE PENSAMIENTO (Gemini 3.1 Pro Preview con JSON de Excerpt y Categoría) ---
      try {
        const prompt = `Escribe un ensayo profundo sobre: "${titulo}".
Devuelve estrictamente un JSON válido con esta estructura:
{
  "content": "Texto completo del ensayo en Markdown con subtítulos (##, ###). Tono Dark Academia erudito, estilizado y riguroso.\\n\\nREGLAS HISTÓRICAS Y CITAS OBLIGATORIAS:\\n1. FUENTES PRIMARIAS: Intercala testimonios y fuentes históricas originales de los actores o documentos involucrados (ej. citas de Nestorio, Simón el Estilita, San Agustín, Carpócrates, manuscritos o códices antiguos).\\n2. QUOTES LATERALES: Formatea estas fuentes o reflexiones clave como bloques de cita Markdown (> \\\"Cita histórica o testimonio...\\\") intercalados en el cuerpo (hasta 3 citas destacadas).\\n3. RECUADRO DE FUENTES ERUDITAS: Al final del ensayo, incluye de manera obligatoria una sección en recuadro titulada '## Fuentes Eruditas & Referencias Históricas' enumerando las fuentes primarias y bibliografía especializada en itálica soft de la tipografía principal.",
  "excerpt": "Un abstract o sinopsis en forma de cita filosófica e histórica impactante de entre 2 y 4 renglones máximo (tipo quote editorial).",
  "category": "La categoría disciplinar TGP más apropiada elegida únicamente de esta lista: [${CATEGORIAS_TGP.join(', ')}]"
}`;

        const responseTexto = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            systemInstruction: "Eres el motor cognitivo TGP (The Great Puzzle Project). Tu objetivo es producir ensayos de alta erudición e investigación histórica basada en fuentes primarias y testimonios originales de los actores históricos. Todo ensayo debe incluir quotes Markdown (>) con citas textuales originales e incluir al final una sección '## Fuentes Eruditas & Referencias Históricas' en itálica soft. NUNCA declares tu rol ni uses fórmulas autorreferenciales.",
          }
        });

        const rawText = responseTexto.text?.trim() || '';
        if (!rawText) throw new Error('El motor de texto no devolvió contenido.');

        let parsed: any = {};
        try {
          parsed = JSON.parse(rawText);
        } catch (e) {
          parsed = {
            content: rawText,
            excerpt: rawText.slice(0, 220) + '...',
            category: 'Filosofía'
          };
        }

        const content = parsed.content || rawText;
        const excerpt = parsed.excerpt || (content.slice(0, 220) + '...');
        const category = parsed.category || 'Filosofía';

        return new Response(JSON.stringify({ 
          success: true, 
          content, 
          excerpt, 
          category 
        }), { status: 200, headers });

      } catch (errorText: any) {
        console.error('[Error] Fallo nativo en el Motor de Pensamiento:', errorText);
        return new Response(JSON.stringify({ error: `Fallo en el Motor de Pensamiento: ${errorText.message}` }), { status: 500, headers });
      }
    }

  } catch (error: any) {
    console.error('[Error] Fallo fatal en el motor:', error.message);
    return new Response(JSON.stringify({ error: `Error del Sistema: ${error.message}` }), { status: 500, headers });
  }
};
