// Compiled using tgp-scraper 1.0.0 (TypeScript 4.9.5)
// Entrada principal de la Web App en Google Apps Script
function doPost(e) {
    try {
        var payloadRaw = "";
        if (e && e.postData && e.postData.contents) {
            payloadRaw = e.postData.contents;
        }
        else if (typeof e === "string") {
            payloadRaw = e;
        }
        if (!payloadRaw) {
            throw new Error("No se recibió contenido en el cuerpo de la petición (POST payload vacío).");
        }
        var data = JSON.parse(payloadRaw);
        var imageBase64 = data.image || "";
        var comments = Array.isArray(data.comments) ? data.comments : [];
        // 1. Procesar con Gemini 1.5 Flash
        var analysis = analyzeWithGemini(imageBase64, comments);
        // 2. Insertar en Google Docs
        var doc = DocumentApp.openById(DOC_ID);
        var body = doc.getBody();
        // Divisor
        body.appendHorizontalRule();
        // Fecha y hora formateada
        var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires", "yyyy-MM-dd HH:mm:ss");
        var headerPara = body.appendParagraph("\uD83D\uDCC5 Registro Forense: ".concat(nowStr));
        headerPara.setHeading(DocumentApp.ParagraphHeading.HEADING2);
        // Análisis de la imagen
        if (analysis.analisis_imagen) {
            var imgSection = body.appendParagraph("🖼️ Análisis del Contexto Visual:");
            imgSection.setHeading(DocumentApp.ParagraphHeading.HEADING3);
            body.appendParagraph(analysis.analisis_imagen);
        }
        // Plots principales
        var plotsHeading = body.appendParagraph("🎯 Plots Principales:");
        plotsHeading.setHeading(DocumentApp.ParagraphHeading.HEADING3);
        if (analysis.plots_principales && analysis.plots_principales.length > 0) {
            analysis.plots_principales.forEach(function (plot) {
                body.appendListItem(plot).setGlyphType(DocumentApp.GlyphType.BULLET);
            });
        }
        else {
            body.appendParagraph("*(Sin hallazgos principales registrados)*");
        }
        // Aportes secundarios
        var secHeading = body.appendParagraph("💡 Aportes Secundarios y Contexto:");
        secHeading.setHeading(DocumentApp.ParagraphHeading.HEADING3);
        if (analysis.aportes_secundarios && analysis.aportes_secundarios.length > 0) {
            analysis.aportes_secundarios.forEach(function (aporte) {
                body.appendListItem(aporte).setGlyphType(DocumentApp.GlyphType.BULLET);
            });
        }
        else {
            body.appendParagraph("*(Sin aportes secundarios registrados)*");
        }
        // Espaciado final
        body.appendParagraph("");
        doc.saveAndClose();
        // 3. Notificación a Telegram
        sendTelegramNotification(DOC_ID, analysis.analisis_imagen);
        // 4. Respuesta de éxito
        return ContentService.createTextOutput(JSON.stringify({ status: "success", timestamp: nowStr })).setMimeType(ContentService.MimeType.JSON);
    }
    catch (error) {
        Logger.log("Error en doPost: ".concat(error.message || error));
        return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: error.message || String(error)
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
// Handler GET — sirve los registros forenses como JSON estructurado
function doGet(e) {
    var corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type"
    };
    // Verificación de token básico
    var QUERY_TOKEN = "forense2026"; // Cambia este valor y refleja en PUBLIC_GAS_FORENSIC_TOKEN del .env de Astro
    var receivedToken = e && e.parameter && e.parameter.token ? e.parameter.token : "";
    if (receivedToken !== QUERY_TOKEN) {
        var denied = ContentService.createTextOutput(JSON.stringify({ status: "unauthorized", message: "Token inválido." })).setMimeType(ContentService.MimeType.JSON);
        return denied;
    }
    try {
        var doc = DocumentApp.openById(DOC_ID);
        var body = doc.getBody();
        var numChildren = body.getNumChildren();
        var registros = [];
        var currentRecord = null;
        var currentSection = "";
        for (var i = 0; i < numChildren; i++) {
            var child = body.getChild(i);
            var childType = child.getType();
            if (childType === DocumentApp.ElementType.PARAGRAPH) {
                var para = child.asParagraph();
                var heading = para.getHeading();
                var text = para.getText().trim();
                if (!text)
                    continue;
                var isRecordHeader = heading === DocumentApp.ParagraphHeading.HEADING2 ||
                    heading === DocumentApp.ParagraphHeading.HEADING1 ||
                    /Registro Forense/i.test(text) ||
                    (/^📅/.test(text) && /\d{4}-\d{2}-\d{2}/.test(text));
                if (isRecordHeader) {
                    if (currentRecord)
                        registros.push(currentRecord);
                    var tsMatch = text.match(/(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?)/);
                    currentRecord = {
                        timestamp: tsMatch ? tsMatch[1] : text.replace(/^📅\s*/, ''),
                        analisis_imagen: "",
                        plots_principales: [],
                        aportes_secundarios: [],
                        imagenes: []
                    };
                    currentSection = "";
                }
                else if (heading === DocumentApp.ParagraphHeading.HEADING3 && currentRecord) {
                    if (text.includes("Visual") || text.includes("Imagen") || text.includes("imagen")) {
                        currentSection = "analisis";
                    }
                    else if (text.includes("Plot") || text.includes("Principal")) {
                        currentSection = "plots";
                    }
                    else if (text.includes("Aporte") || text.includes("Secundari") || text.includes("Contexto")) {
                        currentSection = "aportes";
                    }
                }
                else if (heading === DocumentApp.ParagraphHeading.NORMAL && currentRecord) {
                    if (currentSection === "analisis") {
                        currentRecord.analisis_imagen += (currentRecord.analisis_imagen ? " " : "") + text;
                    }
                }
            }
            else if (childType === DocumentApp.ElementType.LIST_ITEM && currentRecord) {
                var item = child.asListItem();
                var itemText = item.getText().trim();
                if (!itemText)
                    continue;
                if (currentSection === "plots") {
                    currentRecord.plots_principales.push(itemText);
                }
                else if (currentSection === "aportes") {
                    currentRecord.aportes_secundarios.push(itemText);
                }
            }
        }
        if (currentRecord)
            registros.push(currentRecord);
        // Más recientes primero
        registros.reverse();
        var output = ContentService.createTextOutput(JSON.stringify({
            status: "ok",
            total: registros.length,
            registros: registros
        })).setMimeType(ContentService.MimeType.JSON);
        return output;
    }
    catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message || String(error) })).setMimeType(ContentService.MimeType.JSON);
    }
}
// Función de prueba manual para disparar autorización de permisos en Google Apps Script
function probarScript() {
    var testPayload = {
        image: "",
        comments: ["Prueba forense: rituales y antropología en redes sociales."]
    };
    var result = doPost(JSON.stringify(testPayload));
    Logger.log("Resultado de probarScript: " + result.getContent());
}
