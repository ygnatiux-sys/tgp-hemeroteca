import { GoogleGenAI, Type } from '@google/genai';
import type { TgpTool } from '../agents/types.js';

export const wikimediaTool: TgpTool = {
  name: 'search_wikimedia_photo',
  description: 'Busca una fotografía real de alta calidad en Wikimedia Commons. Útil para temas geográficos, antropológicos o arqueológicos.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Término de búsqueda natural o ambiguo (ej. "Pirámides de Bosnia", "Augusto César").',
      },
    },
    required: ['query'],
  },
  execute: async (args: Record<string, any>) => {
    const rawQuery = args.query;
    if (!rawQuery) throw new Error('Falta el query para Wikimedia.');

    const env = process.env as any;
    const apiKey = env.GEMINI_API_KEY;

    // 1. Flash Archivist Router: Traducir query natural a query de Wikimedia (opcional)
    let advancedQuery = rawQuery;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Eres un experto archivista de Wikimedia Commons.
El usuario busca una imagen sobre: "${rawQuery}".
Tu trabajo es construir la 'query' perfecta de búsqueda para la API de Wikimedia.
Usa sintaxis avanzada como "incategory:" o exclusiones "-incategory:" si el tema es propenso a arrojar basura (ej. para sitios arqueológicos excluye mapas o diagramas).
Responde ÚNICAMENTE con el string de búsqueda. Ejemplo: "Visočica hill" incategory:"Visočica (hill in Visoko)" -incategory:"Diagrams"`;

        const flashRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        if (flashRes.text) {
          advancedQuery = flashRes.text.trim().replace(/^["']|["']$/g, '');
        }
      } catch (e) {
        console.warn('[WikimediaTool] Flash falló, usando fallback crudo.', e);
      }
    }

    // 2. Ejecutar la búsqueda en Commons
    // Limitamos a 5 resultados para no sobrecargar el payload
    const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      advancedQuery
    )}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription&format=json&origin=*`;

    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'TGPMind/2.0 (contact@thegreatpuzzleproject.com)',
      },
    });

    if (!res.ok) throw new Error(`Error en Wikimedia Commons API: ${res.status}`);
    const data = await res.json();

    if (!data.query || !data.query.pages) {
      return { success: false, message: 'No se encontraron imágenes para esta búsqueda.' };
    }

    // 3. Formatear y devolver
    const items = Object.values(data.query.pages).map((p: any) => {
      const info = p.imageinfo?.[0] || {};
      const meta = info.extmetadata || {};
      return {
        title: p.title,
        url: info.url,
        license: meta.LicenseShortName?.value,
        author: meta.Artist?.value,
      };
    });

    return {
      success: true,
      originalQuery: rawQuery,
      advancedQuery,
      results: items
    };
  }
};

