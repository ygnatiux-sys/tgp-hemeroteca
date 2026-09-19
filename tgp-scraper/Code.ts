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

// Handler GET — sirve los registros forenses como JSON estructurado
function doGet(e?: any): GoogleAppsScript.Content.TextOutput {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // Verificación de token básico
  const QUERY_TOKEN = "forense2026"; // Cambia este valor y refleja en PUBLIC_GAS_FORENSIC_TOKEN del .env de Astro
  const receivedToken = e && e.parameter && e.parameter.token ? e.parameter.token : "";
  if (receivedToken !== QUERY_TOKEN) {
    const denied = ContentService.createTextOutput(
      JSON.stringify({ status: "unauthorized", message: "Token inválido." })
    ).setMimeType(ContentService.MimeType.JSON);
    return denied;
  }

  try {
    const doc = DocumentApp.openById(DOC_ID);
    const body = doc.getBody();
    const numChildren = body.getNumChildren();

    const registros: any[] = [];
    let currentRecord: any = null;
    let currentSection = "";

    for (let i = 0; i < numChildren; i++) {
      const child = body.getChild(i);
      const childType = child.getType();

      if (childType === DocumentApp.ElementType.PARAGRAPH) {
        const para = child.asParagraph();
        const heading = para.getHeading();
        const text = para.getText().trim();

        if (!text) continue;

        const isRecordHeader =
          heading === DocumentApp.ParagraphHeading.HEADING2 ||
          heading === DocumentApp.ParagraphHeading.HEADING1 ||
          /Registro Forense/i.test(text) ||
          (/^📅/.test(text) && /\d{4}-\d{2}-\d{2}/.test(text));

        if (isRecordHeader) {
          // Nuevo bloque de registro forense (ej: "📅 Registro Forense: 2026-09-19 03:30:00")
          if (currentRecord) registros.push(currentRecord);
          const tsMatch = text.match(/(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?)/);
          currentRecord = {
            timestamp: tsMatch ? tsMatch[1] : text.replace(/^📅\s*/, ''),
            analisis_imagen: "",
            plots_principales: [] as string[],
            aportes_secundarios: [] as string[],
            imagenes: [] as string[]
          };
          currentSection = "";
        } else if (heading === DocumentApp.ParagraphHeading.HEADING3 && currentRecord) {
          if (text.includes("Visual") || text.includes("Imagen") || text.includes("imagen")) {
            currentSection = "analisis";
          } else if (text.includes("Plot") || text.includes("Principal")) {
            currentSection = "plots";
          } else if (text.includes("Aporte") || text.includes("Secundari") || text.includes("Contexto")) {
            currentSection = "aportes";
          }
        } else if (heading === DocumentApp.ParagraphHeading.NORMAL && currentRecord) {
          if (currentSection === "analisis") {
            currentRecord.analisis_imagen += (currentRecord.analisis_imagen ? " " : "") + text;
          }
        }
      } else if (childType === DocumentApp.ElementType.LIST_ITEM && currentRecord) {
        const item = child.asListItem();
        const itemText = item.getText().trim();
        if (!itemText) continue;
        if (currentSection === "plots") {
          currentRecord.plots_principales.push(itemText);
        } else if (currentSection === "aportes") {
          currentRecord.aportes_secundarios.push(itemText);
        }
      }
    }

    if (currentRecord) registros.push(currentRecord);

    // Más recientes primero
    registros.reverse();

    const output = ContentService.createTextOutput(
      JSON.stringify({
        status: "ok",
        total: registros.length,
        registros: registros
      })
    ).setMimeType(ContentService.MimeType.JSON);

    return output;
  } catch (error: any) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.message || String(error) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
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

