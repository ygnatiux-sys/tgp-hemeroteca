// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo de Teclados Inline de Telegram
//
// Paradigma: Stateless/Semántico.
// Los botones son ATAJOS que inyectan texto semántico al agente LLM.
// NO hay máquina de estados: el callback_data es simplemente texto plano
// que Gemini procesa igual que si el usuario lo hubiera escrito.
// ─────────────────────────────────────────────────────────────────────────────

import type { BotIdentity } from '../ia/agent.js';

// ── Tipos Telegram ────────────────────────────────────────────────────────────

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export type InlineKeyboard = InlineKeyboardButton[][];

// ── Detector de Ficha Visual ──────────────────────────────────────────────────
// Evalúa si el texto de Gemini contiene la Ficha Visual para adjuntar atajos.
// La ficha se detecta por la presencia de "¿Confirmamos?" y "Ficha TGP".
export function esFichaVisual(text: string): boolean {
  return (
    text.includes('¿Confirmamos?') ||
    text.includes('Confirmamos?') ||
    (text.includes('Ficha TGP') && text.includes('ok'))
  );
}

// ── Teclado de Confirmación de Ficha ─────────────────────────────────────────
// Se adjunta cuando Gemini imprime la Ficha Visual.
export const TECLADO_CONFIRMACION: InlineKeyboard = [
  [
    { text: '✅ Confirmar', callback_data: 'ok' },
    { text: '❌ Cancelar',  callback_data: '/cancel' },
  ],
  [
    { text: '✏️ Modificar parámetros', callback_data: 'quiero modificar los parámetros' },
  ],
];

// ── Menú Dinámico por Bot ─────────────────────────────────────────────────────
// El callback_data es texto semántico que Gemini lee como mensaje del usuario.

const MENU_OMNI: InlineKeyboard = [
  [
    { text: '🎬 Nuevo Ensayo (Hemeroteca)', callback_data: 'quiero crear un nuevo ensayo para la Hemeroteca' },
  ],
  [
    { text: '📱 Post para Redes',           callback_data: 'quiero crear un post para redes sociales' },
    { text: '🎥 Pipeline Cinemático',       callback_data: 'quiero generar un pipeline cinemático' },
  ],
  [
    { text: '🕸️ Extraer Grafo Neo4j',       callback_data: 'quiero extraer entidades para el grafo Neo4j' },
  ],
  [
    { text: '🔄 Reiniciar sesión',          callback_data: '/nuevo' },
  ],
];

const MENU_REDES: InlineKeyboard = [
  [
    { text: '📘 Post para Facebook',  callback_data: 'quiero crear un post para Facebook' },
    { text: '🎵 Post para TikTok',    callback_data: 'quiero crear un post para TikTok' },
  ],
  [
    { text: '🔄 Reiniciar sesión',    callback_data: '/nuevo' },
  ],
];

const MENU_ASSISTANT: InlineKeyboard = [
  [
    { text: '📖 Nuevo Ensayo',        callback_data: 'quiero crear un nuevo ensayo para la Hemeroteca' },
    { text: '🕸️ Extraer Grafo',       callback_data: 'quiero extraer entidades para el grafo Neo4j' },
  ],
  [
    { text: '🔄 Reiniciar sesión',    callback_data: '/nuevo' },
  ],
];

const MENU_LIMINAL: InlineKeyboard = [
  [
    { text: '🎬 Ensayo Cinemático',   callback_data: 'quiero crear un nuevo ensayo cinemático' },
    { text: '🎥 Pipeline Visual',     callback_data: 'quiero generar un pipeline cinemático' },
  ],
  [
    { text: '💬 Modo Libre',          callback_data: 'hablemos libremente sobre un tema filosófico' },
    { text: '🔄 Reiniciar sesión',    callback_data: '/nuevo' },
  ],
];

export const MENUS_BY_BOT: Record<BotIdentity, InlineKeyboard> = {
  omni:      MENU_OMNI,
  redes:     MENU_REDES,
  assistant: MENU_ASSISTANT,
  liminal:   MENU_LIMINAL,
};

// ── Texto de bienvenida del /menu ─────────────────────────────────────────────
const MENU_TITLES: Record<BotIdentity, string> = {
  omni:      '⚡ **TGP Omni** — ¿Qué creamos hoy?',
  redes:     '📱 **TGP Redes** — ¿Para qué red publicamos?',
  assistant: '🔬 **TGP Assistant** — ¿Qué investigamos?',
  liminal:   '🌒 **TGP Liminal** — ¿A dónde vamos?',
};

export function getMenuTitle(botIdentity: BotIdentity): string {
  return MENU_TITLES[botIdentity];
}
