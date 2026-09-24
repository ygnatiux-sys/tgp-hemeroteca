import { GoogleGenAI, Type } from '@google/genai';
import type { TgpTool } from '../agents/types.js';
import { resolveIntelligentDirection, buildDirectorBrief, buildFinalImagePrompt, generateImageWithGemini } from '../../lib/arte-tgp/index.js';
import type { IntelligentDirectorInput } from '../../lib/arte-tgp/types.js';
import { estandarizarYSubirImagenAR2 } from '../../storage/r2.js';

export const nanoBananaTool: TgpTool = {
  name: 'generate_nano_banana_cover',
  description: 'Genera una imagen/portada fotográfica cinematográfica V2. Úsala cuando necesites ilustrar un artículo o ensayo con alta calidad direccional.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Título del artículo o portada.' },
      concept: { type: Type.STRING, description: 'El núcleo conceptual de la imagen.' },
      contextNotes: { type: Type.STRING, description: 'Instrucciones extra para el director.' },
      visualSensitivity: { 
        type: Type.STRING, 
        enum: ['auto', 'avant-garde', 'classic', 'hybrid'],
        description: 'Sensibilidad visual.'
      },
      narrativeMode: {
        type: Type.STRING,
        enum: ['auto', 'observational-drama', 'historical-epic', 'psychological-closeup', 'night-expedition', 'archival-reconstruction', 'field-documentary', 'editorial-relic', 'material-surrealism'],
        description: 'Modo narrativo dominante.'
      },
      historicalRigor: {
        type: Type.STRING,
        enum: ['strict', 'documented-interpretive', 'editorial', 'conceptual']
      },
      visualRisk: {
        type: Type.STRING,
        enum: ['restrained', 'balanced', 'bold', 'experimental']
      }
    },
    required: ['title', 'concept', 'visualSensitivity', 'narrativeMode', 'historicalRigor', 'visualRisk'],
  },
  execute: async (args: Record<string, any>) => {
    try {
      const input: IntelligentDirectorInput = {
        title: args.title,
        concept: args.concept,
        contextNotes: args.contextNotes || '',
        visualSensitivity: args.visualSensitivity,
        narrativeMode: args.narrativeMode,
        historicalRigor: args.historicalRigor,
        sceneConditions: ['auto'], // Simplified for tool usage
        humanPresence: 'auto',
        visualRisk: args.visualRisk,
        aspectProfile: 'hero-16-9',
        toggles: {
          protectHistoricalAnchors: true,
          avoidAICliches: true,
          safeCropComposition: true,
          allowSingleConceptualAnomaly: false,
          generateDecisionReport: true,
          enableAdvancedOverrides: false
        }
      };

      const resolvedDirection = resolveIntelligentDirection(input);
      const brief = buildDirectorBrief(resolvedDirection);
      
      const env = process.env as any;
      const apiKey = env.GEMINI_API_KEY;
      
      const finalPrompt = await buildFinalImagePrompt({
        direction: resolvedDirection,
        useLLM: true,
        apiKey
      });

      const imageResult = await generateImageWithGemini({
        prompt: finalPrompt,
        aspectRatio: resolvedDirection.providerAspectRatio,
        slug: args.title.toLowerCase().replace(/\s+/g, '-'),
        apiKey
      });

      if (!imageResult.success) {
        return { success: false, error: imageResult.error };
      }

      let finalImageUrl = imageResult.image;
      try {
        if (imageResult.image?.startsWith('data:image/')) {
          const base64Data = imageResult.image.split(',')[1];
          const buf = Buffer.from(base64Data, 'base64');
          const slug = args.title ? args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined;
          finalImageUrl = await estandarizarYSubirImagenAR2(buf, 'portadas', slug);
        }
      } catch (uploadErr: any) {
        console.warn('[NanoBananaTool] No se pudo subir imagen a R2, usando fallback original:', uploadErr?.message);
      }

      return {
        success: true,
        imageUrl: finalImageUrl,
        imagePrompt: finalPrompt,
        brief: brief.fullTextBrief
      };
    } catch (e: any) {
      console.error('[NanoBananaTool] Error:', e);
      return { success: false, error: e.message };
    }
  }
};

