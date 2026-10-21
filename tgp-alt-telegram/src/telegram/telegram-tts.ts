// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo de Síntesis de Voz Documental (Dual Engine TTS + R2 + sendAudio)
//
// Características:
//   1. Chunking inteligente: Divide ensayos de ~3.000 tokens en párrafos < 3.800 bytes
//      para no superar las cuotas individuales de Google Cloud TTS.
//   2. Concatenación de buffers MP3 en memoria y subida consolidada a Cloudflare R2.
//   3. Arquitectura Dual de Voces:
//      - Motor Primario: es-US-Neural2-B (Free Tier $0 hasta 1M caracteres/mes,
//        tono documental grave y pausado con pitch -1.5 y speakingRate 0.98).
//      - Fallback secundario: es-US-Neural2-A (femenina) o Standard.
//   4. Entrega nativa en Telegram vía sendAudio (reproductor integrado con waveform,
//      control de velocidad 1.5x/2x y escucha en segundo plano).
// ─────────────────────────────────────────────────────────────────────────────

import { subirBufferAR2, getR2PublicDomain } from '../storage/r2.js';
import { registrarResguardoD1 } from '../storage/d1.js';
import crypto from 'node:crypto';

// Limpieza previa de Markdown para dicción fluida
function limpiarTextoParaTTS(texto: string): string {
  return texto
    .replace(/!\[.*?\]\(.*?\)/g, '')         // Eliminar imágenes Markdown
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')       // Conservar solo el texto de enlaces
    .replace(/#{1,6}\s*/g, '')                // Quitar encabezados (#, ##)
    .replace(/[*_`~>]/g, '')                 // Quitar negritas, cursivas, quotes
    .replace(/---/g, '')                      // Quitar líneas horizontales
    .replace(/\n{3,}/g, '\n\n')               // Normalizar saltos múltiples
    .replace(/\s+/g, ' ')                     // Normalizar espacios
    .trim();
}

// Fragmentación segura en trozos < 3.800 bytes por oraciones o párrafos
function chunkTextoParaTTS(textoLimpio: string, maxBytes = 3800): string[] {
  const parrafos = textoLimpio.split(/(?<=\.\s+)|(?<=\n\n)/);
  const chunks: string[] = [];
  let chunkActual = '';

  for (const parrafo of parrafos) {
    if (!parrafo.trim()) continue;
    if ((chunkActual + ' ' + parrafo).length <= maxBytes) {
      chunkActual = chunkActual ? `${chunkActual} ${parrafo}` : parrafo;
    } else {
      if (chunkActual) chunks.push(chunkActual.trim());
      if (parrafo.length > maxBytes) {
        // Si un solo párrafo supera maxBytes, dividir por oraciones
        let sub = parrafo;
        while (sub.length > 0) {
          chunks.push(sub.slice(0, maxBytes).trim());
          sub = sub.slice(maxBytes).trimStart();
        }
        chunkActual = '';
      } else {
        chunkActual = parrafo;
      }
    }
  }

  if (chunkActual.trim()) {
    chunks.push(chunkActual.trim());
  }

  return chunks;
}

// Síntesis de un chunk individual vía Google Cloud TTS REST API
async function sintetizarChunk(chunk: string, apiKey: string): Promise<Buffer | null> {
  const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  // Intento 1: es-US-Neural2-B (Voz documental sobria y grave, Free Tier $0)
  try {
    const res = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: chunk },
        voice: {
          languageCode: 'es-US',
          name: 'es-US-Neural2-B',
          ssmlGender: 'MALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.98,
          pitch: -1.5,
        },
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (data.audioContent) {
        return Buffer.from(data.audioContent, 'base64');
      }
    } else {
      const errTxt = await res.text();
      console.warn('[Telegram TTS] Fallo con Neural2-B:', errTxt.slice(0, 150));
    }
  } catch (err: any) {
    console.warn('[Telegram TTS] Error de red en Neural2-B:', err?.message);
  }

  // Fallback seguro: es-US-Standard-B
  try {
    const resFallback = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: chunk },
        voice: {
          languageCode: 'es-US',
          name: 'es-US-Standard-B',
          ssmlGender: 'MALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.98,
          pitch: -1.0,
        },
      }),
    });

    if (resFallback.ok) {
      const data: any = await resFallback.json();
      if (data.audioContent) {
        return Buffer.from(data.audioContent, 'base64');
      }
    }
  } catch (err: any) {
    console.error('[Telegram TTS] Fallback falló también:', err?.message);
  }

  return null;
}

export interface GenerarAudioResult {
  success: boolean;
  audioUrl?: string;
  audioId?: string;
  error?: string;
}

/**
 * Genera el audio documental completo a partir del texto de un ensayo,
 * procesando trozos en secuencia, concatenando en MP3 y alojando en R2.
 */
export async function generarAudioDocumentalR2(
  texto: string,
  titulo = 'Ensayo Erudito TGP',
  chatId?: number,
): Promise<GenerarAudioResult> {
  const apiKey = (
    process.env.GOOGLE_CLOUD_TTS_KEY ||
    process.env.PUBLIC_GOOGLE_PICKER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).replace(/['"]/g, '').trim();
  if (!apiKey) {
    return { success: false, error: 'Clave de Google Cloud TTS no configurada.' };
  }

  const textoLimpio = limpiarTextoParaTTS(texto);
  if (!textoLimpio) {
    return { success: false, error: 'El texto está vacío para sintetizar.' };
  }

  console.log(`[Telegram TTS] Iniciando síntesis para "${titulo.slice(0, 50)}" (${textoLimpio.length} caracteres)...`);
  const chunks = chunkTextoParaTTS(textoLimpio);
  console.log(`[Telegram TTS] Texto dividido en ${chunks.length} fragmentos para síntesis.`);

  const audioBuffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const buf = await sintetizarChunk(chunks[i], apiKey);
    if (buf) {
      audioBuffers.push(buf);
    } else {
      console.warn(`[Telegram TTS] Fragmento ${i + 1}/${chunks.length} no pudo sintetizarse.`);
    }
  }

  if (audioBuffers.length === 0) {
    return { success: false, error: 'No se pudo generar ningún fragmento de audio.' };
  }

  // Concatenación de buffers de audio MP3
  const finalAudioBuffer = Buffer.concat(audioBuffers);
  const audioId = `tgp-${chatId || 'doc'}-${Date.now()}`;
  const fileKey = `audios/${audioId}.mp3`;

  try {
    const audioUrl = await subirBufferAR2(finalAudioBuffer, fileKey, 'audio/mpeg');
    console.log(`[Telegram TTS] ✅ Audio consolidado y subido a R2: ${audioUrl}`);

    // Registrar en Data Lake D1
    if (chatId) {
      await registrarResguardoD1({
        origen: 'telegram-tts-generator',
        destino: 'datalake',
        tema: titulo,
        textoGenerado: textoLimpio.slice(0, 400),
        metadatos: {
          audioUrl,
          audioId,
          titulo,
          chunksCount: chunks.length,
          tamanioBytes: finalAudioBuffer.length,
        },
        chatId,
      }).catch(() => {});
    }

    return {
      success: true,
      audioUrl,
      audioId,
    };
  } catch (err: any) {
    console.error('[Telegram TTS] Error subiendo audio a R2:', err);
    return { success: false, error: err?.message || 'Error guardando audio en storage.' };
  }
}

/**
 * Envía el audio nativo a Telegram usando el endpoint sendAudio, activando
 * el reproductor integrado con waveform, control de velocidad 1.5x y reproducción de fondo.
 */
export async function sendTelegramNativeAudio(params: {
  chatId: number;
  botToken: string;
  audioUrl: string;
  title: string;
  performer?: string;
  caption?: string;
}): Promise<boolean> {
  const { chatId, botToken, audioUrl, title, performer = 'TGP Hemeroteca', caption } = params;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        audio: audioUrl,
        title,
        performer,
        caption: caption || `🎧 **${title}**\n\n🔊 Reproductor documental nativo TGP`,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      console.warn(`[Telegram sendAudio Error ${res.status}]:`, errTxt);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[Telegram sendAudio Exception]:', err?.message);
    return false;
  }
}
