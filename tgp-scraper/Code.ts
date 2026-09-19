// Entrada principal de la Web App en Google Apps Script

function doPost(e: any): GoogleAppsScript.Content.TextOutput {
  try {
    let payloadRaw = "";
    if (e && e.postData && e.postData.contents) {
      payloadRaw = e.postData.contents;
    } else if (typeof e === "string") {
      payloadRaw = e;
    }

    if (!payloadRaw) {
      throw new Error("No se recibió contenido en el cuerpo de la petición (POST payload vacío).");
    }

    const data = JSON.parse(payloadRaw);
    const imageBase64: string = data.image || "";
    const comments: string[] = Array.isArray(data.comments) ? data.comments : [];

    // 1. Procesar con Gemini 1.5 Flash
    const analysis = analyzeWithGemini(imageBase64, comments);

    // 2. Insertar en Google Docs
    const doc = DocumentApp.openById(DOC_ID);
    const body = doc.getBody();

    // Divisor
    body.appendHorizontalRule();

    // Fecha y hora formateada
    const nowStr = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires",
      "yyyy-MM-dd HH:mm:ss"
    );
    const headerPara = body.appendParagraph(`📅 Registro Forense: ${nowStr}`);
    headerPara.setHeading(DocumentApp.ParagraphHeading.HEADING2);

    // Análisis de la imagen
    if (analysis.analisis_imagen) {
      const imgSection = body.appendParagraph("🖼️ Análisis del Contexto Visual:");
      imgSection.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      body.appendParagraph(analysis.analisis_imagen);
    }

    // Plots principales
    const plotsHeading = body.appendParagraph("🎯 Plots Principales:");
    plotsHeading.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    if (analysis.plots_principales && analysis.plots_principales.length > 0) {
      analysis.plots_principales.forEach((plot) => {
        body.appendListItem(plot).setGlyphType(DocumentApp.GlyphType.BULLET);
      });
    } else {
      body.appendParagraph("*(Sin hallazgos principales registrados)*");
    }

    // Aportes secundarios
    const secHeading = body.appendParagraph("💡 Aportes Secundarios y Contexto:");
    secHeading.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    if (analysis.aportes_secundarios && analysis.aportes_secundarios.length > 0) {
      analysis.aportes_secundarios.forEach((aporte) => {
        body.appendListItem(aporte).setGlyphType(DocumentApp.GlyphType.BULLET);
      });
    } else {
      body.appendParagraph("*(Sin aportes secundarios registrados)*");
    }

    // Espaciado final
    body.appendParagraph("");
    doc.saveAndClose();

    // 3. Notificación a Telegram
    sendTelegramNotification(DOC_ID, analysis.analisis_imagen);

    // 4. Respuesta de éxito
    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", timestamp: nowStr })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error: any) {
    Logger.log(`Error en doPost: ${error.message || error}`);
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.message || String(error)
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handler GET auxiliar para verificar estado desde navegador
function doGet(): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: "online",
      service: "Extractor Forense API",
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// Función de prueba manual para disparar autorización de permisos en Google Apps Script
function probarScript(): void {
  const testPayload = {
    image: "",
    comments: ["Prueba forense: rituales y antropología en redes sociales."]
  };
  const result = doPost(JSON.stringify(testPayload));
  Logger.log("Resultado de probarScript: " + result.getContent());
}

