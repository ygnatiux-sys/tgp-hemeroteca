import React, { useState, useEffect, useRef } from 'react';

export function GeneradorArquetiposTGP({ value, onChange }: any) {
  const [titulo, setTitulo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [generarAmbosJuntos, setGenerarAmbosJuntos] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado local para el texto del informe, volanta, excerpt y categoría
  const [informe, setInforme] = useState(value || '');
  const [volantaIA, setVolantaIA] = useState<string>('');
  const [excerptIA, setExcerptIA] = useState<string>('');
  const [categoryIA, setCategoryIA] = useState<string>('Arquetipos Globales');
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');

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

  // Inyectar en los campos DOM de Keystatic (volanta, category, excerpt)
  const syncFieldsToKeystaticDOM = (volantaToUse?: string, categoryToUse?: string, excToUse?: string) => {
    if (typeof document === 'undefined') return;

    if (volantaToUse) {
      const volInput = document.querySelector<HTMLInputElement>('input[name="volanta"], input[id*="volanta"]');
      if (volInput) {
        volInput.value = volantaToUse;
        volInput.dispatchEvent(new Event('input', { bubbles: true }));
        volInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    if (categoryToUse) {
      const catSelect = document.querySelector<HTMLSelectElement>('select[name="category"], select[id*="category"]');
      if (catSelect) {
        catSelect.value = categoryToUse;
        catSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    if (excToUse) {
      const excTextarea = document.querySelector<HTMLTextAreaElement>('textarea[name="excerpt"], textarea');
      if (excTextarea) {
        excTextarea.value = excToUse;
        excTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        excTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
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

        {/* BOTÓN 4: SINCRONIZAR AHORA */}
        <button
          type="button"
          onClick={() => {
            if (!informe) return alert('No hay texto para sincronizar.');
            onChange(informe);
            syncFieldsToKeystaticDOM(volantaIA, categoryIA, excerptIA);
            alert('✦ Campos sincronizados correctamente con Keystatic.');
          }}
          className="py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-lg text-xs font-metadata transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>✓ Sincronizar Campos</span>
        </button>
      </div>

      {/* PREVIEW DEL ARTE GENERADO */}
      {arteResult && arteResult.imageUrl && (
        <div className="mb-5 p-4 bg-black/40 border border-amber-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-metadata uppercase tracking-wider text-amber-400 font-bold">
              ✦ Portada Materializada por IA
            </span>
            {arteResult.resolvedDirection?.nombreEstilo && (
              <span className="text-[10px] font-metadata text-white/50 px-2 py-0.5 bg-white/5 rounded">
                Estilo: {arteResult.resolvedDirection.nombreEstilo}
              </span>
            )}
          </div>
          <div className="flex gap-4 items-start">
            <img
              src={arteResult.imageUrl}
              alt="Portada IA"
              className="w-48 h-28 object-cover rounded-lg border border-white/10 shadow-lg"
            />
            <div className="text-xs text-stone-400 space-y-1.5 overflow-hidden">
              <p className="line-clamp-2 text-stone-300"><strong className="text-white/60 font-metadata">Concepto:</strong> {arteResult.brief}</p>
              <p className="line-clamp-2 text-[11px] text-white/40"><strong className="text-white/50 font-metadata">Prompt:</strong> {arteResult.imagePrompt}</p>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 mb-5 bg-red-950/60 border border-red-500/30 rounded-lg text-red-300 text-xs font-metadata">
          {errorMsg}
        </div>
      )}

      {/* FIELD DE PREVISUALIZACIÓN DE OUTPUT (LIVE OUTPUT PREVIEW) */}
      {(informe || volantaIA || excerptIA) && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-metadata uppercase tracking-wider text-amber-400 font-bold">
                Lienzo de Output & Previsualización
              </span>
              <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded text-[10px] font-metadata uppercase tracking-wider transition-all ${
                    activeTab === 'preview' ? 'bg-amber-500/30 text-amber-300 font-bold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  👁️ Previsualización Live
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('raw')}
                  className={`px-2.5 py-1 rounded text-[10px] font-metadata uppercase tracking-wider transition-all ${
                    activeTab === 'raw' ? 'bg-amber-500/30 text-amber-300 font-bold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  📝 Markdown Raw
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => syncFieldsToKeystaticDOM(volantaIA, categoryIA, excerptIA)}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded text-xs font-metadata transition-all cursor-pointer shadow-sm"
            >
              Traspasar Todo a Keystatic
            </button>
          </div>

          {volantaIA && (
            <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
              <span className="block text-[10px] font-metadata uppercase tracking-wider text-white/40 mb-1">
                Volanta Sugerida
              </span>
              <p className="font-metadata text-xs text-amber-300 font-bold">{volantaIA}</p>
            </div>
          )}

          {excerptIA && (
            <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
              <span className="block text-[10px] font-metadata uppercase tracking-wider text-white/40 mb-1">
                Excerpt / Sinopsis Sugerida (2-4 Renglones)
              </span>
              <p className="font-serif italic text-xs text-stone-300 leading-relaxed">{excerptIA}</p>
            </div>
          )}

          {/* LIENZO DE PREVISUALIZACIÓN DE OUTPUT */}
          {informe && (
            <div className="border border-white/15 rounded-xl bg-[#0e0f0e] p-5 shadow-inner">
              {activeTab === 'preview' ? (
                <div className="prose prose-invert max-w-none space-y-4 font-serif text-sm text-stone-300 leading-relaxed">
                  <div className="p-3 bg-amber-500/10 border-l-2 border-amber-500 text-amber-200 text-xs font-metadata mb-4">
                    <strong>Informe Arquetípico Generado:</strong> {informe.length} caracteres · 10 Fases Historiográficas
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-stone-300 text-xs md:text-sm leading-relaxed">
                    {informe}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-black/60 border border-white/10 rounded-lg max-h-96 overflow-y-auto font-metadata text-xs text-stone-300 leading-relaxed whitespace-pre-wrap">
                  {informe}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
