import React, { useState, useEffect, useRef } from 'react';

// ─── Helper: Setter nativo de React 18 ─────────────────────────────────────
// Keystatic usa inputs controlados por React. El simple `element.value = x`
// no dispara el estado interno de React. Este helper usa el setter nativo
// del prototipo para forzar que React detecte el cambio.
function setNativeValue(element: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(element);
  const descriptor =
    Object.getOwnPropertyDescriptor(proto, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    // Fallback: asignacion directa si no se encontro el descriptor
    (element as any).value = value;
  }

  // Disparar todos los eventos que React 18 necesita para detectar el cambio
  element.dispatchEvent(new Event('input',  { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

export function GeneradorArquetiposTGP({ value, onChange }: any) {
  const [titulo, setTitulo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [generarAmbosJuntos, setGenerarAmbosJuntos] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado local para el texto del informe, volanta, excerpt y categoría
  const [informe, setInforme] = useState(value || '');
  const [volantaIA, setVolantaIA] = useState<string>('');
  const [excerptIA, setExcerptIA] = useState<string>('');
  const [categoryIA, setCategoryIA] = useState<string>('Arquetipos Globales');
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');

  // ── Toggles para campos opcionales (default OFF → no sobrecargar el front-end) ──
  const [syncVolanta,   setSyncVolanta]   = useState(false);
  const [syncExcerpt,  setSyncExcerpt]   = useState(false);
  const [syncCategory, setSyncCategory]  = useState(false);

  const [arteResult, setArteResult] = useState<{
    imageUrl: string | null;
    imagePrompt: string;
    brief: string;
    resolvedDirection?: any;
  } | null>(null);

  // Ref acumulador
  const pendingRef = useRef<{ content?: string; volanta?: string; excerpt?: string; category?: string; imageUrl?: string }>({});

  const getSlugFromUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    const parts = window.location.pathname.split('/');
    const itemIndex = parts.indexOf('item');
    if (itemIndex !== -1 && parts[itemIndex + 1]) {
      return parts[itemIndex + 1];
    }
    return null;
  };

  const currentSlug = getSlugFromUrl() || 'nuevo_arquetipo';
  const BACKUP_KEY = `tgp_arquetipo_${currentSlug}`;

  useEffect(() => {
    if (value && value !== informe) {
      setInforme(value);
    } else if (!value) {
      try {
        const savedBackup = localStorage.getItem(BACKUP_KEY);
        if (savedBackup && currentSlug !== 'new' && currentSlug !== 'nuevo_arquetipo') {
          const parsed = JSON.parse(savedBackup);
          if (parsed.informe && !informe) {
            setInforme(parsed.informe);
            if (parsed.volantaIA) setVolantaIA(parsed.volantaIA);
            if (parsed.excerptIA) setExcerptIA(parsed.excerptIA);
            if (parsed.categoryIA) setCategoryIA(parsed.categoryIA);
            if (parsed.arteResult) setArteResult(parsed.arteResult);
          }
        }
      } catch (e) {}
    }
  }, [value, currentSlug]);

  const saveToLocalBackup = (dataToSave: any) => {
    try {
      const currentBackup = JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}');
      const updated = {
        ...currentBackup,
        ...dataToSave,
        slug: currentSlug,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleLimpiarLienzo = () => {
    if (informe && !window.confirm('¿Deseas limpiar el lienzo de este informe de arquetipo?')) return;
    setInforme('');
    onChange('');
    setVolantaIA('');
    setExcerptIA('');
    setCategoryIA('Arquetipos Globales');
    setArteResult(null);
    setTitulo('');
    pendingRef.current = {};
    try { localStorage.removeItem(BACKUP_KEY); } catch (e) {}
  };

  const detectPostTitle = (): string => {
    if (titulo.trim()) return titulo.trim();
    const titleInput = document.querySelector<HTMLInputElement>('input[name="title"], input[id^="title"]');
    if (titleInput && titleInput.value.trim()) return titleInput.value.trim();
    return '';
  };

  // ─── Inyectar en los campos DOM de Keystatic ─────────────────────────────────
  // SIEMPRE: titulo (obligatorio para la validacion del slug)
  // CONDICIONAL segun toggles: volanta, category, excerpt
  // NUNCA: spotifyLink, youtubeLink (evitar URLs invalidas que rompan hrefs)
  const syncFieldsToKeystaticDOM = (volantaToUse?: string, categoryToUse?: string, excToUse?: string) => {
    if (typeof document === 'undefined') return;

    // ── OBLIGATORIO: Titulo / Slug ──────────────────────────────────────────────
    // Usamos setNativeValue para que React 18 detecte el cambio en el campo slug
    const titleInStr = titulo.trim() || volantaIA || 'Arquetipo';
    const titleInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name="title"], input[id*="title"], input[placeholder*="titulo"], input[placeholder*="tit"]'
    );
    titleInputs.forEach(el => setNativeValue(el, titleInStr));

    // ── OBLIGATORIO: Fecha Actualizada ──────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name="date"], input[type="date"], input[id*="date"]'
    );
    dateInputs.forEach(el => setNativeValue(el, todayStr));

    // ── CONDICIONAL: Volanta ────────────────────────────────────────────────────
    if (syncVolanta && volantaToUse) {
      const volInputs = document.querySelectorAll<HTMLInputElement>(
        'input[name="volanta"], input[id*="volanta"]'
      );
      volInputs.forEach(el => setNativeValue(el, volantaToUse));
    }

    // ── CONDICIONAL: Categoría ──────────────────────────────────────────────────
    if (syncCategory && categoryToUse) {
      // Keystatic usa un custom field para categoría (SelectorCategoriaTGP), no un <select> nativo
      // Intentamos select nativo como fallback
      const catSelects = document.querySelectorAll<HTMLSelectElement>(
        'select[name="category"], select[id*="category"]'
      );
      catSelects.forEach(el => {
        setNativeValue(el, categoryToUse);
      });
    }

    // ── CONDICIONAL: Excerpt ────────────────────────────────────────────────────
    if (syncExcerpt && excToUse) {
      const excTextareas = document.querySelectorAll<HTMLTextAreaElement>(
        'textarea[name="excerpt"], textarea[id*="excerpt"]'
      );
      excTextareas.forEach(el => setNativeValue(el, excToUse));
    }

    // ── NUNCA inyectar spotifyLink / youtubeLink ────────────────────────────────
    // Dejar vacíos para que los componentes de Astro los oculten condicionalmente.
  };

  // 1. Generación de Texto / Informe Arquetípico
  const handleGenerarTexto = async (): Promise<string | null> => {
    const arquetipoTema = detectPostTitle() || titulo.trim();
    if (!arquetipoTema) {
      alert('Por favor, ingresa o auto-detecta un título de arquetipo arriba.');
      return null;
    }

    if (informe && informe.length > 50) {
      if (!window.confirm(`Este arquetipo ya posee un informe de ${informe.length} caracteres. ¿Estás seguro de regenerarlo?`)) {
        return null;
      }
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/generar-arquetipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: arquetipoTema })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el motor de arquetipos');

      setInforme(data.content);
      onChange(data.content);

      if (data.volanta) setVolantaIA(data.volanta);
      if (data.excerpt) setExcerptIA(data.excerpt);
      if (data.category) setCategoryIA(data.category);

      pendingRef.current.content = data.content;
      pendingRef.current.volanta = data.volanta;
      pendingRef.current.excerpt = data.excerpt;
      pendingRef.current.category = data.category;

      syncFieldsToKeystaticDOM(data.volanta, data.category, data.excerpt);

      saveToLocalBackup({
        informe: data.content,
        volantaIA: data.volanta,
        excerptIA: data.excerpt,
        categoryIA: data.category
      });

      return data.content;
    } catch (err: any) {
      setErrorMsg(`Motor Arquetipos: ${err.message}`);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Generación de Arte de Portada con Nano Banana V2 / Imagen 3
  const handleGenerarArte = async (): Promise<string | null> => {
    const temaFinal = detectPostTitle() || titulo.trim() || 'Arquetipo Universal';
    const slug = getSlugFromUrl();

    setIsGeneratingArt(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/generar-arte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug,
          mode: 'intelligent',
          intelligentInput: {
            title: temaFinal,
            concept: `Arquetipo mitológico e histórico: ${temaFinal}`
          }
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el motor de arte');

      const imageUrl = data.imageUrl || data.image;
      const artData = {
        imageUrl,
        imagePrompt: data.imagePrompt,
        brief: data.brief,
        resolvedDirection: data.resolvedDirection
      };

      setArteResult(artData);

      if (imageUrl) {
        pendingRef.current.imageUrl = imageUrl;
        saveToLocalBackup({ arteResult: artData });
      }

      return imageUrl || null;
    } catch (err: any) {
      setErrorMsg(`Arte: ${err.message}`);
      return null;
    } finally {
      setIsGeneratingArt(false);
    }
  };

  // 3. Ejecución Unificada Conjunta (Redacción + Imagen)
  const handleGenerarAmbos = async () => {
    const arquetipoTema = detectPostTitle() || titulo.trim();
    if (!arquetipoTema) {
      alert('Por favor, ingresa o auto-detecta un título de arquetipo arriba.');
      return;
    }

    if (generarAmbosJuntos) {
      await handleGenerarTexto();
      await handleGenerarArte();
    } else {
      await handleGenerarTexto();
    }
  };

  return (
    <div className="p-6 bg-theme-dark border border-amber-500/30 rounded-2xl font-sans text-stone-200 shadow-2xl my-6">
      {/* CABECERA DEL MOTOR */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center text-amber-400 font-metadata text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            🔮
          </div>
          <div>
            <h3 className="text-sm font-metadata uppercase tracking-[0.2em] text-amber-400 font-bold">
              Motor de Arquetipos Globales & Arte Unificado TGP
            </h3>
            <p className="text-[11px] text-white/40 font-metadata">
              Gemini 3.1 Pro (10 Fases Históricas) + Nano Banana / Imagen 3 (Portada)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLimpiarLienzo}
          className="px-3 py-1 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-300 rounded border border-white/10 text-xs font-metadata transition-all cursor-pointer"
        >
          Limpiar Lienzo
        </button>
      </div>

      {/* INPUT DE TÍTULO / SUJETO ARQUETÍPICO */}
      <div className="mb-5">
        <label className="block text-xs font-metadata uppercase tracking-wider text-stone-400 mb-2">
          Título o Sujeto del Arquetipo
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Mercurio, El Laberinto, Jung y los Arquetipos, Los Annunaki..."
            className="grow px-4 py-2.5 bg-black/40 border border-white/15 rounded-lg text-sm font-sans text-white focus:outline-none focus:border-amber-500/60 placeholder:text-white/20"
          />
          <button
            type="button"
            onClick={() => {
              const detected = detectPostTitle();
              if (detected) setTitulo(detected);
              else alert('No se detectó un título en el formulario de arriba.');
            }}
            className="px-3 py-2.5 bg-white/10 hover:bg-white/15 text-stone-300 rounded-lg font-metadata text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
          >
            Detectar Título
          </button>
        </div>
      </div>

      {/* TOGGLE: GENERAR REDACCIÓN + IMAGEN A LA VEZ */}
      <div className="flex items-center gap-3 p-3.5 mb-5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={generarAmbosJuntos}
            onChange={(e) => setGenerarAmbosJuntos(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
        </label>
        <div className="text-xs">
          <span className="font-metadata font-bold text-amber-300">Generar Redacción + Portada IA en un solo clic</span>
          <p className="text-stone-400 text-[11px]">Genera el informe erudito de 10 fases y materializa la portada cinemática simultáneamente.</p>
        </div>
      </div>

      {/* BOTONES DE ACCIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {/* BOTÓN 1: PRINCIPAL CONJUNTO */}
        <button
          type="button"
          disabled={isGenerating || isGeneratingArt}
          onClick={handleGenerarAmbos}
          className={`md:col-span-3 py-4 px-6 rounded-xl font-metadata text-xs uppercase tracking-[0.2em] font-bold transition-all shadow-xl flex items-center justify-center gap-3 cursor-pointer ${
            isGenerating || isGeneratingArt
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
              : 'bg-linear-to-r from-amber-900 via-amber-800 to-amber-600 hover:from-amber-800 hover:to-amber-500 text-white border border-amber-400/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
          }`}
        >
          {isGenerating || isGeneratingArt ? (
            <>
              <div className="w-4.5 h-4.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>{isGenerating ? 'Generando Informe Erudito...' : 'Materializando Portada IA...'}</span>
            </>
          ) : (
            <>
              <span>✦ 1. Generar Redacción + Portada Unificada (Proceso Completo)</span>
            </>
          )}
        </button>

        {/* BOTÓN 2: SOLO TEXTO */}
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerarTexto}
          className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 rounded-lg text-xs font-metadata transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>📜 2. Solo Redacción (Texto)</span>
        </button>

        {/* BOTÓN 3: SOLO PORTADA IA */}
        <button
          type="button"
          disabled={isGeneratingArt}
          onClick={handleGenerarArte}
          className="py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg text-xs font-metadata transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>🎨 3. Solo Portada IA (Nano Banana)</span>
        </button>

        {/* BOTÓN 4: TRASPASAR TODO (con toggles para campos opcionales) */}
        <button
          type="button"
          onClick={() => {
            if (!informe) return alert('No hay texto para sincronizar.');
            onChange(informe);
            syncFieldsToKeystaticDOM(volantaIA, categoryIA, excerptIA);
            alert('✦ Campos sincronizados con Keystatic. El título siempre se inyecta; los opcionales solo si sus toggles están activos.');
          }}
          className="py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-lg text-xs font-metadata transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>✓ Traspasar Todo a Keystatic</span>
        </button>
      </div>

      {/* PANEL DE TOGGLES: Campos Opcionales — qué se inyecta en Keystatic */}
      {(volantaIA || excerptIA || categoryIA) && (
        <div className="mb-5 p-4 bg-black/30 border border-white/10 rounded-xl">
          <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-stone-400 mb-3">
            ❖ Campos Opcionales a Inyectar en Keystatic
          </span>
          <p className="text-[10px] text-stone-500 mb-3 font-mono">
            Activa solo los campos que quieras traspasar. Los desactivados quedan vacíos en Keystatic para no sobrecargar la vista del post.
          </p>
          <div className="flex flex-col gap-2">
            {/* Toggle: Volanta */}
            {volantaIA && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={syncVolanta}
                  onChange={e => setSyncVolanta(e.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <span className="text-xs font-mono text-amber-300 font-bold">Volanta</span>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-mono">"{volantaIA}"</p>
                </div>
              </label>
            )}
            {/* Toggle: Excerpt */}
            {excerptIA && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={syncExcerpt}
                  onChange={e => setSyncExcerpt(e.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <span className="text-xs font-mono text-amber-300 font-bold">Excerpt / Sínopsis</span>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-mono line-clamp-2 italic">"{excerptIA}"</p>
                </div>
              </label>
            )}
            {/* Toggle: Categoría */}
            {categoryIA && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={syncCategory}
                  onChange={e => setSyncCategory(e.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <span className="text-xs font-mono text-amber-300 font-bold">Categoría</span>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-mono">"{categoryIA}"</p>
                </div>
              </label>
            )}
          </div>
          <p className="text-[10px] text-stone-600 mt-3 font-mono">
            ⚠️ Los campos YouTube / Spotify se dejan siempre vacíos (URLs manuales en Keystatic).
          </p>
        </div>
      )}

      {/* PREVIEW DEL ARTE GENERADO */}
      {arteResult && arteResult.imageUrl && (
        <div 
          className="mb-5 p-4 rounded-xl border"
          style={{
            backgroundColor: '#0c100e',
            borderColor: 'rgba(245, 158, 11, 0.25)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-2">
              <span>✦</span> Portada Materializada por IA
            </span>
            {arteResult.resolvedDirection?.nombreEstilo && (
              <span className="text-[10px] font-mono text-stone-400 px-2 py-0.5 bg-white/5 rounded border border-white/10">
                Estilo: {arteResult.resolvedDirection.nombreEstilo}
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <img
              src={arteResult.imageUrl}
              alt="Portada IA"
              className="w-full sm:w-52 h-32 object-cover rounded-lg border border-white/10 shadow-lg"
              style={{ maxHeight: '140px' }}
            />
            <div className="text-xs text-stone-300 space-y-2 overflow-hidden flex-1">
              <p className="line-clamp-2 text-stone-200">
                <strong className="text-amber-400/80 font-mono uppercase text-[11px] block">Concepto Curatorial:</strong> 
                {arteResult.brief}
              </p>
              <p className="line-clamp-2 text-[11px] text-stone-400 font-mono bg-black/40 p-2 rounded border border-white/5">
                <strong className="text-stone-500 uppercase text-[10px] block">Prompt de Imagen:</strong> 
                {arteResult.imagePrompt}
              </p>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div 
          className="p-3.5 mb-5 rounded-lg text-red-300 text-xs font-mono border"
          style={{ backgroundColor: '#200808', borderColor: '#ef4444' }}
        >
          <strong>⚠️ Error:</strong> {errorMsg}
        </div>
      )}

      {/* CAJA DE PREVISUALIZACIÓN Y AUDITORÍA DEL TEXTO GENERADO (LIVE PREVIEW & AUDIT BOX) */}
      {informe && (
        <div 
          className="mb-5 p-5 rounded-xl border transition-all"
          style={{
            backgroundColor: '#0a0e0d',
            borderColor: 'rgba(245, 158, 11, 0.35)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Header de la caja de auditoría */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                <span>📜</span> Previsualización del Ensayo Erudito
              </span>
              <span 
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}
              >
                {informe.length.toLocaleString()} caracteres · {informe.trim().split(/\s+/).filter(Boolean).length} palabras
              </span>
            </div>

            {/* Pestañas de modo de visualización */}
            <div className="flex items-center gap-2">
              <div className="flex bg-black/50 p-0.5 rounded-lg border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'preview' 
                      ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40' 
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  👁️ Lectura
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('raw')}
                  className={`px-3 py-1 rounded text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'raw' 
                      ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40' 
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  ✏️ Editor / Raw
                </button>
              </div>

              {/* Botón copiar al portapapeles */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(informe);
                  alert('✓ Ensayo copiado al portapapeles.');
                }}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/15 text-stone-300 rounded border border-white/10 text-[11px] font-mono transition-all cursor-pointer"
                title="Copiar texto completo"
              >
                📋 Copiar
              </button>
            </div>
          </div>

          {/* Sugerencias de Volanta y Excerpt si existen */}
          {(volantaIA || excerptIA) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {volantaIA && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-amber-400/70 mb-1">
                    Volanta Sugerida
                  </span>
                  <p className="font-mono text-xs text-amber-300 font-bold">{volantaIA}</p>
                </div>
              )}
              {excerptIA && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-amber-400/70 mb-1">
                    Excerpt / Sinopsis Sugerida
                  </span>
                  <p className="font-serif italic text-xs text-stone-300 leading-relaxed">{excerptIA}</p>
                </div>
              )}
            </div>
          )}

          {/* Contenedor de Scroll / Auditoría Visual */}
          {activeTab === 'preview' ? (
            <div 
              className="p-5 rounded-lg border overflow-y-auto"
              style={{
                backgroundColor: '#060807',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                maxHeight: '440px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(245, 158, 11, 0.4) transparent'
              }}
            >
              <div 
                className="font-serif text-stone-200 text-sm leading-relaxed whitespace-pre-wrap selection:bg-amber-500/30"
                style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif', lineHeight: '1.8' }}
              >
                {informe}
              </div>
            </div>
          ) : (
            <div className="relative">
              <textarea
                value={informe}
                onChange={(e) => {
                  const val = e.target.value;
                  setInforme(val);
                  onChange(val); // Persistencia reactiva a Keystatic
                  pendingRef.current.content = val;
                  saveToLocalBackup({ informe: val });
                }}
                className="w-full p-4 rounded-lg font-mono text-xs text-stone-200 border focus:outline-none transition-all"
                style={{
                  backgroundColor: '#060807',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  height: '400px',
                  resize: 'vertical',
                  lineHeight: '1.6'
                }}
                placeholder="El texto del ensayo aparecerá aquí..."
              />
              <span className="absolute bottom-3 right-3 text-[10px] font-mono text-stone-500 bg-black/70 px-2 py-0.5 rounded border border-white/5">
                Edición en vivo habilitada
              </span>
            </div>
          )}

          {/* Barra inferior de estado y sincronización */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10 text-xs">
            <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
              <span>✓</span> Texto sincronizado con Keystatic (listo para guardar)
            </span>

            <div className="flex gap-2">
              {/* Copiar Cuerpo: para pegar manualmente en el editor Markdoc nativo */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(informe);
                  alert('✓ Cuerpo del arquetipo copiado. Pegá (Ctrl+V) directamente en el editor Markdoc de Keystatic para que se guarde en content.mdoc.');
                }}
                className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer font-bold"
              >
                ⌘ Copiar Cuerpo al Portapapeles
              </button>

              <button
                type="button"
                onClick={() => {
                  onChange(informe);
                  syncFieldsToKeystaticDOM(volantaIA, categoryIA, excerptIA);
                  alert('✦ Re-sincronizado con el formulario de Keystatic.');
                }}
                className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer font-bold shadow-sm"
              >
                Re-Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ BOTÓN CONFIRMAR Y GUARDAR EN LA HEMEROTECA ══════════════════════════ */}
      {informe && (
        <div
          className="mt-6 p-5 rounded-xl border"
          style={{
            background: 'linear-gradient(135deg, #0a1a0a, #0f2a0f)',
            borderColor: 'rgba(74, 222, 128, 0.25)',
          }}
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-500 mb-1">
            Paso Final de Vinculación
          </p>
          <p className="text-[11px] text-stone-400 mb-4 font-mono leading-relaxed">
            Guarda el informe, los metadatos y la portada directamente en el sistema de archivos de la hemeroteca.
            <br />
            <span className="text-stone-600">(Solo opera en modo local. En producción, usá el botón Save de Keystatic.)</span>
          </p>

          <button
            type="button"
            disabled={isSaving || !informe || informe.length < 10}
            onClick={async () => {
              const slugToUse = getSlugFromUrl();
              if (!slugToUse || slugToUse === 'new' || slugToUse === 'nuevo_arquetipo') {
                alert('✦ POST NUEVO DETECTADO\n\nPrimero escribí el Título arriba y presioná el botón "Save" / "Create" de Keystatic para crear la entrada. Luego podrás usar este botón para actualizaciones.');
                return;
              }

              setIsSaving(true);
              setIsSaved(false);

              // Sincronizar con el formulario de Keystatic primero
              onChange(informe);
              syncFieldsToKeystaticDOM(volantaIA, categoryIA, excerptIA);

              try {
                const res = await fetch('/api/guardar-arquetipo', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    slug: slugToUse,
                    title: titulo.trim() || volantaIA || slugToUse.replace(/-/g, ' '),
                    content: informe,
                    excerpt:  syncExcerpt  ? excerptIA  : undefined,
                    volanta:  syncVolanta  ? volantaIA  : undefined,
                    category: syncCategory ? categoryIA : 'Arquetipos Globales',
                    imageUrl: arteResult?.imageUrl ?? undefined,
                    // spotifyLink / youtubeLink NO se envían (URLs manuales en Keystatic)
                  }),
                });
                const data = await res.json();
                if (data.success) {
                  setIsSaved(true);
                  alert(`✦ ARQUETIPO GUARDADO EN LA HEMEROTECA\n\n• Metadatos: ${data.indexPath}\n• Contenido: ${data.mdocPath}\n• Caracteres escritos: ${data.charactersWritten}`);
                  setTimeout(() => setIsSaved(false), 5000);
                } else {
                  alert(`Error guardando: ${data.error}`);
                }
              } catch (err: any) {
                alert(`Error de conexión: ${err.message}`);
              } finally {
                setIsSaving(false);
              }
            }}
            className={`w-full py-4 px-6 rounded-xl font-metadata text-xs uppercase tracking-[0.2em] font-bold transition-all flex items-center justify-center gap-3 ${
              isSaving
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse cursor-wait'
                : isSaved
                  ? 'bg-emerald-600/40 text-white border border-emerald-400/60 shadow-[0_0_20px_rgba(74,222,128,0.3)] cursor-default'
                  : (!informe || informe.length < 10)
                    ? 'bg-white/5 text-stone-600 border border-white/10 cursor-not-allowed'
                    : 'bg-linear-to-r from-emerald-900 via-emerald-800 to-emerald-600 hover:from-emerald-800 hover:to-emerald-500 text-white border border-emerald-400/40 hover:shadow-[0_0_20px_rgba(74,222,128,0.3)] cursor-pointer'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>Guardando en Hemeroteca...</span>
              </>
            ) : isSaved ? (
              <span>✦ Arquetipo Guardado Exitosamente en Hemeroteca</span>
            ) : (
              <span>✦ Confirmar y Guardar en la Hemeroteca</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
