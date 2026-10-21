// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Google Photos Picker API v1 (Backend Service)
// Endpoint: photospicker.googleapis.com/v1
//
// Flujo completo:
//   1. getGoogleAccessToken()  → obtiene access_token desde GOOGLE_REFRESH_TOKEN
//   2. createPickerSession()   → crea sesión y devuelve pickerUri
//   3. pollPickerSession()     → hace polling hasta que el usuario elige
//   4. getPickerItems()        → descarga binarios y devuelve Base64 al frontend
//   5. listMyPhotos()          → lista fotos recientes (para BotSelector gallery)
//
// CORS-safe: el frontend NUNCA llama directamente a Google.
// Las credenciales (client_id, refresh_token) viven solo en Cloud Run.
// ─────────────────────────────────────────────────────────────────────────────

export interface PickerSession {
  sessionId: string;
  pickerUri: string;
}

export interface PickerItem {
  id: string;
  filename: string;
  mimeType: string;
  base64: string;
}

export interface PhotoItem {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  width?: number;
  height?: number;
}

// ── Obtener Access Token desde el Refresh Token ───────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  const clientId     = process.env.GOOGLE_CLIENT_ID     || process.env.PUBLIC_GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Credenciales de Google (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) no configuradas.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al refrescar token de Google: ${res.status} — ${errText}`);
  }

  const data = await res.json() as { access_token: string; error?: string };
  if (!data.access_token) {
    throw new Error(`No se obtuvo access_token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ── 1. Crear sesión en Google Photos Picker API ───────────────────────────────
export async function createPickerSession(): Promise<PickerSession> {
  const accessToken = await getGoogleAccessToken();

  const res = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al crear sesión Picker: ${res.status} — ${errText}`);
  }

  const data = await res.json() as {
    id: string;
    pickerUri: string;
    pollingConfig?: { pollInterval: string };
  };

  if (!data.id || !data.pickerUri) {
    throw new Error(`Respuesta inválida de la API de Google Photos: ${JSON.stringify(data)}`);
  }

  return { sessionId: data.id, pickerUri: data.pickerUri };
}

// ── 2. Polling de sesión ───────────────────────────────────────────────────────
export async function pollPickerSession(sessionId: string): Promise<{
  ready: boolean;
  expired?: boolean;
}> {
  const accessToken = await getGoogleAccessToken();

  const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    return { ready: false, expired: true };
  }

  if (!res.ok) {
    // Error transitorio — no abortar, dejar que el frontend reintente
    return { ready: false };
  }

  const data = await res.json() as {
    id: string;
    mediaItemsSet?: boolean;
    expireTime?: string;
  };

  // Si la sesión expiró por tiempo
  if (data.expireTime) {
    const expires = new Date(data.expireTime).getTime();
    if (Date.now() > expires) {
      return { ready: false, expired: true };
    }
  }

  return { ready: !!data.mediaItemsSet };
}

// ── 3. Obtener items seleccionados y descargarlos como Base64 ─────────────────
export async function getPickerItems(sessionId: string): Promise<PickerItem[]> {
  const accessToken = await getGoogleAccessToken();

  // Listar los media items de la sesión
  const res = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al obtener items del Picker: ${res.status} — ${errText}`);
  }

  const data = await res.json() as {
    mediaItems?: Array<{
      id: string;
      mediaFile?: {
        filename?: string;
        mimeType?: string;
        baseUrl?: string;
      };
    }>;
  };

  if (!data.mediaItems || data.mediaItems.length === 0) {
    return [];
  }

  // Descargar los binarios en Cloud Run y convertir a Base64
  const results: PickerItem[] = [];
  for (const item of data.mediaItems.slice(0, 5)) { // máx 5 para evitar timeouts
    const fileInfo = item.mediaFile;
    if (!fileInfo?.baseUrl) continue;

    try {
      // La baseUrl requiere el access_token para descargar el binario
      const imgRes = await fetch(`${fileInfo.baseUrl}=d`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!imgRes.ok) continue;

      const buffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = fileInfo.mimeType || 'image/jpeg';
      const filename  = fileInfo.filename || `photo-${item.id}.jpg`;

      results.push({
        id:       item.id,
        filename,
        mimeType,
        base64:   `data:${mimeType};base64,${base64}`,
      });
    } catch {
      // Si falla un item, continúa con el siguiente
    }
  }

  return results;
}

// ── 4. Listar fotos recientes (para BotSelector Gallery) ──────────────────────
// Usa la Photos Library API v1 (scope: photoslibrary.readonly)
// NOTA: Requiere que el refresh_token tenga scope 'https://www.googleapis.com/auth/photoslibrary.readonly'
// Si el token actual no tiene ese scope, devolvemos un conjunto vacío sin errores.
export async function listMyPhotos(maxItems = 24): Promise<PhotoItem[]> {
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (err) {
    console.warn('[Google Photos listMyPhotos] Sin credenciales:', err);
    return [];
  }

  try {
    const res = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=${maxItems}&orderBy=MediaMetadata.creation_time+desc`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      // Scope insuficiente → 403/401; devolver vacío sin romper la app
      const errText = await res.text();
      console.warn(`[Google Photos listMyPhotos] HTTP ${res.status}:`, errText.slice(0, 200));
      return [];
    }

    const data = await res.json() as {
      mediaItems?: Array<{
        id: string;
        filename: string;
        mimeType: string;
        baseUrl: string;
        mediaMetadata?: { width?: string; height?: string };
      }>;
    };

    if (!data.mediaItems) return [];

    return data.mediaItems
      .filter(it => it.mimeType?.startsWith('image/'))
      .map(it => ({
        id:       it.id,
        filename: it.filename,
        mimeType: it.mimeType,
        url:      `${it.baseUrl}=w400-h300-c`, // Google Photos thumbnail
        width:    it.mediaMetadata?.width  ? parseInt(it.mediaMetadata.width)  : undefined,
        height:   it.mediaMetadata?.height ? parseInt(it.mediaMetadata.height) : undefined,
      }));
  } catch (err) {
    console.warn('[Google Photos listMyPhotos] Error:', err);
    return [];
  }
}
