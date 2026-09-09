/**
 * src/pages/api/generate-premium-report.ts
 * Endpoint Puente — Receptor de peticiones desde la interfaz de Keystatic.
 *
 * POST /api/generate-premium-report
 * Body: { titulo: string, coleccion: string, fuenteVisual: string, directrices?: string, tags?: string[] }
 *
 * Responses:
 *   200 OK   → { success: true, slug, mdxPath, imagenR2Url }
 *   400      → { error: "Mensaje de validación" }
 *   500      → { error: "Mensaje de error interno" }
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { generatePremiumReport, type InformePremiumPayload, type FuenteVisual } from '../../services/generatePremiumReport';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const COLECCIONES_VALIDAS = ['liminal', 'heterodoxia', 'anomalias', 'apocrifa'] as const;
const FUENTES_VALIDAS: FuenteVisual[] = ['wikimedia', 'sintetica'];

export const POST: APIRoute = async ({ request }) => {
  // ── Parseado del Body ──────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'El body debe ser JSON válido.' }),
      { status: 400, headers: HEADERS }
    );
  }

  const { titulo, coleccion, fuenteVisual, directrices, tags, modoPiloto } = body;

  // ── Validación de campos requeridos ───────────────────────────────────────
  if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
    return new Response(
      JSON.stringify({ error: 'El campo "titulo" es requerido y no puede estar vacío.' }),
      { status: 400, headers: HEADERS }
    );
  }

  // Si NO estamos en modo piloto, validamos estrictamente los campos manuales
  if (!modoPiloto) {
    if (!coleccion || !COLECCIONES_VALIDAS.includes(coleccion as any)) {
      return new Response(
        JSON.stringify({
          error: `El campo "coleccion" debe ser uno de: ${COLECCIONES_VALIDAS.join(', ')}.`,
        }),
        { status: 400, headers: HEADERS }
      );
    }

    if (!fuenteVisual || !FUENTES_VALIDAS.includes(fuenteVisual as FuenteVisual)) {
      return new Response(
        JSON.stringify({
          error: `El campo "fuenteVisual" debe ser uno de: ${FUENTES_VALIDAS.join(', ')}.`,
        }),
        { status: 400, headers: HEADERS }
      );
    }
  }

  // ── Invocación del Orquestador ────────────────────────────────────────────
  const payload: InformePremiumPayload = {
    titulo: (titulo as string).trim(),
    coleccion: (coleccion as InformePremiumPayload['coleccion']) || 'liminal', // Default si es piloto
    fuenteVisual: (fuenteVisual as FuenteVisual) || 'sintetica', // Default si es piloto
    directrices: typeof directrices === 'string' ? directrices : undefined,
    tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : undefined,
    modoPiloto: !!modoPiloto
  };

  try {
    const result = await generatePremiumReport(payload);

    return new Response(
      JSON.stringify({
        success: true,
        slug: result.slug,
        mdxPath: result.mdxPath,
        imagenR2Url: result.imagenR2Url,
        contenido: result.contenido,
        metadataInferred: result.metadataInferred,
        mensaje: `Informe "${payload.titulo}" generado exitosamente en ${result.mdxPath}`,
      }),
      { status: 200, headers: HEADERS }
    );
  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error('[API /generate-premium-report] Error en el pipeline:', mensaje);

    return new Response(
      JSON.stringify({
        error: `Error en el orquestador: ${mensaje}`,
      }),
      { status: 500, headers: HEADERS }
    );
  }
};

// Bloquear otros métodos
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ error: 'Método no permitido. Usa POST.' }), {
    status: 405,
    headers: { ...HEADERS, Allow: 'POST' },
  });
