// tgp-mind/scripts/test-live-bots.ts
// Script de prueba dialéctica en vivo para los 4 bots de Telegram (Sin producción)
// Envía un mensaje real a Xavier Benítez (chatId: 7886507052) desde cada bot.

import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { processCompagnonMessage } from '../src/ia/compagnon-genkit.js';
import { sendTelegramMessage } from '../src/telegram/webhook.js';

const XAVIER_CHAT_ID = 7886507052;

const BOTS = [
  {
    name: '1. OMNI BOT (@Analista_IMG_bot)',
    identity: 'omni' as const,
    token: (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '').trim(),
    prompt: 'Hola Omni, hacé un saludo muy breve de 2 líneas como socio intelectual de Xavier Benítez y confirmá que el Códice Maestro está activo.',
  },
  {
    name: '2. REDES BOT (@TGP_redsocial_bot)',
    identity: 'redes' as const,
    token: (process.env.TELEGRAM_SOCIAL_TOKEN || '').trim(),
    prompt: 'Hola Redes, prepará una propuesta de micro-copy de 3 líneas sobre "Memoria Viva vs. Memoria de Archivo" para redes, sin publicar todavía en Zernio.',
  },
  {
    name: '3. ASSISTANT BOT (@tgp_cloud_bot)',
    identity: 'assistant' as const,
    token: (process.env.TELEGRAM_TGP_CLOUD_TOKEN || '').trim(),
    prompt: 'Hola Assistant, explicame en 3 líneas la tesis de la Bondad Achelense según la doctrina de Xavier Benítez.',
  },
  {
    name: '4. LIMINAL BOT (@UXliminal_bot)',
    identity: 'liminal' as const,
    token: (process.env.TELEGRAM_DEV_BOT_TOKEN || process.env.LIMINAL_TOKEN || '').trim(),
    prompt: 'Hola Liminal, explicame en 3 líneas la etimología y ontología de "Recordar" (savoir par cœur) frente a la memoria de archivo.',
  },
];

async function runLiveTest() {
  console.log('🚀 Iniciando Prueba Dialéctica en Vivo (Modo Observador — 0 Producción)...');
  console.log(`Destinatario: Xavier Benítez (Chat ID: ${XAVIER_CHAT_ID})\n`);

  for (const bot of BOTS) {
    console.log(`------------------------------------------------------------`);
    console.log(`⚡ Ejecutando: ${bot.name}...`);
    if (!bot.token) {
      console.warn(`⚠️ Token faltante para ${bot.name}. Omitiendo.`);
      continue;
    }

    try {
      console.log(`💬 Input: "${bot.prompt}"`);
      const result = await processCompagnonMessage(XAVIER_CHAT_ID, bot.prompt, bot.identity);
      console.log(`🤖 Respuesta Generada (${result.text.length} chars):\n${result.text.slice(0, 300)}...`);

      // Enviar a Telegram en vivo
      await sendTelegramMessage(XAVIER_CHAT_ID, bot.token, result.text);
      console.log(`✅ Mensaje entregado en Telegram por ${bot.name} a Chat ID ${XAVIER_CHAT_ID}!`);
    } catch (err: any) {
      console.error(`❌ Error en ${bot.name}:`, err?.message || err);
    }

    // Pausa de cortesía de 2 segundos entre bots
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n🎉 Secuencia completada. Revisa tu aplicación de Telegram para ver los 4 mensajes.`);
  process.exit(0);
}

runLiveTest().catch((err) => {
  console.error('Crash en prueba en vivo:', err);
  process.exit(1);
});
