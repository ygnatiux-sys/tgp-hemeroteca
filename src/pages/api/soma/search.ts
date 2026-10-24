/**
 * src/pages/api/soma/search.ts
 * Endpoint Astro local montado sobre /api/soma/search delegando directamente en src/cloud/routes/soma.route.ts
 */
import type { APIRoute } from 'astro';
import { somaAstroHandler } from '../../../cloud/routes/soma.route.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  return somaAstroHandler(request);
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      service: 'SOMA Wiki Engine v1.0',
      status: 'ready',
      endpoint: 'POST /api/soma/search',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
