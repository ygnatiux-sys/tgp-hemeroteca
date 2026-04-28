const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/ygnat/tgp-hemeroteca/src/content/ensayos/';
const folders = fs.readdirSync(baseDir);

console.log('🚀 Iniciando migración de datos de Ensayos...');

folders.forEach(folder => {
    const jsonPath = path.join(baseDir, folder, 'index.json');
    if (fs.existsSync(jsonPath)) {
        try {
            let data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            let changed = false;

            // Si 'generador' tiene contenido largo, es el ensayo antiguo
            if (data.generador && data.generador.length > 50) {
                console.log(` - Migrando contenido en: ${folder}`);
                data.generadorTexto = data.generador;
                data.generador = "Gemini-1.5-Pro";
                changed = true;
            } else if (!data.generador) {
                // Si no tiene la llave, la añadimos vacía o con default
                data.generador = "Gemini-1.5-Pro";
                changed = true;
            }

            // Asegurar que 'notasInvestigador' existe para evitar campos vacíos si se desea
            if (data.notasInvestigador === undefined) {
                data.notasInvestigador = "";
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error(` ❌ Error en ${folder}:`, e.message);
        }
    }
});

console.log('✅ Migración completada.');
