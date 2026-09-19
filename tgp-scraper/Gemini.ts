// Módulo de integración con Gemini 1.5 Flash

interface GeminiAnalysisResult {
  analisis_imagen: string;
  plots_principales: string[];
  aportes_secundarios: string[];
}

function analyzeWithGemini(
  imageBase64: string,
  comments: string[]
): GeminiAnalysisResult {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está configurada en Config.ts");
  }

  // Detectar y limpiar prefijo data:image/...;base64, si viene incluido
  let mimeType = "image/jpeg";
  let cleanBase64 = imageBase64;

  const dataUriMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1];
    cleanBase64 = dataUriMatch[2];
  }

  const promptText = `
Eres un analista forense de contenido y redes.
Analiza la imagen adjunta (que corresponde a una captura de publicación o contexto) y examina exhaustivamente la lista de comentarios adjunta.

Instrucciones:
1. "analisis_imagen": Resume de forma concisa qué representa la imagen, elementos clave visibles, texto en pantalla o contexto general de la publicación.
2. "plots_principales": Extrae los argumentos centrales, revelaciones, hipótesis o debates más profundos y significativos de los comentarios.
3. "aportes_secundarios": Extrae detalles adicionales, anécdotas, datos contextuales, menciones o ramificaciones secundarias relevantes.
4. Omite por completo ruido, saludos vacíos, spam, insultos sin contenido y emoticones aislados.
5. Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
{
  "analisis_imagen": "resumen conciso del contexto y contenido visual",
  "plots_principales": ["plot 1", "plot 2", ...],
  "aportes_secundarios": ["aporte 1", "aporte 2", ...]
}

Lista de comentarios extraídos:
${JSON.stringify(comments, null, 2)}
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const parts: any[] = [];

  if (cleanBase64 && cleanBase64.trim().length > 0) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: cleanBase64.trim()
      }
    });
  }

  parts.push({
    text: promptText
  });

  const payload = {
    contents: [
      {
        parts: parts
      }
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.2
    }
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`Error en API Gemini (${responseCode}): ${responseText}`);
  }

  const jsonResponse = JSON.parse(responseText);
  const candidateText =
    jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    return JSON.parse(candidateText) as GeminiAnalysisResult;
  } catch (err) {
    throw new Error(`Fallo al parsear respuesta JSON de Gemini: ${candidateText}`);
  }
}
