import type { APIRoute } from 'astro';
import { handleTransmute } from '../../../api/local/transmute.ts';

export const prerender = false;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ status: 'API Transmute Activa', method: 'Requiere POST para guardar' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const result = await handleTransmute(body);
    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[transmute endpoint error]:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Error al transmutar contenido' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
