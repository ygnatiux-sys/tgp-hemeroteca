/**
 * src/pages/api/argon/light-pdf.ts
 * Endpoint Astro local montado sobre /api/argon/light-pdf
 * Delega en src/cloud/routes/argon-light.route.ts
 */
import type { APIRoute } from 'astro';
import { argonLightAstroHandler } from '../../../cloud/routes/argon-light.route.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  return argonLightAstroHandler(request);
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      service: 'ARGON Light PDF Engine v1.2',
      status: 'ready',
      endpoint: 'POST /api/argon/light-pdf',
      supportedModes: ['mini-pdf', 'revista-completa'],
      editorialModels: ['flash', 'pro'],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
