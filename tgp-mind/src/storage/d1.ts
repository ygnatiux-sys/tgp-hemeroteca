// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo Storage: Cloudflare D1 + Google TTS
// Extraído de index.ts. Contiene:
//   - asegurarTablaD1         — crea la tabla si no existe
//   - guardarEnCloudflareD1   — inserta registro de Data Lake
//   - obtenerInformeD1        — lee informe OSINT + ensayo_premium
//   - actualizarRegistroD1    — actualiza ensayo y audio en el registro
//   - generarYGuardarAudioTTS — sintetiza audio vía Google TTS y lo guarda en R2
//
// HITL State (Arquitectura Agéntica):
//   - getHITLState / setHITLState / clearHITLState
//   — Persiste el estado de diálogo HITL en D1 para sobrevivir cold starts de Cloud Run
// ─────────────────────────────────────────────────────────────────────────────

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2BucketName, getR2PublicDomain } from './r2.js';
import crypto from 'node:crypto';

// ── Config inyectada ──────────────────────────────────────────────────────────
let _ACCOUNT_ID    = '';
let _DATABASE_ID   = '';
let _API_TOKEN     = '';
let _GEMINI_KEY    = '';  // reutilizado para Google TTS endpoint

export interface D1InitConfig {
  accountId:    string;
  databaseId:   string;
  apiToken:     string;
  geminiApiKey: string;
}

export function initD1(cfg: D1InitConfig) {
  _ACCOUNT_ID  = cfg.accountId;
  _DATABASE_ID = cfg.databaseId;
  _API_TOKEN   = cfg.apiToken;
  _GEMINI_KEY  = cfg.geminiApiKey;
}

function d1Url(): string {
  return `https://api.cloudflare.com/client/v4/accounts/${_ACCOUNT_ID}/d1/database/${_DATABASE_ID}/query`;
}

function d1Headers() {
  return { 'Authorization': `Bearer ${_API_TOKEN}`, 'Content-Type': 'application/json' };
}

// ── Data Lake ─────────────────────────────────────────────────────────────────

export async function asegurarTablaD1(): Promise<void> {
  if (!_DATABASE_ID || !_API_TOKEN) return;
  const schemaQuery = `
    CREATE TABLE IF NOT EXISTS data_lake_vision (
      id TEXT PRIMARY KEY,
      imagen_url TEXT,
      metadatos_vision TEXT,
      informe_osint TEXT,
      ensayo_premium TEXT,
      audio_url TEXT,
      fecha_ingesta TEXT
    );
  `;
  try {
    await fetch(d1Url(), {
      method: 'POST',
      headers: d1Headers(),
      body: JSON.stringify({ sql: schemaQuery }),
    });
  } catch (err) {
    console.warn('[D1 Schema Warning]:', err);
  }
}

export async function guardarEnCloudflareD1(registro: {
  id: string;
  imagen_url: string;
  metadatos_vision: object;
  informe_osint: string;
  fecha_ingesta: string;
}): Promise<void> {
  if (!_DATABASE_ID || !_API_TOKEN) {
    console.warn('[D1 Storage] Omitiendo guardado en D1 (variables no configuradas).');
    return;
  }
  await asegurarTablaD1();
  const query = `
    INSERT INTO data_lake_vision (id, imagen_url, metadatos_vision, informe_osint, fecha_ingesta)
    VALUES (?, ?, ?, ?, ?)
  `;
  const response = await fetch(d1Url(), {
    method: 'POST',
    headers: d1Headers(),
    body: JSON.stringify({
      sql: query,
      params: [
        registro.id,
        registro.imagen_url,
        JSON.stringify(registro.metadatos_vision),
        registro.informe_osint,
        registro.fecha_ingesta,
      ],
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`[D1 Storage Warning] (${response.status}): ${errorText}`);
  } else {
    console.log(`[D1 Storage] Registro persistido exitosamente con ID: ${registro.id}`);
  }
}

// ── Resguardo Documental Universal (Políticas de Retención Global) ───────────

export interface ResguardoDocumentalParams {
  id?: string;
  origen: 'telegram-hemeroteca' | 'telegram-social' | 'telegram-omni' | 'miniapp-svelte' | 'api-mind' | string;
  destino: 'hemeroteca' | 'alternative' | 'social' | 'datalake' | string;
  tema?: string;
  textoGenerado: string;
  metadatos?: Record<string, any>;
  imagenR2Url?: string;
  chatId?: number;
}

export async function asegurarTablaResguardoDocumental(): Promise<void> {
  if (!_DATABASE_ID || !_API_TOKEN) return;
  const schemaQuery = `
    CREATE TABLE IF NOT EXISTS resguardo_documental (
      id TEXT PRIMARY KEY,
      origen TEXT NOT NULL,
      destino TEXT NOT NULL,
      tema TEXT,
      texto_generado TEXT NOT NULL,
      metadatos TEXT,
      imagen_r2_url TEXT,
      chat_id TEXT,
      fecha_creacion TEXT NOT NULL
    );
  `;
  try {
    await fetch(d1Url(), {
      method: 'POST',
      headers: d1Headers(),
      body: JSON.stringify({ sql: schemaQuery }),
    });
  } catch (err) {
    console.warn('[D1 Resguardo Schema Warning]:', err);
  }
}

/**
 * Registra de forma obligatoria y segura cualquier texto procesado o generado
 * por Gemini, abstracts para redes o metadatos de publicación en D1.
 */
export async function registrarResguardoD1(params: ResguardoDocumentalParams): Promise<string | null> {
  if (!_DATABASE_ID || !_API_TOKEN) {
    console.warn('[D1 Resguardo] D1 no configurado, omitiendo resguardo documental.');
    return null;
  }
  const id = params.id || crypto.randomUUID();
  try {
    await asegurarTablaResguardoDocumental();
    const query = `
      INSERT INTO resguardo_documental (id, origen, destino, tema, texto_generado, metadatos, imagen_r2_url, chat_id, fecha_creacion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await fetch(d1Url(), {
      method: 'POST',
      headers: d1Headers(),
      body: JSON.stringify({
        sql: query,
        params: [
          id,
          params.origen,
          params.destino,
          params.tema || '',
          params.textoGenerado,
          JSON.stringify(params.metadatos || {}),
          params.imagenR2Url || '',
          params.chatId ? String(params.chatId) : '',
          new Date().toISOString(),
        ],
      }),
    });
    if (!res.ok) {
      console.warn('[D1 Resguardo Warning]:', await res.text());
      return null;
    }
    console.log(`[D1 Resguardo Documental] Registro ${id} guardado con éxito (${params.origen} -> ${params.destino})`);
    return id;
  } catch (err: any) {
    console.error('[D1 Resguardo Exception]:', err?.message);
    return null;
  }
}

export async function obtenerInformeD1(id: string): Promise<{ informe_osint: string; imagen_url: string; ensayo_premium?: string } | null> {
  if (!_DATABASE_ID || !_API_TOKEN) return null;
  const res = await fetch(d1Url(), {
    method: 'POST',
    headers: d1Headers(),
    body: JSON.stringify({
      sql: 'SELECT informe_osint, imagen_url, ensayo_premium FROM data_lake_vision WHERE id = ? LIMIT 1',
      params: [id],
    }),
  });
  const data: any = await res.json();
  const rows = data?.result?.[0]?.results;
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function actualizarRegistroD1(id: string, ensayo: string, audioUrl: string | null): Promise<void> {
  if (!_DATABASE_ID || !_API_TOKEN) return;
  await fetch(d1Url(), {
    method: 'POST',
    headers: d1Headers(),
    body: JSON.stringify({
      sql: 'UPDATE data_lake_vision SET ensayo_premium = ?, audio_url = ? WHERE id = ?',
      params: [ensayo, audioUrl, id],
    }),
  });
  console.log(`[D1 Storage] Ensayo Premium y Audio persistidos para ID: ${id}`);
}

export async function generarYGuardarAudioTTS(id: string, texto: string): Promise<string | null> {
  try {
    const textoLimpio = texto
      .replace(/[#*_`>\-\[\]\(\)]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 4500);

    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${_GEMINI_KEY}`;
    const ttsRes = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: textoLimpio },
        voice: { languageCode: 'es-AR', name: 'es-AR-Neural2-A', ssmlGender: 'FEMALE' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.96, pitch: -1.0 },
      }),
    });

    if (!ttsRes.ok) {
      console.warn('[TTS] Aviso en Google TTS:', await ttsRes.text());
      return null;
    }

    const ttsData: any = await ttsRes.json();
    if (!ttsData.audioContent) return null;

    const audioBuffer = Buffer.from(ttsData.audioContent, 'base64');
    const audioKey    = `audios/${id}.mp3`;

    await getR2Client().send(new PutObjectCommand({
      Bucket:       getR2BucketName(),
      Key:          audioKey,
      Body:         audioBuffer,
      ContentType:  'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return `${getR2PublicDomain()}/${audioKey}`;
  } catch (err) {
    console.error('[TTS Error]:', err);
    return null;
  }
}

// ── HITL State — Persistencia en D1 para sobrevivir cold starts de Cloud Run ──
// Tabla: hitl_sessions (chatId TEXT PK, state TEXT, updated_at TEXT, ttl_minutes INT)
// TTL: 30 minutos. Cloud Run no mantiene estado en memoria entre requests.

export interface HITLState {
  tema:      string;
  destino?:  'hemeroteca' | 'alternative' | 'social';
  red?:      'facebook' | 'tiktok';
  densidad?: 'breve' | 'profundo_breve' | 'premium';
  modelo?:   'flash' | 'pro';
  fuenteImg?: 'wiki' | 'telegram' | 'none';
  modoLibrePrompt?: string;
  photoUrl?: string;
  step:      'awaiting_dest' | 'awaiting_network' | 'awaiting_density' | 'awaiting_engine' | 'awaiting_confirm' | 'awaiting_params';
  history?:  Array<{ role: 'user' | 'model'; text: string }>;
}

async function ensureHITLTable(): Promise<void> {
  if (!_DATABASE_ID || !_API_TOKEN) return;
  await fetch(d1Url(), {
    method: 'POST',
    headers: d1Headers(),
    body: JSON.stringify({
      sql: `CREATE TABLE IF NOT EXISTS hitl_sessions (
        chat_id TEXT PRIMARY KEY,
        state   TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    }),
  });
}

export async function getHITLState(chatId: number, botContext: string = 'default'): Promise<HITLState | null> {
  if (!_DATABASE_ID || !_API_TOKEN) return null;
  const key = `${chatId}:${botContext}`;
  try {
    const res = await fetch(d1Url(), {
      method: 'POST',
      headers: d1Headers(),
      body: JSON.stringify({
        sql: `SELECT state, updated_at FROM hitl_sessions WHERE chat_id = ? LIMIT 1`,
        params: [key],
      }),
    });
    const data: any = await res.json();
    const row = data?.result?.[0]?.results?.[0];
    if (!row) return null;
    // Expirar después de 30 minutos
    const age = Date.now() - new Date(row.updated_at).getTime();
    if (age > 30 * 60 * 1000) { await clearHITLState(chatId, botContext); return null; }
    return JSON.parse(row.state) as HITLState;
  } catch { return null; }
}

export async function setHITLState(chatId: number, state: HITLState, botContext: string = 'default'): Promise<void> {
  if (!_DATABASE_ID || !_API_TOKEN) return;
  const key = `${chatId}:${botContext}`;
  try {
    await ensureHITLTable();
    await fetch(d1Url(), {
      method: 'POST',
      headers: d1Headers(),
      body: JSON.stringify({
        sql: `INSERT INTO hitl_sessions (chat_id, state, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(chat_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
        params: [key, JSON.stringify(state), new Date().toISOString()],
      }),
    });
  } catch (err) { console.warn('[HITL D1] Error guardando estado:', err); }
}

export async function clearHITLState(chatId: number, botContext?: string): Promise<void> {
  if (!_DATABASE_ID || !_API_TOKEN) return;
  try {
    if (botContext) {
      const key = `${chatId}:${botContext}`;
      await fetch(d1Url(), {
        method: 'POST',
        headers: d1Headers(),
        body: JSON.stringify({
          sql: 'DELETE FROM hitl_sessions WHERE chat_id = ?',
          params: [key],
        }),
      });
    } else {
      await fetch(d1Url(), {
        method: 'POST',
        headers: d1Headers(),
        body: JSON.stringify({
          sql: 'DELETE FROM hitl_sessions WHERE chat_id = ? OR chat_id LIKE ?',
          params: [String(chatId), `${chatId}:%`],
        }),
      });
    }
  } catch (err) { console.warn('[HITL D1] Error limpiando estado:', err); }
}
