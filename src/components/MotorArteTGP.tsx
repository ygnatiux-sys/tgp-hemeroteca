import React, { useState } from 'react';
import {
  VISUAL_SENSITIVITIES,
  NARRATIVE_MODES,
  HISTORICAL_RIGORS,
  SCENE_CONDITIONS,
  HUMAN_PRESENCES,
  VISUAL_RISKS,
  ASPECT_PROFILES,
  SUBJECT_TREATMENTS,
  ENVIRONMENTS,
  HUMAN_TRACES,
  SHOT_SCALES,
  CAMERA_ANGLES,
  CAMERA_POSITIONS,
  LENS_CHARACTERS,
  FOCUS_STRATEGIES,
  COMPOSITIONS,
  LIGHTING_SOURCES,
  LIGHTING_QUALITIES,
  COLOR_PALETTES,
  CAPTURE_MEDIUMS,
  FILM_TREATMENTS,
  MATERIALITIES,
  IMPERFECTION_LEVELS,
  NEGATIVE_CONSTRAINTS,
} from '../lib/arte-tgp/catalog';
import type {
  IntelligentDirectorInput,
  ManualLabInput,
  ResolvedArtDirection,
  DirectionLocks,
  CoherenceMode,
  Materiality,
  NegativeConstraint,
  SceneCondition,
} from '../lib/arte-tgp/types';

export function MotorArteTGP({ value, onChange, initialTitulo = '', initialEstilo = 'editorial' }: any) {
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'intelligent' | 'manual'>('intelligent');

  // Estado general
  const [titulo, setTitulo] = useState(initialTitulo);
  const [concepto, setConcepto] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Resultados
  const [previsualizacionImagen, setPrevisualizacionImagen] = useState<string | null>(value || null);
  const [promptAplicado, setPromptAplicado] = useState<string | null>(null);
  const [coverImagePath, setCoverImagePath] = useState<string | null>(value?.startsWith('/src/assets') ? value : null);
  const [resolvedDirection, setResolvedDirection] = useState<ResolvedArtDirection | null>(null);
  const [briefText, setBriefText] = useState<string | null>(null);

  // Estados del Modo Inteligente
  const [visualSensitivity, setVisualSensitivity] = useState<any>('classic');
  const [narrativeMode, setNarrativeMode] = useState<any>('auto');
  const [historicalRigor, setHistoricalRigor] = useState<any>('documented-interpretive');
  const [sceneConditions, setSceneConditions] = useState<SceneCondition[]>(['still']);
  const [humanPresence, setHumanPresence] = useState<any>('auto');
  const [visualRisk, setVisualRisk] = useState<any>('balanced');
  const [aspectProfile, setAspectProfile] = useState<any>('hero-16-9');
  const [toggles, setToggles] = useState({
    protectHistoricalAnchors: true,
    avoidAICliches: true,
    safeCropComposition: true,
    allowSingleConceptualAnomaly: false,
    generateDecisionReport: true,
    enableAdvancedOverrides: false,
  });

  // Estados del Laboratorio Manual (19 Módulos)
  const [coherenceMode, setCoherenceMode] = useState<CoherenceMode>('warn');
  const [locks, setLocks] = useState<DirectionLocks>({});

  const [subjectTreatment, setSubjectTreatment] = useState<any>('evidential-object');
  const [environment, setEnvironment] = useState<any>('institutional-archive');
  const [historicalAnchorsDetails, setHistoricalAnchorsDetails] = useState('Siglo XIX, archivo histórico');
  const [humanTrace, setHumanTrace] = useState<any>('none');

  const [shotScale, setShotScale] = useState<any>('medium');
  const [cameraAngle, setCameraAngle] = useState<any>('eye-level');
  const [cameraPosition, setCameraPosition] = useState<any>('centered-observer');
  const [lensCharacter, setLensCharacter] = useState<any>('spherical-clean');
  const [focusStrategy, setFocusStrategy] = useState<any>('deep-focus');
  const [primaryComposition, setPrimaryComposition] = useState<any>('asymmetric-balance');
  const [secondaryComposition, setSecondaryComposition] = useState<any>('');

  const [lightingSource, setLightingSource] = useState<any>('overcast-daylight');
  const [lightingQuality, setLightingQuality] = useState<any>('soft-wrap');
  const [colorPalette, setColorPalette] = useState<any>('neutral-archive');

  const [captureMedium, setCaptureMedium] = useState<any>('digital-medium-format');
  const [filmTreatment, setFilmTreatment] = useState<any>('none');
  const [selectedMaterialities, setSelectedMaterialities] = useState<Materiality[]>(['dry-stone', 'aged-paper']);
  const [imperfectionLevel, setImperfectionLevel] = useState<any>('restrained');

  const [selectedNegatives, setSelectedNegatives] = useState<NegativeConstraint[]>([
    'no-plastic-skin',
    'no-orange-teal',
    'no-generic-dark-academia',
  ]);

  // Secciones desplegables del laboratorio manual
  const [openSection, setOpenSection] = useState<string>('panelA');

  // Toggle de un lock
  const toggleLock = (lockKey: keyof DirectionLocks) => {
    setLocks(prev => ({ ...prev, [lockKey]: !prev[lockKey] }));
  };

  // Manejador de selección de condiciones de escena
  const handleToggleSceneCondition = (cond: SceneCondition) => {
    setSceneConditions(prev => {
      if (prev.includes(cond)) {
        return prev.length === 1 ? ['still'] : prev.filter(c => c !== cond);
      }
      if (prev.length >= 2) {
        return [prev[1], cond];
      }
      return [...prev.filter(c => c !== 'still'), cond];
    });
  };

  // Manejador de selección de materialidades (máx 4)
  const handleToggleMateriality = (mat: Materiality) => {
    setSelectedMaterialities(prev => {
      if (prev.includes(mat)) {
        return prev.filter(m => m !== mat);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), mat];
      }
      return [...prev, mat];
    });
  };

  // Manejador de selección de negativas
  const handleToggleNegative = (neg: NegativeConstraint) => {
    setSelectedNegatives(prev =>
      prev.includes(neg) ? prev.filter(n => n !== neg) : [...prev, neg]
    );
  };

  // ==============================================================
  // LLAMADA AL ENDPOINT /api/generar-arte (PIPELINE V2)
  // ==============================================================
  const handleMaterializarArte = async () => {
    if (!titulo) return alert('Por favor, ingresa el título o concepto del ensayo.');

    setIsLoading(true);
    setErrorMsg(null);
    setStatusMessage('Fase 1/2: Resolviendo Dirección de Arte y Redactando Prompt...');

    // Extraer slug de la URL actual en Keystatic
    const slugMatch = typeof window !== 'undefined'
      ? window.location.pathname.match(/\/item\/([^/]+)$/)
      : null;
    const slugFromUrl = slugMatch ? slugMatch[1] : null;

    try {
      let payload: any;

      if (activeTab === 'intelligent') {
        const intelligentInput: IntelligentDirectorInput = {
          title: titulo,
          concept: concepto || titulo,
          visualSensitivity,
          narrativeMode,
          historicalRigor,
          sceneConditions,
          humanPresence,
          visualRisk,
          aspectProfile,
          toggles,
        };

        payload = {
          mode: 'intelligent',
          intelligentInput,
          slug: slugFromUrl,
        };
      } else {
        const manualInput: ManualLabInput = {
          subjectSummary: titulo,
          physicalScene: concepto || titulo,
          subjectTreatment,
          environment,
          historicalAnchors: {
            categories: ['period', 'material-culture'],
            details: historicalAnchorsDetails,
          },
          humanTrace,
          shotScale,
          cameraAngle,
          cameraPosition,
          lensCharacter,
          focusStrategy,
          primaryComposition,
          secondaryComposition: secondaryComposition || undefined,
          lightingSource,
          lightingQuality,
          colorPalette,
          captureMedium,
          filmTreatment,
          materiality: selectedMaterialities,
          imperfectionLevel,
          aspectProfile,
          selectedNegativeConstraints: selectedNegatives,
          locks,
          coherenceMode,
        };

        payload = {
          mode: 'manual',
          manualInput,
          slug: slugFromUrl,
        };
      }

      setStatusMessage('Fase 2/2: Materializando Fotografía en Gemini 3.1...');

      const res = await fetch('/api/generar-arte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success && data.image) {
        setPrevisualizacionImagen(data.image);
        setPromptAplicado(data.imagePrompt || null);
        setCoverImagePath(data.coverImagePath || null);
        setResolvedDirection(data.resolvedDirection || null);
        setBriefText(data.brief || null);

        // Notificamos a Keystatic para persistencia
        onChange(data.coverImagePath || data.imagePrompt || titulo);
      } else {
        throw new Error(data.error || 'No se pudo materializar la dirección de arte.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const handleCopyPrompt = () => {
    if (promptAplicado) {
      navigator.clipboard.writeText(promptAplicado);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  return (
    <div style={{
      padding: '24px',
      background: '#090a0f',
      color: '#e2e8f0',
      borderRadius: '14px',
      border: '1px solid #1e293b',
      fontFamily: '"Inter", system-ui, sans-serif',
      marginTop: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.05em', color: '#f59e0b', textTransform: 'uppercase' }}>
            Director de Arte Visual TGP V2
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Motor Editorial e Hiperrealismo Histórico</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
          DOS FASES • GEMINI 3.1
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#0f172a', padding: '4px', borderRadius: '10px', border: '1px solid #1e293b' }}>
        <button
          type="button"
          onClick={() => setActiveTab('intelligent')}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: activeTab === 'intelligent' ? '#2563eb' : 'transparent',
            color: activeTab === 'intelligent' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          🧠 Combinador Inteligente
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: activeTab === 'manual' ? '#2563eb' : 'transparent',
            color: activeTab === 'manual' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          🔬 Laboratorio Manual (19 Módulos)
        </button>
      </div>

      {/* Inputs Comunes: Título y Concepto */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
          Título o Sujeto Principal *
        </label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej: El Naufragio de la Medusa..."
          style={{
            width: '100%',
            padding: '12px 14px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.9rem',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
          Concepto / Contexto Específico (Opcional)
        </label>
        <textarea
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          rows={2}
          placeholder="Detalles sobre atmósfera, época, material o metáfora..."
          style={{
            width: '100%',
            padding: '10px 14px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.85rem',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* ========================================================= */}
      {/* VISTA 1: COMBINADOR INTELIGENTE */}
      {/* ========================================================= */}
      {activeTab === 'intelligent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Modo Narrativo
              </label>
              <select
                value={narrativeMode}
                onChange={(e) => setNarrativeMode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              >
                {NARRATIVE_MODES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Sensibilidad Visual
              </label>
              <select
                value={visualSensitivity}
                onChange={(e) => setVisualSensitivity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              >
                {VISUAL_SENSITIVITIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Rigor Histórico
              </label>
              <select
                value={historicalRigor}
                onChange={(e) => setHistoricalRigor(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
              >
                {HISTORICAL_RIGORS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Presencia Humana
              </label>
              <select
                value={humanPresence}
                onChange={(e) => setHumanPresence(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
              >
                {HUMAN_PRESENCES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Proporción / Formato
              </label>
              <select
                value={aspectProfile}
                onChange={(e) => setAspectProfile(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
              >
                {ASPECT_PROFILES.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Chips de Condiciones de Escena */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Condiciones de Escena (Máx 2)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SCENE_CONDITIONS.filter(c => c.value !== 'auto').map(cond => {
                const isSelected = sceneConditions.includes(cond.value);
                return (
                  <button
                    key={cond.value}
                    type="button"
                    onClick={() => handleToggleSceneCondition(cond.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: isSelected ? '#3b82f6' : '#1e293b',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      border: '1px solid',
                      borderColor: isSelected ? '#60a5fa' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {cond.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: LABORATORIO MANUAL (19 MÓDULOS CON LOCKS) */}
      {/* ========================================================= */}
      {activeTab === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Barra de Coherencia */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>
              Política de Coherencia:
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['off', 'warn', 'correct'] as CoherenceMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCoherenceMode(mode)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: coherenceMode === mode ? '#2563eb' : '#1e293b',
                    color: coherenceMode === mode ? '#fff' : '#64748b',
                    border: 'none',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Acordeón Panel A: Sujeto e Historia */}
          <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
            <div
              onClick={() => setOpenSection(openSection === 'panelA' ? '' : 'panelA')}
              style={{ padding: '12px 16px', background: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>📌 Panel A: Sujeto e Historia</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleLock('lockSubject'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                {locks.lockSubject ? '🔒 Bloqueado' : '🔓 Libre'}
              </button>
            </div>
            {openSection === 'panelA' && (
              <div style={{ padding: '14px', background: '#090a0f', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Tratamiento de Sujeto</label>
                  <select value={subjectTreatment} onChange={e => setSubjectTreatment(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}>
                    {SUBJECT_TREATMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Entorno</label>
                  <select value={environment} onChange={e => setEnvironment(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}>
                    {ENVIRONMENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Acordeón Panel B: Cámara y Composición */}
          <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
            <div
              onClick={() => setOpenSection(openSection === 'panelB' ? '' : 'panelB')}
              style={{ padding: '12px 16px', background: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>📷 Panel B: Cámara y Composición</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleLock('lockCamera'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                {locks.lockCamera ? '🔒 Bloqueado' : '🔓 Libre'}
              </button>
            </div>
            {openSection === 'panelB' && (
              <div style={{ padding: '14px', background: '#090a0f', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Escala de Plano</label>
                  <select value={shotScale} onChange={e => setShotScale(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}>
                    {SHOT_SCALES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Lente</label>
                  <select value={lensCharacter} onChange={e => setLensCharacter(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}>
                    {LENS_CHARACTERS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Composición</label>
                  <select value={primaryComposition} onChange={e => setPrimaryComposition(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}>
                    {COMPOSITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Acordeón Panel C: Luz y Color */}
          <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
            <div
              onClick={() => setOpenSection(openSection === 'panelC' ? '' : 'panelC')}
              style={{ padding: '12px 16px', background: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>💡 Panel C: Luz y Color</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleLock('lockLighting'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                {locks.lockLighting ? '🔒 Bloqueado' : '🔓 Libre'}
              </button>
            </div>
            {openSection === 'panelC' && (
              <div style={{ padding: '14px', background: '#090a0f', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Fuente de Luz</label>
                  <select value={lightingSource} onChange={e => setLightingSource(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}>
                    {LIGHTING_SOURCES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Paleta de Color</label>
                  <select value={colorPalette} onChange={e => setColorPalette(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}>
                    {COLOR_PALETTES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Acordeón Panel D: Captura y Materialidad */}
          <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
            <div
              onClick={() => setOpenSection(openSection === 'panelD' ? '' : 'panelD')}
              style={{ padding: '12px 16px', background: '#0f172a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>🧱 Panel D: Captura y Materialidad</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleLock('lockMateriality'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                {locks.lockMateriality ? '🔒 Bloqueado' : '🔓 Libre'}
              </button>
            </div>
            {openSection === 'panelD' && (
              <div style={{ padding: '14px', background: '#090a0f' }}>
                <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  Materialidades Táctiles (Máximo 4)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {MATERIALITIES.map(mat => {
                    const isSelected = selectedMaterialities.includes(mat.value);
                    return (
                      <button
                        key={mat.value}
                        type="button"
                        onClick={() => handleToggleMateriality(mat.value)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '0.7rem',
                          background: isSelected ? '#059669' : '#1e293b',
                          color: isSelected ? '#fff' : '#94a3b8',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {mat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOTÓN PRINCIPAL DE GENERACIÓN */}
      <button
        type="button"
        onClick={handleMaterializarArte}
        disabled={isLoading || !titulo}
        style={{
          display: 'block',
          width: '100%',
          padding: '16px',
          marginTop: '24px',
          marginBottom: '16px',
          background: (isLoading || !titulo) ? '#334155' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
          color: (isLoading || !titulo) ? '#94a3b8' : '#ffffff',
          border: 'none',
          borderRadius: '10px',
          fontWeight: 700,
          fontSize: '0.95rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          cursor: (isLoading || !titulo) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: (isLoading || !titulo) ? 'none' : '0 4px 14px rgba(37,99,235,0.4)',
        }}
      >
        {isLoading ? (statusMessage || 'MATERIALIZANDO DIRECCIÓN DE ARTE...') : '✨ MATERIALIZAR DIRECCIÓN VISUAL (2 FASES)'}
      </button>

      {/* MENSAJE DE ERROR */}
      {errorMsg && (
        <div style={{ color: '#f87171', fontSize: '0.8rem', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '16px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* RESULTADOS / PREVIEW */}
      {previsualizacionImagen && (
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid #334155' }}>
            <img src={previsualizacionImagen} alt="Arte Materializado" style={{ width: '100%', display: 'block' }} />
          </div>

          {coverImagePath && (
            <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#34d399' }}>
              ✅ Imagen guardada y sincronizada en disco: <code>{coverImagePath}</code>
            </div>
          )}

          {/* Prompt Aplicado */}
          {promptAplicado && (
            <div style={{ padding: '14px', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                  Prompt Visual Ensamblado
                </label>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.7rem',
                    background: '#1e293b',
                    color: '#38bdf8',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {copiedPrompt ? '✓ Copiado' : '📋 Copiar Prompt'}
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: '1.5', wordBreak: 'break-word' }}>
                {promptAplicado}
              </p>
            </div>
          )}

          {/* Decisiones del Resolver */}
          {resolvedDirection && resolvedDirection.decisions.length > 0 && (
            <details style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <summary style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', cursor: 'pointer' }}>
                📋 Informe de Decisiones de Compatibilidad ({resolvedDirection.decisions.length})
              </summary>
              <ul style={{ marginTop: '10px', marginBottom: 0, paddingLeft: '20px', fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.6' }}>
                {resolvedDirection.decisions.map((dec, idx) => (
                  <li key={idx}>
                    <strong style={{ color: '#e2e8f0' }}>{dec.id}</strong>: {dec.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
