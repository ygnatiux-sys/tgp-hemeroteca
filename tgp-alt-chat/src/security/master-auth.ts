// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Candado de Seguridad y Llave Maestra Personal
// Protege los endpoints HTTP (/tools/*, /api/*) y los 4 Bots de Telegram (/telegram/*)
// ─────────────────────────────────────────────────────────────────────────────

import { Firestore } from '@google-cloud/firestore';
import crypto from 'node:crypto';

// ── Clave Master Personal (.env) ────────────────────────────────────────────
export function getMasterApiKey(): string {
  return (
    process.env.TGP_MIND_API_KEY ||
    process.env.TGP_MASTER_KEY ||
    process.env.MASTER_KEY ||
    '2771'
  ).replace(/['"]/g, '').trim();
}

// ── Lista de Chat IDs Autorizados en Memoria + Firestore ─────────────────────
const DEFAULT_XAVIER_CHAT_ID = 7886507052;
const envAdminId = Number(process.env.ADMIN_CHAT_ID || 0);

const authorizedChatIds = new Set<number>([
  DEFAULT_XAVIER_CHAT_ID,
  ...(envAdminId ? [envAdminId] : []),
]);

let firestoreInitialized = false;

// ── Sincronizar Chat IDs autorizados con Firestore (Colección tgp_config) ────
export async function initAuthorizedChatIdsFromFirestore(firestoreDb?: Firestore): Promise<void> {
  if (firestoreInitialized) return;
  firestoreInitialized = true;

  try {
    const db = firestoreDb || new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.DIALOGFLOW_PROJECT_ID || 'tgp-mind',
    });
    const docRef = db.collection('tgp_config').doc('authorized_users');
    const snap = await docRef.get();

    if (snap.exists) {
      const data = snap.data();
      const ids: number[] = data?.chat_ids || [];
      for (const id of ids) {
        authorizedChatIds.add(Number(id));
      }
      console.log(`[Master Auth] Chat IDs autorizados cargados desde Firestore: [${Array.from(authorizedChatIds).join(', ')}]`);
    } else {
      await docRef.set({
        chat_ids: Array.from(authorizedChatIds),
        owner: 'Xavier Benítez',
        actualizadoEl: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err: any) {
    console.warn('[Master Auth] No se pudo sincronizar tgp_config/authorized_users:', err?.message);
  }
}

// ── Verificación de Chat ID en Telegram ─────────────────────────────────────
export function isAuthorizedChatId(chatId: number): boolean {
  return authorizedChatIds.has(Number(chatId));
}

// ── Desbloqueo en Caliente vía /auth <CLAVE_MASTER> ──────────────────────────
export async function authorizeChatWithKey(
  chatId: number,
  keyCandidate: string,
  firestoreDb?: Firestore
): Promise<boolean> {
  const masterKey = getMasterApiKey();
  const cleanCandidate = (keyCandidate || '').replace(/['"]/g, '').trim();

  if (!cleanCandidate || cleanCandidate !== masterKey) {
    return false;
  }

  authorizedChatIds.add(Number(chatId));
  console.log(`[Master Auth] ✅ Chat ID ${chatId} desbloqueado exitosamente como dueño autorizado.`);

  // Persistir en Firestore tgp_config
  try {
    const db = firestoreDb || new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.DIALOGFLOW_PROJECT_ID || 'tgp-mind',
    });
    await db.collection('tgp_config').doc('authorized_users').set({
      chat_ids: Array.from(authorizedChatIds),
      ultimoDesbloqueo: new Date().toISOString(),
      ultimoChatId: chatId,
    }, { merge: true });
  } catch (err: any) {
    console.warn('[Master Auth] Error persistiendo nuevo chat ID en Firestore:', err?.message);
  }

  return true;
}

// ── Borrar mensaje de Telegram por seguridad (evitar clave en el chat) ───────
export async function deleteTelegramMessage(botToken: string, chatId: number, messageId: number): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch (err: any) {
    console.warn(`[Master Auth] No se pudo borrar mensaje de auth (${messageId}):`, err?.message);
  }
}

// ── Verificación de Cabecera HTTP para Endpoints REST ────────────────────────
export function verifyHttpMasterKey(c: any): boolean {
  const masterKey = getMasterApiKey();

  // 1. Cabeceras directas x-tgp-master-key, x-api-key o x-tgp-bridge-key
  const headerKey = (
    c.req.header('x-tgp-bridge-key') ||
    c.req.header('x-tgp-master-key') ||
    c.req.header('x-api-key') ||
    c.req.header('X-Api-Key') ||
    ''
  ).trim();

  const bridgeKey = (process.env.TGP_BRIDGE_KEY || 'tgp-bridge-secret').trim();
  if (headerKey && (headerKey === masterKey || headerKey === bridgeKey)) return true;

  // 2. Cabecera Authorization: Bearer <KEY>
  const authHeader = (c.req.header('authorization') || c.req.header('Authorization') || '').trim();
  if (authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken === masterKey || bearerToken === bridgeKey) return true;
  }

  return false;
}

// ── Middleware Hono para Candado en Endpoints Sensibles ──────────────────────
export async function masterAuthMiddleware(c: any, next: () => Promise<void>) {
  const path = c.req.path;

  // Rutas exentas de candado HTTP:
  // 1. Health check y CORS
  if (path === '/' || c.req.method === 'OPTIONS') {
    return next();
  }

  // 2. Google Chat Webhook y Dialogflow CX (REGLA MANDATORIA: Cero bloqueo a Google Chat)
  if (
    path === '/google-chat-webhook' ||
    path === '/webhook' ||
    path === '/webhook/chat' ||
    path === '/api/chat/webhook' ||
    path === '/api/cx/submit-draft' ||
    path === '/cx-tool-wikimedia' ||
    path === '/cx-tool-panlingua' ||
    path.startsWith('/api/picker/') ||
    path === '/api/my-photos'
  ) {
    return next();
  }

  // 3. Webhooks de Telegram (tienen su propio candado interno por chatId)
  if (
    path.startsWith('/webhook/telegram') ||
    path.startsWith('/telegram') ||
    path.startsWith('/webhook-dev') ||
    path.startsWith('/bot') ||
    path === '/webhook/telegram-social' ||
    path === '/webhook/telegram-omni' ||
    path === '/webhook/telegram-premium' ||
    path === '/webhook/telegram'
  ) {
    return next();
  }

  // 4. Webhooks de Twilio WhatsApp (tienen validación criptográfica X-Twilio-Signature)
  if (
    path === '/twilio-webhook' ||
    path.startsWith('/twilio')
  ) {
    return next();
  }

  // Para cualquier otro endpoint sensible (/tools/*, /api/*, /api/telegram/drop-pending):
  if (!verifyHttpMasterKey(c)) {
    return c.json({
      error: '401 Unauthorized',
      message: 'Candado TGP Mind: Clave Master Personal requerida en header [x-tgp-master-key] o [Authorization: Bearer <CLAVE>]',
    }, 401);
  }

  return next();
}
