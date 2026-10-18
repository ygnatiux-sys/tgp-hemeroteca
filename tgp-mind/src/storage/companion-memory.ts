// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Gestor de Memoria y Estado Compagnon (Firestore + Fallback D1)
//
// Responsabilidades:
//   1. Persistir el "working_state" por (chatId + botId):
//      - Resumen vivo del tema en curso, último borrador/ensayo, última acción y URLs.
//   2. Persistir "recent_turns" (máximo 12 turnos limpios).
//   3. Auto-Sanación Anti-Cuelgues (Cero HTTP 400 de Gemini):
//      - Limpia functionCall huérfanos sin functionResponse correspondiente.
//      - Garantiza que el historial empiece siempre con rol 'user'.
//   4. Fallback de doble vía: Si Firestore no está disponible en local,
//      recurre transparentemente a Cloudflare D1 sin interrumpir al usuario.
// ─────────────────────────────────────────────────────────────────────────────

import { appendTurn, getConversationHistory, clearChatHistory, type GeminiTurn, type GeminiPart } from './d1.js';

export interface WorkingState {
  topic?: string;
  lastDraft?: string;
  lastTitle?: string;
  lastSlug?: string;
  lastCollection?: string;
  lastImageUrl?: string;
  lastAudioUrl?: string;
  lastAction?: string;
  targetDestination?: 'hemeroteca' | 'alternative' | 'facebook' | 'tiktok';
  updatedAt: string;
}

export interface CompanionSession {
  chatId: number | string;
  botId: string;
  working_state: WorkingState;
  recent_turns: GeminiTurn[];
}

// Caché en memoria para alta velocidad y fallback inmediato
const sessionCache = new Map<string, CompanionSession>();

let firestoreInstance: any = null;
let firestoreAvailable: boolean | null = null;

async function getFirestoreClient(): Promise<any> {
  if (firestoreAvailable === false) return null;
  if (firestoreInstance) return firestoreInstance;

  try {
    // @ts-ignore - Dependencia opcional para Cloud Run; en local usa fallback D1
    const { Firestore } = await import('@google-cloud/firestore');
    const projectId = process.env.DIALOGFLOW_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'tgp-mind';
    firestoreInstance = new Firestore({ projectId });
    // Prueba rápida de conectividad
    firestoreAvailable = true;
    return firestoreInstance;
  } catch (err: any) {
    console.warn('[Companion Memory] Firestore SDK no disponible o no inicializado. Usando fallback D1 / Memoria local:', err?.message || err);
    firestoreAvailable = false;
    return null;
  }
}

function getSessionKey(chatId: number | string, botId: string): string {
  const safeId = String(chatId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeId}_${botId}`;
}


// ── Auto-Sanación de Turnos (Anti-Cuelgues Gemini) ───────────────────────────
export function sanitizeTurns(rawTurns: GeminiTurn[]): GeminiTurn[] {
  if (!Array.isArray(rawTurns) || rawTurns.length === 0) return [];

  const sanitized: GeminiTurn[] = [];

  for (let i = 0; i < rawTurns.length; i++) {
    const turn = rawTurns[i];
    if (!turn || !Array.isArray(turn.parts) || turn.parts.length === 0) continue;

    const hasFuncCall = turn.parts.some((p: any) => p.functionCall);
    const hasFuncResp = turn.parts.some((p: any) => p.functionResponse);

    // 1. Si es functionResponse, verificar que el turno anterior fuera functionCall emparejado
    if (hasFuncResp) {
      const respName = turn.parts.find((p: any) => p.functionResponse)?.functionResponse?.name;
      const prevTurn = sanitized[sanitized.length - 1];
      const prevHasMatchingCall = prevTurn?.role === 'model' &&
        prevTurn?.parts?.some((p: any) => p.functionCall && p.functionCall.name === respName);

      if (!prevHasMatchingCall) {
        console.warn(`[Auto-Sanación] Descartando functionResponse huérfano "${respName}" sin llamada previa.`);
        continue;
      }
    }

    // 2. Si es functionCall, verificar si el siguiente turno es su respuesta
    if (hasFuncCall) {
      const callName = turn.parts.find((p: any) => p.functionCall)?.functionCall?.name;
      const nextTurn = rawTurns[i + 1];
      const nextHasMatchingResp = nextTurn?.parts?.some(
        (p: any) => p.functionResponse && p.functionResponse.name === callName
      );

      if (!nextHasMatchingResp) {
        console.warn(`[Auto-Sanación] functionCall "${callName}" sin respuesta detectado. Reparando turno para evitar crash de Gemini.`);
        // Si quedó huérfano, lo convertimos en un turno de pensamiento/texto limpio
        sanitized.push({
          role: 'model',
          parts: [{ text: `(Acción previa sobre ${callName} cerrada por actualización)` }],
        });
        continue;
      }
    }

    sanitized.push(turn);
  }

  // 3. Garantizar que la conversación arranque siempre con rol 'user'
  while (sanitized.length > 0 && sanitized[0].role !== 'user') {
    sanitized.shift();
  }

  // 4. Límite estricto de los últimos 12 turnos para economía de tokens
  if (sanitized.length > 12) {
    const trimmed = sanitized.slice(-12);
    while (trimmed.length > 0 && trimmed[0].role !== 'user') {
      trimmed.shift();
    }
    return trimmed;
  }

  return sanitized;
}

// ── Cargar Sesión Completa ──────────────────────────────────────────────────
export async function getCompanionSession(chatId: number | string, botId: string): Promise<CompanionSession> {
  const key = getSessionKey(chatId, botId);

  // 1. Intentar Firestore
  try {
    const db = await getFirestoreClient();
    if (db) {
      const docRef = db.collection('tgp_companion_sessions').doc(key);
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        const data = snapshot.data();
        const session: CompanionSession = {
          chatId,
          botId,
          working_state: data.working_state || { updatedAt: new Date().toISOString() },
          recent_turns: sanitizeTurns(data.recent_turns || []),
        };
        sessionCache.set(key, session);
        return session;
      }
    }
  } catch (err: any) {
    console.warn(`[Companion Memory] Error leyendo Firestore para ${key}:`, err?.message);
  }

  // 2. Fallback a caché en memoria si existe
  if (sessionCache.has(key)) {
    const cached = sessionCache.get(key)!;
    cached.recent_turns = sanitizeTurns(cached.recent_turns);
    return cached;
  }

  // 3. Fallback a D1 (recuperar historial previo de D1 si es numérico)
  const d1Turns = typeof chatId === 'number'
    ? await getConversationHistory(chatId, 12, botId).catch(() => [])
    : [];
  const initialSession: CompanionSession = {
    chatId,
    botId,
    working_state: {
      updatedAt: new Date().toISOString(),
    },
    recent_turns: sanitizeTurns(d1Turns),
  };

  sessionCache.set(key, initialSession);
  return initialSession;
}

// ── Guardar o Actualizar working_state ───────────────────────────────────────
export async function updateWorkingState(
  chatId: number | string,
  botId: string,
  partialState: Partial<WorkingState>,
): Promise<WorkingState> {
  const session = await getCompanionSession(chatId, botId);
  const updatedWorkingState: WorkingState = {
    ...session.working_state,
    ...partialState,
    updatedAt: new Date().toISOString(),
  };

  session.working_state = updatedWorkingState;
  const key = getSessionKey(chatId, botId);
  sessionCache.set(key, session);

  // Persistir en Firestore de manera asíncrona no bloqueante
  try {
    const db = await getFirestoreClient();
    if (db) {
      await db.collection('tgp_companion_sessions').doc(key).set({
        chatId,
        botId,
        working_state: updatedWorkingState,
        recent_turns: session.recent_turns,
        lastSeenAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err: any) {
    console.warn(`[Companion Memory] Error guardando working_state en Firestore (${key}):`, err?.message);
  }

  return updatedWorkingState;
}

// ── Agregar Turno Limpio al Historial ────────────────────────────────────────
export async function appendCompanionTurn(
  chatId: number | string,
  botId: string,
  turn: GeminiTurn,
): Promise<void> {
  const session = await getCompanionSession(chatId, botId);
  session.recent_turns.push(turn);
  session.recent_turns = sanitizeTurns(session.recent_turns);

  const key = getSessionKey(chatId, botId);
  sessionCache.set(key, session);

  // Persistir en Firestore
  try {
    const db = await getFirestoreClient();
    if (db) {
      await db.collection('tgp_companion_sessions').doc(key).set({
        chatId,
        botId,
        working_state: session.working_state,
        recent_turns: session.recent_turns,
        lastSeenAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err: any) {
    console.warn(`[Companion Memory] Error guardando turno en Firestore (${key}):`, err?.message);
  }

  // Resguardo atómico simultáneo en Cloudflare D1 si chatId es numérico
  if (typeof chatId === 'number') {
    try {
      await appendTurn(chatId, turn.role, turn.parts, botId);
    } catch (d1Err: any) {
      console.warn(`[Companion Memory] Error secundario D1 (${key}):`, d1Err?.message);
    }
  }
}

// ── Reiniciar / Sanear Sesión (/reset, /nuevo, /sanear) ───────────────────────
export async function resetCompanionSession(chatId: number | string, botId: string): Promise<void> {
  const key = getSessionKey(chatId, botId);
  sessionCache.delete(key);

  try {
    const db = await getFirestoreClient();
    if (db) {
      await db.collection('tgp_companion_sessions').doc(key).delete();
    }
  } catch (err: any) {
    console.warn(`[Companion Memory] Error borrando sesión en Firestore (${key}):`, err?.message);
  }

  // Limpiar también en D1 si es numérico
  if (typeof chatId === 'number') {
    await clearChatHistory(chatId, botId).catch(() => {});
  }
  console.log(`[Companion Memory] Sesión reseteada completamente para ${key}`);
}

// ── Memoria Fundacional Antigravity (Caché en RAM de bajo costo) ─────────────
export interface FoundationalMemory {
  pensamiento_filosofico: string;
  criterios_operativos: string;
  manifiesto_fundacional: string;
  doctrina_codice_maestro: string;
}

let cachedFoundationalMemory: FoundationalMemory | null = null;
let lastFoundationalFetch = 0;
const FOUNDATIONAL_TTL_MS = 60 * 60 * 1000; // 1 hora de TTL en memoria

export async function getFoundationalContext(): Promise<FoundationalMemory> {
  const now = Date.now();
  if (cachedFoundationalMemory && (now - lastFoundationalFetch < FOUNDATIONAL_TTL_MS)) {
    return cachedFoundationalMemory;
  }

  // Valores predeterminados seguros (Fallback local si no hay conexión)
  const memory: FoundationalMemory = {
    pensamiento_filosofico: `Eres el socio intelectual y compagnon de investigación de Xavier Benítez en The Great Puzzle Project (TGP).
Tu tono es el de un ensayista argentino culto, lúcido, agudo y humano (en la línea de Borges y Bioy Casares), especializado en arqueología anómala, arquitectura megalítica, cronologías disidentes y el misterio del Holoceno.
Escribes en prosa sobria, precisa, cinematográfica y sin condescendencia ni clichés sensacionalistas.`,
    criterios_operativos: `REGLAS MAESTRAS DE ARQUITECTURA TGP (ZERO-FOOTPRINT):
1. Ecosistema Multicanal: thegreatpuzzleproject.com, TGP Alternative (/ensayos), TGP Hemeroteca (/hemeroteca), TGP Ediciones (/magazine), Bóveda R2 Vault (storage.thegreatpuzzleproject.com).
2. Seguridad de Credenciales: Jamás tocar ni alterar tokens de Telegram ni variables Cloudflare/Google en .env.
3. Despliegues Cloud Run Eficientes: Cero CPU ociosa ($0 idle cost). No usar --no-cpu-throttling. Webhooks responden 200 OK inmediatamente.`,
    manifiesto_fundacional: `DOCUMENTO FUNDACIONAL Y ONTOLÓGICO: THE GREAT PUZZLE PROJECT (TGP)
Autor e Investigador Principal: Xavier Benítez.
El Motor Cognitivo (tgp-mind): Socio dialéctico para extraer patrones de comportamiento y sentido de la historia, la arqueología y el pensamiento simbólico.`,
    doctrina_codice_maestro: `CÓDICE MAESTRO DE XAVIER BENÍTEZ (TGP):
1. Arquetipo Cognitivo: Arquitecto Antiescolástico. Rechazo a la escolástica académica y al misticismo ingenuo. Tercera vía: tecnologías somáticas y simbólicas de supervivencia cognitiva.
2. Empatía Trágica: Humanismo somático. El mito y el rito como conjuros ante el abismo de la contingencia y el azar mudo.
3. Glosario: Valor de Sentido como Vara de Oro; Memoria Viva vs. Memoria de Archivo; Los Vivenciales Triples (Nómade -> Sedentario -> Urbano); Estratigrafías Monádicas Arcaicas; Fósiles Performados.
4. Protocolo de Ensayos en 7 Pasos: Apertura por anomalía material concreta -> Anclaje histórico riguroso -> Tesis de transformación/fricción -> Desglose estratigráfico -> Tensión historiográfica -> Puente TGP a la condición humana -> Cierre en destilación filosófica.`
  };

  try {
    const db = await getFirestoreClient();
    if (db) {
      const col = db.collection('tgp_foundational_memory');
      const [docFilosofia, docOperativo, docManifiesto, docCodice] = await Promise.all([
        col.doc('pensamiento_filosofico').get().catch(() => null),
        col.doc('criterios_operativos').get().catch(() => null),
        col.doc('manifiesto_fundacional').get().catch(() => null),
        col.doc('doctrina_codice_maestro_xavier_benitez').get().catch(() => null),
      ]);

      if (docFilosofia?.exists) {
        const data = docFilosofia.data();
        memory.pensamiento_filosofico = data?.nucleo || data?.contenido || memory.pensamiento_filosofico;
      }
      if (docOperativo?.exists) {
        const data = docOperativo.data();
        memory.criterios_operativos = data?.nucleo || data?.contenido || memory.criterios_operativos;
      }
      if (docManifiesto?.exists) {
        const data = docManifiesto.data();
        memory.manifiesto_fundacional = data?.contenido || memory.manifiesto_fundacional;
      }
      if (docCodice?.exists) {
        const data = docCodice.data();
        memory.doctrina_codice_maestro = data?.contenido || memory.doctrina_codice_maestro;
      }
      console.log('[Companion Memory] Memoria fundacional y Códice Maestro sincronizados desde Cloud Firestore');
    }
  } catch (err: any) {
    console.warn('[Companion Memory] Usando memoria fundacional estática por error en Firestore:', err?.message);
  }

  cachedFoundationalMemory = memory;
  lastFoundationalFetch = now;
  return memory;
}


