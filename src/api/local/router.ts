import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGuardarEnsayo } from './guardar-ensayo.ts';
import { handleGuardarCinematico } from './guardar-cinematico.ts';
import { handleGuardarArquetipo } from './guardar-arquetipo.ts';
import { handleGuardarGeorreferencia } from './guardar-georreferencia.ts';
import { handleGuardarInformePremium } from './guardar-informe-premium.ts';
import { handleTransmute } from './transmute.ts';

export async function handleLocalApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) {
  const url = req.url?.split('?')[0];

  if (!url || (!url.startsWith('/api/guardar-') && url !== '/api/hemeroteca/transmute')) {
    return next();
  }

  // CORS y preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // GET informativo para transmute
  if (url === '/api/hemeroteca/transmute' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(JSON.stringify({ status: 'API Transmute Activa', method: 'Requiere POST para publicar' }));
  }

  if (req.method !== 'POST') {
    return next();
  }

  try {
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(buffers).toString('utf-8');
    const body = rawBody ? JSON.parse(rawBody) : {};

    let result: { status: number; data: any } | null = null;

    if (url === '/api/guardar-ensayo') {
      result = await handleGuardarEnsayo(body);
    } else if (url === '/api/guardar-cinematico') {
      result = await handleGuardarCinematico(body);
    } else if (url === '/api/guardar-arquetipo') {
      result = await handleGuardarArquetipo(body);
    } else if (url === '/api/guardar-georreferencia') {
      result = await handleGuardarGeorreferencia(body);
    } else if (url === '/api/guardar-informe-premium') {
      result = await handleGuardarInformePremium(body);
    } else if (url === '/api/hemeroteca/transmute') {
      result = await handleTransmute(body);
    }

    if (result) {
      res.writeHead(result.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(JSON.stringify(result.data));
    }

    next();
  } catch (err: any) {
    console.error('[Local API Error]:', err);
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ error: err?.message || 'Error interno en local API' }));
  }
}
