import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const ensayosDir = path.join(rootDir, 'src', 'content', 'ensayos');

console.log('🧹 Iniciando saneamiento profundo de la colección de ensayos...');

const folders = fs.readdirSync(ensayosDir);
let migratedTextCount = 0;
let cleanedJsonCount = 0;
let fixedCoverCount = 0;
let fixedDateCount = 0;

const todayStr = new Date().toISOString().split('T')[0];

for (const folder of folders) {
  const essayPath = path.join(ensayosDir, folder);
  if (!fs.statSync(essayPath).isDirectory()) continue;

  const jsonPath = path.join(essayPath, 'index.json');
  const mdocPath = path.join(essayPath, 'content.mdoc');

  if (fs.existsSync(jsonPath)) {
    try {
      const rawJson = fs.readFileSync(jsonPath, 'utf-8');
      let data = JSON.parse(rawJson);

      // 1. Migrar generadorTexto a content.mdoc si mdoc está vacío o no existe
      let mdocContent = '';
      if (fs.existsSync(mdocPath)) {
        mdocContent = fs.readFileSync(mdocPath, 'utf-8').trim();
      }

      if ((!mdocContent || mdocContent.length === 0) && data.generadorTexto && data.generadorTexto.trim().length > 0) {
        fs.writeFileSync(mdocPath, data.generadorTexto.trim(), 'utf-8');
        console.log(`  📄 [${folder}] Texto migrado de index.json -> content.mdoc`);
        migratedTextCount++;
      }

      // 2. Asignar fecha por defecto si no existe
      if (!data.date) {
        data.date = todayStr;
        fixedDateCount++;
      }

      // 3. Corregir rutas relativas de coverImage (ej: "coverImage.png")
      if (data.coverImage && typeof data.coverImage === 'string' && !data.coverImage.startsWith('/') && !data.coverImage.startsWith('http')) {
        const fixedPath = `/src/assets/ensayos/${folder}/${data.coverImage}`;
        data.coverImage = fixedPath;
        console.log(`  🖼️ [${folder}] Ruta de portada corregida -> ${fixedPath}`);
        fixedCoverCount++;
      }

      // 4. Limpiar strings escapados de bancoImagenesWikimedia o generadorImagen
      if (data.bancoImagenesWikimedia === '""' || data.bancoImagenesWikimedia === '""') {
        data.bancoImagenesWikimedia = '';
      }
      if (data.generadorImagen === '""' || data.generadorImagen === '""') {
        data.generadorImagen = '';
      }

      // 5. Limpiar campo generadorTexto de index.json para alivianar el índice
      if ('generadorTexto' in data) {
        delete data.generadorTexto;
        cleanedJsonCount++;
      }

      // Reescribir index.json limpio y formateado
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

    } catch (e) {
      console.error(`❌ Error en ensayo [${folder}]:`, e.message);
    }
  }
}

console.log(`\n✅ Saneamiento completado:`);
console.log(`   - Ensayos con texto migrado a .mdoc: ${migratedTextCount}`);
console.log(`   - Rutas de portada corregidas: ${fixedCoverCount}`);
console.log(`   - Fechas asignadas/normalizadas: ${fixedDateCount}`);
console.log(`   - Archivos index.json limpiados: ${cleanedJsonCount}\n`);
