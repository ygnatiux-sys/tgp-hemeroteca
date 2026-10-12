#!/usr/bin/env node
/**
 * scripts/db-tools/query_d1.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Herramienta de consulta directa a Cloudflare D1 (tgp-panlingua).
 * Permite ejecutar consultas SQL interactivas tanto vía Cloudflare REST API
 * (con credenciales de .env) como vía Wrangler CLI (--remote).
 * ─────────────────────────────────────────────────────────────────────────────
 * Uso:
 *   node scripts/db-tools/query_d1.js "SELECT * FROM lexico_periferico LIMIT 5"
 *   node scripts/db-tools/query_d1.js "SELECT COUNT(*) FROM lexico_periferico"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../..');

// Cargar .env de la raíz o de tgp-mind si existen
const envPaths = [
  resolve(ROOT_DIR, '.env'),
  resolve(ROOT_DIR, 'tgp-mind/.env')
];

for (const p of envPaths) {
  if (existsSync(p)) {
    dotenv.config({ path: p });
  }
}

const CF_ACCOUNT_ID = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const CF_API_TOKEN = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
const PANLINGUA_DB_ID = (process.env.PANLINGUA_D1_ID || 'a4c11340-cec3-4273-b6d0-5691a100f09a').trim();
const DB_NAME = 'tgp-panlingua';

// SQL desde argumento o consulta de prueba por defecto
const sqlQuery = process.argv[2] || `SELECT COUNT(*) AS total_entradas, COUNT(DISTINCT "Language") AS total_idiomas FROM "lexico_periferico"`;

console.log(`\n============================================================`);
console.log(`🔍 [D1 Query Tool] Base: ${DB_NAME} (${PANLINGUA_DB_ID})`);
console.log(`📌 SQL: ${sqlQuery}`);
console.log(`============================================================\n`);

async function queryViaRestApi(sql) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${PANLINGUA_DB_ID}/query`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare API HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const json = await response.json();
  if (!json.success) {
    const msg = json.errors?.map(e => e.message).join(', ') || 'Error desconocido';
    throw new Error(`D1 Error: ${msg}`);
  }

  return json.result?.[0]?.results ?? [];
}

function queryViaWrangler(sql) {
  const escapedSql = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --command="${escapedSql}" --json`;
  const output = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  
  const parsed = JSON.parse(output);
  if (Array.isArray(parsed) && parsed[0]?.results) {
    return parsed[0].results;
  }
  return parsed;
}

async function main() {
  try {
    let rows;

    if (CF_ACCOUNT_ID && CF_API_TOKEN) {
      console.log(`⚡ Ejecutando vía Cloudflare REST API...`);
      rows = await queryViaRestApi(sqlQuery);
    } else {
      console.log(`⚡ Credenciales API no detectadas en .env. Ejecutando vía Wrangler CLI...`);
      rows = queryViaWrangler(sqlQuery);
    }

    if (!rows || rows.length === 0) {
      console.log(`ℹ️ La consulta no devolvió resultados.`);
    } else {
      console.table(rows);
      console.log(`\n✅ Total filas devueltas: ${rows.length}`);
    }
  } catch (err) {
    console.error(`\n❌ Error ejecutando consulta D1:`, err.message);
    process.exit(1);
  }
}

main();
