/**
 * src/cloud/services/pdfkit-builder.ts
 * Motor de Maquetación Editorial en PDFKit (Ecosistema TGP ARGON / SOMA)
 * 
 * Generación de Dossiers y Revistas Patrimoniales optimizadas para Tablet (público Senior).
 * Blindajes Anti-Crash:
 * 1. Concurrencia de descarga limitada a 3 simultáneas.
 * 2. Conversión a JPEG en memoria con sharp (calidad 88 mozjpeg).
 * 3. Liberación forzada de memoria por página para evitar OOM.
 */

import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { buildSimpleLayout, type DossierLayout, type DossierPage } from './layout-simple.ts';
import type { CuratedWikiBatch } from '../../lib/curator/wiki-smart-curator.ts';
import type { SomaAsset, SomaSearchResult } from '../../core/soma-engine.ts';

export interface PdfBuilderOptions {
  topic: string;
  input: CuratedWikiBatch | SomaSearchResult | SomaAsset[];
  subtitle?: string;
  concurrencyLimit?: number; // default: 3
}

// ── Paleta Editorial para Tablet (TGP Warm Paper) ───────────────────────────
const THEME = {
  bgWarmCream: '#FAF8F5',       // Crema cálido relajante para vista en tablet
  bgCoverDark: '#0D1410',       // Verde obsidiana profundo para portada monumental
  accentGold: '#D97706',        // Ámbar / Oro antiguo
  accentEmerald: '#059669',     // Verde esmeralda editorial
  textPrimary: '#1F2937',       // Gris carbón de alta legibilidad
  textMuted: '#6B7280',         // Subtítulos y créditos
  textCoverPrimary: '#F9FAFB',  // Blanco hueso para portada
  textCoverMuted: '#9CA3AF',    // Gris plata para portada
  dividerColor: '#E5E7EB',      // Separadores tenues
};

// ── Allowlist de Dominios Patrimoniales Autorizados ─────────────────────────
export function isAllowedAssetDomain(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'wikimedia.org' ||
      host.endsWith('.wikimedia.org') ||
      host === 'europeana.eu' ||
      host.endsWith('.europeana.eu') ||
      host === 'si.edu' ||
      host.endsWith('.si.edu')
    );
  } catch {
    return false;
  }
}

// ── Descargador de Imágenes con Cola de Concurrencia Estricta ───────────────
async function fetchAndConvertImageBuffer(url: string, isStarGuest: boolean): Promise<Buffer | null> {
  if (!isAllowedAssetDomain(url)) {
    console.warn(`[PDFKit Image Fetch] URL bloqueada por no pertenecer a la allowlist de dominios: ${url}`);
    return null;
  }

  try {
    // Si es Star Guest, ajustamos la URL de Wikimedia para solicitar alta fidelidad (hasta 2800px)
    let targetUrl = url;
    if (isStarGuest && targetUrl.includes('/thumb/')) {
      targetUrl = targetUrl.replace(/\/1[0-9]{3}px-/i, '/2800px-');
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'TgpPdfBuilder/1.2 (contact@thegreatpuzzleproject.com; SOMA Visual Engine)',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      // Fallback a la URL original si el reescalado 2800px falló
      if (targetUrl !== url) {
        const fallbackRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!fallbackRes.ok) return null;
        const rawBuf = Buffer.from(await fallbackRes.arrayBuffer());
        return await sharp(rawBuf).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      }
      return null;
    }

    const arrayBuf = await res.arrayBuffer();
    const inputBuf = Buffer.from(arrayBuf);

    // Normalización con sharp: conversión de WebP/PNG a JPEG de alta fidelidad para PDFKit
    const jpegBuf = await sharp(inputBuf)
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    return jpegBuf;
  } catch (err: any) {
    console.warn(`[PDFKit Image Fetch] No se pudo descargar imagen ${url}:`, err?.message || err);
    return null;
  }
}

/**
 * Ejecuta descargas en paralelo limitadas por un semáforo de concurrencia estricto (máximo 3)
 */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIdx = index++;
      results[currentIdx] = await fn(items[currentIdx], currentIdx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Pintado de Páginas Editoriales ──────────────────────────────────────────

function drawPageBackground(doc: PDFKit.PDFDocument, color: string = THEME.bgWarmCream) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(color);
}

function drawCover(doc: PDFKit.PDFDocument, page: DossierPage, layout: DossierLayout) {
  drawPageBackground(doc, THEME.bgCoverDark);

  const w = doc.page.width;
  const h = doc.page.height;

  // Marco perimetral fino editorial
  doc.rect(36, 36, w - 72, h - 72)
    .lineWidth(1)
    .stroke('#263229');

  // Sello editorial superior
  doc.fontSize(10)
    .fillColor(THEME.accentGold)
    .text('THE GREAT PUZZLE PROJECT  ·  SOMA HERITAGE ARCHIVE', 54, 72, {
      align: 'left',
      characterSpacing: 2,
    });

  // Título monumental
  doc.fontSize(38)
    .fillColor(THEME.textCoverPrimary)
    .text(page.title, 54, h * 0.36, {
      width: w - 108,
      lineGap: 4,
    });

  // Línea dorada separadora
  doc.rect(54, h * 0.36 + 65, 80, 2)
    .fill(THEME.accentGold);

  // Subtítulo
  doc.fontSize(15)
    .fillColor(THEME.textCoverMuted)
    .text(page.subtitle || layout.subtitle, 54, h * 0.36 + 80, {
      width: w * 0.75,
      lineGap: 3,
    });

  // Pie de portada con metadatos de tiraje
  const metaY = h - 85;
  doc.fontSize(9)
    .fillColor('#64748B')
    .text(`Curaduría: ${layout.totalPlates} Láminas  ·  Láminas VIP Zoom: ${layout.starGuestsCount}`, 54, metaY);

  doc.fontSize(9)
    .fillColor('#64748B')
    .text(`Edición Documental: ${layout.dateGenerated}`, 54, metaY + 14);
}

function drawSectionDivider(doc: PDFKit.PDFDocument, page: DossierPage) {
  drawPageBackground(doc, THEME.bgWarmCream);

  const w = doc.page.width;
  const h = doc.page.height;

  // Marca de agua de sección
  doc.fontSize(70)
    .fillColor('#F3EFEA')
    .text(`ACTO ${page.secuenciaNarrativa || ''}`, 54, h * 0.25, { characterSpacing: 4 });

  // Título de Sección
  doc.fontSize(24)
    .fillColor(THEME.textPrimary)
    .text(page.title, 54, h * 0.42, { width: w - 108 });

  // Línea esmeralda
  doc.rect(54, h * 0.42 + 40, 60, 2)
    .fill(THEME.accentEmerald);

  // Bajada conceptual
  if (page.subtitle) {
    doc.fontSize(13)
      .fillColor(THEME.textMuted)
      .text(page.subtitle, 54, h * 0.42 + 55, { width: w * 0.7, lineGap: 3 });
  }

  // Folio inferior
  doc.fontSize(9)
    .fillColor('#9CA3AF')
    .text(`TGP ARGON DOSSIER  ·  SECCIÓN ${page.secuenciaNarrativa || 1}`, 54, h - 50);
}

function drawPlate(doc: PDFKit.PDFDocument, page: DossierPage, imageBuffer: Buffer | null) {
  drawPageBackground(doc, THEME.bgWarmCream);

  const w = doc.page.width;
  const h = doc.page.height;
  const plate = page.plate!;

  // ── CABECERA DE LA LÁMINA ──────────────────────────────────────────────
  doc.fontSize(16)
    .fillColor(THEME.textPrimary)
    .text(plate.cleanTitle, 54, 42, { width: w - 108, ellipsis: true });

  // ── RECUADRO DE IMAGEN ──────────────────────────────────────────────────
  // Área asignada para la imagen: márgenes seguros en tablet
  const canvasW = w - 108;
  const canvasH = h * 0.58;
  const canvasX = 54;
  const canvasY = 74;

  if (imageBuffer) {
    try {
      // PDFKit escala la imagen automáticamente manteniendo proporción dentro de fit
      doc.image(imageBuffer, canvasX, canvasY, {
        fit: [canvasW, canvasH],
        align: 'center',
        valign: 'center',
      });
    } catch (err: any) {
      console.warn('[PDFKit Plate] Error al renderizar imagen en canvas:', err?.message);
    }
  } else {
    // Placeholder elegante si la imagen no se descargó
    doc.rect(canvasX, canvasY, canvasW, canvasH).fill('#EDE8E1');
    doc.fontSize(11).fillColor(THEME.textMuted).text('Imagen no disponible en acervo remoto', canvasX, canvasY + canvasH / 2, { align: 'center', width: canvasW });
  }

  // ── TEXTO EDITORIAL (AIBRIEF) EN CUERPO LEGIBLE (13-14pt) ───────────────
  const textY = canvasY + canvasH + 18;
  doc.fontSize(13)
    .fillColor(THEME.textPrimary)
    .text(plate.aiBrief, 54, textY, {
      width: w - 108,
      lineGap: 3,
      align: 'justify',
    });

  // ── PIE LEGAL Y FOLIO ───────────────────────────────────────────────────
  const footerY = h - 42;
  doc.rect(54, footerY - 8, w - 108, 0.5).fill(THEME.dividerColor);

  doc.fontSize(8.5)
    .fillColor(THEME.textMuted)
    .text(plate.credits, 54, footerY, { width: w * 0.7, ellipsis: true });

  doc.fontSize(8.5)
    .fillColor(THEME.textMuted)
    .text(`Pág. ${page.pageIndex}`, w - 108, footerY, { align: 'right', width: 54 });
}

function drawStarGuestFull(doc: PDFKit.PDFDocument, page: DossierPage, imageBuffer: Buffer | null) {
  // Para láminas VIP Star Guest (mapas / panoramas), fondo carbón oscuro para contraste cinematográfico
  drawPageBackground(doc, '#080C0A');

  const w = doc.page.width;
  const h = doc.page.height;
  const plate = page.plate!;

  // Ocupa el 85% de la pantalla para permitir zoom táctil en tablet
  const margin = 24;
  const imgW = w - margin * 2;
  const imgH = h - 90;

  if (imageBuffer) {
    try {
      doc.image(imageBuffer, margin, margin, {
        fit: [imgW, imgH],
        align: 'center',
        valign: 'center',
      });
    } catch {}
  }

  // Banda inferior sutil con el título y crédito de la joya documental
  const barY = h - 60;
  doc.fontSize(11)
    .fillColor(THEME.accentGold)
    .text(`★ JOYAS DEL ACERVO  ·  ${plate.cleanTitle}`, margin, barY, { width: w * 0.7, ellipsis: true });

  doc.fontSize(8.5)
    .fillColor('#94A3B8')
    .text(plate.credits, margin, barY + 16, { width: w * 0.7, ellipsis: true });

  doc.fontSize(9)
    .fillColor('#64748B')
    .text(`Pág. ${page.pageIndex}`, w - margin - 60, barY + 8, { align: 'right', width: 60 });
}

// ── FUNCIÓN PRINCIPAL DE CONSTRUCCIÓN DEL PDF ────────────────────────────────

export async function buildDossierPdf(options: PdfBuilderOptions): Promise<Buffer> {
  const {
    topic,
    input,
    subtitle,
    concurrencyLimit = 3,
  } = options;

  // 1. Estructuración del Layout Editorial (Portada, Dividers, Plates, Star Guests)
  const layout = buildSimpleLayout(topic, input, subtitle);

  // 2. Extracción de todas las láminas con imagen
  const platePages = layout.pages.filter(p => p.plate);

  console.log(`[PDFKit Builder] Iniciando descarga concurrente (límite: ${concurrencyLimit}) de ${platePages.length} imágenes...`);

  // 3. Descarga concurrente controlada (máximo 3 a la vez) con conversión JPEG inmediata
  const imageBuffers = await mapConcurrent(
    platePages,
    concurrencyLimit,
    async (page, idx) => {
      const plate = page.plate!;
      const buf = await fetchAndConvertImageBuffer(plate.cdnUrl, plate.isStarGuest);
      console.log(`  [${String(idx + 1).padStart(2, '0')}/${platePages.length}] Descargada: "${plate.cleanTitle.slice(0, 35)}..." (${buf ? (buf.length / 1024).toFixed(0) + ' KB' : 'ERROR'})`);
      return { pageIndex: page.pageIndex, buffer: buf };
    }
  );

  const bufferMap = new Map(imageBuffers.map(item => [item.pageIndex, item.buffer]));

  // 4. Inicialización del documento PDFKit en Landscape A4 (ideal para Tablet 4:3 / 16:10)
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape', // 841.89 x 595.28 pt
    margin: 0,
    info: {
      Title: `TGP Dossier — ${layout.topic}`,
      Author: 'The Great Puzzle Project (TGP SOMA)',
      Subject: layout.subtitle,
      Creator: 'ARGON PDFKit Engine v1.2',
    },
  });

  const pdfChunks: Buffer[] = [];
  doc.on('data', chunk => pdfChunks.push(chunk));

  // 5. Renderizado secuencial de páginas con liberación de memoria inmediata
  for (let i = 0; i < layout.pages.length; i++) {
    const page = layout.pages[i];

    if (i > 0) {
      doc.addPage();
    }

    if (page.type === 'cover') {
      drawCover(doc, page, layout);
    } else if (page.type === 'section-divider') {
      drawSectionDivider(doc, page);
    } else if (page.type === 'star-guest-full') {
      const buf = bufferMap.get(page.pageIndex) || null;
      drawStarGuestFull(doc, page, buf);
      bufferMap.delete(page.pageIndex); // Liberación forzada de RAM
    } else if (page.type === 'plate') {
      const buf = bufferMap.get(page.pageIndex) || null;
      drawPlate(doc, page, buf);
      bufferMap.delete(page.pageIndex); // Liberación forzada de RAM
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const finalBuffer = Buffer.concat(pdfChunks);
      console.log(`[PDFKit Builder] ✓ PDF completado con éxito: ${layout.pages.length} páginas, ${(finalBuffer.length / (1024 * 1024)).toFixed(2)} MB.`);
      resolve(finalBuffer);
    });
    doc.on('error', reject);
  });
}
