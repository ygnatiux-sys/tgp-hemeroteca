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
// Handler GET auxiliar para verificar estado desde navegador
function doGet() {
    return ContentService.createTextOutput(JSON.stringify({
        status: "online",
        service: "Extractor Forense API",
        timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
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
