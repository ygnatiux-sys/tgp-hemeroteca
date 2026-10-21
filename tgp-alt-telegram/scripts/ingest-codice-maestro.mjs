// tgp-mind/scripts/ingest-codice-maestro.mjs
// Ingesta el Códice Maestro de Xavier Benítez en Cloud Firestore bajo 'tgp_foundational_memory'

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Firestore } from '@google-cloud/firestore';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.DIALOGFLOW_PROJECT_ID || 'tgp-mind';
console.log(`[Ingest Códice] Conectando a Cloud Firestore (Proyecto: ${PROJECT_ID})...`);

const db = new Firestore({ projectId: PROJECT_ID });
const COLLECTION_NAME = 'tgp_foundational_memory';
const DOC_ID = 'doctrina_codice_maestro_xavier_benitez';

const filePath = path.resolve(__dirname, '../corpus/04_TGP_Codice_Maestro_Doctrina_Xavier_Benitez.md');

try {
  const content = readFileSync(filePath, 'utf-8');
  console.log(`[Ingest Códice] Leído archivo local: ${filePath} (${content.length} bytes)`);

  await db.collection(COLLECTION_NAME).doc(DOC_ID).set({
    titulo: 'Códice Maestro: Arquitectura Cognitiva, Doctrina y Estilo de Xavier Benítez (The Great Puzzle Project)',
    autor: 'Xavier Benítez',
    proyecto: 'The Great Puzzle Project',
    categoria: 'Doctrina / Corpus Epistémico / Matriz Estilística',
    tipo: 'corpus_doctrina_maestra',
    contenido: content.trim(),
    actualizadoEl: new Date().toISOString()
  });

  console.log(`✅ ¡Éxito! Documento [${COLLECTION_NAME}/${DOC_ID}] guardado y actualizado en Firestore.`);
  process.exit(0);
} catch (err) {
  console.error('❌ Error guardando en Firestore:', err);
  process.exit(1);
}
