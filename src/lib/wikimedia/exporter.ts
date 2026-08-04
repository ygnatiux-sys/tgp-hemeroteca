/**
 * EXPORTADOR DE METADATOS Y DOSSIER DE IMÁGENES WIKIMEDIA COMMONS TGP
 * Genera una Hoja de Contactos y Dossier en formato PDF / Imprimible con licencias CC,
 * autorías, resoluciones y URLs legales de atribución.
 */

import type { WikimediaImageItem } from './client';

/**
 * Genera y abre el Dossier de Metadatos listo para guardar como PDF
 */
export function exportMetadataPdfDossier(topic: string, items: WikimediaImageItem[]): void {
  if (!items || items.length === 0) {
    alert('No hay imágenes seleccionadas para exportar.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permite las ventanas emergentes en tu navegador para generar el dossier PDF.');
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Dossier de Archivo Visual TGP — ${topic}</title>
  <style>
    body {
      font-family: 'Times New Roman', Georgia, serif;
      background: #ffffff;
      color: #111111;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    header {
      border-bottom: 3px double #111;
      padding-bottom: 20px;
      margin-bottom: 30px;
      text-align: center;
    }
    h1 {
      font-size: 24pt;
      margin: 0 0 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .subtitle {
      font-style: italic;
      color: #555;
      font-size: 11pt;
    }
    .meta-badge {
      display: inline-block;
      padding: 3px 8px;
      background: #eee;
      border: 1px solid #ccc;
      font-size: 9pt;
      font-family: sans-serif;
      font-weight: bold;
      border-radius: 3px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }
    .card {
      border: 1px solid #ddd;
      padding: 15px;
      background: #fafafa;
      page-break-inside: avoid;
    }
    .card img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border: 1px solid #ccc;
      margin-bottom: 10px;
    }
    .title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 6px;
      word-break: break-all;
    }
    .info {
      font-size: 9pt;
      color: #333;
      line-height: 1.5;
      font-family: sans-serif;
    }
    .footer {
      margin-top: 50px;
      border-top: 1px solid #ccc;
      padding-top: 15px;
      font-size: 9pt;
      color: #777;
      text-align: center;
      font-family: sans-serif;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #222; color: #fff; padding: 15px; text-align: center; margin-bottom: 20px; border-radius: 6px; font-family: sans-serif;">
    <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Dossier de Archivo TGP Listo para Exportar</strong></p>
    <button onclick="window.print()" style="padding: 10px 20px; background: #28a745; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
      Imprimir / Guardar como PDF
    </button>
  </div>

  <header>
    <h1>The Great Puzzle Project</h1>
    <div class="subtitle">Dossier de Archivo Visual & Atribución de Licencias Commons</div>
    <p style="margin-top: 15px; font-size: 10pt; font-weight: bold;">
      TEMA / ENSAYO: "${topic.toUpperCase()}" · SELECCIÓN: ${items.length} ARCHIVOS
    </p>
  </header>

  <div class="grid">
    ${items.map((item, index) => `
      <div class="card">
        <img src="${item.thumbUrl}" alt="${item.title}" />
        <div class="title">#${index + 1}. ${item.title}</div>
        <div style="margin-bottom: 8px;">
          <span class="meta-badge">${item.roleLabel}</span>
          <span class="meta-badge" style="background: #e8f4fd; color: #02569b;">${item.license}</span>
        </div>
        <div class="info">
          <strong>Resolución:</strong> ${item.width} × ${item.height}px (Ratio: ${item.aspectRatio})<br>
          <strong>Autor / Atribución:</strong> ${item.author}<br>
          <strong>Licencia:</strong> <a href="${item.licenseUrl}" target="_blank">${item.license}</a><br>
          <strong>Enlace Oficial:</strong> <a href="${item.pageUrl}" target="_blank">Wikimedia Commons File</a>
        </div>
      </div>
    `).join('')}
  </div>

  <div class="footer">
    The Great Puzzle Project — Archivo Hemeroteca TGP 2026. Todos los derechos respetan sus respectivas licencias CC/CC0 de Wikimedia Commons.
  </div>
</body>
</html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Descarga individualmente las imágenes seleccionadas
 */
export function downloadBatchImages(items: WikimediaImageItem[]): void {
  if (!items || items.length === 0) {
    alert('No hay imágenes seleccionadas.');
    return;
  }

  items.forEach((item, index) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = `tgp-wikimedia-${item.role.toLowerCase()}-${index + 1}.jpg`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, index * 400);
  });
}
