/**
 * MOTOR DE DIRECCIÓN VISUAL TGP V2 - TIPOS Y CONTRATOS
 * The Great Puzzle Project
 */

// ==========================================
// 1. COMBINADOR INTELIGENTE (Campos Principales)
// ==========================================

export type VisualSensitivity = 'auto' | 'avant-garde' | 'classic' | 'hybrid';

export type NarrativeMode = 
  | 'auto'
  | 'observational-drama'
  | 'historical-epic'
  | 'psychological-closeup'
  | 'night-expedition'
  | 'archival-reconstruction'
  | 'field-documentary'
  | 'editorial-relic'
  | 'material-surrealism';

export type HistoricalRigor = 
  | 'strict'
  | 'documented-interpretive'
  | 'editorial'
  | 'conceptual';

export type SceneCondition = 
  | 'auto'
  | 'still'
  | 'wind'
  | 'rain'
  | 'mist'
  | 'dust'
  | 'heat'
  | 'cold'
  | 'wet-ground'
  | 'night'
  | 'interior'
  | 'exterior';

export type HumanPresence = 
  | 'auto'
  | 'none'
  | 'trace-only'
  | 'distant-scale'
  | 'hands-only'
  | 'partial-body'
  | 'single-observer'
  | 'working-figure'
  | 'small-group'
  | 'crowd';

export type VisualRisk = 'restrained' | 'balanced' | 'bold' | 'experimental';

export type AspectProfile = 
  | 'article-3-2'
  | 'hero-16-9'
  | 'ultrawide-21-9'
  | 'editorial-4-5'
  | 'mobile-9-16'
  | 'square-1-1';

export interface IntelligentToggles {
  protectHistoricalAnchors: boolean;
  avoidAICliches: boolean;
  safeCropComposition: boolean;
  allowSingleConceptualAnomaly: boolean;
  generateDecisionReport: boolean;
  enableAdvancedOverrides: boolean;
}

export interface AdvancedOverrides {
  cameraFamilyOverride?: string;
  lightingFamilyOverride?: string;
  colorFamilyOverride?: string;
  captureFamilyOverride?: string;
}

export interface IntelligentDirectorInput {
  title: string;
  concept: string;
  contextNotes?: string;
  visualSensitivity: VisualSensitivity;
  narrativeMode: NarrativeMode;
  historicalRigor: HistoricalRigor;
  sceneConditions: SceneCondition[]; // máx 2 compatibles
  humanPresence: HumanPresence;
  visualRisk: VisualRisk;
  aspectProfile: AspectProfile;
  toggles: IntelligentToggles;
  overrides?: AdvancedOverrides;
}

// ==========================================
// 2. LOS 19 MÓDULOS MANUALES (Laboratorio Manual)
// ==========================================

// PANEL A — SUJETO E HISTORIA
export type SubjectTreatment = 
  | 'evidential-object'
  | 'observational-human'
  | 'ritual-action'
  | 'editorial-portrait'
  | 'anonymous-figure'
  | 'environmental-subject'
  | 'archival-tableau'
  | 'material-anomaly'
  | 'architectural-subject'
  | 'landscape-as-evidence';

export type Environment = 
  | 'archaeological-field'
  | 'institutional-archive'
  | 'museum-clinical'
  | 'lived-historic-interior'
  | 'decayed-heritage'
  | 'monumental-landscape'
  | 'nocturnal-site'
  | 'studio-material'
  | 'urban-palimpsest'
  | 'ritual-space'
  | 'domestic-historical'
  | 'industrial-archaeology';

export type HistoricalAnchorCategory = 
  | 'period'
  | 'location'
  | 'architecture'
  | 'material-culture'
  | 'clothing'
  | 'technology'
  | 'inscriptions'
  | 'ritual'
  | 'climate'
  | 'conservation-state'
  | 'social-practice';

export interface HistoricalAnchors {
  categories: HistoricalAnchorCategory[];
  details: string;
}

export type HumanTrace = 
  | 'none'
  | 'distant-scale'
  | 'hands-only'
  | 'partial-body'
  | 'working-figure'
  | 'small-group'
  | 'crowd-trace'
  | 'abandoned-tools'
  | 'footprints'
  | 'recent-displacement'
  | 'breath-condensation'
  | 'wind-on-clothing';

// PANEL B — CÁMARA Y COMPOSICIÓN
export type ShotScale = 
  | 'extreme-wide'
  | 'wide'
  | 'full'
  | 'medium-wide'
  | 'medium'
  | 'medium-close'
  | 'close'
  | 'extreme-close'
  | 'macro-detail';

export type CameraAngle = 
  | 'eye-level'
  | 'low-angle'
  | 'high-angle'
  | 'top-down'
  | 'ground-skimming'
  | 'three-quarter'
  | 'profile'
  | 'over-shoulder'
  | 'subtle-dutch'
  | 'architectural-frontal';

export type CameraPosition = 
  | 'centered-observer'
  | 'off-axis'
  | 'threshold-doorway'
  | 'behind-object'
  | 'shoulder-height'
  | 'waist-height'
  | 'ground-level'
  | 'elevated-platform'
  | 'intimate-near'
  | 'distant-witness'
  | 'inside-crowd';

export type LensCharacter = 
  | 'spherical-clean'
  | 'spherical-vintage-low-contrast'
  | 'anamorphic-subtle'
  | 'wide-close-perspective'
  | 'tele-compressed'
  | 'macro-flat-field'
  | 'medium-format-natural'
  | 'documentary-35mm'
  | 'large-format-precise'
  | 'soft-portrait-vintage';

export type FocusStrategy = 
  | 'deep-focus'
  | 'layered-focus'
  | 'selective-focus'
  | 'shallow-controlled'
  | 'zone-focus'
  | 'gradual-falloff'
  | 'split-diopter'
  | 'foreground-obstruction';

export type Composition = 
  | 'asymmetric-balance'
  | 'layered-depth'
  | 'central-iconic'
  | 'negative-space-for-title'
  | 'corridor-framing'
  | 'obstructed-foreground'
  | 'diagonal-movement'
  | 'formal-tableau'
  | 'edge-crop'
  | 'repetition'
  | 'mobile-safe-vertical'
  | 'environmental-scale';

// PANEL C — LUZ Y COLOR
export type LightingSource = 
  | 'overcast-daylight'
  | 'hard-sun'
  | 'raking-sun'
  | 'golden-hour'
  | 'blue-hour'
  | 'tungsten-practical'
  | 'candle-fire'
  | 'fluorescent-institutional'
  | 'museum-led'
  | 'direct-flash'
  | 'bounced-flash'
  | 'moonlit-ambient'
  | 'mixed-practicals'
  | 'scanner-light';

export type LightingQuality = 
  | 'soft-wrap'
  | 'hard-raking'
  | 'bounced-natural'
  | 'low-key-motivated'
  | 'flat-forensic'
  | 'restrained-chiaroscuro'
  | 'specular-editorial'
  | 'diffuse-atmospheric'
  | 'broken-shadow'
  | 'localized-falloff'
  | 'ambient-unbeautified';

export type ColorPalette = 
  | 'mineral-cool'
  | 'wet-earth'
  | 'neutral-archive'
  | 'tungsten-neutral'
  | 'oxidized-green'
  | 'silver-graphite'
  | 'faded-daylight'
  | 'sodium-cyan-night'
  | 'restrained-monochrome'
  | 'chromatic-editorial'
  | 'renaissance-cold'
  | 'terracotta-neutral'
  | 'desaturated-primary'
  | 'restricted-archival-sepia';

// PANEL D — CAPTURA Y MATERIALIDAD
export type CaptureMedium = 
  | 'digital-cinema-large-format'
  | 'digital-medium-format'
  | 'digital-full-frame'
  | 'large-format-sheet-film'
  | 'medium-format-6x7'
  | 'medium-format-6x6'
  | '35mm-color-negative'
  | '35mm-black-and-white'
  | 'slide-film'
  | '16mm-frame-aesthetic'
  | 'archival-plate-emulation';

export type FilmTreatment = 
  | 'none'
  | 'clean-daylight-negative'
  | 'soft-daylight-negative'
  | 'balanced-tungsten-negative'
  | 'high-speed-tungsten-grain'
  | 'black-and-white-cinema'
  | 'slide-saturation'
  | 'kodachrome-inspired'
  | 'restrained-bleach-bypass'
  | 'soft-print-film'
  | 'subtle-cross-process'
  | 'archival-fade'
  | 'subtle-halation'
  | 'silver-rich-monochrome';

export type Materiality = 
  | 'dry-stone'
  | 'wet-stone'
  | 'oxidized-metal'
  | 'aged-paper'
  | 'waxed-wood'
  | 'cracked-plaster'
  | 'worn-velvet'
  | 'light-dust'
  | 'salt-air'
  | 'mud-clay'
  | 'glass-steel'
  | 'skin-fabric'
  | 'pigment-fresco'
  | 'bone-ivory'
  | 'smoke-soot';

export type ImperfectionLevel = 
  | 'pristine-editorial'
  | 'restrained'
  | 'human'
  | 'raw-documentary'
  | 'archival-distress';

// PANEL E — ENTREGA Y RESTRICCIONES
export type NegativeConstraint = 
  | 'no-sepia'
  | 'no-steampunk'
  | 'no-fantasy-costume'
  | 'no-blue-anamorphic-flare'
  | 'no-perfect-symmetry'
  | 'no-excessive-bokeh'
  | 'no-unmotivated-volumetric-dust'
  | 'no-plastic-skin'
  | 'no-anachronism'
  | 'no-illegible-text'
  | 'no-over-sharpening'
  | 'no-orange-teal'
  | 'no-generic-dark-academia'
  | 'no-tourist-postcard'
  | 'no-decorative-ruins'
  | 'no-glowing-symbols'
  | 'no-floating-particles'
  | 'no-empty-cinematic-spectacle'
  | 'no-unmotivated-lens-flare';

// ==========================================
// 3. LOCKS Y POLÍTICAS DE COHERENCIA
// ==========================================

export interface DirectionLocks {
  lockSubject?: boolean;
  lockEnvironment?: boolean;
  lockHistoricalAnchors?: boolean;
  lockCamera?: boolean;
  lockFocus?: boolean;
  lockComposition?: boolean;
  lockLighting?: boolean;
  lockColor?: boolean;
  lockCapture?: boolean;
  lockMateriality?: boolean;
  lockAspectProfile?: boolean;
}

export type CoherenceMode = 'off' | 'warn' | 'correct';

export interface ManualLabInput {
  subjectSummary: string;
  physicalScene: string;
  
  subjectTreatment: SubjectTreatment;
  environment: Environment;
  historicalAnchors: HistoricalAnchors;
  humanTrace: HumanTrace;

  shotScale: ShotScale;
  cameraAngle: CameraAngle;
  cameraPosition: CameraPosition;
  lensCharacter: LensCharacter;
  focusStrategy: FocusStrategy;
  primaryComposition: Composition;
  secondaryComposition?: Composition;

  lightingSource: LightingSource;
  lightingQuality: LightingQuality;
  colorPalette: ColorPalette;

  captureMedium: CaptureMedium;
  filmTreatment: FilmTreatment;
  materiality: Materiality[]; // máx 4
  imperfectionLevel: ImperfectionLevel;

  aspectProfile: AspectProfile;
  selectedNegativeConstraints: NegativeConstraint[];

  locks: DirectionLocks;
  coherenceMode: CoherenceMode;
}

// ==========================================
// 4. DIRECCIÓN VISUAL RESUELTA Y AUDITORÍA
// ==========================================

export interface CompatibilityDecision {
  id: string;
  level: 'hard' | 'preference' | 'creative';
  priority: number;
  changedFields: string[];
  reason: string;
  originalValues?: Record<string, any>;
  appliedValues?: Record<string, any>;
}

export interface DirectionWarning {
  ruleId: string;
  severity: 'warning' | 'conflict';
  message: string;
  fields: string[];
}

export interface ResolvedArtDirection {
  version: '2.0';
  mode: 'intelligent' | 'manual';

  subjectSummary: string;
  physicalScene: string;

  subjectTreatment: SubjectTreatment;
  environment: Environment;
  historicalAnchors: HistoricalAnchors;
  humanTrace: HumanTrace;

  shotScale: ShotScale;
  cameraAngle: CameraAngle;
  cameraPosition: CameraPosition;
  lensCharacter: LensCharacter;
  focusStrategy: FocusStrategy;
  primaryComposition: Composition;
  secondaryComposition?: Composition;

  lightingSource: LightingSource;
  lightingQuality: LightingQuality;
  colorPalette: ColorPalette;

  captureMedium: CaptureMedium;
  filmTreatment: FilmTreatment;
  materiality: Materiality[];
  imperfectionLevel: ImperfectionLevel;

  requestedAspectProfile: AspectProfile;
  providerAspectRatio: string;
  safeCropRequired: boolean;

  selectedNegativeConstraints: NegativeConstraint[];
  emittedNegativeConstraints: NegativeConstraint[];

  locks: DirectionLocks;
  decisions: CompatibilityDecision[];
  warnings: DirectionWarning[];

  providerCapabilities?: ProviderCapabilities;
}

// ==========================================
// 5. CONTRATOS DE PROVEEDOR E INTEGRACIÓN
// ==========================================

export interface ProviderCapabilities {
  modelId: string;
  supportedAspectRatios: string[];
  supportedResolutions: string[];
  supportsNegativePrompt: boolean;
  supportsReferenceImages: boolean;
  maxReferenceImages?: number;
  supportsSeed?: boolean;
  supportsSafetySettings?: boolean;
}

export interface ProviderImageRequest {
  prompt: string;
  aspectRatio: string;
  negativePrompt?: string;
  slug?: string;
}

export interface ProviderImageResponse {
  success: boolean;
  image?: string;
  coverImagePath?: string | null;
  error?: string;
  normalizedError?: NormalizedProviderError;
}

export interface NormalizedProviderError {
  type: 
    | 'safety'
    | 'invalid-request'
    | 'unsupported-parameter'
    | 'quota'
    | 'authentication'
    | 'provider'
    | 'unknown';
  message: string;
  providerCode?: string;
  providerReason?: string;
  retryable: boolean;
  rawMetadata?: unknown;
}

// ==========================================
// 6. ROUTER SEMÁNTICO Y REDACTOR
// ==========================================

export interface SemanticRoutingResult {
  subjectSummary: string;
  physicalScene: string;
  candidateNarrativeMode: NarrativeMode;
  candidateSubjectTreatment: SubjectTreatment;
  candidateEnvironment: Environment;
  candidateSceneConditions: SceneCondition[];
  historicalAnchors: HistoricalAnchors;
  humanPresence: HumanPresence;
  uncertainty: string[];
}

export interface LLMPromptWriterOutput {
  imagePrompt: string;
  negativePrompt: string;
  summary: string;
  preservedAnchors: string[];
}

// ==========================================
// 7. PRESETS NARRATIVOS Y LEGACY
// ==========================================

export type ArtDirectionKey = keyof ResolvedArtDirection;

export interface NarrativePreset {
  id: NarrativeMode;
  label: string;
  description: string;
  preferred: Partial<ResolvedArtDirection>;
  discouraged?: Partial<Record<ArtDirectionKey, string[]>>;
  forbidden?: Partial<Record<ArtDirectionKey, string[]>>;
  priorityNotes: string[];
}

export type LegacyVisualKey = 
  | 'victorian-archeo'
  | 'travel-senses'
  | 'dark-academia'
  | 'italian-interiors'
  | 'cine'
  | 'editorial'
  | 'concepto'
  | 'personalizado';
