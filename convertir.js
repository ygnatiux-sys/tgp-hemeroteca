/**
 * convertir.js — Conversor y Optimizador Automático de Imágenes TGP
 *
 * Lee imágenes desde la carpeta "Fotos_Para_Convertir" en el Escritorio
 * (o desde ./fotos_entrada en el proyecto) y las convierte a WebP optimizado
 * de alta calidad en "Fotos_Convertidas_TGP" en tu Escritorio.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// ── RUTAS PRINCIPALES ────────────────────────────────────────────────────────
const USER_HOME = process.env.USERPROFILE || 'C:\\Users\\ygnat';
const DESKTOP_DIR = path.join(USER_HOME, 'Desktop');

// Carpetas de trabajo en el Escritorio
const DESKTOP_INPUT_DIR = path.join(DESKTOP_DIR, 'Fotos_Para_Convertir');
const DESKTOP_OUTPUT_DIR = path.join(DESKTOP_DIR, 'Fotos_Convertidas_TGP');

// Carpeta local alternativa dentro del proyecto
const LOCAL_INPUT_DIR = path.resolve('fotos_entrada');

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.bmp']);

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function processImages() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   📸 TGP — CONVERSOR Y OPTIMIZADOR INTELIGENTE DE FOTOS       ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Asegurar existencia de carpetas
  if (!fs.existsSync(DESKTOP_INPUT_DIR)) {
    fs.mkdirSync(DESKTOP_INPUT_DIR, { recursive: true });
    console.log(`📁 Carpeta creada en tu Escritorio: [Fotos_Para_Convertir]`);
  }
  if (!fs.existsSync(DESKTOP_OUTPUT_DIR)) {
    fs.mkdirSync(DESKTOP_OUTPUT_DIR, { recursive: true });
  }

  // Buscar archivos en la carpeta del Escritorio y en la local
  const scanDirs = [DESKTOP_INPUT_DIR];
  if (fs.existsSync(LOCAL_INPUT_DIR)) {
    scanDirs.push(LOCAL_INPUT_DIR);
  }

  let filesToProcess = [];
  for (const dir of scanDirs) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const ext = path.extname(item).toLowerCase();
        if (SUPPORTED_EXTS.has(ext) && fs.statSync(fullPath).isFile()) {
          filesToProcess.push({ fullPath, filename: item, sourceDir: dir });
        }
      }
    } catch (e) {
      // Ignorar directorios no legibles
    }
  }

  if (filesToProcess.length === 0) {
    console.log('ℹ️  No hay fotos para convertir.');
    console.log(`👉 Coloca las imágenes que quieras procesar dentro de la carpeta:`);
    console.log(`   ${DESKTOP_INPUT_DIR}`);
    console.log(`   y vuelve a hacer doble clic en convertir_fotos.bat.\n`);
    return;
  }

  console.log(`🔍 Se encontraron ${filesToProcess.length} foto(s) para procesar.\n`);

  let convertedCount = 0;
  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;
  const startTime = Date.now();

  for (const file of filesToProcess) {
    const originalStats = fs.statSync(file.fullPath);
    const originalSize = originalStats.size;
    totalOriginalBytes += originalSize;

    const baseName = path.parse(file.filename).name;
    const outputFilename = `${baseName}.webp`;
    const outputPath = path.join(DESKTOP_OUTPUT_DIR, outputFilename);

    try {
      // Reglas de optimización:
      // - Max width 2560px respetando ratio (sin agrandar si es menor)
      // - WebP q82 con compresión inteligente
      await sharp(file.fullPath)
        .rotate() // Respeta orientación EXIF
        .resize({
          width: 2560,
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({
          quality: 82,
          effort: 5,
          smartSubsample: true
        })
        .toFile(outputPath);

      const newStats = fs.statSync(outputPath);
      const newSize = newStats.size;
      totalOptimizedBytes += newSize;

      const savingPercent = originalSize > 0 
        ? (((originalSize - newSize) / originalSize) * 100).toFixed(1)
        : 0;

      console.log(`✓ [${convertedCount + 1}/${filesToProcess.length}] ${file.filename}`);
      console.log(`   -> ${outputFilename} | ${formatBytes(originalSize)} -> ${formatBytes(newSize)} (-${savingPercent}%)\n`);

      convertedCount++;
    } catch (err) {
      console.error(`❌ Error procesando ${file.filename}: ${err.message}\n`);
    }
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalSaved = totalOriginalBytes - totalOptimizedBytes;
  const totalPercent = totalOriginalBytes > 0 
    ? ((totalSaved / totalOriginalBytes) * 100).toFixed(1) 
    : 0;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🎉 ¡PROCESO COMPLETADO EN ${elapsedSec}s!`);
  console.log(`• Fotos convertidas: ${convertedCount} de ${filesToProcess.length}`);
  console.log(`• Peso original:     ${formatBytes(totalOriginalBytes)}`);
  console.log(`• Peso final:        ${formatBytes(totalOptimizedBytes)}`);
  console.log(`• Ahorro total:      ${formatBytes(totalSaved)} (-${totalPercent}%)`);
  console.log(`📂 Revisa tus fotos optimizadas en:`);
  console.log(`   ${DESKTOP_OUTPUT_DIR}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

processImages();
