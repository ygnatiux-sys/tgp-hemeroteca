import fs from 'node:fs';
import path from 'node:path';

const isDryRun = process.argv.includes('--dry-run');

console.log(`\n\x1b[36m🚀 [TGP-SANEADOR] Iniciando saneamiento automático de esquemas Keystatic...\x1b[0m`);
if (isDryRun) {
  console.log(`\x1b[33mℹ️ Modo --dry-run activo. No se aplicarán cambios a disco.\x1b[0m\n`);
}

let totalEnsayosCinematicosSanados = 0;
let totalEnsayosSanados = 0;

// ─── 1. SANEAMIENTO DE ENSAYOS CINEMÁTICOS ───────────────────────────────────
const dirCinematicos = path.resolve('src/content/ensayos-cinematicos');
const allowedCinematicos = new Set([
  'title',
  'generadorTexto',
  'agenteErudito',
  'generador',
  'atmosfera',
  'coverImage',
  'gallery',
  'excerpt',
  'dek',
  'date',
  'content'
]);

if (fs.existsSync(dirCinematicos)) {
  const folders = fs.readdirSync(dirCinematicos, { withFileTypes: true });

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const jsonPath = path.join(dirCinematicos, folder.name, 'index.json');
    if (!fs.existsSync(jsonPath)) continue;

    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(raw);
      let changed = false;
      const reasons = [];

      // A. Normalizar título en español
      if (data.titulo && !data.title) {
        data.title = data.titulo;
        delete data.titulo;
        changed = true;
        reasons.push('titulo ➔ title');
      } else if (data.titulo) {
        delete data.titulo;
        changed = true;
        reasons.push('remover titulo residual');
      }

      // Si no tiene title, generar a partir del nombre del directorio
      if (!data.title) {
        data.title = folder.name
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        changed = true;
        reasons.push('title generado desde slug');
      }

      // B. Normalizar fecha
      if (data.fecha && !data.date) {
        data.date = data.fecha;
        delete data.fecha;
        changed = true;
        reasons.push('fecha ➔ date');
      } else if (data.fecha) {
        delete data.fecha;
        changed = true;
        reasons.push('remover fecha residual');
      }

      // C. Normalizar atmósfera para conditional field de Keystatic
      if (typeof data.atmosfera === 'string') {
        data.atmosfera = { discriminant: data.atmosfera };
        changed = true;
        reasons.push(`atmosfera string ➔ conditional { discriminant: "${data.atmosfera.discriminant}" }`);
      } else if (!data.atmosfera || !data.atmosfera.discriminant) {
        data.atmosfera = { discriminant: 'obsidiana' };
        changed = true;
        reasons.push('atmosfera ➔ default obsidiana');
      }

      // D. Limpiar claves no permitidas
      for (const key of Object.keys(data)) {
        if (!allowedCinematicos.has(key)) {
          delete data[key];
          changed = true;
          reasons.push(`remover clave no permitida: "${key}"`);
        }
      }

      if (changed) {
        totalEnsayosCinematicosSanados++;
        console.log(`\x1b[32m✔ [ensayos-cinematicos]\x1b[0m ${folder.name}: ${reasons.join(', ')}`);
        if (!isDryRun) {
          fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        }
      }
    } catch (err) {
      console.error(`\x1b[31m✖ Error procesando ${folder.name}:\x1b[0m`, err.message);
    }
  }
}

// ─── 2. SANEAMIENTO DE ENSAYOS ESTÁNDAR ───────────────────────────────────────
const dirEnsayos = path.resolve('src/content/ensayos');
const allowedEnsayos = new Set([
  'title',
  'volanta',
  'generador',
  'notasInvestigador',
  'generadorTexto',
  'agenteErudito',
  'bancoImagenesWikimedia',
  'generadorImagen',
  'date',
  'category',
  'themeColor',
  'sitioGeohistorico',
  'publicarConImagen',
  'draft',
  'coverImage',
  'isCinematic',
  'gallery',
  'videoBg',
  'spotifyLink',
  'youtubeLink',
  'excerpt',
  'dek',
  'content'
]);

if (fs.existsSync(dirEnsayos)) {
  const folders = fs.readdirSync(dirEnsayos, { withFileTypes: true });

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const jsonPath = path.join(dirEnsayos, folder.name, 'index.json');
    if (!fs.existsSync(jsonPath)) continue;

    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(raw);
      let changed = false;
      const reasons = [];

      // A. Normalizar título si estuviera en español
      if (data.titulo && !data.title) {
        data.title = data.titulo;
        delete data.titulo;
        changed = true;
        reasons.push('titulo ➔ title');
      }

      // B. Limpiar claves no permitidas (slug, metallicGradient, campos OSINT, etc.)
      for (const key of Object.keys(data)) {
        if (!allowedEnsayos.has(key)) {
          delete data[key];
          changed = true;
          reasons.push(`remover clave no permitida: "${key}"`);
        }
      }

      if (changed) {
        totalEnsayosSanados++;
        console.log(`\x1b[32m✔ [ensayos]\x1b[0m ${folder.name}: ${reasons.join(', ')}`);
        if (!isDryRun) {
          fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        }
      }
    } catch (err) {
      console.error(`\x1b[31m✖ Error procesando ${folder.name}:\x1b[0m`, err.message);
    }
  }
}

console.log(`\n\x1b[35m📊 [RESUMEN]\x1b[0m`);
console.log(`- Ensayos Cinemáticos sanados: ${totalEnsayosCinematicosSanados}`);
console.log(`- Ensayos Estándar sanados:    ${totalEnsayosSanados}`);
console.log(`\x1b[32m✨ ¡Saneamiento completado exitosamente!\x1b[0m\n`);
