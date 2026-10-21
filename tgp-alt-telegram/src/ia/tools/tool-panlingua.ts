// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Tool: query_panlingua
// Permite a Gemini Flash consultar la base de datos lingüística Panlingua (D1)
// via Cloudflare REST API (no Worker binding — compatible con Cloud Run).
//
// Tabla: lexico_periferico
// Columnas: Language, Glottocode, Macroarea, Latitude, Longitude, Concept, Tribal_Word
// ─────────────────────────────────────────────────────────────────────────────

// ── Configuración D1 REST API ─────────────────────────────────────────────────
const CF_ACCOUNT_ID   = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const CF_API_TOKEN    = (process.env.CLOUDFLARE_API_TOKEN  || '').trim();
const PANLINGUA_DB_ID = (process.env.PANLINGUA_D1_ID || 'a4c11340-cec3-4273-b6d0-5691a100f09a').trim();
const D1_API_BASE     = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${PANLINGUA_DB_ID}/query`;

// ── Schema para Gemini Function Calling ──────────────────────────────────────
export const TOOL_QUERY_PANLINGUA = {
  name: 'query_panlingua',
  description: `Consulta la base de datos lingüística Panlingua con vocabulario de más de 314 idiomas del mundo.
Úsala cuando el usuario pregunte sobre:
- Palabras o conceptos en idiomas específicos (ej: "cómo se dice 'fuego' en avar")
- Comparar palabras de un mismo concepto entre idiomas
- Cuántas entradas tiene un idioma
- Qué idiomas existen en una macroárea (Africa, Eurasia, Papunesia, Americas, Australia)
- Vocabulario tribal o periférico de lenguas poco documentadas
La tabla tiene columnas: Language, Glottocode, Macroarea, Latitude, Longitude, Concept, Tribal_Word`,
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      intent: {
        type: 'STRING' as const,
        enum: ['buscar_concepto', 'buscar_idioma', 'listar_idiomas', 'contar_entradas', 'comparar_conceptos', 'buscar_macroarea'] as const,
        description: 'Tipo de consulta. Elegir según la pregunta del usuario.',
      },
      language: {
        type: 'STRING' as const,
        description: 'Nombre del idioma (ej: "Avar (Batlukh dialect)", "Quechua", "Swahili"). Dejar vacío si no aplica.',
      },
      concept: {
        type: 'STRING' as const,
        description: 'Concepto a buscar en inglés (ej: "fire", "water", "mother", "sky"). Búsqueda flexible (LIKE).',
      },
      macroarea: {
        type: 'STRING' as const,
        description: 'Macroárea geográfica: Africa, Eurasia, Papunesia, North America, South America, Australia.',
      },
      limit: {
        type: 'NUMBER' as const,
        description: 'Máximo de resultados (5-10 para conciso, 20 para comparativas). Default: 8.',
      },
    },
    required: ['intent'],
  },
};

// ── Helper: ejecutar SQL en D1 via REST API ───────────────────────────────────
async function runD1Query(sql: string, params: (string | number)[] = []): Promise<any[]> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('[Panlingua] Faltan CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_API_TOKEN');
  }
  const response = await fetch(D1_API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D1 API error ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json() as any;
  if (!data.success) {
    const errMsg = data.errors?.map((e: any) => e.message).join(', ') || 'Error desconocido';
    throw new Error(`D1 query failed: ${errMsg}`);
  }
  return data.result?.[0]?.results ?? [];
}

// ── Formateador de resultados para Telegram ───────────────────────────────────
function formatResults(rows: any[], intent: string, concept?: string, language?: string): string {
  if (!rows || rows.length === 0) return `🔍 No encontré resultados en Panlingua para esa búsqueda.`;

  if (intent === 'contar_entradas') {
    const count = rows[0]?.['COUNT(*)'] ?? rows[0]?.total ?? 0;
    return `📊 *Panlingua* — ${language || 'base completa'}: *${Number(count).toLocaleString()}* entradas registradas.`;
  }
  if (intent === 'listar_idiomas' || intent === 'buscar_macroarea') {
    const langs = [...new Set(rows.map((r: any) => r.Language))].slice(0, 15);
    return `🌍 *Idiomas en Panlingua*\n\n${langs.map(l => `• ${l}`).join('\n')}\n\n_Total mostrado: ${langs.length}_`;
  }
  if (intent === 'buscar_concepto' || intent === 'comparar_conceptos') {
    const lines = rows.map((r: any) => `• *${r.Language}* (${r.Macroarea}): _${r.Tribal_Word}_`).join('\n');
    return `📖 *"${concept}"* en Panlingua:\n\n${lines}`;
  }
  if (intent === 'buscar_idioma') {
    const lines = rows.map((r: any) => `• _${r.Concept}_: *${r.Tribal_Word}*`).join('\n');
    return `🗣️ *${language}* — vocabulario:\n\n${lines}`;
  }
  const lines = rows.map((r: any) => `• ${r.Language}: ${r.Concept} → _${r.Tribal_Word}_`).join('\n');
  return `📋 *Panlingua*:\n\n${lines}`;
}

// ── Ejecutor principal (llamado desde agent.ts) ───────────────────────────────
export interface PanlingualArgs {
  intent: 'buscar_concepto' | 'buscar_idioma' | 'listar_idiomas' | 'contar_entradas' | 'comparar_conceptos' | 'buscar_macroarea';
  language?: string;
  concept?: string;
  macroarea?: string;
  limit?: number;
  chatId?: number;
}

export async function ejecutarQueryPanlingua(args: PanlingualArgs): Promise<string> {
  const { intent, language, concept, macroarea, limit = 8 } = args;
  const safeLimit = Math.min(Math.max(1, limit), 25);

  // Normalización tolerante de alias de intent (inglés / español)
  let normalizedIntent: string = intent;
  if (['stats', 'contar', 'count', 'contar_entradas'].includes(intent)) normalizedIntent = 'contar_entradas';
  else if (['by_language', 'buscar_idioma', 'idioma', 'language'].includes(intent)) normalizedIntent = 'buscar_idioma';
  else if (['search_word', 'buscar_palabra', 'buscar_concepto', 'semantic_search', 'concept'].includes(intent)) normalizedIntent = 'buscar_concepto';
  else if (['compare_languages', 'comparar', 'comparar_conceptos'].includes(intent)) normalizedIntent = 'comparar_conceptos';
  else if (['list_languages', 'listar', 'listar_idiomas'].includes(intent)) normalizedIntent = 'listar_idiomas';
  else if (['buscar_macroarea', 'macroarea'].includes(intent)) normalizedIntent = 'buscar_macroarea';

  const targetConcept = concept || (args as any).term || (args as any).word || (args as any).concepto;
  const targetLanguage = language || (args as any).lang || (args as any).idioma;

  try {
    let rows: any[] = [];

    if (normalizedIntent === 'buscar_concepto' || normalizedIntent === 'comparar_conceptos') {
      rows = await runD1Query(
        `SELECT "Language","Macroarea","Concept","Tribal_Word" FROM "lexico_periferico" WHERE "Concept" LIKE ? ORDER BY "Macroarea","Language" LIMIT ?`,
        [`%${targetConcept || ''}%`, safeLimit]
      );
    } else if (normalizedIntent === 'buscar_idioma') {
      rows = await runD1Query(
        `SELECT "Concept","Tribal_Word","Macroarea" FROM "lexico_periferico" WHERE "Language" LIKE ? LIMIT ?`,
        [`%${targetLanguage || ''}%`, safeLimit]
      );
    } else if (normalizedIntent === 'listar_idiomas') {
      const hasArea = macroarea && macroarea.trim() !== '';
      rows = hasArea
        ? await runD1Query(`SELECT DISTINCT "Language","Macroarea" FROM "lexico_periferico" WHERE "Macroarea" = ? ORDER BY "Language" LIMIT ?`, [macroarea!, safeLimit])
        : await runD1Query(`SELECT DISTINCT "Language","Macroarea" FROM "lexico_periferico" ORDER BY "Language" LIMIT ?`, [safeLimit]);
    } else if (normalizedIntent === 'contar_entradas') {
      const hasLang = targetLanguage && targetLanguage.trim() !== '';
      rows = hasLang
        ? await runD1Query(`SELECT COUNT(*) FROM "lexico_periferico" WHERE "Language" LIKE ?`, [`%${targetLanguage}%`])
        : await runD1Query(`SELECT COUNT(*) FROM "lexico_periferico"`);
    } else if (normalizedIntent === 'buscar_macroarea') {
      rows = await runD1Query(
        `SELECT DISTINCT "Language","Macroarea" FROM "lexico_periferico" WHERE "Macroarea" LIKE ? ORDER BY "Language" LIMIT ?`,
        [`%${macroarea || ''}%`, safeLimit]
      );
    } else {
      return `⚠️ Tipo de consulta no reconocida: ${intent}`;
    }

    return formatResults(rows, normalizedIntent, targetConcept, targetLanguage);

  } catch (err: any) {
    console.error('[Panlingua Tool] Error:', err?.message || err);
    return `⚠️ Error consultando Panlingua: ${err?.message || 'Error interno'}.`;
  }
}
