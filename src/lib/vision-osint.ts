export interface MetadatosVision {
  entidades: Array<{ descripcion: string; score: number }>;
  urls: Array<{ url: string; titulo: string }>;
  coords: Array<{ nombre: string; score: number; lat: number | null; lng: number | null }>;
}

export interface RespuestaVisionExhaustiva {
  id: string;
  imagen_url: string;
  informe: string;
  metadatos: MetadatosVision;
  fecha_ingesta: string;
}

export interface RespuestaRedaccionPremium {
  id: string;
  ensayo: string;
  audio_url: string | null;
  imagen_url: string;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export async function ejecutarIngestaExhaustiva(
  endpointUrl: string,
  imageBase64: string,
  apiKey: string
): Promise<RespuestaVisionExhaustiva> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Error en backend.`);
    }

    return await res.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('La cascada cognitiva excedió el tiempo límite de espera.');
    }
    throw error;
  }
}

export async function ejecutarRedaccionPremium(
  endpointUrl: string,
  id: string,
  apiKey: string,
  informeDirecto?: string
): Promise<RespuestaRedaccionPremium> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ id, informe_directo: informeDirecto }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Error al redactar ensayo premium.`);
    }

    return await res.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('La generación del ensayo premium excedió el tiempo límite de espera.');
    }
    throw error;
  }
}
