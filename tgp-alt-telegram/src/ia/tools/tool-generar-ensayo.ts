import { registrarResguardoD1 } from '../../storage/d1.js';
import { crearModeloEnsayo, buildDensityInstruction } from '../gemini.js';
import { generarMarkdoc, publicarEntradaKeystaticGitHub } from '../../servicios/publicacion.js';
import { procesarImagen } from '../../vision/wikimedia.js';

// ── SCHEMA DE LA TOOL ─────────────────────────────────────────────────────────
// FIX: origen_fotos removido de 'required'. Gemini puede no pasarlo si el
// usuario dijo "solowiki" en la ficha en lugar de "solo_wiki" (typo). Se hace
// el mapeo seguro internamente en ejecutarGenerarEnsayo.
export const TOOL_GENERAR_ENSAYO = {
  name: 'generar_ensayo',
  description: 'Redacta un ensayo cinemático con imágenes de Wikimedia y lo publica en la Hemeroteca TGP (Keystatic/GitHub). Incluye la búsqueda de imágenes, redacción y commit atómico.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      tema: {
        type: 'STRING' as const,
        description: 'El tema central del ensayo a generar (nombre del sujeto, evento histórico, concepto filosófico, etc.).',
      },
      longitud: {
        type: 'STRING' as const,
        description: 'Extensión del ensayo. "breve_1500" ≈ 3 secciones (~1500 palabras). "pro_4500" ≈ 5 secciones (~4500 palabras).',
        enum: ['breve_1500', 'pro_4500'],
      },
      motor: {
        type: 'STRING' as const,
        description: 'Motor de generación. "flash" = gemini-3.8-flash (rápido). "pro" = gemini-3.1-pro-preview (denso, analítico).',
        enum: ['flash', 'pro'],
      },
      origen_fotos: {
        type: 'STRING' as const,
        description: 'Fuente de imágenes para el ensayo. Usa "solo_wiki" para imágenes de Wikimedia Commons, o "mix_propias_wiki" si el usuario ya envió una foto por Telegram.',
        enum: ['solo_wiki', 'mix_propias_wiki'],
      },
    },
    required: ['tema', 'longitud', 'motor'],
  },
};

// ── Normaliza enum values que Gemini puede confundir ──────────────────────────
function normalizarOrigenFotos(raw?: string): 'solo_wiki' | 'mix_propias_wiki' {
  if (!raw) return 'solo_wiki';
  const clean = raw.toLowerCase().replace(/[^a-z_]/g, '');
  if (clean.includes('mix') || clean.includes('propias')) return 'mix_propias_wiki';
  return 'solo_wiki';
}

function normalizarLongitud(raw?: string): 'breve_1500' | 'pro_4500' {
  if (!raw) return 'breve_1500';
  const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (clean.includes('pro') || clean.includes('4500') || clean.includes('premium')) return 'pro_4500';
  return 'breve_1500';
}

function normalizarMotor(raw?: string): 'flash' | 'pro' {
  if (!raw) return 'flash';
  const clean = raw.toLowerCase();
  if (clean.includes('pro')) return 'pro';
  return 'flash';
}

// ── Ejecución principal ───────────────────────────────────────────────────────
export async function ejecutarGenerarEnsayo(args: {
  tema: string;
  longitud?: string;
  motor?: string;
  origen_fotos?: string;
  chatId: number;
  telegramToken?: string;
}): Promise<string> {
  const { tema, chatId } = args;

  // Mapeo tolerante de enums (Gemini puede generar "solowiki" en lugar de "solo_wiki")
  const longitud    = normalizarLongitud(args.longitud);
  const motor       = normalizarMotor(args.motor);
  const origenFotos = normalizarOrigenFotos(args.origen_fotos);

  console.log(`[Tool:generar_ensayo] START tema="${tema}" longitud="${longitud}" motor="${motor}" origenFotos="${origenFotos}" chatId=${chatId}`);

  try {
    // PASO 1 — Mapeo de parámetros a la lógica interna
    const densidad      = longitud === 'pro_4500' ? 'premium' : 'profundo_breve';
    const cantSecciones = densidad === 'premium' ? 5 : 3;
    const modeloGemini  = motor === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
    const densityInstruction = buildDensityInstruction(densidad, densidad === 'premium');

    console.log(`[Tool:generar_ensayo] Paso 1 OK — densidad=${densidad} secciones=${cantSecciones} modelo=${modeloGemini}`);

    // PASO 2 — Crear modelo con Structured Output
    const modelo = crearModeloEnsayo(cantSecciones, modeloGemini);

    // PASO 3 — Prompt de generación
    const prompt = `Genera un ensayo cinemático sobre: "${tema}".
Instrucciones de formato: ${densityInstruction || 'Profundo breve, 3 secciones con subtítulos ## Markdown.'}
Para cada sección, incluye una búsqueda de Wikimedia precisa en inglés o español.`;

    console.log(`[Tool:generar_ensayo] Paso 3 — llamando a Gemini (${modeloGemini})...`);

    // PASO 4 — Generar contenido
    const result = await modelo.generateContent(prompt);
    const textResponse = result.response.text();
    if (!textResponse) throw new Error('Gemini devolvió una respuesta vacía al generar el ensayo.');

    console.log(`[Tool:generar_ensayo] Paso 4 OK — respuesta de ${textResponse.length} chars`);

    // PASO 5 — Parsear JSON estructurado
    let ensayoJSON: { titulo: string; secciones: Array<{ busqueda_wikimedia?: string; imagen_url?: string; parrafo: string }> };
    try {
      ensayoJSON = JSON.parse(textResponse);
    } catch (parseErr: any) {
      console.error('[Tool:generar_ensayo] ERROR parseando JSON:', textResponse.slice(0, 500));
      throw new Error(`JSON malformado en respuesta de Gemini: ${parseErr.message}`);
    }

    if (!ensayoJSON.titulo || !Array.isArray(ensayoJSON.secciones)) {
      throw new Error(`Estructura JSON inválida: falta "titulo" o "secciones". Recibido: ${JSON.stringify(Object.keys(ensayoJSON))}`);
    }

    console.log(`[Tool:generar_ensayo] Paso 5 OK — título: "${ensayoJSON.titulo}" (${ensayoJSON.secciones.length} secciones)`);

    // PASO 6 — Buscar e inyectar imágenes en Wikimedia / R2
    if (origenFotos === 'solo_wiki' || origenFotos === 'mix_propias_wiki') {
      console.log(`[Tool:generar_ensayo] Paso 6 — Buscando imágenes en Wikimedia y subiendo a R2 (origen=${origenFotos})...`);
      for (let i = 0; i < ensayoJSON.secciones.length; i++) {
        const seccion = ensayoJSON.secciones[i];
        if (!seccion.imagen_url) {
          const termino = seccion.busqueda_wikimedia || (i === 0 ? tema : `${tema} ${i + 1}`);
          try {
            console.log(`[Tool:generar_ensayo] Buscando imagen para sección ${i + 1}: "${termino}"`);
            const r2Url = await procesarImagen(termino);
            if (r2Url) {
              seccion.imagen_url = r2Url;
              console.log(`[Tool:generar_ensayo] ✓ Sección ${i + 1} imagen asignada: ${r2Url}`);
            } else {
              console.warn(`[Tool:generar_ensayo] Sin imagen verificada para sección ${i + 1} ("${termino}")`);
            }
          } catch (imgErr: any) {
            console.warn(`[Tool:generar_ensayo] Error buscando imagen para sección ${i + 1}:`, imgErr.message);
          }
        }
      }

      // Garantía de Portada: Si la primera sección no obtuvo imagen, buscar directamente con el tema general
      if (!ensayoJSON.secciones[0]?.imagen_url) {
        console.log(`[Tool:generar_ensayo] Portada vacía. Buscando fallback con tema principal: "${tema}"...`);
        try {
          const portadaFallback = await procesarImagen(tema);
          if (portadaFallback && ensayoJSON.secciones[0]) {
            ensayoJSON.secciones[0].imagen_url = portadaFallback;
            console.log(`[Tool:generar_ensayo] ✓ Portada asignada via fallback: ${portadaFallback}`);
          }
        } catch (err: any) {
          console.warn(`[Tool:generar_ensayo] Fallback de portada fallido:`, err.message);
        }
      }
    }

    const coverUrl = ensayoJSON.secciones?.[0]?.imagen_url || '';
    const primerParrafo = ensayoJSON.secciones?.[0]?.parrafo || '';
    const excerpt = primerParrafo ? primerParrafo.slice(0, 180) + '...' : '';
    const dek = primerParrafo ? primerParrafo.slice(0, 110) + '...' : '';
    const fechaHoy = new Date().toISOString().split('T')[0];

    // PASO 7 — Resguardo obligatorio en D1 antes de publicar
    console.log('[Tool:generar_ensayo] Paso 7 — Guardando en D1...');
    await registrarResguardoD1({
      origen: 'telegram-omni',
      destino: 'hemeroteca',
      tema: ensayoJSON.titulo || tema,
      textoGenerado: JSON.stringify(ensayoJSON, null, 2),
      metadatos: { titulo: ensayoJSON.titulo, coverImage: coverUrl },
      imagenR2Url: coverUrl,
      chatId: chatId,
    });

    // PASO 8 — Generar Markdoc y Estructura Keystatic index.json
    const { slug, contenidoMdoc } = generarMarkdoc(ensayoJSON);
    const indexJson = {
      title: ensayoJSON.titulo,
      generadorTexto: JSON.stringify({ text: contenidoMdoc, image: coverUrl }),
      atmosfera: { discriminant: 'obsidiana' },
      gallery: [],
      dek,
      coverImage: coverUrl,
      date: fechaHoy,
      excerpt,
    };

    console.log(`[Tool:generar_ensayo] Paso 8 OK — slug: "${slug}" coverImage: "${coverUrl}"`);

    // PASO 9 — Publicar en GitHub via Keystatic
    const githubToken = process.env.GITHUB_TOKEN_HEMEROTECA || process.env.GITHUB_TOKEN || '';
    const githubRepo  = process.env.GITHUB_REPO_HEMEROTECA || process.env.GITHUB_REPO || 'ygnatiux-sys/tgp-hemeroteca';

    if (!githubToken) throw new Error('GITHUB_TOKEN no configurado en las variables de entorno.');

    console.log(`[Tool:generar_ensayo] Paso 9 — Publicando en GitHub (${githubRepo})...`);

    const urlCommit = await publicarEntradaKeystaticGitHub({
      slug,
      indexJson,
      contentMdoc: contenidoMdoc,
      token: githubToken,
      repoFull: githubRepo,
    });

    const urlWeb = `https://thegreatpuzzleproject.com/ensayos-cinematicos/${slug}`;
    console.log(`[Tool:generar_ensayo] ÉXITO — "${ensayoJSON.titulo}" publicado: ${urlCommit}`);

    let respuestaFinal = `Ensayo **"${ensayoJSON.titulo}"** publicado en la Hemeroteca.\n\n`;
    if (coverUrl) {
      respuestaFinal += `🖼️ **Imagen de Cabecera:** ${coverUrl}\n\n`;
    }
    respuestaFinal += `🌐 Ver en la Web:\n${urlWeb}\n\n📦 Commit en GitHub:\n${urlCommit}`;

    return respuestaFinal;

  } catch (err: any) {
    // Log detallado del crash real (visible en Cloud Run logs)
    console.error(`[Tool:generar_ensayo] CRASH — tema="${tema}" longitud="${args.longitud}" motor="${args.motor}" origen="${args.origen_fotos}"`);
    console.error('[Tool:generar_ensayo] ERROR STACK:', err?.stack || err?.message || String(err));
    // Re-lanzar con mensaje descriptivo para que el agent.ts lo capture
    throw new Error(`Error en generar_ensayo: ${err?.message || 'Error desconocido'}. Args recibidos: longitud=${args.longitud}, motor=${args.motor}, origen_fotos=${args.origen_fotos}`);
  }
}
