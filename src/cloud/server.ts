/**
 * src/cloud/server.ts
 * ============================================================================
 * SERVIDOR CLOUD STANDALONE (SOMA v1.2 + ARGON LIGHT PDF ENGINE)
 * ============================================================================
 * Servidor HTTP nativo ultraliviano para Cloud Run (o Docker).
 * Escucha en process.env.PORT || 8080 con cero overhead de frameworks pesados.
 */

import http from 'node:http';
import { handleSomaSearch } from './routes/soma.route.ts';
import { handleArgonLightPdf } from './routes/argon-light.route.ts';

const PORT = parseInt(process.env.PORT || '8080', 10);

/**
 * Lee y parsea el cuerpo JSON de una petición entrante de manera segura.
 */
function readJsonBody<T = any>(req: http.IncomingMessage, maxBytes = 10 * 1024 * 1024): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytesRead = 0;

    req.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      if (bytesRead > maxBytes) {
        req.destroy();
        reject(new Error('Payload Too Large: El cuerpo de la petición excede el límite permitido.'));
        return;
      }
      raw += chunk.toString('utf-8');
    });

    req.on('end', () => {
      if (!raw.trim()) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err: any) {
        reject(new Error(`JSON Inválido: ${err.message}`));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

/**
 * Aplica cabeceras CORS permisivas para permitir llamadas directas desde
 * el cliente web / Astro o herramientas de monitoreo.
 */
function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-tgp-secret, Authorization');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Health check vital para Cloud Run
  if ((pathname === '/health' || pathname === '/') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'soma-argon-light',
        version: '1.2.0',
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // 2. Endpoint SOMA Search: POST /api/soma/search
  if (pathname === '/api/soma/search' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const result = await handleSomaSearch(payload, req.headers);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch (err: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Error procesando solicitud.' }));
    }
    return;
  }

  // 3. Endpoint ARGON Light PDF: POST /api/argon/light-pdf
  if (pathname === '/api/argon/light-pdf' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const result = await handleArgonLightPdf(payload, req.headers);

      if (result.status !== 200) {
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.json || { error: result.error || 'Error compilando PDF.' }));
        return;
      }

      // Si se solicitó el buffer binario directo
      if (payload.returnBinary && result.buffer) {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${result.filename || 'dossier.pdf'}"`,
          'Content-Length': result.buffer.length,
          'Cache-Control': 'no-cache',
        });
        res.end(result.buffer);
        return;
      }

      // Respuesta estándar JSON con los enlaces multicloud generados
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.json));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Error interno del servidor PDF.' }));
    }
    return;
  }

  // Ruta no encontrada
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Ruta no encontrada: ${req.method} ${pathname}` }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SOMA-ARGON CLOUD] ✓ Servidor iniciado en http://0.0.0.0:${PORT}`);
  console.log(`[SOMA-ARGON CLOUD] - Healthcheck: GET /health`);
  console.log(`[SOMA-ARGON CLOUD] - SOMA Search: POST /api/soma/search`);
  console.log(`[SOMA-ARGON CLOUD] - ARGON PDF:   POST /api/argon/light-pdf`);
});

// Manejo de apagado elegante (Graceful Shutdown)
function handleShutdown(signal: string) {
  console.log(`[SOMA-ARGON CLOUD] Señal ${signal} recibida. Cerrando conexiones...`);
  server.close(() => {
    console.log('[SOMA-ARGON CLOUD] Servidor cerrado ordenadamente.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
