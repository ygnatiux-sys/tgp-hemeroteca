// tgp-mind/scripts/sync-codice-config.mjs
// Sincroniza el Códice Maestro + Catálogo de Obra en Firestore bajo tgp_config y tgp_foundational_memory

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Firestore } from '@google-cloud/firestore';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.DIALOGFLOW_PROJECT_ID || 'tgp-mind';
console.log(`[Sync Códice & Config] Conectando a Cloud Firestore (Proyecto: ${PROJECT_ID})...`);

const db = new Firestore({ projectId: PROJECT_ID });

async function main() {
  const codicePath = path.resolve(__dirname, '../corpus/04_TGP_Codice_Maestro_Doctrina_Xavier_Benitez.md');
  const catalogoPath = path.resolve(__dirname, '../corpus/05_TGP_Catalogo_Obra_Tesis_Dossiers_Xavier_Benitez.md');

  const rawCodice = readFileSync(codicePath, 'utf-8');
  const rawCatalogo = readFileSync(catalogoPath, 'utf-8');

  const corpusCompleto = `${rawCodice}\n\n---\n\n${rawCatalogo}`.trim();

  // 1. Guardar en tgp_config/doctrina_xavier_benitez
  await db.collection('tgp_config').doc('doctrina_xavier_benitez').set({
    titulo: 'Códice Maestro y Catálogo General de Obra — Xavier Benítez (TGP)',
    autor: 'Xavier Benítez',
    proyecto: 'The Great Puzzle Project',
    contenido: corpusCompleto,
    codice_estilo: rawCodice.trim(),
    catalogo_obras_tesis: rawCatalogo.trim(),
    actualizadoEl: new Date().toISOString()
  });
  console.log('✅ Documento [tgp_config/doctrina_xavier_benitez] actualizado en Firestore.');

  // 2. Guardar en tgp_foundational_memory/doctrina_codice_maestro_xavier_benitez
  await db.collection('tgp_foundational_memory').doc('doctrina_codice_maestro_xavier_benitez').set({
    titulo: 'Códice Maestro y Catálogo de Tesis: Xavier Benítez',
    contenido: corpusCompleto,
    actualizadoEl: new Date().toISOString()
  });
  console.log('✅ Documento [tgp_foundational_memory/doctrina_codice_maestro_xavier_benitez] actualizado en Firestore.');

  // 3. Inicializar tgp_config/authorized_users
  await db.collection('tgp_config').doc('authorized_users').set({
    chat_ids: [7886507052],
    owner: 'Xavier Benítez',
    actualizadoEl: new Date().toISOString()
  }, { merge: true });
  console.log('✅ Documento [tgp_config/authorized_users] verificado en Firestore.');

  console.log('🎉 Sincronización completada exitosamente.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error en sincronización:', err);
  process.exit(1);
});
