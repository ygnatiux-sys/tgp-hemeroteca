// Compiled using tgp-scraper 1.0.0 (TypeScript 4.9.5)
var exports = exports || {};
var module = module || { exports: exports };
exports.analyzeWithGemini = void 0;
function analyzeWithGemini(imageBase64, comments) {
    var _a, _b, _c, _d, _e;
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY no está configurada en Config.ts");
    }
    // Detectar y limpiar prefijo data:image/...;base64, si viene incluido
    var mimeType = "image/jpeg";
    var cleanBase64 = imageBase64;
    var dataUriMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
    if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        cleanBase64 = dataUriMatch[2];
    }
    var promptText = "\nEres un analista forense de contenido y redes.\nAnaliza la imagen adjunta (que corresponde a una captura de publicaci\u00F3n o contexto) y examina exhaustivamente la lista de comentarios adjunta.\n\nInstrucciones:\n1. \"analisis_imagen\": Resume de forma concisa qu\u00E9 representa la imagen, elementos clave visibles, texto en pantalla o contexto general de la publicaci\u00F3n.\n2. \"plots_principales\": Extrae los argumentos centrales, revelaciones, hip\u00F3tesis o debates m\u00E1s profundos y significativos de los comentarios.\n3. \"aportes_secundarios\": Extrae detalles adicionales, an\u00E9cdotas, datos contextuales, menciones o ramificaciones secundarias relevantes.\n4. Omite por completo ruido, saludos vac\u00EDos, spam, insultos sin contenido y emoticones aislados.\n5. Devuelve EXCLUSIVAMENTE un JSON v\u00E1lido con esta estructura:\n{\n  \"analisis_imagen\": \"resumen conciso del contexto y contenido visual\",\n  \"plots_principales\": [\"plot 1\", \"plot 2\", ...],\n  \"aportes_secundarios\": [\"aporte 1\", \"aporte 2\", ...]\n}\n\nLista de comentarios extra\u00EDdos:\n".concat(JSON.stringify(comments, null, 2), "\n").trim();
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=".concat(GEMINI_API_KEY);
    var payload = {
        contents: [
            {
                parts: [
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: cleanBase64
                        }
                    },
                    {
                        text: promptText
                    }
                ]
            }
        ],
        generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.2
        }
    };
    var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    if (responseCode !== 200) {
        throw new Error("Error en API Gemini (".concat(responseCode, "): ").concat(responseText));
    }
    var jsonResponse = JSON.parse(responseText);
    var candidateText = ((_e = (_d = (_c = (_b = (_a = jsonResponse.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || "{}";
    try {
        return JSON.parse(candidateText);
    }
    catch (err) {
        throw new Error("Fallo al parsear respuesta JSON de Gemini: ".concat(candidateText));
    }
}
exports.analyzeWithGemini = analyzeWithGemini;
