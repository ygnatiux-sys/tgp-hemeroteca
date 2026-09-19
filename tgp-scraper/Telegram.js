// Compiled using tgp-scraper 1.0.0 (TypeScript 4.9.5)
// Módulo de notificación por Telegram
function sendTelegramNotification(docId, summaryNotes) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        Logger.log("Telegram no configurado: omitiendo notificación.");
        return;
    }
    var docUrl = "https://docs.google.com/document/d/".concat(docId, "/edit");
    var text = "\uD83D\uDE80 *Extractor Forense - An\u00E1lisis Listo*\n\nSe ha completado el an\u00E1lisis y vaciado de datos forenses en Google Docs.\n\n\uD83D\uDD17 *Documento:* [Abrir en Google Docs](".concat(docUrl, ")");
    if (summaryNotes) {
        text += "\n\n\uD83D\uDCCC *Contexto:* ".concat(summaryNotes);
    }
    var url = "https://api.telegram.org/bot".concat(TELEGRAM_BOT_TOKEN, "/sendMessage");
    var payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "Markdown",
        disable_web_page_preview: false
    };
    var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    if (code !== 200) {
        Logger.log("Aviso Telegram (".concat(code, "): ").concat(response.getContentText()));
    }
}
