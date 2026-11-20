/**
 * src/pages/api/local/transmute-press-batch.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE 2 — TRANSMUTACIÓN AUTOMÁTICA WEBP A CLOUDFLARE R2 PARA IMPRENTA
 * Recibe un lote de láminas aprobadas en la Mesa de Luz, descarga cada imagen,
 * la convierte a .webp vía src/lib/vault-r2.mjs (transmuteRemoteToR2) y la sube
 * a r2://tgp-storage/ediciones/<issueSlug>/plate_NN.webp.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { APIRoute } from 'astro';

export const prerender = false;

interface PressPlateInput {
  plate_number?: number;
  title?: string;
  original_url?: string;
  thumb_url?: string;
  license?: string;
  author?: string;
  attribution_text?: string;
}

function sanitizeIssueSlug(raw: unknown): string {
  const cleaned = String(raw || '002-cremo')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || '002-cremo';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = await request.json();
    const issueSlug = sanitizeIssueSlug(body?.issueSlug);
    const plates: PressPlateInput[] = Array.isArray(body?.plates) ? body.plates : [];

    if (!plates.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Se requiere al menos 1 lámina en el array plates[].',
        }),
        { status: 400, headers }
      );
    }

    const r2Folder = `ediciones/${issueSlug}`;
    const cloudflareEnv = (locals as any)?.runtime?.env || {};
    if (typeof process === 'undefined' || typeof process.cwd !== 'function') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Endpoint local únicamente: requiere Node.js local para comprimir con Sharp y subir a R2.',
        }),
        { status: 501, headers }
      );
    }
    const path = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const vaultFileUrl = pathToFileURL(
      path.join(process.cwd(), 'src', 'lib', 'vault-r2.mjs')
    ).href;
    const { transmuteRemoteToR2 } = (await import(/* @vite-ignore */ vaultFileUrl)) as {
      transmuteRemoteToR2: (
        remoteUrl: string,
        folder?: string,
        titleHint?: string,
        exactFilename?: string,
        envOverride?: Record<string, any>
      ) => Promise<string>;
    };
    const updatedPlates: any[] = [];
    const errors: Array<{ plate_number: number; title: string; error: string }> = [];

    // Procesamiento controlado en orden para preservar plate_01..plate_NN sin saturar Wikimedia (HTTP 429)
    for (let idx = 0; idx < plates.length; idx++) {
      const plate = plates[idx] || {};
      const plateNumber = Number(plate.plate_number) || idx + 1;
      const padNum = String(plateNumber).padStart(2, '0');
      const exactFilename = `plate_${padNum}.webp`;
      const cleanTitle = (plate.title || `Lámina ${padNum}`).trim();
      const license = (plate.license || 'Public domain').trim();
      const author = (plate.author || 'Archivo Patrimonial').trim();
      const attributionText =
        (plate.attribution_text || '').trim() ||
        `${cleanTitle} — ${author} (${license})`;

      const candidateUrls = [plate.original_url, plate.thumb_url].filter(
        (u, pos, arr): u is string =>
          typeof u === 'string' &&
          /^https?:\/\//i.test(u.trim()) &&
          arr.indexOf(u) === pos
      );

      if (!candidateUrls.length) {
        errors.push({
          plate_number: plateNumber,
          title: cleanTitle,
          error: 'URL de imagen original o miniatura inválida/vacía.',
        });
        continue;
      }

      let r2Url = '';
      let lastErr: any = null;

      for (const sourceUrl of candidateUrls) {
        try {
          r2Url = await transmuteRemoteToR2(
            sourceUrl,
            r2Folder,
            cleanTitle,
            exactFilename,
            cloudflareEnv
          );
          if (r2Url) break;
        } catch (err: any) {
          lastErr = err;
        }
      }

      if (!r2Url) {
        errors.push({
          plate_number: plateNumber,
          title: cleanTitle,
          error: lastErr?.message || 'Error subiendo WebP a Cloudflare R2.',
        });
        continue;
      }

      updatedPlates.push({
        plate_number: plateNumber,
        title: cleanTitle,
        original_url: r2Url,
        thumb_url: r2Url,
        license,
        author,
        attribution_text: attributionText,
      });
    }

    if (!updatedPlates.length) {
      return new Response(
        JSON.stringify({
          success: false,
          issueSlug,
          error: errors[0]?.error || 'No se pudo subir ninguna lámina a Cloudflare R2.',
          errors,
        }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        issueSlug,
        r2Prefix: `r2://tgp-storage/${r2Folder}/`,
        count: updatedPlates.length,
        plates: updatedPlates,
        errors,
      }),
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error('[API /api/local/transmute-press-batch] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Error interno transmutando lote de imprenta a WebP/R2.',
      }),
      { status: 500, headers }
    );
  }
};
