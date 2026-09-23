import { BaseAgent } from './BaseAgent.js';
import { wikimediaTool } from '../tools/wikimediaTool.js';
import { nanoBananaTool } from '../tools/nanoBananaTool.js';
import {
  ERUDITO_DIVULGATIVO_PROMPT,
  AGENTE_ERUDITO_ACADEMICO_PROMPT,
} from '../../config/geminiPrompts.js';
import type { AgentResponse } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// MODELOS DISPONIBLES
//   Flash  → gemini-2.5-flash   (default, seguro para tests)
//   Pro    → gemini-2.5-pro     (opt-in, para redacciones Premium confirmadas)
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_FLASH = 'gemini-2.5-flash';
const MODEL_PRO   = 'gemini-2.5-pro';

// Palabras clave que indican que el usuario PODRÍA querer calidad Pro.
// El agente los detecta y SUGIERE —no ejecuta— el cambio.
const PRO_TRIGGER_KEYWORDS = [
  'premium', 'ensayo largo', 'pro_4500', 'largo', 'extenso', 'profundo',
  'académico', 'academico', 'publicar', 'publicación', 'hemeroteca',
  'definitivo', 'final', 'versión final',
];

function detectsProRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return PRO_TRIGGER_KEYWORDS.some(kw => lower.includes(kw));
}

export class EruditoAgent extends BaseAgent {
  constructor(apiKey: string) {
    super(apiKey);

    // Herramientas disponibles para este agente
    this.registerTool(wikimediaTool);
    this.registerTool(nanoBananaTool);

    // Modelo por defecto: Flash (seguro para tests)
    this.modelName = MODEL_FLASH;
  }

  /**
   * Genera un ensayo erudito en modo Flash (default) o Pro (opt-in).
   *
   * @param tema         - Tema del ensayo
   * @param textoActual  - Borrador existente (para modo académico)
   * @param modo         - 'divulgativo' | 'academico'
   * @param history      - Historial de conversación (GeminiTurn[])
   * @param usePro       - Si true, usa gemini-2.5-pro. Solo cuando el usuario lo confirmó.
   */
  public async generateEssay(
    tema: string,
    textoActual: string = '',
    modo: 'divulgativo' | 'academico' = 'divulgativo',
    history: any[] = [],
    usePro: boolean = false,
  ): Promise<AgentResponse> {

    // ── Selección de modelo ───────────────────────────────────────────────────
    this.modelName = usePro ? MODEL_PRO : MODEL_FLASH;

    // ── Detección temprana: sugerir Pro sin ejecutarlo ────────────────────────
    // Si el usuario NO eligió Pro explícitamente pero el tema sugiere que lo necesita,
    // devolvemos una sugerencia como respuesta de texto antes de generar.
    if (!usePro && detectsProRequest(tema + ' ' + textoActual)) {
      return {
        status: 'COMPLETED',
        content: [
          `✍️ *Erudito detectó que este ensayo podría beneficiarse del motor Pro.*`,
          ``,
          `Estoy usando **Flash** (rápido y económico) por defecto.`,
          `Si querés la versión Premium completa con mayor profundidad analítica, respondé:`,
          ``,
          `> **"sí, usá Pro"** — para activar *gemini-2.5-pro* en este ensayo.`,
          `> **"continúa"** — para generar ahora con Flash.`,
        ].join('\n'),
      };
    }

    // ── Construcción de mensajes ──────────────────────────────────────────────
    let systemInstruction = '';
    let userMessage = '';

    if (modo === 'academico') {
      this.temperature = 0.20;
      systemInstruction = AGENTE_ERUDITO_ACADEMICO_PROMPT;
      userMessage = `Formatea el siguiente texto con estándar tipográfico impecable para TGP Hemeroteca. Corrige la redacción si detectas prosa mecánica o genérica. Devuelve únicamente el Markdown final:\n\n${textoActual}`;
    } else {
      this.temperature = 0.62;
      systemInstruction = ERUDITO_DIVULGATIVO_PROMPT;

      const temaLimpio = tema.trim()
        ? `"${tema}"`
        : (textoActual.trim()
            ? `el tema central de este texto:\n\n${textoActual.slice(0, 600)}`
            : 'el arquetipo o tema detectado en el contexto actual');

      userMessage = [
        `Redacta un ensayo magistral de historia cultural y pensamiento simbólico sobre ${temaLimpio}.`,
        `Si el texto carece de portadas o imágenes geográficas/históricas, ERES LIBRE de pedir`,
        `una búsqueda en Wikimedia o generar una portada fotográfica si añadirá valor visual.`,
        `Aplica todas las reglas de estructura, tono divulgativo-erudito y formato Markdown`,
        `definidas en tu identidad. El ensayo debe tener entre 900 y 2.000 palabras.`,
        usePro ? `\n[Motor: gemini-2.5-pro — Calidad Premium activada por el usuario.]` : '',
      ].filter(Boolean).join('\n');
    }

    return this.execute(userMessage, systemInstruction, history);
  }

  /**
   * Continúa tras aprobación HITL del usuario.
   * Llama a BaseAgent.resume() con el contexto correcto.
   */
  public async resumeAfterApproval(
    toolName: string,
    toolResult: any,
    history: any[],
    usePro: boolean = false,
  ): Promise<AgentResponse> {
    this.modelName = usePro ? MODEL_PRO : MODEL_FLASH;
    return this.resume(
      toolName,
      toolResult,
      'Continúa el ensayo incorporando el resultado de la herramienta.',
      ERUDITO_DIVULGATIVO_PROMPT,
      history,
    );
  }
}
