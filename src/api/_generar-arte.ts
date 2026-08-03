import type { APIRoute } from 'astro';
import {
  resolveIntelligentDirection,
  resolveManualDirection,
  buildDirectorBrief,
  buildFinalImagePrompt,
  generateImageWithGemini,
  adaptLegacyToV2Intelligent,
} from '../lib/arte-tgp';
import type { IntelligentDirectorInput, ManualLabInput, ResolvedArtDirection } from '../lib/arte-tgp/types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const data = await request.json();
    const slug = data.slug || null;

    let resolvedDirection: ResolvedArtDirection | null = null;
    let finalPrompt = data.prompt || '';
    let briefText = '';

    // ==============================================================
    // 1. EVALUACIÓN DE PIPELINE V2 VS V1
    // ==============================================================
    if (data.mode === 'intelligent' && data.intelligentInput) {
      // MODO INTELIGENTE V2
      const input: IntelligentDirectorInput = data.intelligentInput;
      resolvedDirection = resolveIntelligentDirection(input);
      const brief = buildDirectorBrief(resolvedDirection);
      briefText = brief.fullTextBrief;
      finalPrompt = await buildFinalImagePrompt({
        direction: resolvedDirection,
        useLLM: true,
      });
    } else if (data.mode === 'manual' && data.manualInput) {
      // MODO LABORATORIO MANUAL V2
      const input: ManualLabInput = data.manualInput;
      resolvedDirection = resolveManualDirection(input);
      const brief = buildDirectorBrief(resolvedDirection);
      briefText = brief.fullTextBrief;
      finalPrompt = await buildFinalImagePrompt({
        direction: resolvedDirection,
        useLLM: false, // En modo manual se respeta estrictamente la síntesis directa
      });
    } else if (data.style && data.titulo) {
      // MODO LEGACY ADAPTADO A V2
      const intelligentInput = adaptLegacyToV2Intelligent(data.titulo, data.concept || data.titulo, data.style);
      resolvedDirection = resolveIntelligentDirection(intelligentInput);
      const brief = buildDirectorBrief(resolvedDirection);
      briefText = brief.fullTextBrief;
      finalPrompt = await buildFinalImagePrompt({
        direction: resolvedDirection,
        useLLM: true,
      });
    }

    if (!finalPrompt && !resolvedDirection) {
      throw new Error('No se proporcionó un prompt ni configuración de dirección de arte.');
    }

    // ==============================================================
    // 2. FASE 2: MATERIALIZACIÓN DE IMAGEN CON GEMINI
    // ==============================================================
    const aspectRatio = resolvedDirection ? resolvedDirection.providerAspectRatio : '16:9';

    const imageResult = await generateImageWithGemini({
      prompt: finalPrompt,
      aspectRatio,
      slug,
    });

    if (!imageResult.success || !imageResult.image) {
      return new Response(JSON.stringify({
        success: false,
        error: imageResult.error || 'No se pudo generar la imagen.',
        imagePrompt: finalPrompt,
        resolvedDirection,
        brief: briefText,
      }), { status: 500, headers });
    }

    // ==============================================================
    // 3. RESPUESTA EXITOSA (Retrocompatible y enriquecida con V2)
    // ==============================================================
    return new Response(JSON.stringify({
      success: true,
      image: imageResult.image,
      coverImagePath: imageResult.coverImagePath,
      imagePrompt: finalPrompt,
      resolvedDirection,
      brief: briefText,
    }), { status: 200, headers });

  } catch (error: any) {
    console.error('Error en /api/generar-arte:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || String(error),
    }), { status: 500, headers });
  }
};
