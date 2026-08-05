import 'dotenv/config';
import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';

export const prerender = false;

function sanitizeAndParseJson(rawText: string, lugar: string) {
  let clean = rawText.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  try {
    return JSON.parse(clean);
  } catch (err) {
    // Intento de extracción con regex de campos individuales si el JSON está malformado
    const extractField = (fieldName: string) => {
      const match = clean.match(new RegExp(`"${fieldName}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"|\\s*})`));
      return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null;
    };

    const informeMatch = extractField('informeMarkdown');
    const volantaMatch = extractField('volantaHook');
    const excerptMatch = extractField('excerpt');
    const saberMasMatch = extractField('saberMasDato');

    if (informeMatch) {
      return {
        titulosSugeridos: [`${lugar}: Cartografía Arqueosemiótica`, `${lugar}: El Secreto Geohistórico`],
        volantaHook: volantaMatch || `Investigación geohistórica y registro arqueosemiótico sobre ${lugar}.`,
        informeMarkdown: informeMatch,
        excerpt: excerptMatch || `Informe geohistórico y etnográfico sobre ${lugar}.`,
        saberMasDato: saberMasMatch || `Tradición etnográfica local documentada en ${lugar}.`
      };
    }

    // Si todo falla, asegurar que informeMarkdown no sea un JSON crudo
    let pureMarkdown = clean;
    if (pureMarkdown.includes('informeMarkdown":')) {
      const splitPart = pureMarkdown.split('"informeMarkdown":');
      if (splitPart.length > 1) {
        pureMarkdown = splitPart[1].replace(/^\s*"/, '').replace(/"\s*,?\s*"[\w]+":[\s\S]*$/, '').replace(/"\s*}\s*$/, '');
        pureMarkdown = pureMarkdown.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    return {
      titulosSugeridos: [`${lugar}: Cartografía Arqueosemiótica`],
      volantaHook: `Investigación geohistórica y registro arqueosemiótico sobre ${lugar}.`,
      informeMarkdown: pureMarkdown,
      excerpt: `Informe geohistórico y etnográfico sobre ${lugar}.`,
      saberMasDato: `Tradición etnográfica local documentada en ${lugar}.`
    };
  }
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  let body: any = {};

  try {
    body = await request.json().catch(() => ({}));
    const lugar = body?.lugar;

    if (!lugar || typeof lugar !== 'string' || !lugar.trim()) {
      return new Response(JSON.stringify({ error: 'Debes proporcionar un lugar o tema válido para la Georreferencia Arqueosemiótica.' }), { status: 400, headers });
    }

    const API_KEY = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en las variables de entorno del servidor.' }), { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `Actúa como el Investigador Senior y Cartógrafo Epistémico del proyecto TGP (The Great Puzzle Project).
Generá un informe completo, riguroso, erudito y neutral de "Georreferencias Arqueosemióticas" para el lugar o sitio: "${lugar}".

Devolvé ESTRICTAMENTE un JSON válido con esta estructura exacta (sin texto fuera del JSON):
{
  "titulosSugeridos": [
    "Título erudito principal (Ej: ${lugar}: El Códice de la Piedra)",
    "Título alternativo intrigante",
    "Título alternativo analítico"
  ],
  "volantaHook": "Un hook inteligente y conciso de MÁXIMO 1 A 2 RENGLONES (12-22 palabras). Puede ser una pregunta provocadora o subtítulo de alto impacto editorial. Ejemplos: '${lugar}: ¿La Atlántida insular o una anomalía tectónica en el abismo?' o '¿El vestigio de una civilización sumergida antes del diluvio oriental?'",
  "informeMarkdown": "## Georreferencias Arqueosemióticas: [Nombre del Sitio]\\n\\n> [Volanta o Copete de 2 renglones]\\n\\n### 1. Marco Geohistórico & Datos Arqueológicos\\n(Reseña histórica rigurosa y hallazgos arqueológicos documentados por la arqueología y la historiografía científica).\\n\\n### 2. Contexto Geológico & Entorno Natural\\n(Composición de la roca, tectónica, formación geológica, geografía del lugar y singularidades del terreno).\\n\\n### 3. Registro Etnográfico & Población Local\\n(La relación de las comunidades locales actuales, sus vivencias, tradiciones ancestrales y por qué es un sitio conocido o un polo de atracción para el turismo o los pobladores).\\n\\n### 4. Hermenéutica de las Teorías Alternativas\\n(Análisis neutral, equitativo y serio de las hipótesis alternativas, lecturas esotéricas, mitos contemporáneos o portales interdimensionales atribuidos al sitio, abordándolos como objeto de estudio semiótico sin caer en el sensacionalismo ni la burla).\\n\\n### 5. Saber Más: La Historia dentro de la Historia\\n(Un relato, leyenda o dato local poco conocido, hallazgo menor o curiosidad etnográfica no divulgada masivamente, presentado como una micro-narrativa reveladora final).",
  "excerpt": "Un resumen ejecutivo o sinopsis sintética de 2 renglones.",
  "saberMasDato": "El dato desconocido local sintetizado en 2 oraciones."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        systemInstruction: 'Eres el módulo de Georreferencias Arqueosemióticas de TGP. Generas informes geohistóricos multidimensionales con datos precisos, geología, arqueología, etnografía local, tratamiento neutral de teorías alternativas, 3 títulos sugeridos de alto impacto, un H2 volantaHook inteligente de máximo 2 renglones (12-22 palabras) y un dato local no divulgado ("saber más"). Devuelve siempre JSON válido.',
      }
    });

    const rawText = response.text?.trim() || '';
    if (!rawText) throw new Error('Gemini 3.1 Pro no devolvió contenido para la georreferencia.');

    const parsed = sanitizeAndParseJson(rawText, lugar);

    // Asegurar que informeMarkdown sea exclusivamente texto markdown limpio
    let cleanInforme = parsed.informeMarkdown || '';
    if (cleanInforme.trim().startsWith('{') && cleanInforme.includes('informeMarkdown')) {
      const nested = sanitizeAndParseJson(cleanInforme, lugar);
      cleanInforme = nested.informeMarkdown || cleanInforme;
    }

    return new Response(JSON.stringify({
      success: true,
      titulosSugeridos: Array.isArray(parsed.titulosSugeridos) ? parsed.titulosSugeridos : [`${lugar}: El Códice de la Piedra`],
      volantaHook: parsed.volantaHook || '',
      informeMarkdown: cleanInforme,
      excerpt: parsed.excerpt || '',
      saberMasDato: parsed.saberMasDato || ''
    }), { status: 200, headers });

  } catch (error: any) {
    console.warn('[Aviso] Caída o fallo en API Gemini para georreferencias. Usando fallback de contingencia local:', error.message);
    
    // FALLBACK DE CONTINGENCIA ANTE CAÍDAS DE RED/API
    const lugar = body?.lugar || 'Sitio Geohistórico';
    const fallbackResponse = {
      success: true,
      isFallback: true,
      titulosSugeridos: [
        `${lugar}: El Códice Pétreo y Etnografía de la Memoria`,
        `${lugar}: Cartografía Arqueosemiótica Multidimensional`,
        `${lugar}: Entre el Registro Arqueológico y la Hermenéutica Sagrada`
      ],
      volantaHook: `Investigación geohistórica y registro arqueosemiótico sobre ${lugar}.`,
      informeMarkdown: `## Georreferencias Arqueosemióticas: ${lugar}\n\n> Investigación geohistórica y registro arqueosemiótico sobre ${lugar}.\n\n### 1. Marco Geohistórico & Datos Arqueológicos\nEstudio documental y evidencias arqueológicas asociadas al sitio de ${lugar}.\n\n### 2. Contexto Geológico & Entorno Natural\nFormación geológica, composición del terreno y características del paisaje natural en ${lugar}.\n\n### 3. Registro Etnográfico & Población Local\nRelación de las comunidades locales y valor como punto de interés geocultural.\n\n### 4. Hermenéutica de las Teorías Alternativas\nLectura neutral y semiótica de los relatos y mitos asociados a ${lugar}.\n\n### 5. Saber Más: La Historia dentro de la Historia\nDato etnográfico local preservado por los habitantes de las cercanías de ${lugar}.`,
      excerpt: `Estudio geohistórico multidimensional sobre el sitio de ${lugar}.`,
      saberMasDato: `Tradición etnográfica y relatos locales registrados en las cercanías de ${lugar}.`
    };

    return new Response(JSON.stringify(fallbackResponse), { status: 200, headers });
  }
};
