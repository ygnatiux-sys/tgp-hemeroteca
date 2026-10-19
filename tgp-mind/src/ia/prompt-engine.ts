// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Prompt Engine: Especialización Granular (Snacks vs. Ensayos)
// ─────────────────────────────────────────────────────────────────────────────
import { buildSilosXML } from './codice-xavier-benitez.js';

export interface PromptConfig {
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3.8-flash';
  temperature: number;
  maxOutputTokens: number;
  systemInstruction: string;
}

/**
 * System prompt base sobrio y analítico para Snacks/Hooks y consultas operativas.
 * Cero metáforas teatrales forzadas ni pastiche.
 */
export const SNACK_HOOK_SYSTEM_PROMPT = `
Eres el motor de análisis y síntesis de TGP (The Great Puzzle Project).
Tu función es producir "Snacks/Hooks": textos de enganche intelectual, precisos, sobrios y analíticos.

REGLAS DE FORMATO Y ESTILO (MODO SNACK / BENTO):
1. Tono: Analítico, sobrio, directo al hueso. Prohibido el tono teatral, poético impostado, autoayuda o esoterismo.
2. Longitud estricta: Máximo 900 caracteres (debe caber holgadamente en una Bento Card de Telegram sin truncarse).
3. Estructura recomendada:
   - Gancho forense / material (la anomalía en la piedra, el documento o la fecha).
   - Fricción conceptual (por qué desafía la narrativa estándar).
   - Remate analítico sin conclusiones escolares tipo "en conclusión".
4. Sin etiquetas XML o Markdown rotas en la salida final.
`.trim();

/**
 * System prompt para Ensayos Visuales Profundos (Magazine 60/40 y VaultEngine).
 * Inyecta la arquitectura de 7 pasos y los 3 silos XML aislados.
 */
export const PRODUCTION_ESSAY_SYSTEM_PROMPT = `
Eres el socio intelectual de Xavier Benítez y el motor de redacción de Ensayos Visuales Profundos de TGP Hemeroteca.

${buildSilosXML()}

DIRECTIVAS EDITORIALES DE PRODUCCIÓN:
1. Arquitectura de Ensayo en 7 Pasos:
   - 1. Apertura por anomalía material concreta (la ruina, la inscripción, el fósil).
   - 2. Anclaje histórico y geográfico estricto.
   - 3. Tesis de transformación o fricción política/social.
   - 4. Desglose estratigráfico (antecedente vs. sistematizador vs. recepción).
   - 5. Tensión historiográfica (oficial vs. anomalía fundada).
   - 6. Puente humanista (Memoria Viva vs. Memoria de Archivo, el animal humano).
   - 7. Cierre en destilación filosófica memorable.
2. Tono: Ensayo rioplatense culto, denso y directo.
3. Prohibido el cliché esotérico ("sabiduría ancestral", "tiempos inmemoriales") y la tibieza académica ("cabe destacar").
`.trim();

/**
 * Obtiene la configuración adecuada según el formato:
 * - 'snack': Gemini 2.5 Flash, temp 0.3, max 1024 tokens.
 * - 'essay': Gemini 2.5 Pro, temp 0.7, max 8192 tokens.
 */
export function getPromptEngineConfig(format: 'snack' | 'essay' | 'chat' = 'snack'): PromptConfig {
  if (format === 'essay') {
    return {
      model: 'gemini-2.5-pro',
      temperature: 0.65,
      maxOutputTokens: 8192,
      systemInstruction: PRODUCTION_ESSAY_SYSTEM_PROMPT,
    };
  }

  // Por defecto para snacks, hooks y bots: Flash a 0.3
  return {
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxOutputTokens: 1200,
    systemInstruction: SNACK_HOOK_SYSTEM_PROMPT,
  };
}

/**
 * Formatea un texto como Telegram Bento Card (< 950 caracteres).
 */
export function formatTelegramBentoCard(data: {
  titulo: string;
  categoria?: string;
  silo?: string;
  cuerpo: string;
  enlaceTaller?: string;
}): string {
  const { titulo, categoria = 'Hemeroteca', silo = 'Grounded', cuerpo, enlaceTaller } = data;
  
  // Limitar cuerpo para garantizar < 950 caracteres en total
  const maxBodyLength = 700;
  const cleanBody = cuerpo.length > maxBodyLength
    ? cuerpo.slice(0, maxBodyLength).trim() + '…'
    : cuerpo.trim();

  let card = `🏛️ *${titulo.toUpperCase()}*\n`;
  card += `📁 Estrato: \`${categoria}\` | Silo: \`${silo}\`\n\n`;
  card += `${cleanBody}\n\n`;

  if (enlaceTaller) {
    card += `🔗 [Abrir en Taller Desk](${enlaceTaller})\n`;
  }

  return card.trim();
}
