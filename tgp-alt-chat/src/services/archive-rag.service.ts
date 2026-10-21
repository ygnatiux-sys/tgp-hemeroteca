// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Servicio Firebase / Firestore RAG (Silos de Archivo)
// ─────────────────────────────────────────────────────────────────────────────
import { getFoundationalContext } from '../storage/companion-memory.js';
import { buildSilosXML } from '../ia/codice-xavier-benitez.js';

export interface RAGQueryResult {
  bibliotecaAlternativa: string;
  adnAutoral: string;
  cienciaGrounded: string;
  silosXML: string;
  fuentes: string[];
}

/**
 * Consulta fragmentos y documentos de memoria fundacional en Firestore
 * para nutrir los 3 silos XML (<silo_biblioteca_alternativa>, <silo_ciencia_grounded>, <silo_adn_autoral>).
 */
export async function consultarSilosRAG(
  query: string,
  options: { includeAlternativePdfs?: boolean } = {}
): Promise<RAGQueryResult> {
  const foundational = await getFoundationalContext();
  const fuentes: string[] = ['Firestore / tgp_foundational_memory'];

  let bibliotecaAlternativa = `Notas de campo sobre anomalías empíricas relativas a "${query}":
- Catastrofismo geológico del Holoceno y tensiones estratigráficas.
- Desglose de erosión climática vs. datación convencional.
- Hipótesis de la Tercera Vía TGP (sin esoterismo acrítico).`;

  try {
    // @ts-ignore
    const { Firestore } = await import('@google-cloud/firestore');
    const projectId = process.env.DIALOGFLOW_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'tgp-mind';
    const db = new Firestore({ projectId });

    // Consulta en colección de chunks o dossiers si existe
    const dossierRef = db.collection('tgp_dossiers_alternative');
    const snapshot = await dossierRef.limit(5).get().catch(() => null);

    if (snapshot && !snapshot.empty) {
      const chunks: string[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data?.contenido || data?.texto) {
          chunks.push(`[Documento: ${doc.id}]: ${(data.contenido || data.texto).slice(0, 500)}`);
          fuentes.push(`Firestore: ${doc.id}`);
        }
      });
      if (chunks.length > 0) {
        bibliotecaAlternativa += '\n\n' + chunks.join('\n\n');
      }
    }
  } catch (err: any) {
    console.warn('[Archive RAG] Aviso consultando Firestore:', err?.message || err);
  }

  const adnAutoral = `
${foundational.pensamiento_filosofico}
---
${foundational.doctrina_codice_maestro}
---
[DIRECTRICES ONTOLÓGICAS TGP]:
${foundational.manifiesto_fundacional.slice(0, 1500)}
`.trim();

  const cienciaGrounded = `
- Foco material estricto sobre: "${query}".
- Datación por radiocarbono, estratigrafía forense y registro arqueológico comprobable.
- Distinción explícita entre lo comprobado en laboratorio y las hipótesis abiertas.
`.trim();

  const silosXML = buildSilosXML({
    bibliotecaAlternativa,
    cienciaGrounded,
    adnAutoral,
  });

  return {
    bibliotecaAlternativa,
    adnAutoral,
    cienciaGrounded,
    silosXML,
    fuentes,
  };
}
