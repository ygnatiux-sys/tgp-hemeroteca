// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo de Teclados Inline de Telegram (Botoneras WOW Nativas)
//
// Paradigma: Stateless/Semántico + Acciones Rápidas Nativas (Action Bento).
// Los botones son atajos táctiles directos con protección anti-doble clic.
// ─────────────────────────────────────────────────────────────────────────────

export type BotIdentity = 'redes' | 'assistant' | 'omni' | 'liminal';

// ── Tipos Telegram ────────────────────────────────────────────────────────────
export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export type InlineKeyboard = InlineKeyboardButton[][];

// ── Detector de Ficha Visual ──────────────────────────────────────────────────
export function esFichaVisual(text: string): boolean {
  return (
    text.includes('¿Confirmamos?') ||
    text.includes('Confirmamos?') ||
    (text.includes('Ficha TGP') && text.includes('ok'))
  );
}

// ── Detector de Ensayo Generado (para adjuntar Action Bento) ──────────────────
export function esEnsayoGenerado(text: string): boolean {
  return (
    (text.includes('# ') || text.includes('## ')) &&
    (text.length > 600 || text.includes('Hemeroteca') || text.includes('Ensayo'))
  );
}

// ── Teclado de Confirmación de Ficha (Web y Social) ───────────────────────────
export const TECLADO_CONFIRMACION_WEB: InlineKeyboard = [
  [
    { text: '🏛️ Confirmar Hemeroteca', callback_data: 'ok_hemeroteca' },
    { text: '📜 Confirmar Alternative', callback_data: 'ok_alternative' },
  ],
  [
    { text: '✏️ Modificar parámetros', callback_data: 'quiero modificar los parámetros' },
    { text: '❌ Cancelar', callback_data: '/cancel' },
  ],
];

export const TECLADO_CONFIRMACION_REDES: InlineKeyboard = [
  [
    { text: '📘 Publicar en Facebook', callback_data: 'ok_facebook' },
    { text: '🎵 Publicar en TikTok', callback_data: 'ok_tiktok' },
  ],
  [
    { text: '✏️ Modificar copy', callback_data: 'quiero ajustar el copy' },
    { text: '❌ Cancelar', callback_data: '/cancel' },
  ],
];

// Fallback genérico de confirmación
export const TECLADO_CONFIRMACION: InlineKeyboard = [
  [
    { text: '✅ Confirmar', callback_data: 'ok' },
    { text: '❌ Cancelar', callback_data: '/cancel' },
  ],
  [
    { text: '✏️ Modificar parámetros', callback_data: 'quiero modificar los parámetros' },
  ],
];

// ── Action Bento: Botonera Interactiva Nativa para Ensayos Terminados ─────────
export function buildBotoneraAccionesEnsayo(backupId = 'reciente'): InlineKeyboard {
  return [
    [
      { text: '🎧 Escuchar Ensayo', callback_data: 'action:audio' },
      { text: '🎨 Portada Nano Banana', callback_data: 'action:nanobanana' },
    ],
    [
      { text: '🏛️ Publicar en Hemeroteca', callback_data: 'action:publicar_hemeroteca' },
      { text: '📜 Publicar en Alternative', callback_data: 'action:publicar_alternative' },
    ],
    [
      { text: '🏛️ Enviar a Taller Desk... ▾', callback_data: `menu:taller_desk:${backupId}` },
    ],
    [
      { text: '🧹 Sanear Hilo', callback_data: '/nuevo' },
    ],
  ];
}

export const BOTONERA_ACCIONES_ENSAYO: InlineKeyboard = buildBotoneraAccionesEnsayo('reciente');

// ── Teclado Contextual de Peloteo Dialéctico ──────────────────────────────────
export function buildPeloteoKeyboard(
  backupId: string,
  _context?: { tema?: string; tipo?: string },
): InlineKeyboard {
  const safeDraft = backupId || 'draft';
  return [
    [
      { text: '📚 Cruzar con PDFs Firebase', callback_data: 'action:rag_firebase' },
      { text: '🧠 Consolidar en 2.5 Pro', callback_data: 'action:escalate_pro' },
    ],
    [
      { text: '📝 Guardar Borrador en Keystatic', callback_data: 'action:commit_keystatic' },
    ],
    [
      { text: '🏛️ Enviar a Taller Desk... ▾', callback_data: `menu:taller_desk:${safeDraft}` },
    ],
    [
      { text: '🧹 Sanear Hilo', callback_data: '/nuevo' },
    ],
  ];
}

// ── Submenú Desplegable Inline Arrows: Talleres TGP (thegreatpuzzleproject.com) ───
// Usa estrictamente la propiedad `url` de la API de Telegram para navegar a la web
export function buildSubmenuTallerDesk(backupId: string): InlineKeyboard {
  const safeDraft = backupId ? encodeURIComponent(backupId) : 'draft';
  return [
    [
      { text: '🏛️ Hemeroteca Desk', url: `https://thegreatpuzzleproject.com/hemeroteca?draft=${safeDraft}` },
      { text: '🖋️ Scriptorium Desk', url: `https://thegreatpuzzleproject.com/scriptorium?draft=${safeDraft}` },
    ],
    [
      { text: '🎨 Laboratorio Visual', url: `https://thegreatpuzzleproject.com/laboratorio-visual?draft=${safeDraft}` },
      { text: '📜 Cartografía de Ideas', url: `https://thegreatpuzzleproject.com/colecciones?draft=${safeDraft}` },
    ],
    [
      { text: '▴ Contraer menú', callback_data: `menu:collapse_taller:${safeDraft}` },
    ],
  ];
}

export const SUBMENU_TALLER_DESK: InlineKeyboard = buildSubmenuTallerDesk('reciente');

// ── Action Bento: Botonera Interactiva Nativa para Posts de Redes Sociales ────
export const BOTONERA_ACCIONES_REDES: InlineKeyboard = [
  [
    { text: '📘 Publicar en Facebook', callback_data: 'action:post_facebook' },
    { text: '🎵 Publicar en TikTok', callback_data: 'action:post_tiktok' },
  ],
  [
    { text: '🎧 Audio Resumen', callback_data: 'action:audio' },
    { text: '🏛️ Enviar a Taller Desk... ▾', callback_data: 'menu:taller_desk' },
  ],
  [
    { text: '🧹 Sanear Hilo', callback_data: '/nuevo' },
  ],
];

// ── Menús Principales por Bot (/menu) ─────────────────────────────────────────
const MENU_OMNI: InlineKeyboard = [
  [
    { text: '🏛️ Ensayo para Hemeroteca', callback_data: 'quiero crear un nuevo ensayo para la Hemeroteca' },
    { text: '📜 Ensayo para Alternative', callback_data: 'quiero crear un ensayo para Historia Alternative' },
  ],
  [
    { text: '📘 Post Facebook', callback_data: 'quiero crear un post para Facebook' },
    { text: '🎵 Post TikTok', callback_data: 'quiero crear un post para TikTok' },
  ],
  [
    { text: '🎥 Pipeline Cinemático', callback_data: 'quiero generar un pipeline cinemático' },
    { text: '🕸️ Extraer Grafo Neo4j', callback_data: 'quiero extraer entidades para el grafo Neo4j' },
  ],
  [
    { text: '🔄 Reiniciar sesión', callback_data: '/nuevo' },
  ],
];

const MENU_REDES: InlineKeyboard = [
  [
    { text: '📘 Post para Facebook', callback_data: 'quiero crear un post para Facebook' },
    { text: '🎵 Post para TikTok', callback_data: 'quiero crear un post para TikTok' },
  ],
  [
    { text: '🔄 Reiniciar sesión', callback_data: '/nuevo' },
  ],
];

const MENU_ASSISTANT: InlineKeyboard = [
  [
    { text: '📖 Nuevo Ensayo Histórico', callback_data: 'quiero crear un nuevo ensayo histórico' },
    { text: '🕸️ Extraer Grafo Neo4j', callback_data: 'quiero extraer entidades para el grafo Neo4j' },
  ],
  [
    { text: '🔄 Reiniciar sesión', callback_data: '/nuevo' },
  ],
];

const MENU_LIMINAL: InlineKeyboard = [
  [
    { text: '🎬 Ensayo Cinemático', callback_data: 'quiero crear un nuevo ensayo cinemático' },
    { text: '🗣️ Consulta Panlingua D1', callback_data: 'consultar la base lingüística Panlingua' },
  ],
  [
    { text: '🎨 Portada Artística', callback_data: 'generar una portada artística con Nano Banana' },
    { text: '🎧 Audio Documental', callback_data: 'sintetizar el audio documental' },
  ],
  [
    { text: '🔄 Reiniciar sesión', callback_data: '/nuevo' },
  ],
];

export const MENUS_BY_BOT: Record<BotIdentity, InlineKeyboard> = {
  omni: MENU_OMNI,
  redes: MENU_REDES,
  assistant: MENU_ASSISTANT,
  liminal: MENU_LIMINAL,
};

const MENU_TITLES: Record<BotIdentity, string> = {
  omni: '⚡ **TGP Omni** — ¿Qué creamos hoy, che? Seleccioná una acción rápida:',
  redes: '📱 **TGP Redes** — ¿Para qué red publicamos el post?',
  assistant: '🔬 **TGP Assistant** — ¿Qué línea histórica o grafo investigamos?',
  liminal: '🌒 **TGP Liminal** — Exploradora lingüística y archivo vivo:',
};

export function getMenuTitle(botIdentity: BotIdentity): string {
  return MENU_TITLES[botIdentity] || '⚡ **TGP Mind** — ¿En qué avanzamos?';
}
