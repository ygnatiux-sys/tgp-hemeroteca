/**
 * src/cloud/routes/soma.route.ts
 * Endpoint modular de Curaduría Visual y Top 3 Hero (SOMA WIKI ENGINE v1.0)
 * Exporta el handler POST puro compatible tanto con Express/Node server como con Astro APIRoute.
 */
import { executeSomaEngine, type SomaSearchOptions, type SomaSearchResult } from '../../core/soma-engine.ts';

export async function handleSomaSearch(
  payload: { query?: string; options?: Partial<SomaSearchOptions> }
): Promise<{ status: number; body: SomaSearchResult | { error: string } }> {
  const query = payload.query?.trim();
  if (!query) {
    return {
      status: 400,
      body: { error: 'El parámetro "query" es requerido.' },
    };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || (typeof import.meta !== 'undefined' && (import.meta as any).env?.GEMINI_API_KEY);
  const europeanaApiKey = process.env.EUROPEANA_API_KEY || (typeof import.meta !== 'undefined' && (import.meta as any).env?.EUROPEANA_API_KEY);

  const searchOptions: SomaSearchOptions = {
    query,
    limit: payload.options?.limit || 40,
    sources: payload.options?.sources || ['wikimedia', 'europeana', 'smithsonian'],
    useGeminiAgent: payload.options?.useGeminiAgent ?? true,
    geminiApiKey,
    europeanaApiKey,
  };

  try {
    const result = await executeSomaEngine(searchOptions);
    return {
      status: 200,
      body: result,
    };
  } catch (error: any) {
    return {
      status: 500,
      body: { error: error.message || 'Error ejecutando SOMA Wiki Engine.' },
    };
  }
}

/**
 * Handler de ruta para servidores Express / Connect
 */
export async function somaExpressRoute(req: any, res: any) {
  const { status, body } = await handleSomaSearch(req.body || {});
  return res.status(status).json(body);
}

/**
 * Handler canónico para endpoints Astro / Web Standards API (Request -> Response)
 */
export async function somaAstroHandler(request: Request): Promise<Response> {
  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const { status, body } = await handleSomaSearch(payload);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
