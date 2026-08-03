/**
 * CATÁLOGO VISUAL TIPADO TGP V2
 * Define todos los valores, etiquetas y agrupaciones de los 19 módulos y modos narrativos.
 */

import type {
  VisualSensitivity,
  NarrativeMode,
  HistoricalRigor,
  SceneCondition,
  HumanPresence,
  VisualRisk,
  AspectProfile,
  SubjectTreatment,
  Environment,
  HistoricalAnchorCategory,
  HumanTrace,
  ShotScale,
  CameraAngle,
  CameraPosition,
  LensCharacter,
  FocusStrategy,
  Composition,
  LightingSource,
  LightingQuality,
  ColorPalette,
  CaptureMedium,
  FilmTreatment,
  Materiality,
  ImperfectionLevel,
  NegativeConstraint,
} from './types';

export interface CatalogItem<T extends string> {
  value: T;
  label: string;
  description?: string;
}

// -------------------------------------------------------------
// COMBINADOR INTELIGENTE
// -------------------------------------------------------------

export const VISUAL_SENSITIVITIES: CatalogItem<VisualSensitivity>[] = [
  { value: 'auto', label: 'Auto (Inteligente)', description: 'Combinación balanceada según concepto y contexto' },
  { value: 'avant-garde', label: 'Vanguardista', description: 'Altera 1-2 dimensiones: encuadre, cámara o contraste sin caer en surrealismo' },
  { value: 'classic', label: 'Clásico Disciplinado', description: 'Claridad formal, luz motivada, equilibrio y continuidad material' },
  { value: 'hybrid', label: 'Híbrido Editorial', description: 'Base clásica con exactamente una operación contemporánea dominante' },
];

export const NARRATIVE_MODES: CatalogItem<NarrativeMode>[] = [
  { value: 'auto', label: 'Auto (Inferido por LLM)' },
  { value: 'observational-drama', label: 'Drama Observacional', description: 'Escena natural, cámara testigo, gesto contenido, luz motivada' },
  { value: 'historical-epic', label: 'Épica Histórica', description: 'Escala territorial o arquitectónica, profundidad, figuras de escala' },
  { value: 'psychological-closeup', label: 'Primer Plano Psicológico', description: 'Rostro, manos, objeto íntimo o gesto concentrado' },
  { value: 'night-expedition', label: 'Expedición Nocturna', description: 'Oscuridad realista, fuentes prácticas limitadas, orientación legible' },
  { value: 'archival-reconstruction', label: 'Reconstrucción de Archivo', description: 'Reconstrucción documental, contenida, precisa y sin espectáculo' },
  { value: 'field-documentary', label: 'Documental de Campo', description: 'Terreno, clima, evidencia material, trabajo humano y luz encontrada' },
  { value: 'editorial-relic', label: 'Reliquia Editorial', description: 'Objeto como protagonista editorial, textura, sombra y espacio negativo' },
  { value: 'material-surrealism', label: 'Surrealismo Material', description: 'Mundo realista con una única anomalía material o causal' },
];

export const HISTORICAL_RIGORS: CatalogItem<HistoricalRigor>[] = [
  { value: 'strict', label: 'Estricto / Arqueológico', description: 'Fidelidad rigurosa a evidencia material e histórica' },
  { value: 'documented-interpretive', label: 'Interpretativo Documentado', description: 'Basado en fuentes con margen de ambientación verosímil' },
  { value: 'editorial', label: 'Editorial Sofisticado', description: 'Prioridad estética refinada respetando el núcleo conceptual' },
  { value: 'conceptual', label: 'Conceptual / Simbólico', description: 'Metáfora visual con peso filosófico y atemporal' },
];

export const SCENE_CONDITIONS: CatalogItem<SceneCondition>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'still', label: 'Calma / Estático' },
  { value: 'wind', label: 'Viento' },
  { value: 'rain', label: 'Lluvia' },
  { value: 'mist', label: 'Niebla / Neblina' },
  { value: 'dust', label: 'Polvo / Arena' },
  { value: 'heat', label: 'Calor Radiante' },
  { value: 'cold', label: 'Frío / Helada' },
  { value: 'wet-ground', label: 'Suelo Húmedo / Charcos' },
  { value: 'night', label: 'Noche' },
  { value: 'interior', label: 'Interior' },
  { value: 'exterior', label: 'Exterior' },
];

export const HUMAN_PRESENCES: CatalogItem<HumanPresence>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'none', label: 'Sin Presencia Humana' },
  { value: 'trace-only', label: 'Solo Huella / Rastro' },
  { value: 'distant-scale', label: 'Figura Lejana (Escala)' },
  { value: 'hands-only', label: 'Solo Manos / Acción' },
  { value: 'partial-body', label: 'Cuerpo Parcial / Silueta' },
  { value: 'single-observer', label: 'Observador Solitario' },
  { value: 'working-figure', label: 'Figura en Trabajo' },
  { value: 'small-group', label: 'Grupo Reducido' },
  { value: 'crowd', label: 'Multitud' },
];

export const VISUAL_RISKS: CatalogItem<VisualRisk>[] = [
  { value: 'restrained', label: 'Contenido / Conservador' },
  { value: 'balanced', label: 'Equilibrado TGP' },
  { value: 'bold', label: 'Audaz / Contraste Marcado' },
  { value: 'experimental', label: 'Experimental' },
];

export const ASPECT_PROFILES: CatalogItem<AspectProfile>[] = [
  { value: 'article-3-2', label: 'Artículo (3:2)' },
  { value: 'hero-16-9', label: 'Hero Web (16:9)' },
  { value: 'ultrawide-21-9', label: 'Ultrawide (21:9)' },
  { value: 'editorial-4-5', label: 'Editorial / Redes (4:5)' },
  { value: 'mobile-9-16', label: 'Móvil / Stories (9:16)' },
  { value: 'square-1-1', label: 'Cuadrado (1:1)' },
];

// -------------------------------------------------------------
// PANEL A — SUJETO E HISTORIA
// -------------------------------------------------------------

export const SUBJECT_TREATMENTS: CatalogItem<SubjectTreatment>[] = [
  { value: 'evidential-object', label: 'Objeto Evidencial / Reliquia' },
  { value: 'observational-human', label: 'Gesto Humano Observacional' },
  { value: 'ritual-action', label: 'Acción Ritual / Solemne' },
  { value: 'editorial-portrait', label: 'Retrato Editorial Histórico' },
  { value: 'anonymous-figure', label: 'Figura Anónima Testigo' },
  { value: 'environmental-subject', label: 'Sujeto Integrado en Paisaje' },
  { value: 'archival-tableau', label: 'Tableau de Archivo Documental' },
  { value: 'material-anomaly', label: 'Anomalía Material Aislada' },
  { value: 'architectural-subject', label: 'Elemento Arquitectónico Central' },
  { value: 'landscape-as-evidence', label: 'Paisaje como Evidencia' },
];

export const ENVIRONMENTS: CatalogItem<Environment>[] = [
  { value: 'archaeological-field', label: 'Campo Arqueológico / Excavación' },
  { value: 'institutional-archive', label: 'Archivo Institucional / Depósito' },
  { value: 'museum-clinical', label: 'Museo Clínico / Vitrina Técnica' },
  { value: 'lived-historic-interior', label: 'Interior Histórico Habitado' },
  { value: 'decayed-heritage', label: 'Patrimonio Decadente / Ruina Real' },
  { value: 'monumental-landscape', label: 'Paisaje Monumental / Remoto' },
  { value: 'nocturnal-site', label: 'Yacimiento Nocturno' },
  { value: 'studio-material', label: 'Estudio de Materialidad Táctil' },
  { value: 'urban-palimpsest', label: 'Palimpsesto Urbano Estratificado' },
  { value: 'ritual-space', label: 'Espacio Ritual / Sagrado Antiguo' },
  { value: 'domestic-historical', label: 'Ámbito Doméstico de Época' },
  { value: 'industrial-archaeology', label: 'Arqueología Industrial Temprana' },
];

export const HISTORICAL_ANCHOR_CATEGORIES: CatalogItem<HistoricalAnchorCategory>[] = [
  { value: 'period', label: 'Periodo / Datación' },
  { value: 'location', label: 'Ubicación Geográfica' },
  { value: 'architecture', label: 'Tipología Arquitectónica' },
  { value: 'material-culture', label: 'Cultura Material' },
  { value: 'clothing', label: 'Vestimenta y Textiles' },
  { value: 'technology', label: 'Herramientas y Tecnología' },
  { value: 'inscriptions', label: 'Epigrafía e Inscripciones' },
  { value: 'ritual', label: 'Práctica Ritual' },
  { value: 'climate', label: 'Clima y Microclima' },
  { value: 'conservation-state', label: 'Estado de Conservación' },
  { value: 'social-practice', label: 'Práctica Social' },
];

export const HUMAN_TRACES: CatalogItem<HumanTrace>[] = [
  { value: 'none', label: 'Sin Rastro' },
  { value: 'distant-scale', label: 'Figura a la Distancia (Escala)' },
  { value: 'hands-only', label: 'Manos Manipulando' },
  { value: 'partial-body', label: 'Cuerpo Parcial / Espectador' },
  { value: 'working-figure', label: 'Persona Trabajando' },
  { value: 'small-group', label: 'Pequeño Grupo en Tarea' },
  { value: 'crowd-trace', label: 'Rastro de Multitud Pasada' },
  { value: 'abandoned-tools', label: 'Herramientas Abandonadas' },
  { value: 'footprints', label: 'Pisadas en Barro / Arena' },
  { value: 'recent-displacement', label: 'Objetos Recién Desplazados' },
  { value: 'breath-condensation', label: 'Vaho de Respiración' },
  { value: 'wind-on-clothing', label: 'Viento en la Ropa' },
];

// -------------------------------------------------------------
// PANEL B — CÁMARA Y COMPOSICIÓN
// -------------------------------------------------------------

export const SHOT_SCALES: CatalogItem<ShotScale>[] = [
  { value: 'extreme-wide', label: 'Plano General Extremo (Paisaje/Territorio)' },
  { value: 'wide', label: 'Plano General / Establecimiento' },
  { value: 'full', label: 'Plano Entero (Figura completa)' },
  { value: 'medium-wide', label: 'Plano Americano / Tres cuartos' },
  { value: 'medium', label: 'Plano Medio' },
  { value: 'medium-close', label: 'Plano Medio Corto' },
  { value: 'close', label: 'Primer Plano' },
  { value: 'extreme-close', label: 'Primerísimo Primer Plano' },
  { value: 'macro-detail', label: 'Detalle Macro Táctil' },
];

export const CAMERA_ANGLES: CatalogItem<CameraAngle>[] = [
  { value: 'eye-level', label: 'A Nivel de Ojos (Objetivo / Testigo)' },
  { value: 'low-angle', label: 'Contrapicado Suave (Monumentalidad)' },
  { value: 'high-angle', label: 'Picado Suave (Inspección)' },
  { value: 'top-down', label: 'Cenital / Top-down' },
  { value: 'ground-skimming', label: 'Rasante de Suelo' },
  { value: 'three-quarter', label: 'Tres Cuartos Clásico' },
  { value: 'profile', label: 'Perfil Estricto' },
  { value: 'over-shoulder', label: 'Sobre el Hombro' },
  { value: 'subtle-dutch', label: 'Holandés Sutil (Tensión)' },
  { value: 'architectural-frontal', label: 'Frontal Arquitectónico' },
];

export const CAMERA_POSITIONS: CatalogItem<CameraPosition>[] = [
  { value: 'centered-observer', label: 'Observador Centrado' },
  { value: 'off-axis', label: 'Fuera de Eje' },
  { value: 'threshold-doorway', label: 'En el Umbral / Puerta' },
  { value: 'behind-object', label: 'Detrás de un Objeto' },
  { value: 'shoulder-height', label: 'Altura de Hombro' },
  { value: 'waist-height', label: 'Altura de Cintura' },
  { value: 'ground-level', label: 'A Nivel de Suelo' },
  { value: 'elevated-platform', label: 'Plataforma Elevada' },
  { value: 'intimate-near', label: 'Íntimo Cercano' },
  { value: 'distant-witness', label: 'Testigo Distante' },
  { value: 'inside-crowd', label: 'Dentro de la Multitud' },
];

export const LENS_CHARACTERS: CatalogItem<LensCharacter>[] = [
  { value: 'spherical-clean', label: 'Esférico Limpio y Nítido' },
  { value: 'spherical-vintage-low-contrast', label: 'Esférico Vintage de Bajo Contraste' },
  { value: 'anamorphic-subtle', label: 'Anamórfico Sutil (Bokeh Oval)' },
  { value: 'wide-close-perspective', label: 'Gran Angular Cercano con Perspectiva' },
  { value: 'tele-compressed', label: 'Teleobjetivo Comprimido' },
  { value: 'macro-flat-field', label: 'Macro de Campo Plano' },
  { value: 'medium-format-natural', label: 'Formato Medio Natural' },
  { value: 'documentary-35mm', label: '35mm Documental' },
  { value: 'large-format-precise', label: 'Gran Formato Preciso' },
  { value: 'soft-portrait-vintage', label: 'Retrato Vintage Suave' },
];

export const FOCUS_STRATEGIES: CatalogItem<FocusStrategy>[] = [
  { value: 'deep-focus', label: 'Foco Profundo (Todo nítido)' },
  { value: 'layered-focus', label: 'Foco por Capas de Profundidad' },
  { value: 'selective-focus', label: 'Foco Selectivo en Sujeto' },
  { value: 'shallow-controlled', label: 'Profundidad de Campo Reducida Controlada' },
  { value: 'zone-focus', label: 'Foco por Zonas Documental' },
  { value: 'gradual-falloff', label: 'Caída de Foco Gradual y Orgánica' },
  { value: 'split-diopter', label: 'Doble Plano Nítido (Split Diopter)' },
  { value: 'foreground-obstruction', label: 'Obstrucción en Primer Término Desenfundada' },
];

export const COMPOSITIONS: CatalogItem<Composition>[] = [
  { value: 'asymmetric-balance', label: 'Equilibrio Asimétrico' },
  { value: 'layered-depth', label: 'Profundidad por Planos y Capas' },
  { value: 'central-iconic', label: 'Central Icónico' },
  { value: 'negative-space-for-title', label: 'Espacio Negativo para Título' },
  { value: 'corridor-framing', label: 'Encuadre por Corredor / Arco' },
  { value: 'obstructed-foreground', label: 'Primer Término Obstruido' },
  { value: 'diagonal-movement', label: 'Tensión Diagonal' },
  { value: 'formal-tableau', label: 'Tableau Formal Disciplinado' },
  { value: 'edge-crop', label: 'Recorte al Borde / Fragmentario' },
  { value: 'repetition', label: 'Ritmo y Repetición' },
  { value: 'mobile-safe-vertical', label: 'Zona Segura Vertical Móvil' },
  { value: 'environmental-scale', label: 'Escala Monumental del Entorno' },
];

// -------------------------------------------------------------
// PANEL C — LUZ Y COLOR
// -------------------------------------------------------------

export const LIGHTING_SOURCES: CatalogItem<LightingSource>[] = [
  { value: 'overcast-daylight', label: 'Luz de Día Nublado (Difusa y Neutra)' },
  { value: 'hard-sun', label: 'Sol Duro Directo' },
  { value: 'raking-sun', label: 'Sol Rasante (Textura y Relieve)' },
  { value: 'golden-hour', label: 'Hora Dorada Natural' },
  { value: 'blue-hour', label: 'Hora Azul Crepuscular' },
  { value: 'tungsten-practical', label: 'Lámpara de Tungsteno Práctica' },
  { value: 'candle-fire', label: 'Velas o Fuego Real' },
  { value: 'fluorescent-institutional', label: 'Fluorescente Institucional Frío' },
  { value: 'museum-led', label: 'LED Técnico de Museo' },
  { value: 'direct-flash', label: 'Flash Directo Forense' },
  { value: 'bounced-flash', label: 'Flash Rebotado Suave' },
  { value: 'moonlit-ambient', label: 'Luz de Luna y Ambiente Nocturno' },
  { value: 'mixed-practicals', label: 'Fuentes Prácticas Mixtas' },
  { value: 'scanner-light', label: 'Luz de Escáner / Haz Lineal' },
];

export const LIGHTING_QUALITIES: CatalogItem<LightingQuality>[] = [
  { value: 'soft-wrap', label: 'Envolvente Suave' },
  { value: 'hard-raking', label: 'Rasante Dura con Sombras Largas' },
  { value: 'bounced-natural', label: 'Rebotada Natural Orgánica' },
  { value: 'low-key-motivated', label: 'Clave Baja con Luz Motivada' },
  { value: 'flat-forensic', label: 'Plana Forense / Documental' },
  { value: 'restrained-chiaroscuro', label: 'Claroscuro Contenido' },
  { value: 'specular-editorial', label: 'Especular Editorial Precisa' },
  { value: 'diffuse-atmospheric', label: 'Atmosférica Difusa' },
  { value: 'broken-shadow', label: 'Sombra Fragmentada (Gobo natural)' },
  { value: 'localized-falloff', label: 'Caída de Luz Muy Localizada' },
  { value: 'ambient-unbeautified', label: 'Ambiente Crudo sin Embellecer' },
];

export const COLOR_PALETTES: CatalogItem<ColorPalette>[] = [
  { value: 'mineral-cool', label: 'Mineral Frío (Piedra, Pizarra, Basalto)' },
  { value: 'wet-earth', label: 'Tierra Húmeda (Ocre, Fango, Turba)' },
  { value: 'neutral-archive', label: 'Archivo Neutro (Gris plomo, Papel, Roble)' },
  { value: 'tungsten-neutral', label: 'Tungsteno Neutro (Ámbar cálido contenido)' },
  { value: 'oxidized-green', label: 'Verde Oxidado (Cobre, Pátina, Musgo)' },
  { value: 'silver-graphite', label: 'Plata y Grafito (Monocromo rico)' },
  { value: 'faded-daylight', label: 'Luz de Día Desvaída (Tonos apagados)' },
  { value: 'sodium-cyan-night', label: 'Sodio y Cian Nocturno' },
  { value: 'restrained-monochrome', label: 'Monocromo Contenido' },
  { value: 'chromatic-editorial', label: 'Editorial Cromático Controlado' },
  { value: 'renaissance-cold', label: 'Renacimiento Frío (Lapis, Óleo seco)' },
  { value: 'terracotta-neutral', label: 'Terracota y Caliza Neutra' },
  { value: 'desaturated-primary', label: 'Primarios Desaturados' },
  { value: 'restricted-archival-sepia', label: 'Sepia de Archivo Restringido (Secundario)' },
];

// -------------------------------------------------------------
// PANEL D — CAPTURA Y MATERIALIDAD
// -------------------------------------------------------------

export const CAPTURE_MEDIUMS: CatalogItem<CaptureMedium>[] = [
  { value: 'digital-cinema-large-format', label: 'Cine Digital Gran Formato (Arri Alexa 65)' },
  { value: 'digital-medium-format', label: 'Formato Medio Digital (Hasselblad / Phase One)' },
  { value: 'digital-full-frame', label: 'Full Frame Digital Editorial' },
  { value: 'large-format-sheet-film', label: 'Película Gran Formato Placa 4x5' },
  { value: 'medium-format-6x7', label: 'Película Formato Medio 6x7' },
  { value: 'medium-format-6x6', label: 'Película Formato Medio Cuadrado 6x6' },
  { value: '35mm-color-negative', label: '35mm Negativo Color' },
  { value: '35mm-black-and-white', label: '35mm Blanco y Negro Fotoquímico' },
  { value: 'slide-film', label: 'Película Diapositiva Reversal' },
  { value: '16mm-frame-aesthetic', label: '16mm Grano Cinematográfico' },
  { value: 'archival-plate-emulation', label: 'Emulación de Placa Húmeda del S. XIX' },
];

export const FILM_TREATMENTS: CatalogItem<FilmTreatment>[] = [
  { value: 'none', label: 'Sin Tratamiento Específico' },
  { value: 'clean-daylight-negative', label: 'Negativo Luz de Día Limpio' },
  { value: 'soft-daylight-negative', label: 'Negativo Luz de Día Suave' },
  { value: 'balanced-tungsten-negative', label: 'Negativo Tungsteno Equilibrado' },
  { value: 'high-speed-tungsten-grain', label: 'Grano de Alta Sensibilidad Tungsteno' },
  { value: 'black-and-white-cinema', label: 'Blanco y Negro Cinematográfico Clásico' },
  { value: 'slide-saturation', label: 'Saturación Densa de Diapositiva' },
  { value: 'kodachrome-inspired', label: 'Inspiración Kodachrome Vintage' },
  { value: 'restrained-bleach-bypass', label: 'Bleach Bypass Contenido (Alto contraste desaturado)' },
  { value: 'soft-print-film', label: 'Copia Positiva en Película de Exhibición' },
  { value: 'subtle-cross-process', label: 'Proceso Cruzado Sutil' },
  { value: 'archival-fade', label: 'Desvanecimiento de Archivo Natural' },
  { value: 'subtle-halation', label: 'Halación Sutil en Luces Altas' },
  { value: 'silver-rich-monochrome', label: 'Monocromo Rico en Plata' },
];

export const MATERIALITIES: CatalogItem<Materiality>[] = [
  { value: 'dry-stone', label: 'Piedra Seca / Caliza' },
  { value: 'wet-stone', label: 'Piedra Húmeda / Basalto Mojado' },
  { value: 'oxidized-metal', label: 'Metal Oxidado / Bronce con Pátina' },
  { value: 'aged-paper', label: 'Papel Antiguo / Pergamino' },
  { value: 'waxed-wood', label: 'Madera Encerada / Viga Antigua' },
  { value: 'cracked-plaster', label: 'Yeso Agrietado / Estuco' },
  { value: 'worn-velvet', label: 'Terciopelo Gastado' },
  { value: 'light-dust', label: 'Polvo Fino Sedimentado' },
  { value: 'salt-air', label: 'Salitre Marino' },
  { value: 'mud-clay', label: 'Barro y Arcilla' },
  { value: 'glass-steel', label: 'Vidrio y Acero' },
  { value: 'skin-fabric', label: 'Piel y Tejido Natural' },
  { value: 'pigment-fresco', label: 'Pigmento Mineral en Fresco' },
  { value: 'bone-ivory', label: 'Hueso y Marfil Antiguo' },
  { value: 'smoke-soot', label: 'Humo y Hollín' },
];

export const IMPERFECTION_LEVELS: CatalogItem<ImperfectionLevel>[] = [
  { value: 'pristine-editorial', label: 'Prístino Editorial (Impecable)' },
  { value: 'restrained', label: 'Contenido (Texturas sutiles)' },
  { value: 'human', label: 'Humano (Desgaste de uso creíble)' },
  { value: 'raw-documentary', label: 'Documental Crudo (Polvo, lodo, intemperie)' },
  { value: 'archival-distress', label: 'Deterioro de Archivo Histórico' },
];

// -------------------------------------------------------------
// PANEL E — NEGATIVAS
// -------------------------------------------------------------

export const NEGATIVE_CONSTRAINTS: CatalogItem<NegativeConstraint>[] = [
  { value: 'no-sepia', label: 'Sin Sepia Genérico' },
  { value: 'no-steampunk', label: 'Sin Estética Steampunk' },
  { value: 'no-fantasy-costume', label: 'Sin Vestuario de Fantasía' },
  { value: 'no-blue-anamorphic-flare', label: 'Sin Flare Anamórfico Azul Injustificado' },
  { value: 'no-perfect-symmetry', label: 'Sin Simetría Artificial Perfecta' },
  { value: 'no-excessive-bokeh', label: 'Sin Bokeh Excesivo o Borroso Extremo' },
  { value: 'no-unmotivated-volumetric-dust', label: 'Sin Polvo Volumétrico Inmotivado' },
  { value: 'no-plastic-skin', label: 'Sin Piel de Plástico / Suavizado IA' },
  { value: 'no-anachronism', label: 'Sin Anacronismos Tecnológicos o Materiales' },
  { value: 'no-illegible-text', label: 'Sin Textos o Letras Ilegibles Generadas' },
  { value: 'no-over-sharpening', label: 'Sin Sobre-enfoque Digital Artificial' },
  { value: 'no-orange-teal', label: 'Sin Graduación Orange & Teal Gratuita' },
  { value: 'no-generic-dark-academia', label: 'Sin Dark Academia de Cliché / Pinterest' },
  { value: 'no-tourist-postcard', label: 'Sin Composición de Postal Turística' },
  { value: 'no-decorative-ruins', label: 'Sin Ruinas Románticas Decorativas' },
  { value: 'no-glowing-symbols', label: 'Sin Símbolos Místicos Brillantes' },
  { value: 'no-floating-particles', label: 'Sin Partículas Mágicas Flotantes' },
  { value: 'no-empty-cinematic-spectacle', label: 'Sin Espectáculo Cinematográfico Vacío' },
  { value: 'no-unmotivated-lens-flare', label: 'Sin Destellos de Lente Injustificados' },
];
