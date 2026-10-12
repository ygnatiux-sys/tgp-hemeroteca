#!/usr/bin/env node
/**
 * scripts/db-tools/generate_d1_batches.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generador de lotes SQL (batches) para Cloudflare D1 en Node.js nativo.
 * Fragmenta volcados SQL grandes (panlingua.sql) en archivos de 50.000 registros
 * (panlingua_batches/part_XX.sql) para cumplir los límites de Cloudflare D1.
 * ─────────────────────────────────────────────────────────────────────────────
 * Uso:
 *   node scripts/db-tools/generate_d1_batches.js
 *   node scripts/db-tools/generate_d1_batches.js panlingua.sql panlingua_batches 50000
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, createReadStream, createWriteStream, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../..');

const DEFAULT_BATCH_SIZE = 50000;
const TABLE_NAME = 'lexico_periferico';

const inputFile = resolve(ROOT_DIR, process.argv[2] || 'panlingua.sql');
const outputDir = resolve(ROOT_DIR, process.argv[3] || 'panlingua_batches');
const batchSize = parseInt(process.argv[4] || `${DEFAULT_BATCH_SIZE}`, 10);

if (!existsSync(inputFile)) {
  console.error(`❌ Error: El archivo fuente '${inputFile}' no existe.`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

const sizeMB = (statSync(inputFile).size / (1024 * 1024)).toFixed(2);
console.log(`\n============================================================`);
console.log(`📦 [D1 Batch Generator] Dividiendo SQL en lotes (Node.js)`);
console.log(`📄 Archivo origen: ${inputFile} (${sizeMB} MB)`);
console.log(`📁 Directorio destino: ${outputDir}`);
console.log(`🔢 Tamaño de lote: ${batchSize} registros por archivo`);
console.log(`============================================================\n`);

let currentBatch = 1;
let currentCount = 0;
let totalRecords = 0;

function getBatchPath(batchNum) {
  const pad = String(batchNum).padStart(2, '0');
  return resolve(outputDir, `part_${pad}.sql`);
}

let currentBatchPath = getBatchPath(currentBatch);
let currentStream = createWriteStream(currentBatchPath, { encoding: 'utf-8' });
currentStream.write(`INSERT INTO ${TABLE_NAME} VALUES `);

const rl = readline.createInterface({
  input: createReadStream(inputFile, { encoding: 'utf-8' }),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  const stripped = line.trim();
  if (!stripped) return;

  const upper = stripped.toUpperCase();
  if (
    upper.startsWith('CREATE TABLE') ||
    upper.startsWith('DROP TABLE') ||
    upper.startsWith('BEGIN TRANSACTION') ||
    upper.startsWith('COMMIT') ||
    upper.startsWith('PRAGMA')
  ) {
    return;
  }

  if (stripped.startsWith('(') || stripped.includes("('")) {
    let cleanTuple = stripped.replace(/[;,]+$/, '');
    if (cleanTuple.endsWith(')')) {
      if (currentCount > 0) {
        currentStream.write(',\n');
      } else {
        currentStream.write('\n');
      }

      currentStream.write(cleanTuple);
      currentCount++;
      totalRecords++;

      if (currentCount >= batchSize) {
        currentStream.write(';\n');
        currentStream.end();
        console.log(`  ✓ Generado part_${String(currentBatch).padStart(2, '0')}.sql (${currentCount} registros)`);
        currentBatch++;
        currentCount = 0;
        currentBatchPath = getBatchPath(currentBatch);
        currentStream = createWriteStream(currentBatchPath, { encoding: 'utf-8' });
        currentStream.write(`INSERT INTO ${TABLE_NAME} VALUES `);
      }
    }
  }
});

rl.on('close', () => {
  if (currentCount > 0) {
    currentStream.write(';\n');
    currentStream.end();
    console.log(`  ✓ Generado part_${String(currentBatch).padStart(2, '0')}.sql (${currentCount} registros)`);
  } else {
    currentStream.end();
    try {
      unlinkSync(currentBatchPath);
    } catch {}
    currentBatch--;
  }

  console.log(`\n✅ Proceso completado exitosamente.`);
  console.log(`📊 Total registros procesados: ${totalRecords.toLocaleString()}`);
  console.log(`📁 Total lotes generados: ${currentBatch}`);
  console.log(`\n💡 Para cargar un lote a Cloudflare D1 ejecuta:`);
  console.log(`   npx wrangler d1 execute tgp-panlingua --remote --file=${outputDir}/part_01.sql\n`);
});
