// background.js — Service Worker Inmune a CSP

const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbxDAInTvmvfJZsMKbgpkYAP8wEedpAvRIv5t2s_QcNbUUaZp8h2bMr5A9XoII2_5C9hCw/exec";

// 1. Inyectar content.js cuando el usuario hace clic en el icono de la extensión
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  } catch (err) {
    console.error("[TGP Background] Error al inyectar content.js:", err);
  }
});

// Función auxiliar para convertir Blob/ArrayBuffer a Base64 en Service Worker
async function fetchImageAsBase64(imageUrl) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return "";
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.warn("[TGP Background] No se pudo descargar la imagen remota:", err);
    return "";
  }
}

// 2. Escuchar datos extraídos desde content.js y enviar a Google Apps Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PROCESS_FORENSIC_CAPTURE") {
    (async () => {
      try {
        const payload = request.payload || {};

        // Si el canvas de content.js fue bloqueado por CORS, el Service Worker descarga la imagen directamente
        if (!payload.image && payload.imageUrl) {
          console.log("[TGP Background] Descargando imagen con privilegios de extensión:", payload.imageUrl);
          payload.image = await fetchImageAsBase64(payload.imageUrl);
        }

        console.log("[TGP Background] Despachando payload hacia Google Apps Script...");

        const response = await fetch(ENDPOINT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify({
            image: payload.image || "",
            comments: payload.comments || [],
            metadata: {
              sourceUrl: payload.sourceUrl || "",
              pageTitle: payload.pageTitle || ""
            }
          }),
          redirect: "follow"
        });

        const rawText = await response.text();
        let jsonRes;
        try {
          jsonRes = JSON.parse(rawText);
        } catch {
          jsonRes = { status: response.ok ? "success" : "error", raw: rawText };
        }

        if (response.ok && jsonRes.status !== "error") {
          sendResponse({ success: true, data: jsonRes });
        } else {
          sendResponse({
            success: false,
            error: jsonRes.message || `Servidor respondió con código ${response.status}: ${rawText.slice(0, 150)}`
          });
        }
      } catch (error) {
        console.error("[TGP Background] Error en fetch a Apps Script:", error);
        sendResponse({ success: false, error: error.message || String(error) });
      }
    })();

    return true; // Mantiene el canal abierto para sendResponse asíncrono
  }
});
