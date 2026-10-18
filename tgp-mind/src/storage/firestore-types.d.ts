// ─────────────────────────────────────────────────────────────────────────────
// Declaración de tipos ambientales para @google-cloud/firestore
// Permite que TypeScript compile limpiamente tanto en local como en Cloud Run.
// ─────────────────────────────────────────────────────────────────────────────

declare module '@google-cloud/firestore' {
  export class Firestore {
    constructor(options?: { projectId?: string; keyFilename?: string; credentials?: any });
    collection(collectionPath: string): any;
    doc(documentPath: string): any;
  }
}
