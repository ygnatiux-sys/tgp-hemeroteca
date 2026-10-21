// tgp-mind/scripts/import-memory-firestore.mjs
// Script de sincronización: Lee la memoria consolidada en GCS Iowa (gs://tgp-mind-memoria-iowa/corpus/)
// y la estructura en Cloud Firestore bajo la colección 'tgp_foundational_memory'

import { execSync } from 'node:child_process';
import { Firestore } from '@google-cloud/firestore';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.DIALOGFLOW_PROJECT_ID || 'tgp-mind';
console.log(`[Import Memory] Conectando a Cloud Firestore en proyecto: ${PROJECT_ID}...`);

const db = new Firestore({ projectId: PROJECT_ID });
const COLLECTION_NAME = 'tgp_foundational_memory';

function readGcsFile(gcsPath) {
  try {
    console.log(`[GCS Read] Leyendo: ${gcsPath}...`);
    const stdout = execSync(`gcloud storage cat "${gcsPath}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024
    });
    return stdout;
  } catch (err) {
    console.warn(`[GCS Read] Error leyendo ${gcsPath}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Iniciando sincronización GCS Iowa -> Cloud Firestore...');

  // 1. Manifiesto Original
  const rawManifesto = readGcsFile('gs://tgp-mind-memoria-iowa/corpus/MANIFIESTO ORIGINAL DE TGP-MIND.txt') || '';
  if (rawManifesto) {
    await db.collection(COLLECTION_NAME).doc('manifiesto_fundacional').set({
      titulo: 'Documento Fundacional y Ontológico: The Great Puzzle Project (TGP)',
      autor: 'Xavier Benítez',
      proyecto: 'The Great Puzzle Project',
      motor: 'tgp-mind',
      contenido: rawManifesto.trim(),
      actualizadoEl: new Date().toISOString()
    });
    console.log('✅ Documento [manifiesto_fundacional] guardado en Firestore');
  }

  // 2. Editorial y Filosofía de Xavier Benítez (Pensamiento Argentino, Arqueosemiótica)
  const rawFilosofia = readGcsFile('gs://tgp-mind-memoria-iowa/corpus/02_TGP_Editorial_Arqueologia_Filosofia.md') || '';
  // Extraer las directrices clave de tono y pensamiento para que quepan óptimamente
  const nucleoPensamiento = `
Eres el socio intelectual y compagnon de investigación de Xavier Benítez en The Great Puzzle Project (TGP).
Tu tono es el de un ensayista argentino culto, lúcido, agudo y humano (en la línea de Borges y Bioy Casares), especializado en arqueología anómala, arquitectura megalítica, cronologías disidentes y el misterio del Holoceno.

PRINCIPIOS COGNITIVOS Y ONTOLÓGICOS DE XAVIER BENÍTEZ:
1. El Rompecabezas (The Great Puzzle): Estudio de sistemas complejos. La interacción de variables geográficas, artefactos arqueológicos, mitos fundacionales y estructuras de poder.
2. Palimpsesto Cultural: Estratificación de la memoria humana. Las civilizaciones no borran el pasado; lo reescriben sobre los mismos estratos y piedras.
3. Dark Academia & Rigor Dialéctico: Rechazo de la superficialidad y la autoayuda. Densidad conceptual accesible, rigor terminológico, dialéctica estoica (Séneca, Nietzsche, Borges) y asombro cósmico (Carl Sagan).
4. Tensión Mítica vs. Materialidad: Diálogo entre la heurística del símbolo (cómo la mente procesa el miedo y el tiempo) y las condiciones técnicas/económicas de la supervivencia.
5. Veto Estricto a Metacomentarios: Cero saludos vacíos, cero "Aquí tienes el texto", cero condescendencia. Entrada directa al nudo conceptual.
`.trim();

  await db.collection(COLLECTION_NAME).doc('pensamiento_filosofico').set({
    titulo: 'Filosofía, Identidad y Tono Ensayístico Argentino de Xavier Benítez',
    nucleo: nucleoPensamiento,
    extractoCorpus: rawFilosofia.slice(0, 150000), // Muestra rica del corpus dentro del límite de 1MB de Firestore
    actualizadoEl: new Date().toISOString()
  });
  console.log('✅ Documento [pensamiento_filosofico] guardado en Firestore');

  // 3. Criterios de Arquitectura y Operatividad
  const rawArq = readGcsFile('gs://tgp-mind-memoria-iowa/corpus/01_TGP_Arquitectura_Web_Dev_Patrones.md') || '';
  const rawDevops = readGcsFile('gs://tgp-mind-memoria-iowa/corpus/03_TGP_Soluciones_Bugs_y_DevOps.md') || '';

  const nucleoOperativo = `
REGLAS MAESTRAS DE ARQUITECTURA TGP (ZERO-FOOTPRINT):
1. Ecosistema Multicanal: Dominio central thegreatpuzzleproject.com, TGP Alternative (/ensayos), TGP Hemeroteca (/hemeroteca), TGP Ediciones (/magazine), Bóveda R2 Vault (storage.thegreatpuzzleproject.com).
2. Seguridad de Credenciales: Jamás tocar, renombrar ni sobrescribir los tokens de Telegram (OMNI_TOKEN, ASSISTANT_TOKEN, REDES_TOKEN) ni variables Cloudflare/Google en .env.
3. Despliegues Cloud Run Eficientes: Cero CPU ociosa ($0 idle cost). No usar --no-cpu-throttling. Webhooks de Telegram responden 200 OK inmediatamente para evitar bucles.
4. Preservación Legacy: Toda función de publicación existente se respeta como Tool autónoma.
`.trim();

  await db.collection(COLLECTION_NAME).doc('criterios_operativos').set({
    titulo: 'Criterios Operativos, DevOps y Arquitectura de Sistemas TGP',
    nucleo: nucleoOperativo,
    extractoArquitectura: rawArq.slice(0, 100000),
    extractoDevops: rawDevops.slice(0, 100000),
    actualizadoEl: new Date().toISOString()
  });
  console.log('✅ Documento [criterios_operativos] guardado en Firestore');

  // 4. Códice Maestro de Doctrina y Estilo de Xavier Benítez
  const codicePath = path.resolve(__dirname, '../corpus/04_TGP_Codice_Maestro_Doctrina_Xavier_Benitez.md');
  try {
    const rawCodice = (await import('node:fs')).readFileSync(codicePath, 'utf-8');
    await db.collection(COLLECTION_NAME).doc('doctrina_codice_maestro_xavier_benitez').set({
      titulo: 'Códice Maestro: Arquitectura Cognitiva, Doctrina y Estilo de Xavier Benítez (The Great Puzzle Project)',
      autor: 'Xavier Benítez',
      proyecto: 'The Great Puzzle Project',
      categoria: 'Doctrina / Corpus Epistémico / Matriz Estilística',
      tipo: 'corpus_doctrina_maestra',
      contenido: rawCodice.trim(),
      actualizadoEl: new Date().toISOString()
    });
    console.log('✅ Documento [doctrina_codice_maestro_xavier_benitez] guardado en Firestore');
  } catch (cErr) {
    console.warn('⚠️ No se pudo leer el archivo local del Códice Maestro:', cErr.message);
  }

  console.log('🎉 Sincronización a Cloud Firestore completada con éxito.');
}

main().catch(err => {
  console.error('❌ Error en script de sincronización:', err);
  process.exit(1);
});
