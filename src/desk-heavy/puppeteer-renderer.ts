/**
 * src/desk-heavy/puppeteer-renderer.ts
 * ============================================================================
 * EXCLUSIVO EJECUCIÓN LOCAL (ACER SWIFT) — PROHIBIDO SUBIR A DOCKER / CLOUD RUN
 * ============================================================================
 * 
 * Motor de Maquetación Pesada HTML/CSS -> PDF vía Puppeteer / Chromium.
 * Reservado para ediciones de lujo de 300 DPI, renderizado de fuentes avanzadas,
 * micro-animaciones congeladas y maquetación editorial hiperdensa.
 */

export interface HeavyRendererOptions {
  htmlContent: string;
  outputPath: string;
  format?: 'A4' | 'Letter';
  landscape?: boolean;
  printBackground?: boolean;
  scale?: number;
}

export interface HeavyDossierItem {
  title: string;
  brief: string;
  imageUrl: string;
  credits: string;
  isStarGuest?: boolean;
}

/**
 * Plantilla HTML básica de alta fidelidad editorial para renderizado local con Puppeteer
 */
export function generateHeavyHtml(topic: string, items: HeavyDossierItem[]): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${topic} · Heavy Editorial Dossier</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #FAF8F5;
      color: #1F2937;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 297mm;
      height: 210mm;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      padding: 18mm 20mm;
      display: flex;
      flex-direction: column;
    }
    .cover-page {
      background: #0D1410;
      color: #F9FAFB;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .cover-title {
      font-size: 3rem;
      letter-spacing: -0.02em;
      margin-bottom: 1rem;
      color: #FFF;
    }
    .plate-img-wrap {
      width: 100%;
      height: 125mm;
      background: #000;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .plate-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .plate-brief {
      margin-top: 5mm;
      font-size: 11pt;
      line-height: 1.5;
      text-align: justify;
    }
  </style>
</head>
<body>
  <div class="page cover-page">
    <div style="font-size: 11pt; letter-spacing: 3px; color: #D97706; margin-bottom: 8mm;">
      THE GREAT PUZZLE PROJECT · HEAVY DESK ENGINE
    </div>
    <h1 class="cover-title">${topic}</h1>
    <p style="color: #9CA3AF; font-size: 14pt;">Dossier Editorial de Ultra-Alta Definición</p>
  </div>
  ${items.map((item, idx) => `
    <div class="page">
      <h2 style="font-size: 16pt; margin-bottom: 4mm;">${item.title}</h2>
      <div class="plate-img-wrap">
        <img class="plate-img" src="${item.imageUrl}" alt="${item.title}" />
      </div>
      <p class="plate-brief">${item.brief}</p>
      <div style="margin-top: auto; font-size: 8.5pt; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 2mm;">
        ${item.credits} · Pág. ${idx + 2}
      </div>
    </div>
  `).join('')}
</body>
</html>`;
}

/**
 * Renderizador Pesado Local: invoca Puppeteer de forma aislada solo si está instalado en el host local
 */
export async function renderHeavyDossierPdf(options: HeavyRendererOptions): Promise<void> {
  let puppeteer: any;
  try {
    // Dynamic import condicional exclusivo en runtime local (nunca empaquetado en Cloud Run)
    const puppeteerModule = await import('puppeteer');
    puppeteer = puppeteerModule.default || puppeteerModule;
  } catch {
    throw new Error(
      'Puppeteer no está instalado en este entorno. Este motor es EXCLUSIVO para ejecución en Desktop Local (Acer Swift).'
    );
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(options.htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.pdf({
      path: options.outputPath,
      format: options.format || 'A4',
      landscape: options.landscape ?? true,
      printBackground: options.printBackground ?? true,
      scale: options.scale ?? 1,
    });
    console.log(`[Desk-Heavy] ✓ PDF generado con Puppeteer en: ${options.outputPath}`);
  } finally {
    await browser.close();
  }
}
