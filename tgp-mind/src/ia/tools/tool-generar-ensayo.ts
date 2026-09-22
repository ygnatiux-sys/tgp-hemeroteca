import { registrarResguardoD1 } from '../../storage/d1.js';
import { crearModeloEnsayo, buildDensityInstruction } from '../gemini.js';
import { generarMarkdoc, publicarEntradaKeystaticGitHub } from '../../servicios/publicacion.js';

export const TOOL_GENERAR_ENSAYO = {
  name: 'generar_ensayo',
  description: 'Redacta un ensayo y lo publica en la Hemeroteca (Keystatic/GitHub). Esta tool ya incluye la búsqueda de imágenes y la redacción del contenido.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      tema: {
        type: 'STRING' as const,
        description: 'El tema central del ensayo a generar.',
      },
      longitud: {
        type: 'STRING' as const,
        description: 'La longitud del ensayo.',
        enum: ['breve_1500', 'pro_4500'],
      },
      motor: {
        type: 'STRING' as const,
        description: 'El motor de generación a utilizar.',
        enum: ['flash', 'pro'],
      },
      origen_fotos: {
        type: 'STRING' as const,
        description: 'De dónde obtener las fotos para el ensayo.',
        enum: ['solo_wiki', 'mix_propias_wiki'],
      },
    },
    required: ['tema', 'longitud', 'motor', 'origen_fotos'],
  },
};

export async function ejecutarGenerarEnsayo(args: {
  tema: string;
  longitud: 'breve_1500' | 'pro_4500';
  motor: 'flash' | 'pro';
  origen_fotos: 'solo_wiki' | 'mix_propias_wiki';
  chatId: number;
}): Promise<string> {
  const { tema, longitud, motor, chatId } = args;
  console.log(`[Tool] Ejecutando generar_ensayo: Tema=${tema}, Longitud=${longitud}, Motor=${motor}`);

  // 1. Mapear parámetros a la lógica existente
  const densidad = longitud === 'breve_1500' ? 'profundo_breve' : 'premium';
  const cantSecciones = densidad === 'premium' ? 5 : 3;
  const modeloGemini = motor === 'flash' ? 'gemini-3.8-flash' : 'gemini-3.1-pro-preview';
  const densityInstruction = buildDensityInstruction(densidad, densidad === 'premium');

  // 2. Crear modelo estructurado
  const modelo = crearModeloEnsayo(cantSecciones, modeloGemini);
  
  // 3. Prompt de generación
  const prompt = `Genera un ensayo sobre: "${tema}".
Instrucciones de formato: ${densityInstruction}
Asegúrate de proporcionar búsquedas de Wikimedia en inglés o español precisas para cada sección.`;

  // 4. Generar contenido
  const result = await modelo.generateContent(prompt);
  const textResponse = result.response.text();
  if (!textResponse) throw new Error("Gemini no devolvió texto.");
  
  let ensayoJSON: any;
  try {
    ensayoJSON = JSON.parse(textResponse);
  } catch (e) {
    throw new Error("No se pudo parsear el JSON generado por Gemini.");
  }

  // 5. Respaldar en D1 (Persistencia por defecto) antes de publicar
  await registrarResguardoD1({
    origen: 'telegram-hemeroteca',
    destino: 'hemeroteca',
    tema: ensayoJSON.titulo || tema,
    textoGenerado: JSON.stringify(ensayoJSON, null, 2),
    chatId: chatId,
  });

  // 6. Generar markdoc
  const { slug, contenidoMdoc } = generarMarkdoc(ensayoJSON);
  const indexJson = { titulo: ensayoJSON.titulo, secciones: cantSecciones };

  // 7. Publicar en GitHub
  const urlCommit = await publicarEntradaKeystaticGitHub({
    slug,
    indexJson,
    contentMdoc: contenidoMdoc,
    token: process.env.GITHUB_TOKEN || '',
    repoFull: process.env.GITHUB_REPO || 'ygnatiux-sys/tgp-hemeroteca',
  });

  return `Ensayo "${ensayoJSON.titulo}" generado exitosamente.\n🔗 Commit: ${urlCommit}`;
}
