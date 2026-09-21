// ─────────────────────────────────────────────────────────────────────────────
// Google Photos Picker API v1 — Integración Frontend
// Nueva API obligatoria desde 31/03/2025 (photospicker.googleapis.com)
// Flujo: Backend crea sesion → Frontend abre pickerUri en nueva pestana →
//        Backend hace polling → Backend descarga binario → Frontend recibe Base64
// CORS-safe: el frontend NO descarga nada, todo pasa por Cloud Run.
// ─────────────────────────────────────────────────────────────────────────────

export interface GooglePickerOptions {
  /** URL base del backend (ej: https://tgp-mind-...run.app) */
  backendUrl?: string;
  /** Callback al recibir el File listo para ingestar */
  onSelect: (file: File) => void;
  /** Callback de error o cierre */
  onError?: (err: Error) => void;
  // Campos legacy (ignorados en la nueva API — se mantienen por compatibilidad de tipos)
  apiKey?: string;
  clientId?: string;
}

/** Intervalo fijo de polling en ms — 3 s para no saturar Cloud Run */
const POLL_INTERVAL_MS = 3000;
/** Timeout máximo de polling: 5 min — tras eso se aborta y limpia */
const POLL_TIMEOUT_MS  = 5 * 60 * 1000;

export async function openGooglePicker(options: GooglePickerOptions): Promise<void> {
  if (typeof window === 'undefined') return;

  const { onSelect, onError } = options;

  // Resuelve la URL base del backend desde las opciones o desde la variable de entorno de Astro
  const backendBase = (options.backendUrl
    || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_TGP_MIND_URL : null)
    || 'https://tgp-mind-713934653057.us-central1.run.app'
  ).replace(/\/$/, '');

  try {
    // ── 1. Crear sesión en el backend ────────────────────────────────────────
    const sessionRes = await fetch(`${backendBase}/api/picker/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!sessionRes.ok) {
      const errData = await sessionRes.json().catch(() => ({})) as any;
      throw new Error(errData.error || `Error al crear sesion Picker: ${sessionRes.status}`);
    }

    const { sessionId, pickerUri } = await sessionRes.json() as {
      sessionId: string;
      pickerUri: string;
    };

    if (!sessionId || !pickerUri) {
      throw new Error('Respuesta invalida del backend: faltan sessionId o pickerUri');
    }

    // ── 2. Abrir pickerUri en nueva pestaña ──────────────────────────────────
    // Google prohíbe iframes — debe ser window.open en nueva pestaña
    const pickerTab = window.open(pickerUri, '_blank', 'noopener,noreferrer');
    if (!pickerTab) {
      throw new Error('El navegador bloqueó la apertura de la pestaña de Google Photos. Habilita las ventanas emergentes para este sitio.');
    }

    // ── 3. Polling al backend cada 3 s ───────────────────────────────────────
    const startTime = Date.now();

    const pollResult = await new Promise<boolean>((resolve, reject) => {
      const interval = setInterval(async () => {
        // Timeout máximo de 5 min
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          clearInterval(interval);
          reject(new Error('PICKER_TIMEOUT'));
          return;
        }

        try {
          const pollRes = await fetch(`${backendBase}/api/picker/poll/${sessionId}`);
          if (!pollRes.ok) {
            // No abortar en errores transitorios de red — seguir esperando
            return;
          }

          const pollData = await pollRes.json() as {
            ready: boolean;
            expired?: boolean;
            pollingInterval?: number;
          };

          if (pollData.expired) {
            clearInterval(interval);
            reject(new Error('PICKER_SESSION_EXPIRED'));
            return;
          }

          if (pollData.ready) {
            clearInterval(interval);
            resolve(true);
          }
        } catch (_) {
          // Error de red transitorio — ignorar y reintentar en el próximo tick
        }
      }, POLL_INTERVAL_MS);
    });

    if (!pollResult) return;

    // ── 4. Obtener items — el backend descarga el binario y devuelve Base64 ──
    const itemsRes = await fetch(`${backendBase}/api/picker/items/${sessionId}`);

    if (!itemsRes.ok) {
      const errData = await itemsRes.json().catch(() => ({})) as any;
      throw new Error(errData.error || `Error al obtener items: ${itemsRes.status}`);
    }

    const { items } = await itemsRes.json() as {
      items: Array<{
        id: string;
        filename: string;
        mimeType: string;
        base64: string;  // data:image/jpeg;base64,...
      }>;
    };

    if (!items || items.length === 0) {
      throw new Error('No se recibieron imagenes del servidor');
    }

    // ── 5. Convertir el primer item a File y llamar a onSelect ───────────────
    const first = items[0];
    const [meta, b64] = first.base64.split(',');
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: first.mimeType });
    const file = new File([blob], first.filename, { type: first.mimeType });

    onSelect(file);

    // Notificar estado 'renderizado' para que el componente pueda resetear botones
    setTimeout(() => {
      onError?.(new Error('PICKER_RENDERED'));
    }, 100);

  } catch (err: any) {
    console.error('[Google Photos Picker]:', err);
    if (err.message !== 'PICKER_RENDERED') {
      onError?.(err);
    }
  }
}
