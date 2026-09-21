import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Parámetro "url" requerido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validar que provenga de dominios de Wikimedia autorizados
  const allowed = /^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org)\//i.test(targetUrl);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Dominio no permitido.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'TGPMind/1.0 (contact@thegreatpuzzleproject.com; Wikimedia Inbox)',
      },
    });

    if (!res.ok) {
      return new Response(`Error al obtener recurso de Wikimedia: HTTP ${res.status}`, {
        status: res.status,
      });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error de proxy.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
