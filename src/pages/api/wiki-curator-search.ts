/**
 * src/pages/api/wiki-curator-search.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ENDPOINT DE BÚSQUEDA Y CURADURÍA EN VIVO (CIRRUSSEARCH + GEMINI FLASH)
 * Permite que el botón "New Search (40)" en el Lightbox invoque el motor
 * pre-fetch de alta fidelidad directamente desde el cliente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { APIRoute } from 'astro';
import { searchWikiCurator } from '../../lib/wikiCuratorEngine';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('query')?.trim() || 'Saqqara pyramid';
  const limit = parseInt(url.searchParams.get('limit') || '40', 10);

  try {
    const result = await searchWikiCurator({
      query,
      limit,
      useGeminiAgent: true,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    console.error('[wiki-curator-search API] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Error consultando Wikimedia Commons.',
        images: [],
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
