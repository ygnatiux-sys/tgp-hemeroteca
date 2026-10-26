import type { APIRoute } from 'astro';
import ontology from '../../data/tgp-ontology.json';

export const prerender = false;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(ontology), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
