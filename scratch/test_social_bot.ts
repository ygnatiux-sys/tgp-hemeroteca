import { callGemini } from '../tgp-mind/src/ia/gemini.js';

async function main() {
    try {
        const chatId = "test-chat";
        const tema = "la inteligencia artificial en el arte";
        const modelName = "gemini-3.8-flash";
        
        console.log("Iniciando prueba de generación de contenido (Bot Redes Social)...");
        console.log(`Tema: ${tema}`);
        
        const userPrompt = `Genera un texto magnético y reflexivo para redes sociales sobre: ${tema}. Estilo directo, sobrio y atrapante. Máximo 2 párrafos cortos y 3 hashtags.`;
        const SOCIAL_PROMPT = 'Eres un redactor cultural y turístico experto. Crea descripciones grounded basadas en hechos. Tono: Informativo, directo y claro.';
        
        const textoGenerado = await callGemini(`social-${chatId}`, userPrompt, modelName, SOCIAL_PROMPT);
        
        console.log("\n=== TEXTO GENERADO ===");
        console.log(textoGenerado);
        console.log("======================");
    } catch (e) {
        console.error("Error durante el test:", e);
    }
}

main();
