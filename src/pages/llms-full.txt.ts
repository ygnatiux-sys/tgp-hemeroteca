import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

export const prerender = false;

export const GET: APIRoute = async () => {
  const filePath = path.join(process.cwd(), 'public', 'llms-full.txt');
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
