import React, { useState, useEffect, useRef } from 'react';

export function GeneradorArquetiposTGP({ value, onChange }: any) {
  const [titulo, setTitulo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado local para el texto del informe, volanta, excerpt y categoría
  const [informe, setInforme] = useState(value || '');
  const [volantaIA, setVolantaIA] = useState<string>('');
  const [excerptIA, setExcerptIA] = useState<string>('');
  const [categoryIA, setCategoryIA] = useState<string>('Arquetipos Globales');
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');

  // Ref acumulador
  const pendingRef = useRef<{ content?: string; volanta?: string; excerpt?: string; category?: string }>({});

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

  const handleGenerarArquetipo = async () => {
    const arquetipoTema = detectPostTitle() || titulo.trim();
    if (!arquetipoTema) {
      alert('Por favor, ingresa o auto-detecta un título de arquetipo arriba.');
      return;
    }

    if (informe && informe.length > 50) {
      if (!window.confirm(`Este arquetipo ya posee un informe de ${informe.length} caracteres. ¿Estás seguro de regenerarlo?`)) {
        return;
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

      pendingRef.current = {
        content: data.content,
        volanta: data.volanta,
        excerpt: data.excerpt,
        category: data.category
      };

      syncFieldsToKeystaticDOM(data.volanta, data.category, data.excerpt);

      saveToLocalBackup({
        informe: data.content,
        volantaIA: data.volanta,
        excerptIA: data.excerpt,
        categoryIA: data.category
      });

    } catch (err: any) {
      setErrorMsg(`Motor Arquetipos: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 bg-theme-dark border border-amber-500/30 rounded-2xl font-sans text-stone-200 shadow-2xl my-6">
      {/* CABECERA DEL MOTOR */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center text-amber-400 font-mono text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            🔮
          </div>
          <div>
            <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
              Motor de Arquetipos Globales TGP
            </h3>
            <p className="text-[11px] text-white/40 font-mono">
              Generación de informe de 10 fases (Gemini 3.1 Pro · 3 Niveles Históricos · Sin visuales)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLimpiarLienzo}
          className="px-3 py-1 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-300 rounded border border-white/10 text-xs font-mono transition-all cursor-pointer"
        >
          Limpiar Lienzo
        </button>
      </div>

      {/* INPUT DE TÍTULO / SUJETO ARQUETÍPICO */}
      <div className="mb-5">
        <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-2">
          Título o Sujeto del Arquetipo
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: El Laberinto, El Náufrago, El Axis Mundi, El Guardián del Umbral..."
            className="grow px-4 py-2.5 bg-black/40 border border-white/15 rounded-lg text-sm font-sans text-white focus:outline-none focus:border-amber-500/60 placeholder:text-white/20"
          />
          <button
            type="button"
            onClick={() => {
              const detected = detectPostTitle();
              if (detected) setTitulo(detected);
              else alert('No se detectó un título en el formulario de arriba.');
            }}
            className="px-3 py-2.5 bg-white/10 hover:bg-white/15 text-stone-300 rounded-lg font-mono text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
          >
            Detectar Título
          </button>
        </div>
      </div>

      {/* BOTÓN DE GENERACIÓN UNIFICADA */}
      <div className="mb-6">
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerarArquetipo}
          className={`w-full py-4 px-6 rounded-xl font-mono text-xs uppercase tracking-[0.2em] font-bold transition-all shadow-xl flex items-center justify-center gap-3 cursor-pointer ${
            isGenerating
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
              : 'bg-linear-to-r from-amber-900 via-amber-800 to-amber-600 hover:from-amber-800 hover:to-amber-500 text-white border border-amber-400/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-4.5 h-4.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Ejecutando Análisis Histórico & Arquetípico (Gemini 3.1 Pro)...</span>
            </>
          ) : (
            <>
              <span>✨ Generar Informe de Arquetipo Global (10 Fases)</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 mb-5 bg-red-950/60 border border-red-500/30 rounded-lg text-red-300 text-xs font-mono">
          {errorMsg}
        </div>
      )}

      {/* FIELD DE PREVISUALIZACIÓN DE OUTPUT (LIVE OUTPUT PREVIEW) */}
      {(informe || volantaIA || excerptIA) && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                Lienzo de Output & Previsualización
              </span>
              <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all ${
                    activeTab === 'preview' ? 'bg-amber-500/30 text-amber-300 font-bold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  👁️ Previsualización Live
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('raw')}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all ${
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
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded text-xs font-mono transition-all cursor-pointer shadow-sm"
            >
              Traspasar Todo a Keystatic
            </button>
          </div>

          {volantaIA && (
            <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">
                Volanta Sugerida
              </span>
              <p className="font-mono text-xs text-amber-300 font-bold">{volantaIA}</p>
            </div>
          )}

          {excerptIA && (
            <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">
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
                  <div className="p-3 bg-amber-500/10 border-l-2 border-amber-500 text-amber-200 text-xs font-mono mb-4">
                    <strong>Informe Arquetípico Generado:</strong> {informe.length} caracteres · 10 Fases Historiográficas
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-stone-300 text-xs md:text-sm leading-relaxed">
                    {informe}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-black/60 border border-white/10 rounded-lg max-h-96 overflow-y-auto font-mono text-xs text-stone-300 leading-relaxed whitespace-pre-wrap">
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
