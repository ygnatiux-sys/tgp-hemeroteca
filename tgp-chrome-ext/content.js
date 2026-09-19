// content.js — Extractor Local de DOM (Inyectado en la pestaña activa)

(async function extractAndDispatch() {
  alert("🔍 [TGP Forense] Iniciando captura de contenido...");

  // 1. Extracción de imagen principal
  let imgBase64 = "";
  let imgSrc = "";

  const candidateSelectors = [
    'article img[style*="object-fit: cover"]',
    'div[role="dialog"] img[srcset]',
    'div[role="dialog"] img',
    'div[data-ad-preview="message"] img',
    'article img[src*="fbcdn"]',
    'article img[src*="cdninstagram"]',
    'article img',
    'main img',
    'img'
  ];

  let imgNode = null;
  for (const selector of candidateSelectors) {
    const el = document.querySelector(selector);
    if (el && (el.naturalWidth > 150 || el.width > 150)) {
      imgNode = el;
      break;
    }
  }

  if (!imgNode) {
    imgNode = document.querySelector('img');
  }

  if (imgNode) {
    imgSrc = imgNode.currentSrc || imgNode.src || "";
    try {
      const canvas = document.createElement("canvas");
      canvas.width = imgNode.naturalWidth || imgNode.width || 600;
      canvas.height = imgNode.naturalHeight || imgNode.height || 600;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imgNode, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (dataUrl.includes(",")) {
        imgBase64 = dataUrl.split(",")[1];
      }
    } catch (e) {
      console.warn("[TGP Forense] Canvas local restringido por CORS; delegando descarga al Service Worker.");
    }
  }

  // 2. Extracción de comentarios y textos de la publicación
  const textSelectors = [
    'span[dir="auto"]',
    'div[dir="auto"]',
    'div[data-ad-preview="message"]',
    'div[role="article"] span',
    'article span',
    'p'
  ];

  const textNodes = document.querySelectorAll(textSelectors.join(", "));
  const commentsSet = new Set();

  textNodes.forEach((node) => {
    const text = (node.innerText || "").trim();
    // Filtrar textos muy cortos, botones comunes de redes o duplicados
    if (
      text.length > 2 &&
      !text.match(/^(Me gusta|Responder|Compartir|Ver más|Seguir|Editar|Eliminar|\d+\s*(h|min|sem|d))$/i)
    ) {
      commentsSet.add(text);
    }
  });

  const comments = Array.from(commentsSet);

  if (comments.length === 0 && !imgBase64 && !imgSrc) {
    alert("⚠️ No se encontró contenido legible ni imagen en la vista actual.");
    return;
  }

  console.log(`[TGP Forense] Encontrados ${comments.length} bloques de texto e imagen.`);

  // 3. Enviar al background script (sin hacer fetch directo en la página)
  chrome.runtime.sendMessage(
    {
      action: "PROCESS_FORENSIC_CAPTURE",
      payload: {
        image: imgBase64,
        imageUrl: imgSrc,
        comments: comments,
        sourceUrl: window.location.href,
        pageTitle: document.title
      }
    },
    (response) => {
      if (chrome.runtime.lastError) {
        alert("❌ Error de comunicación con la extensión: " + chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        alert("✅ [TGP Forense] Extracción enviada con éxito al Laboratorio.\nRevisa tu Google Doc y Telegram.");
      } else {
        alert("❌ Error al procesar extracción:\n" + (response?.error || "Respuesta desconocida del servidor"));
      }
    }
  );
})();
