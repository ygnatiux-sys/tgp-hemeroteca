/**
 * scripts/lib/synthetic-engine.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * MÓDULO 2: MOTOR DE GENERACIÓN SINTÉTICA CON IA (IMAGEN 3 / ESTÉTICA TGP)
 *
 * Principio de Responsabilidad Única:
 *   1. Recibe el tema, la atmósfera y el contexto del post.
 *   2. Construye el prompt de dirección de arte canónico de TGP (Obsidiana,
 *      granito, claroscuro, atmósfera cinematográfica 16:9, grano volumétrico).
 *   3. Llama a la API de Imagen 3 (imagen-3.0-generate-002 / predict).
 *   4. Genera la atribución transparente de IA.
 *   5. Admite generar 1 imagen (Hero) o hasta N variaciones (Modo Video Array).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// ── 1. GENERADOR DE PROMPTS CANÓNICOS TGP ─────────────────────────────────────
function construirPromptTGP(tema, excerpt = '', atmosfera = 'obsidiana') {
  const paletas = {
    obsidiana: 'obsidian black (#060a08), dark olive, antique gold dust, dramatic chiaroscuro',
    deriva: 'pale limestone, terracotta clay, cold mineral waters, foggy morning dawn',
    umbral: 'deep basalt stone, volcanic ash, emerald moss, ethereal celestial rays',
  };

  const paletaSeleccionada = paletas[atmosfera] || paletas.obsidiana;

  return `Cinematic monumental editorial photography for ancient archaeological and metaphysical archive.
Subject: ${tema}.
Context: ${excerpt ? excerpt.slice(0, 180) : 'Ancient historical and philosophical investigation'}.
Style and Atmosphere: Fine-art cinematic wide shot, monumental stone architecture or classical artifact, ${paletaSeleccionada}, master of light and shadow, Caravaggio-inspired chiaroscuro, volumetric haze, atmospheric depth.
Camera: 35mm anamorphic cinema lens, subtle analog film grain, hyperdetailed textures, 8k resolution, authentic historical realism, no modern elements, aspect ratio 16:9.`;
}

// ── 2. LLAMADA A IMAGEN 3 VIA REST API ────────────────────────────────────────
async function generarConImagen3(promptText, sampleCount = 1) {
  if (!GEMINI_API_KEY) {
    throw new Error('[Synthetic Engine] Falta GEMINI_API_KEY en las variables de entorno (.env).');
  }

  // Modelos Imagen 3 disponibles
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`,
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`,
  ];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: promptText }],
          parameters: {
            sampleCount: Math.min(Math.max(1, sampleCount), 4),
            aspectRatio: '16:9',
            personGeneration: 'ALLOW_ADULT',
            outputMimeType: 'image/jpeg',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 250)}`);
      }

      const data = await response.json();
      const predictions = data?.predictions || [];
      if (predictions.length === 0) {
        throw new Error('Imagen 3 no devolvió predicciones de imagen.');
      }

      const buffers = [];
      for (const pred of predictions) {
        const base64 = pred?.bytesBase64Encoded;
        if (base64) {
          buffers.push(Buffer.from(base64, 'base64'));
        }
      }

      if (buffers.length > 0) {
        return buffers;
      }
    } catch (err) {
      lastError = err;
      // Probar siguiente endpoint
    }
  }

  throw lastError || new Error('[Synthetic Engine] Falló la generación en todos los endpoints de Imagen 3.');
}

// ── 3. PIPELINE PRINCIPAL EXPORTABLE ──────────────────────────────────────────
/**
 * @param {Object} options
 * @param {string} options.title - Título del post
 * @param {string} [options.excerpt=''] - Sinopsis o contexto
 * @param {string} [options.atmosfera='obsidiana'] - Atmósfera de Keystatic
 * @param {boolean} [options.isVideoArray=false] - Modo video array
 * @param {number} [options.count=1] - Cantidad de imágenes a generar
 */
export async function curarSintetica({
  title,
  excerpt = '',
  atmosfera = 'obsidiana',
  isVideoArray = false,
  count = 1,
}) {
  const targetCount = isVideoArray ? Math.min(Math.max(count, 2), 4) : 1;
  console.log(`\n🎨 [Synthetic Engine] Activando generación IA (Imagen 3)...`);
  console.log(`   Tema: "${title}" | Atmósfera: ${atmosfera} | Cantidad: ${targetCount}`);

  const promptFinal = construirPromptTGP(title, excerpt, atmosfera);
  console.log(`   📜 Prompt canónico: "${promptFinal.slice(0, 110)}..."`);

  try {
    const buffers = await generarConImagen3(promptFinal, targetCount);
    console.log(`   ✅ Generadas exitosamente ${buffers.length} imagen(es) sintética(s) 16:9.`);

    const items = buffers.map((buf, idx) => ({
      buffer: buf,
      width: 2560,
      height: 1440,
      title: `${title} (Variación IA ${idx + 1})`,
      attribution: {
        author: 'TGP Mind (Imagen 3)',
        license: 'Generación IA Sintética',
        source: 'TGP Creative Engine',
        prompt: promptFinal,
        generatedAt: new Date().toISOString(),
      },
    }));

    return {
      ok: true,
      isVideoArray,
      isSynthetic: true,
      items,
      primary: items[0],
    };
  } catch (err) {
    console.error(`   ❌ [Synthetic Engine] Error:`, err.message);
    return {
      ok: false,
      reason: err.message,
      items: [],
    };
  }
}
