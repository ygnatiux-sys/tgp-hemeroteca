import { crearModeloEnsayo, buildDensityInstruction } from '../tgp-mind/src/ia/gemini.js';

async function main() {
    try {
        const tema = "la influencia del estoicismo en la arquitectura moderna";
        const cantSecciones = 3;
        const modelName = "gemini-3.8-flash";
        const densidad = "profundo_breve"; // Tier 2
        
        console.log("Iniciando prueba de generación de contenido (Bot Hemeroteca)...");
        console.log(`Tema: ${tema}`);
        console.log(`Secciones: ${cantSecciones}`);
        console.log(`Densidad: ${densidad}`);
        
        const densityDirective = buildDensityInstruction(densidad, false);
        const promptGitops = `Desarrolla un ensayo cinemático sobre: "${tema}". Genera exactamente ${cantSecciones} secciones con rigor histórico, filosófico y narrativo. ${densityDirective}`;
        
        const modeloEnsayo = crearModeloEnsayo(cantSecciones, modelName);
        console.log("\nGenerando (esto puede tardar unos segundos)...");
        const result = await modeloEnsayo.generateContent(promptGitops);
        
        const rawResponse = result.response.text();
        console.log("\n=== RESPUESTA CRUDA (JSON) ===");
        console.log(rawResponse);
        
        const parsed = JSON.parse(rawResponse);
        console.log("\n=== RESULTADO PARSEADO ===");
        console.log("Título:", parsed.titulo);
        console.log("Cantidad de secciones:", parsed.secciones?.length);
        if (parsed.secciones && parsed.secciones.length > 0) {
            console.log("Ejemplo Sección 1 (Búsqueda Wikimedia):", parsed.secciones[0].busqueda_wikimedia);
            console.log("Ejemplo Sección 1 (Párrafo):", parsed.secciones[0].parrafo.substring(0, 150) + "...");
        }
        console.log("===========================");
    } catch (e) {
        console.error("Error durante el test:", e);
    }
}

main();
