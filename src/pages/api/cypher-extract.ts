import type { APIRoute } from 'astro';
import { extractEntityToCypher } from '../../lib/knowledgeGraph';

export const prerender = false;

// Email autorizado en Cloudflare Zero Trust (Access)
const AUTHORIZED_EMAIL = Xgnatiux@gmail.com;

export const POST: APIRoute = async ({ request, locals }) => {
  const isDev = import.meta.env.DEV;

  // ── BLINDAJE EN PRODUCCIÓN: EXIGIR VALIDACIÓN DE CLOUDFLARE ACCESS ──
  if (!isDev) {
    const cfUserEmail = request.headers.get('cf-access-authenticated-user-email');
    if (!cfUserEmail || cfUserEmail.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: Recurso no encontrado }), {
        status: 404, // Simula que el endpoint no existe
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const { query } = await request.json();
    
    // Buscar API key en env local o Cloudflare runtime binding
    const apiKey = 
      import.meta.env.KNOWLEDGE_GRAPH_API_KEY || 
      process.env.KNOWLEDGE_GRAPH_API_KEY ||
      (locals as any)?.runtime?.env?.KNOWLEDGE_GRAPH_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: Falta configurar KNOWLEDGE_GRAPH_API_KEY en .env o Cloudflare Secrets 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const resultado = await extractEntityToCypher(query, apiKey);
    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || Error procesando entidad }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
