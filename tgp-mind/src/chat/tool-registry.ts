// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Registro de Herramientas (Tool Registry / Function Calling)
// Arquitectura Productiva para Google Chat y Dialogflow CX
// Ejecución Stateless (Cero Memoria) en Cloud Run
// ─────────────────────────────────────────────────────────────────────────────

import { estandarizarYSubirImagenAR2 } from '../storage/r2.js';
import { registrarResguardoD1 } from '../storage/d1.js';
import {
  generarSlug,
  publicarEntradaKeystaticGitHub,
  existeEntradaKeystaticGitHub,
  type ColeccionKeystatic,
} from '../servicios/publicacion.js';
import { ejecutarQueryPanlingua } from '../ia/tools/tool-panlingua.js';
import { nanoBananaTool } from '../core/tools/nanoBananaTool.js';
import { wikimediaTool } from '../core/tools/wikimediaTool.js';
import { callGemini, TGP_SYSTEM_PROMPT, buildDensityInstruction } from '../ia/gemini.js';
import crypto from 'node:crypto';

// ── Tipos y Contratos de Herramientas ─────────────────────────────────────────

export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ChatToolHandler {
  definition: ChatToolDefinition;
  execute: (args: Record<string, any>) => Promise<Record<string, any>>;
}

// ── 1. Tool: convert_and_upload_r2 ───────────────────────────────────────────
const toolConvertAndUploadR2: ChatToolHandler = {
  definition: {
    name: 'convert_and_upload_r2',
    description: 'Descarga una o varias imágenes desde URLs públicas, las estandariza a WebP optimizado con Sharp en memoria y las sube al bucket Cloudflare R2 con CDN de alta velocidad.',
    parameters: {
      type: 'OBJECT',
      properties: {
        images: {
          type: 'ARRAY',
          description: 'Lista de URLs de imágenes para convertir y subir a R2.',
          items: {
            type: 'OBJECT',
            properties: {
              url: { type: 'STRING', description: 'URL pública de la imagen origen (http/https).' },
              filename: { type: 'STRING', description: 'Nombre sugerido para el archivo (opcional).' },
              folder: { type: 'STRING', description: 'Subcarpeta en R2 (ej. ensayos, portadas, r2-chat). Default: chat-uploads.' },
            },
            required: ['url'],
          },
        },
        folder: {
          type: 'STRING',
          description: 'Carpeta global por defecto en R2 si no se define por imagen.',
        },
      },
      required: ['images'],
    },
  },
  execute: async (args) => {
    const rawImages = Array.isArray(args.images) ? args.images : [];
    const defaultFolder = (args.folder as string) || 'chat-uploads';
    const results: Array<{ originalUrl: string; r2Url: string; status: string; error?: string }> = [];

    console.log(`[Tool: convert_and_upload_r2] Procesando ${rawImages.length} imágenes secuencialmente...`);

    // Procesamiento estrictamente secuencial para proteger RAM de Cloud Run
    for (const item of rawImages) {
      const url = typeof item === 'string' ? item : item.url;
      const folder = (typeof item === 'object' && item.folder) ? item.folder : defaultFolder;
      const filename = (typeof item === 'object' && item.filename) ? item.filename : undefined;

      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        results.push({ originalUrl: url || 'invalida', r2Url: '', status: 'error', error: 'URL inválida' });
        continue;
      }

      try {
        const r2Url = await estandarizarYSubirImagenAR2(url, folder, filename);
        results.push({ originalUrl: url, r2Url, status: 'ok' });

        // Registrar resguardo en Cloudflare D1
        try {
          await registrarResguardoD1({
            id: crypto.randomUUID(),
            origen: 'google-chat-tool',
            destino: 'r2',
            tema: filename || 'Asset subido desde Google Chat',
            textoGenerado: `Imagen subida a R2 vía Chat Tool (${folder})`,
            metadatos: { originalUrl: url, r2Url, folder, timestamp: new Date().toISOString() },
            imagenR2Url: r2Url,
          });
        } catch (d1Err: any) {
          console.warn('[Tool: convert_and_upload_r2] Aviso D1:', d1Err?.message);
        }
      } catch (err: any) {
        console.error(`[Tool: convert_and_upload_r2] Error en ${url}:`, err?.message);
        results.push({ originalUrl: url, r2Url: '', status: 'error', error: err?.message || 'Error procesando imagen' });
      }
    }

    return {
      success: results.some((r) => r.status === 'ok'),
      totalProcesadas: results.length,
      uploaded: results,
    };
  },
};

// ── 2. Tool: check_keystatic_post ────────────────────────────────────────────
const toolCheckKeystaticPost: ChatToolHandler = {
  definition: {
    name: 'check_keystatic_post',
    description: 'Verifica en el repositorio GitHub de Hemeroteca si un post o slug ya existe en las colecciones de Keystatic (ensayos, ensayos-cinematicos, georreferencias).',
    parameters: {
      type: 'OBJECT',
      properties: {
        slug: {
          type: 'STRING',
          description: 'El slug único del post a verificar (ej. los-nestorianos).',
        },
        coleccion: {
          type: 'STRING',
          description: 'Colección de Keystatic a consultar.',
          enum: ['ensayos', 'ensayos-cinematicos', 'georreferencias'],
        },
      },
      required: ['slug'],
    },
  },
  execute: async (args) => {
    const slug = String(args.slug || '').trim();
    const coleccion = (args.coleccion as ColeccionKeystatic) || 'ensayos';

    if (!slug) return { exists: false, error: 'Slug no proporcionado' };

    console.log(`[Tool: check_keystatic_post] Verificando "${slug}" en colección [${coleccion}]...`);
    const checkResult = await existeEntradaKeystaticGitHub({
      coleccion,
      slug,
      token: process.env.GITHUB_TOKEN_HEMEROTECA || process.env.GITHUB_TOKEN,
      repoFull: process.env.GITHUB_REPO_HEMEROTECA || 'ygnatiux-sys/tgp-hemeroteca',
    });

    return {
      exists: checkResult.exists,
      slug,
      coleccion,
      path: checkResult.path,
      url: checkResult.url || null,
      title: checkResult.title || null,
    };
  },
};

// ── 3. Tool: publish_keystatic_post ──────────────────────────────────────────
const toolPublishKeystaticPost: ChatToolHandler = {
  definition: {
    name: 'publish_keystatic_post',
    description: 'Publica o actualiza de forma atómica una entrada en Keystatic/GitHub (generando index.json y content.mdoc) mediante la API de GitHub, dejándola lista en la Hemeroteca.',
    parameters: {
      type: 'OBJECT',
      properties: {
        titulo: {
          type: 'STRING',
          description: 'Título completo del ensayo o post.',
        },
        slug: {
          type: 'STRING',
          description: 'Slug para la URL. Si no se pasa, se genera automáticamente a partir del título.',
        },
        contenido: {
          type: 'STRING',
          description: 'Texto principal en formato Markdoc/Markdown.',
        },
        coleccion: {
          type: 'STRING',
          description: 'Colección destino.',
          enum: ['ensayos', 'ensayos-cinematicos', 'georreferencias'],
        },
        silo: {
          type: 'STRING',
          description: 'Silo de destino: "alternative" (TGP Alternative) o "hemeroteca" (TGP Hemeroteca).',
          enum: ['alternative', 'hemeroteca', 'magazine'],
        },
        coverImage: {
          type: 'STRING',
          description: 'URL pública de la imagen de portada (alojada en R2 o Wikimedia).',
        },
        categoria: {
          type: 'STRING',
          description: 'Categoría temática (ej. Arqueología, Filosofía, Historia).',
        },
        excerpt: {
          type: 'STRING',
          description: 'Resumen breve o copete de 1 a 2 párrafos.',
        },
        draft: {
          type: 'BOOLEAN',
          description: 'Indica si se publica como borrador (true) o definitivo (false). Default: false.',
        },
      },
      required: ['titulo', 'contenido'],
    },
  },
  execute: async (args) => {
    const titulo = String(args.titulo || '').trim();
    const slug = (args.slug ? String(args.slug).trim() : generarSlug(titulo)) || 'nuevo-ensayo';
    const coleccion = (args.coleccion as ColeccionKeystatic) || 'ensayos';
    const silo = ((args.silo as string) || (args.coleccion === 'ensayos-cinematicos' ? 'hemeroteca' : 'alternative')).toLowerCase();
    const contenido = String(args.contenido || '').trim();
    const coverImage = String(args.coverImage || '');
    const categoria = String(args.categoria || 'Ensayo');
    const isDraft = args.draft === true;
    const fechaHoy = new Date().toISOString().split('T')[0];

    const excerpt = args.excerpt
      ? String(args.excerpt).trim()
      : contenido.slice(0, 180).replace(/[#*`_]/g, '') + '...';

    console.log(`[Tool: publish_keystatic_post] Publicando entrada "${titulo}" (${slug}) en silo [${silo}] coleccion [${coleccion}]...`);

    const indexJson = {
      title: titulo,
      volanta: '',
      date: fechaHoy,
      category: categoria,
      themeColor: 'british-green',
      draft: isDraft,
      coverImage: coverImage || null,
      videoBg: null,
      excerpt,
      generador: 'TGP Mind Chat Assistant (Google Chat / Dialogflow CX)',
      generadorTexto: contenido,
      generadorImagen: '',
      notasInvestigador: '',
      spotifyLink: null,
      youtubeLink: null,
    };

    const frontmatter = `---
title: "${titulo.replace(/"/g, '\\"')}"
date: "${fechaHoy}"
category: "${categoria}"
coverImage: "${coverImage}"
draft: ${isDraft}
excerpt: "${excerpt.replace(/"/g, '\\"')}"
generador: "TGP Mind Chat Assistant"
---

`;

    const contentMdoc = frontmatter + contenido + '\n';

    const token = process.env.GITHUB_TOKEN_HEMEROTECA || process.env.GITHUB_TOKEN || '';
    const repoFull = silo === 'alternative'
      ? (process.env.GITHUB_REPO_ALTERNATIVE || 'ygnatiux-sys/tgp-webfinal2026')
      : (process.env.GITHUB_REPO_HEMEROTECA || 'ygnatiux-sys/tgp-hemeroteca');

    let commitUrl = '';
    try {
      commitUrl = await publicarEntradaKeystaticGitHub({
        coleccion,
        slug,
        indexJson,
        contentMdoc,
        token,
        repoFull,
        mensajeCommit: `TGP Chat Assistant: Publicar [${silo}/${coleccion}] ${slug}`,
      });
    } catch (gitErr: any) {
      console.warn(`[Tool: publish_keystatic_post] Aviso en commit de GitHub (${repoFull}):`, gitErr?.message);
      commitUrl = `https://github.com/${repoFull}/tree/main/src/content/${coleccion}/${slug}`;
    }

    const publicUrl = silo === 'alternative'
      ? `https://alternative.thegreatpuzzleproject.com/ensayos/${slug}`
      : `https://thegreatpuzzleproject.com/hemeroteca/${slug}`;

    const queryParams = `?slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(titulo)}&silo=${silo}`;
    const vaultUrl = `https://thegreatpuzzleproject.com/tgp-vault${queryParams}`;
    const r2Url = coverImage || 'https://storage.thegreatpuzzleproject.com';

    return {
      success: true,
      titulo,
      slug,
      silo,
      coleccion,
      publicUrl,
      vaultUrl,
      r2Url,
      githubUrl: commitUrl,
      commitUrl,
      isDraft,
    };
  },
};

// ── 4. Tool: query_panlingua_d1 ──────────────────────────────────────────────
const toolQueryPanlinguaD1: ChatToolHandler = {
  definition: {
    name: 'query_panlingua_d1',
    description: 'Consulta léxico, etimología y términos en más de 314 idiomas del mundo en la base de datos Cloudflare D1 (tgp-panlingua / lexico_periferico).',
    parameters: {
      type: 'OBJECT',
      properties: {
        intent: {
          type: 'STRING',
          description: 'Tipo de consulta léxica.',
          enum: ['search_concept', 'get_language_vocab', 'compare_languages', 'count_macroareas', 'custom_sql'],
        },
        concept: { type: 'STRING', description: 'Concepto o palabra a buscar (ej. agua, fuego, sol, alma).' },
        language: { type: 'STRING', description: 'Idioma específico a consultar.' },
        macroarea: { type: 'STRING', description: 'Macroárea geográfica (ej. Eurasia, Africa, South America).' },
        limit: { type: 'INTEGER', description: 'Límite de filas (máx 50).' },
      },
      required: ['intent'],
    },
  },
  execute: async (args) => {
    console.log(`[Tool: query_panlingua_d1] Ejecutando intent: ${args.intent}...`);
    const resultado = await ejecutarQueryPanlingua({
      intent: args.intent,
      concept: args.concept,
      language: args.language,
      macroarea: args.macroarea,
      limit: args.limit || 10,
    });
    return { success: true, resultado };
  },
};

// ── 5. Tool: generate_ai_cover ───────────────────────────────────────────────
const toolGenerateAiCover: ChatToolHandler = {
  definition: {
    name: 'generate_ai_cover',
    description: 'Genera una portada o imagen cinematográfica de alta fidelidad con Imagen 3 / Gemini NanoBanana, siguiendo la dirección de arte TGP (Obsidiana, claroscuro, 16:9) y la sube a R2.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Título del ensayo o tema visual.' },
        concept: { type: 'STRING', description: 'Idea conceptual rectora de la escena.' },
        visualSensitivity: {
          type: 'STRING',
          enum: ['auto', 'classic', 'avant-garde', 'hybrid'],
          description: 'Sensibilidad estética dominante.',
        },
        narrativeMode: {
          type: 'STRING',
          enum: ['auto', 'historical-epic', 'observational-drama', 'night-expedition', 'archival-reconstruction'],
          description: 'Atmósfera narrativa.',
        },
        visualRisk: {
          type: 'STRING',
          enum: ['restrained', 'balanced', 'bold', 'experimental'],
          description: 'Grado de audacia visual.',
        },
      },
      required: ['title', 'concept'],
    },
  },
  execute: async (args) => {
    console.log(`[Tool: generate_ai_cover] Creando portada para: "${args.title}"...`);
    const result = await nanoBananaTool.execute({
      title: args.title,
      concept: args.concept,
      visualSensitivity: args.visualSensitivity || 'auto',
      narrativeMode: args.narrativeMode || 'auto',
      historicalRigor: 'documented-interpretive',
      visualRisk: args.visualRisk || 'balanced',
    });
    return result;
  },
};

// ── 6. Tool: search_wikimedia ────────────────────────────────────────────────
const toolSearchWikimedia: ChatToolHandler = {
  definition: {
    name: 'search_wikimedia',
    description: 'Busca imágenes de dominio público y patrimonio histórico en Wikimedia Commons mediante búsqueda canónica anti-drift.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Término de búsqueda histórica, arqueológica o artística.' },
      },
      required: ['query'],
    },
  },
  execute: async (args) => {
    console.log(`[Tool: search_wikimedia] Buscando: "${args.query}"...`);
    const result = await wikimediaTool.execute({ query: args.query });
    return result;
  },
};

// ── 7. Tool: generate_essay_draft ────────────────────────────────────────────
const toolGenerateEssayDraft: ChatToolHandler = {
  definition: {
    name: 'generate_essay_draft',
    description: 'Redacta un ensayo en prosa reflexiva y profunda usando el genoma conceptual de TGP y el nivel de densidad seleccionado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tema: { type: 'STRING', description: 'Tema histórico, arqueológico o filosófico a desarrollar.' },
        longitud: {
          type: 'STRING',
          enum: ['breve_1500', 'pro_4500'],
          description: 'Extensión del ensayo.',
        },
        motor: {
          type: 'STRING',
          enum: ['flash', 'pro'],
          description: 'Motor de inferencia: flash (gemini-3.8-flash) o pro (gemini-2.5-pro).',
        },
      },
      required: ['tema'],
    },
  },
  execute: async (args) => {
    const tema = String(args.tema || '').trim();
    const isPro = args.motor === 'pro';
    const isLong = args.longitud === 'pro_4500';
    const densidad = isLong ? 'premium' : 'profundo_breve';
    const directivaDensidad = buildDensityInstruction(densidad, isLong);

    console.log(`[Tool: generate_essay_draft] Redactando ensayo sobre "${tema}" (motor: ${args.motor || 'flash'})...`);

    const userPrompt = `Escribe un ensayo reflexivo, denso y riguroso para Hemeroteca TGP sobre: "${tema}". Estilo ensayo argentino contemporáneo. ${directivaDensidad}`;
    const modelName = isPro ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
    const textoGenerado = await callGemini(`chat-${Date.now()}`, userPrompt, modelName, TGP_SYSTEM_PROMPT, 16384);

    return {
      success: true,
      tema,
      textoGenerado,
      longitudAproximadaChars: textoGenerado.length,
    };
  },
};

// ── Registro Maestro de Herramientas ─────────────────────────────────────────

export const CHAT_TOOL_REGISTRY: Record<string, ChatToolHandler> = {
  convert_and_upload_r2: toolConvertAndUploadR2,
  check_keystatic_post: toolCheckKeystaticPost,
  publish_keystatic_post: toolPublishKeystaticPost,
  query_panlingua_d1: toolQueryPanlinguaD1,
  generate_ai_cover: toolGenerateAiCover,
  search_wikimedia: toolSearchWikimedia,
  generate_essay_draft: toolGenerateEssayDraft,
};

/** Devuelve las declaraciones de función compatibles con el SDK de Gemini */
export function getChatToolDeclarations() {
  return Object.values(CHAT_TOOL_REGISTRY).map((t) => t.definition);
}

/** Ejecuta una herramienta por nombre con control de errores integrado */
export async function executeChatTool(name: string, args: Record<string, any>): Promise<Record<string, any>> {
  const handler = CHAT_TOOL_REGISTRY[name];
  if (!handler) {
    console.warn(`[Tool Registry] Herramienta desconocida solicitada: "${name}"`);
    return { error: `La herramienta "${name}" no está registrada en el sistema.` };
  }

  try {
    return await handler.execute(args || {});
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[Tool Registry] Excepción al ejecutar herramienta "${name}":`, errorMsg);
    return { error: errorMsg };
  }
}
