// Módulo de notificación por Telegram

function sendTelegramNotification(
  docId: string,
  summaryNotes?: string
): void {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    Logger.log("Telegram no configurado: omitiendo notificación.");
    return;
  }

  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
  let text = `🚀 *Extractor Forense - Análisis Listo*\n\nSe ha completado el análisis y vaciado de datos forenses en Google Docs.\n\n🔗 *Documento:* [Abrir en Google Docs](${docUrl})`;

  if (summaryNotes) {
    text += `\n\n📌 *Contexto:* ${summaryNotes}`;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: "Markdown",
    disable_web_page_preview: false
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code !== 200) {
    Logger.log(`Aviso Telegram (${code}): ${response.getContentText()}`);
  }
}
