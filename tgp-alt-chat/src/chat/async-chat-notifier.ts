// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Notificador Asíncrono para Google Chat (Respaldo Anti-Timeout)
// Garantiza la entrega de Cards V2 al espacio/hilo usando Google Chat REST API
// ─────────────────────────────────────────────────────────────────────────────
import { GoogleAuth } from 'google-auth-library';
import { CHAT_SPACE_TECNICO, CHAT_VIGIA_WEBHOOK_URL } from '../config/env.js';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/chat.bot'],
});

export interface AsyncCardOptions {
  spaceName?: string;
  threadName?: string;
  cardV2: any;
  fallbackText?: string;
}

/**
 * Envía una Card V2 directamente al espacio/hilo de Google Chat de forma asíncrona.
 * Respaldo garantizado si el webhook síncrono supera el umbral de 25 segundos.
 */
export async function sendAsyncGoogleChatCard(options: AsyncCardOptions): Promise<boolean> {
  const { spaceName, threadName, cardV2, fallbackText } = options;

  // 1. Si no hay espacio definido, intentar el espacio técnico por defecto
  const targetSpace = spaceName || CHAT_SPACE_TECNICO || 'spaces/AAQAkHxZYn0';

  try {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      console.warn('[Async Chat Notifier] No se obtuvo access token de Google Cloud.');
      return false;
    }

    let endpoint = `https://chat.googleapis.com/v1/${targetSpace}/messages`;
    if (threadName) {
      endpoint += '?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD';
    }

    const payload: any = {
      text: fallbackText || '🏛️ **TGP Mind:** Nueva actualización editorial disponible:',
      cardsV2: cardV2.cardsV2 || (Array.isArray(cardV2) ? cardV2 : [cardV2]),
    };

    if (threadName) {
      payload.thread = { name: threadName };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[Async Chat Notifier] Error HTTP ${res.status} al enviar a ${targetSpace}:`, errBody);
      return false;
    }

    console.log(`[Async Chat Notifier] ✅ Card V2 entregada asíncronamente en ${targetSpace} (${threadName || 'sin hilo'})`);
    return true;
  } catch (err: any) {
    console.warn('[Async Chat Notifier] Excepción enviando mensaje asíncrono:', err?.message || err);

    // Fallback: Si hay CHAT_VIGIA_WEBHOOK_URL configurado y es un espacio técnico
    if (CHAT_VIGIA_WEBHOOK_URL && targetSpace.includes('AAQAkHxZYn0')) {
      try {
        await fetch(CHAT_VIGIA_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: fallbackText || '🏛️ Despacho editorial TGP forjado.',
            cardsV2: cardV2.cardsV2,
          }),
        });
      } catch {}
    }

    return false;
  }
}
