/**
 * src/cloud/routes/argon-light.route.ts
 * ============================================================================
 * ENDPOINT ARGON LIGHT PDF ENGINE + PIPELINE DE DOBLE SUBIDA (DRIVE + R2)
 * ============================================================================
 * Genera el PDF con PDFKit y ejecuta en paralelo (Promise.allSettled):
 * 1. Respaldo en Google Drive (Bóveda Documental).
 * 2. Almacenamiento en Cloudflare R2 (CDN Público con enrutamiento multi-bucket).
 * 3. Persistencia física en disco local (si no es Cloud Run).
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildDossierPdf } from '../services/pdfkit-builder.ts';
import { executeWikiSmartCurator, type CuratedWikiBatch } from '../../lib/curator/wiki-smart-curator.ts';
import { somaSearch, type SomaSearchResult } from '../../core/soma-engine.ts';
import { uploadToGoogleDrive, type DriveUploadResult } from '../services/drive-uploader.ts';
import { uploadToR2, type R2UploadResult } from '../services/r2-uploader.ts';

function validateSecuritySecret(headers?: any): boolean {
  const expected = process.env.TGP_RUN_SECRET;
  if (!expected) return true; // En desarrollo local libre si no está configurado

  let incoming: string | null = null;
  if (headers && typeof headers.get === 'function') {
    incoming = headers.get('x-tgp-secret');
  } else if (headers) {
    incoming = headers['x-tgp-secret'] || headers['X-TGP-SECRET'];
  }
  return incoming === expected;
}

export interface ArgonLightPayload {
  topic?: string;
  query?: string;
  subtitle?: string;
  modoCuraduria?: 'mini-pdf' | 'revista-completa'; // default: 'mini-pdf'
  editorialModel?: 'flash' | 'pro';                 // default: 'flash'
  input?: CuratedWikiBatch | SomaSearchResult | any[];
  engineMode?: 'smart-curator' | 'soma-raw';        // default: 'smart-curator'
  returnBinary?: boolean;                           // Si es true, responde el buffer binario en lugar del JSON
  driveFolderId?: string;
  r2Folder?: string;
}

export interface ArgonUploadResponse {
  success: boolean;
  filename: string;
  bytes: number;
  drive: DriveUploadResult;
  r2: R2UploadResult;
  localPath?: string;
  timestamp: string;
  error?: string;
}

export interface HandleArgonResult {
  status: number;
  json?: ArgonUploadResponse | { error: string };
  buffer?: Buffer;
  filename?: string;
  error?: string;
}

export async function handleArgonLightPdf(
  payload: ArgonLightPayload,
  headers?: any
): Promise<HandleArgonResult> {
  // 1. Validación de seguridad TGP Secret
  if (!validateSecuritySecret(headers)) {
    return {
      status: 401,
      error: 'No autorizado. Header x-tgp-secret requerido o inválido.',
      json: { error: 'No autorizado. Header x-tgp-secret requerido o inválido.' },
    };
  }

  const topic = (payload.topic || payload.query || '').trim();
  let curatorInput = payload.input;

  // 2. Curaduría bajo demanda si no se proveyó input previo
  if (!curatorInput) {
    if (!topic) {
      return {
        status: 400,
        error: 'Debe especificarse el parámetro "topic" o proveer un lote "input".',
        json: { error: 'Debe especificarse el parámetro "topic" o proveer un lote "input".' },
      };
    }

    const modo = payload.modoCuraduria || 'mini-pdf';
    const model = payload.editorialModel || 'flash';

    if (payload.engineMode === 'soma-raw') {
      curatorInput = await somaSearch(topic, { limit: modo === 'mini-pdf' ? 15 : 30 });
    } else {
      curatorInput = await executeWikiSmartCurator({
        query: topic,
        modoCuraduria: modo,
        editorialModel: model,
      });
    }
  }

  try {
    // 3. Generación del buffer PDF en memoria con PDFKit
    const pdfBuffer = await buildDossierPdf({
      topic: topic || 'Dossier Patrimonial',
      input: curatorInput,
      subtitle: payload.subtitle,
      concurrencyLimit: 3,
    });

    const safeTopic = (topic || 'soma').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const filename = `${safeTopic}-dossier.pdf`;

    // 4. Regla de Persistencia Local: guardar en disco si estamos fuera de Cloud Run
    const isCloudRun = Boolean(process.env.K_SERVICE);
    let localSavedPath: string | undefined;

    if (!isCloudRun) {
      const outputDir = path.resolve('dossiers');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      localSavedPath = path.join(outputDir, filename);
      fs.writeFileSync(localSavedPath, pdfBuffer);
      console.log(`[Argon Light] ✓ Copia local guardada en disco: ${localSavedPath} (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    }

    // 5. Pipeline de Doble Subida en paralelo (Google Drive + Cloudflare R2)
    const [driveSettled, r2Settled] = await Promise.allSettled([
      uploadToGoogleDrive({
        buffer: pdfBuffer,
        filename,
        mimeType: 'application/pdf',
        folderId: payload.driveFolderId,
        description: `Dossier TGP ARGON: ${topic || 'SOMA Visual Dossier'}`,
      }),
      uploadToR2({
        buffer: pdfBuffer,
        filename,
        mimeType: 'application/pdf',
        folder: payload.r2Folder || 'dossiers',
      }),
    ]);

    const driveResult: DriveUploadResult =
      driveSettled.status === 'fulfilled'
        ? driveSettled.value
        : { success: false, error: driveSettled.reason?.message || 'Fallo desconocido en Drive' };

    const r2Result: R2UploadResult =
      r2Settled.status === 'fulfilled'
        ? r2Settled.value
        : { success: false, error: r2Settled.reason?.message || 'Fallo desconocido en R2' };

    const responseJson: ArgonUploadResponse = {
      success: true,
      filename,
      bytes: pdfBuffer.length,
      drive: driveResult,
      r2: r2Result,
      localPath: localSavedPath,
      timestamp: new Date().toISOString(),
    };

    return {
      status: 200,
      json: responseJson,
      buffer: pdfBuffer,
      filename,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Error durante la compilación o subida del PDF.';
    return {
      status: 500,
      error: errorMsg,
      json: { error: errorMsg },
    };
  }
}

/**
 * Handler para microservicios Express / Cloud Run
 */
export async function argonLightExpressRoute(req: any, res: any) {
  const payload = req.body || {};
  const result = await handleArgonLightPdf(payload, req.headers);

  if (result.status !== 200) {
    return res.status(result.status).json(result.json || { error: result.error });
  }

  // Si se solicitó descarga binaria directa
  if (payload.returnBinary && result.buffer) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    return res.status(200).send(result.buffer);
  }

  // Respuesta por defecto con el JSON de auditoría multicloud
  return res.status(200).json(result.json);
}

/**
 * Handler canónico para endpoints Astro / Web Standards API (Request -> Response)
 */
export async function argonLightAstroHandler(request: Request): Promise<Response> {
  let payload: ArgonLightPayload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const result = await handleArgonLightPdf(payload, request.headers);

  if (result.status !== 200) {
    return new Response(JSON.stringify(result.json || { error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Si se solicitó descarga binaria directa
  if (payload.returnBinary && result.buffer) {
    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': String(result.buffer.length),
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Respuesta por defecto con el JSON de auditoría multicloud
  return new Response(JSON.stringify(result.json), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
