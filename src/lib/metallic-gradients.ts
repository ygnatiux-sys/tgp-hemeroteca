/**
 * GLOSARIO Y DICCIONARIO DE DEGRADADOS METÁLICOS TGP (APPLE HERO & DIDONE)
 * Biblioteca central de gradientes metálicos con biseles especulares y delineado ultra-mínimo (0.1px).
 */

export interface MetallicGradientSpec {
  id: string;
  name: string;
  className: string;
  strokeClass: string;
  baseHex: string;
  middleHex: string;
  bottomHex: string;
  stopsDescription: string;
  visualEffect: string;
  recommendedFor: string[];
}

export const METALLIC_GRADIENTS_LIBRARY: Record<string, MetallicGradientSpec> = {
  silverBright: {
    id: "silverBright",
    name: "Plata Brillante iOS Hero",
    className: "gradient-silver-bright",
    strokeClass: "title-stroke-dark-bg", // Filo negro 0.15px
    baseHex: "#D1D1D6",
    middleHex: "#FFFFFF",
    bottomHex: "#8E8E93",
    stopsDescription: "#D1D1D6 (0%-45%) ➔ #FFFFFF (50% Reflejo Afilado) ➔ #8E8E93 (100%)",
    visualEffect: "Metal plata brillante especular con destello blanco pulido. Sensación de superficie de aluminio cepillado de precisión Apple.",
    recommendedFor: ["Portadas Hero sobre fondo oscuro", "Dossiers cinemáticos estándar", "Títulos de apertura"],
  },
  titaniumDark: {
    id: "titaniumDark",
    name: "Titanio Oscuro / Grafito",
    className: "gradient-titanium-dark",
    strokeClass: "title-stroke-light-bg", // Filo blanco 0.15px
    baseHex: "#8E8E93",
    middleHex: "#E5E5EA",
    bottomHex: "#1C1C1E",
    stopsDescription: "#8E8E93 (0%-40%) ➔ #E5E5EA (45% Reflejo Plata) ➔ #1C1C1E (100%)",
    visualEffect: "Metal titanio grafito profundo con filo blanco microscópico. Resalta con solidez sin perderse sobre fondos diurnos, bruma o blancos.",
    recommendedFor: ["Títulos sobre fondo blanco/claro/diurno", "Aguará Guazú", "Retratos con bruma alta"],
  },
  rojoNetflix: {
    id: "rojoNetflix",
    name: "Rojo Netflix Metal Anodizado",
    className: "gradient-rojo-netflix",
    strokeClass: "title-stroke-dark-bg", // Filo negro 0.15px
    baseHex: "#E50914",
    middleHex: "#FFFFFF",
    bottomHex: "#2B0002",
    stopsDescription: "#E50914 (0%-30%) ➔ #FFFFFF (45%-55% Reflejo Afilado) ➔ #2B0002 (60%-100%)",
    visualEffect: "Metal rojo carmesí anodizado con destello central blanco puro e interior sangriento profundo. Sensación de armadura de acero templado.",
    recommendedFor: ["Temas HARD de Historia", "Guerras y Batallas (Atila, Cartago, Nerón, Julio César)", "Conflictos y Conquistas"],
  },
  azulPlatinado: {
    id: "azulPlatinado",
    name: "Azul Platinado Zafiro Anodizado",
    className: "gradient-azul-platinado",
    strokeClass: "title-stroke-dark-bg", // Filo negro 0.15px
    baseHex: "#38BDF8",
    middleHex: "#FFFFFF",
    bottomHex: "#030712",
    stopsDescription: "#38BDF8 (0%-30%) ➔ #FFFFFF (45%-55% Reflejo Afilado) ➔ #030712 (60%-100%)",
    visualEffect: "Metal zafiro platinado anodizado con bisel de luz blanca e interior abisal. Diferente al titanio neutro: aporta aura cósmica y cognitiva.",
    recommendedFor: ["Filosofía Profunda y Gnosis", "Arquetipos y Semiótica", "Astronomía y Cosmología (Hegel, Nag Hammadi, Sueños Lúcidos)"],
  },
  generalH1: {
    id: "generalH1",
    name: "Pergamino & Cobre Especular (Gloock H1)",
    className: "gradient-general-h1",
    strokeClass: "glow-metallic-gloock",
    baseHex: "#EFEBE3",
    middleHex: "#FFFFFF",
    bottomHex: "#C88D58",
    stopsDescription: "#FFFFFF (0%) ➔ #EFEBE3 (22%) ➔ #D5C7B3 (55%) ➔ #C88D58 (82%) ➔ rgba(110,72,47,0.70) (100%)",
    visualEffect: "Estructura especular multi-stop adaptada a pergamino, níquel champagne y cobre dorado. Máxima distinción didone monumental.",
    recommendedFor: ["H1 de artículos de investigación", "Encabezados principales de Dossier"],
  },
  generalH2: {
    id: "generalH2",
    name: "Níquel & Champagne Especular (Gloock H2)",
    className: "gradient-general-h2",
    strokeClass: "glow-metallic-gloock",
    baseHex: "#EFEBE3",
    middleHex: "#FFFFFF",
    bottomHex: "#C88D58",
    stopsDescription: "#FFFFFF (0%) ➔ #EFEBE3 (25%) ➔ #D5C7B3 (60%) ➔ #C88D58 (85%) ➔ rgba(110,72,47,0.75) (100%)",
    visualEffect: "Versión de lectura continua en Didone para subtítulos H2 y etiquetas monumentales con resplandor niquelado.",
    recommendedFor: ["Subtítulos H2", "Secciones editoriales"],
  },
  metalSteelCard: {
    id: "metalSteelCard",
    name: "Acero Arenado Cálido",
    className: "gradient-metal-steel-card",
    strokeClass: "title-stroke-dark-bg",
    baseHex: "#E3DDD3",
    middleHex: "#D4CDC2",
    bottomHex: "#736C62",
    stopsDescription: "#E3DDD3 (0%) ➡ #D4CDC2 (55%) ➡ rgba(227,221,211,0.50) (100%)",
    visualEffect: "Metal mate de tono marfil/acero pulido suave. Presencia física táctil para tarjetas menores sin competir con la portada hero.",
    recommendedFor: ["Tarjetas secundarias de archivo", "Grillas compactas"],
  },
  steelTitanium: {
    id: "steelTitanium",
    name: "Steel Titanium Cepillado (Hemeroteca Original)",
    className: "gradient-steel-titanium",
    strokeClass: "",
    baseHex: "#94A3B8",
    middleHex: "#94A3B8",
    bottomHex: "#334155",
    stopsDescription: "#94A3B8 (0%) ➡ #64748B (30%) ➡ #94A3B8 (50% Reflejo) ➡ #475569 (75%) ➡ #334155 (100%)",
    visualEffect: "Acero cepillado azul-titanio con destello especular en el centro. Paleta Slate original de la Hemeroteca TGP. Hermano azulado del Gloock gradient pero en Cinzel.",
    recommendedFor: ["Hero cinémático de inicio por defecto", "Títulos generales sobre fondo oscuro", "Sección principal Home"],
  },
};

/**
 * Recomienda el gradiente metálico ideal según la categoría, título, contraste de fondo o selector explícito.
 * 
 * ⚠️ UNIFORMIZACIÓN GLOBAL: La función siempre devuelve gradient-general-h1 (titanio 2 colores)
 * para mantener todos los heros grandes del sitio con el mismo color unificado.
 * El selector dinámico por categoría queda comentado abajo como referencia histórica.
 */
export function recommendMetallicGradient(
  category: string = '',
  title: string = '',
  bgContrast: 'light' | 'dark' = 'dark',
  explicitVariant?: string | null
): { gradientClass: string; strokeClass: string; gradientSpec: MetallicGradientSpec } {

  // UNIFORMIZACIÓN GLOBAL — gradient-general-h1 para todos los heros grandes
  return {
    gradientClass: METALLIC_GRADIENTS_LIBRARY.generalH1.className,
    strokeClass: '', // Sin filo especial — el gradiente titanio ya tiene contraste propio
    gradientSpec: METALLIC_GRADIENTS_LIBRARY.generalH1,
  };

  /* ── SELECTOR DINÁMICO ORIGINAL (deshabilitado — conservar como referencia) ──
  const explicit = (explicitVariant || '').toLowerCase().trim();
  if (explicit) {
    if (explicit.includes('rojo') || explicit.includes('netflix') || explicit.includes('red')) {
      return { gradientClass: METALLIC_GRADIENTS_LIBRARY.rojoNetflix.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.rojoNetflix.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.rojoNetflix };
    }
    if (explicit.includes('azul') || explicit.includes('blue') || explicit.includes('platin')) {
      return { gradientClass: METALLIC_GRADIENTS_LIBRARY.azulPlatinado.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.azulPlatinado.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.azulPlatinado };
    }
    if (explicit.includes('titan') || explicit.includes('dark')) {
      return { gradientClass: METALLIC_GRADIENTS_LIBRARY.titaniumDark.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.titaniumDark.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.titaniumDark };
    }
    if (explicit.includes('silver') || explicit.includes('plata') || explicit.includes('bright')) {
      return { gradientClass: METALLIC_GRADIENTS_LIBRARY.silverBright.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.silverBright.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.silverBright };
    }
    if (explicit.includes('acero') || explicit.includes('steel')) {
      return { gradientClass: METALLIC_GRADIENTS_LIBRARY.steelTitanium.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.steelTitanium.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.steelTitanium };
    }
  }

  const cat = (category || '').toLowerCase();
  const t = (title || '').toLowerCase();

  const isHardHistory = /atila|cartago|neron|roma|galos|cesar|moctezuma|cortez|guerra|batalla|imperio|conquista|sangre|destruccion|combate/i.test(`${cat} ${t}`);
  if (isHardHistory && bgContrast === 'dark') {
    return { gradientClass: METALLIC_GRADIENTS_LIBRARY.rojoNetflix.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.rojoNetflix.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.rojoNetflix };
  }

  const isDeepCosmic = /filosofia|hegel|gnosis|cosmo|luna|sueño|arquetipo|nag-hammadi|simbolismo|estrella|astrologia/i.test(`${cat} ${t}`);
  if (isDeepCosmic && bgContrast === 'dark') {
    return { gradientClass: METALLIC_GRADIENTS_LIBRARY.azulPlatinado.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.azulPlatinado.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.azulPlatinado };
  }

  if (bgContrast === 'light') {
    return { gradientClass: METALLIC_GRADIENTS_LIBRARY.titaniumDark.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.titaniumDark.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.titaniumDark };
  }

  return { gradientClass: METALLIC_GRADIENTS_LIBRARY.steelTitanium.className, strokeClass: METALLIC_GRADIENTS_LIBRARY.steelTitanium.strokeClass, gradientSpec: METALLIC_GRADIENTS_LIBRARY.steelTitanium };
  ── FIN SELECTOR DINÁMICO */
}
