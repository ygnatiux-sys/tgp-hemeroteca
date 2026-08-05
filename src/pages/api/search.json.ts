import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

export const GET: APIRoute = async () => {
  try {
    const ensayos = await getCollection('ensayos').catch(() => []);
    const arquetipos = await getCollection('arquetiposGlobales').catch(() => []);
    const georefs = await getCollection('georreferencias').catch(() => []);

    const allCombined = [...ensayos, ...arquetipos, ...georefs];

    const items = allCombined.map(e => ({
      id: e.id,
      slug: e.id.replace(/\/index$/, ''),
      title: e.data.title || 'Sin Título',
      category: e.data.category || 'Arquetipos Globales',
      date: e.data.date || '',
      excerpt: e.data.excerpt || '',
      coverImage: e.data.coverImage || null,
      type: 'Post / Archivo'
    }));

    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
