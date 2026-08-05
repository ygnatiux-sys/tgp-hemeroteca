import React, { useState, useEffect, useRef } from 'react';

export function GeneradorGeorreferenciaTGP({ value, onChange }: any) {
  const [lugar, setLugar] = useState('');
  const [generarConImagen, setGenerarConImagen] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const [informe, setInforme] = useState(value || '');
  const [volanta, setVolanta] = useState('');
  const [saberMas, setSaberMas] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [titulosSugeridos, setTitulosSugeridos] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const pendingRef = useRef<any>({});

  // Helper para obtener el slug actual de la URL
  const getSlugFromUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    const parts = window.location.pathname.split('/');
    const itemIndex = parts.indexOf('item');
    if (itemIndex !== -1 && parts[itemIndex + 1]) {
      return parts[itemIndex + 1];
    }
    return null;
  };

  const currentSlug = getSlugFromUrl() || 'nuevo_post';
  // CLAVE AISLADA POR POST (Evita que un post herede datos de otro como Yonaguni a Cueva de las Manos)
  const BACKUP_KEY = `tgp_georef_post_${currentSlug}`;

  // Helper para desenredar JSON crudo si llega dentro del campo Markdown
  const unnestMarkdownJson = (val: string) => {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (trimmed.startsWith('{') && (trimmed.includes('"informeMarkdown"') || trimmed.includes('"volantaHook"'))) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // Regex fallback
        const extract = (field: string) => {
          const match = trimmed.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"|\\s*})`));
          return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null;
        };
        return {
          informeMarkdown: extract('informeMarkdown'),
          volantaHook: extract('volantaHook'),
          excerpt: extract('excerpt'),
          saberMasDato: extract('saberMasDato')
        };
      }
    }
    return null;
  };

  useEffect(() => {
    if (value) {
      const unnested = unnestMarkdownJson(value);
      if (unnested && unnested.informeMarkdown) {
        setInforme(unnested.informeMarkdown);
        if (unnested.volantaHook) setVolanta(unnested.volantaHook);
        if (unnested.saberMasDato) setSaberMas(unnested.saberMasDato);
        if (unnested.excerpt) setExcerpt(unnested.excerpt);
        if (unnested.titulosSugeridos) setTitulosSugeridos(unnested.titulosSugeridos);
        syncFieldsToKeystaticDOM({
          volanta: unnested.volantaHook,
          saberMas: unnested.saberMasDato,
          excerpt: unnested.excerpt,
          sitio: lugar || effectiveTitle
        });
        onChange(unnested.informeMarkdown);
        setStatusFeedback('Campos separados y desanidados correctamente');
      } else if (value !== informe) {
        setInforme(value);
        setStatusFeedback('Listo para edición');
      }
    } else if (!value) {
      // Solo recuperar backup SI coincide exactamente con este post
      try {
        const saved = localStorage.getItem(BACKUP_KEY);
        if (saved && currentSlug !== 'new' && currentSlug !== 'nuevo_post') {
          const parsed = JSON.parse(saved);
          if (parsed.informe && !informe) {
            setInforme(parsed.informe);
            if (parsed.volanta) setVolanta(parsed.volanta);
            if (parsed.saberMas) setSaberMas(parsed.saberMas);
            if (parsed.excerpt) setExcerpt(parsed.excerpt);
            if (parsed.imageUrl) setImageUrl(parsed.imageUrl);
            if (parsed.titulosSugeridos) setTitulosSugeridos(parsed.titulosSugeridos);
            setStatusFeedback('Borrador restaurado para este post');
          }
        }
      } catch (e) {}
    }

    // Escuchar selección de portada desde BuscadorWikimediaTGP
    const handleCoverSelected = (e: any) => {
      const url = e.detail?.imageUrl;
      if (url) {
        setImageUrl(url);
        pendingRef.current.imageUrl = url;
        saveToLocalBackup({ imageUrl: url });
        setStatusFeedback('Portada de Wikimedia fijada');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('tgp:cover-selected', handleCoverSelected);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('tgp:cover-selected', handleCoverSelected);
      }
    };
  }, [value, currentSlug]);

  const saveToLocalBackup = (data: any) => {
    try {
      const current = JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}');
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ ...current, ...data, slug: currentSlug, updatedAt: new Date().toISOString() }));
    } catch (e) {}
  };

  const detectTitleFromDOM = (): string => {
    if (lugar.trim()) return lugar.trim();
    if (typeof document === 'undefined') return '';
    const input = document.querySelector<HTMLInputElement>('input[name="title"], input[id^="title"]');
    if (input && input.value.trim()) return input.value.trim();
    const slug = getSlugFromUrl();
    if (slug && slug !== 'new' && slug !== 'nuevo_post') return slug.replace(/-/g, ' ');
    return '';
  };

  const effectiveTitle = detectTitleFromDOM();

  const setInputElementValue = (el: HTMLInputElement | HTMLTextAreaElement | null, val: string) => {
    if (!el || !val) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const syncFieldsToKeystaticDOM = (data: { title?: string; volanta?: string; saberMas?: string; excerpt?: string; sitio?: string }) => {
    if (typeof document === 'undefined') return;

    if (data.title) {
      const titleEl = document.querySelector<HTMLInputElement>('input[name="title"], input[id^="title"]');
      setInputElementValue(titleEl, data.title);
    }
    if (data.volanta) {
      const volantaEl = document.querySelector<HTMLTextAreaElement>('textarea[name="volantaHook"], textarea[id*="volantaHook"], textarea[name*="volanta"], textarea[id*="volanta"]');
      setInputElementValue(volantaEl, data.volanta);
    }
    if (data.saberMas) {
      const saberEl = document.querySelector<HTMLTextAreaElement>('textarea[name="saberMasDato"], textarea[id*="saberMasDato"], textarea[name*="saberMas"], textarea[id*="saberMas"]');
      setInputElementValue(saberEl, data.saberMas);
    }
    if (data.excerpt) {
      const excEl = document.querySelector<HTMLTextAreaElement>('textarea[name="excerpt"], textarea[id*="excerpt"]');
      setInputElementValue(excEl, data.excerpt);
    }
    if (data.sitio) {
      const sitioEl = document.querySelector<HTMLInputElement>('input[name="sitioGeohistorico"], input[id*="sitioGeohistorico"], input[name*="sitio"], input[id*="sitio"]');
      setInputElementValue(sitioEl, data.sitio);
    }
  };

  // BOTÓN DE RESET / LIMPIEZA DE LIENZO (Evita mezclas indeseadas)
  const handleLimpiarLienzo = () => {
    if (informe && !window.confirm('¿Estás seguro de que deseas limpiar el lienzo de este post por completo? Se restablecerán todos los campos en blanco.')) {
      return;
    }
    setInforme('');
    onChange('');
    setVolanta('');
    setSaberMas('');
    setExcerpt('');
    setImageUrl(null);
    setTitulosSugeridos([]);
    setLugar('');
    pendingRef.current = {};
    try {
      localStorage.removeItem(BACKUP_KEY);
    } catch (e) {}
    setStatusFeedback('Lienzo reseteado y en blanco para nueva edición');
  };

  // Aplicar un título sugerido por Gemini
  const handleSeleccionarTituloSugerido = (titulo: string) => {
    setLugar(titulo);
    syncFieldsToKeystaticDOM({ title: titulo, sitio: titulo });
  };

  // 1. Generación de Informe Geohistórico Multidimensional (Gemini 3.1 Pro)
  const handleGenerarInforme = async () => {
    const temaToUse = effectiveTitle || lugar.trim();
    if (!temaToUse) return alert('Por favor, ingresa o auto-detecta el nombre del sitio o lugar (ej. Cueva de las Manos, Patagonia).');

    // Fallback de confirmación si ya existe texto previo
    if (informe && informe.length > 50) {
      const confirmar = window.confirm(`Este post ya tiene un informe redactado (${informe.length} caracteres). ¿Estás seguro de que deseas regenerarlo y sobreescribir el contenido con una nueva reseña de "${temaToUse}"?`);
      if (!confirmar) return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setStatusFeedback('Investigando y redactando informe geohistórico...');

    try {
      const res = await fetch('/api/generar-georreferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lugar: temaToUse })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar la georreferencia.');

      setInforme(data.informeMarkdown);
      onChange(data.informeMarkdown);
      setVolanta(data.volantaHook || '');
      setSaberMas(data.saberMasDato || '');
      setExcerpt(data.excerpt || '');
      if (Array.isArray(data.titulosSugeridos)) {
        setTitulosSugeridos(data.titulosSugeridos);
      }

      pendingRef.current.informe = data.informeMarkdown;
      pendingRef.current.volanta = data.volantaHook;
      pendingRef.current.saberMas = data.saberMasDato;
      pendingRef.current.excerpt = data.excerpt;
      pendingRef.current.titulosSugeridos = data.titulosSugeridos;

      // Inyectar automáticamente en los campos de Keystatic
      syncFieldsToKeystaticDOM({
        volanta: data.volantaHook,
        saberMas: data.saberMasDato,
        excerpt: data.excerpt,
        sitio: temaToUse
      });

      saveToLocalBackup({
        informe: data.informeMarkdown,
        volanta: data.volantaHook,
        saberMas: data.saberMasDato,
        excerpt: data.excerpt,
        titulosSugeridos: data.titulosSugeridos
      });

      setStatusFeedback('Informe generado exitosamente. Listo para guardar.');
      
      // Si el toggle de imagen está activado, generar también imagen de portada
      if (generarConImagen) {
        await handleGenerarImagenSitio(temaToUse);
      }

    } catch (err: any) {
      setErrorMsg(`Georreferencia: ${err.message}`);
      setStatusFeedback('Error en la generación');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Generación Separada/Independiente de Imagen de Portada (Nano Banana V2)
  const handleGenerarImagenSitio = async (temaArg?: string) => {
    const temaToUse = temaArg || effectiveTitle || lugar.trim() || 'Sitio Arqueológico Geohistórico';
    const slug = getSlugFromUrl();

    setIsGeneratingArt(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/generar-arte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug !== 'new' ? slug : undefined,
          mode: 'intelligent',
          intelligentInput: {
            title: temaToUse,
            concept: `Archaeological photorealistic wide shot of ${temaToUse}`
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar la imagen de portada.');

      const img = data.imageUrl || data.image;
      if (img) {
        setImageUrl(img);
        pendingRef.current.imageUrl = img;
        saveToLocalBackup({ imageUrl: img });
      }

    } catch (err: any) {
      setErrorMsg(`Imagen Sitio: ${err.message}`);
    } finally {
      setIsGeneratingArt(false);
    }
  };

  // 3. Guardado Directo a Disco en la Colección Georreferencias
  const handleConfirmarSincronizacion = async () => {
    const temaToUse = effectiveTitle || lugar.trim();
    if (!informe) return alert('No hay contenido de informe geohistórico para guardar.');

    const slugConfirmado = (getSlugFromUrl() && getSlugFromUrl() !== 'new')
      ? getSlugFromUrl()! 
      : temaToUse.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');

    try {
      const res = await fetch('/api/guardar-georreferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slugConfirmado,
          title: temaToUse,
          content: pendingRef.current.informe ?? informe,
          volantaHook: pendingRef.current.volanta ?? volanta,
          saberMasDato: pendingRef.current.saberMas ?? saberMas,
          sitioGeohistorico: temaToUse,
          excerpt: pendingRef.current.excerpt ?? excerpt,
          category: 'Arqueosemiótica',
          imageUrl: pendingRef.current.imageUrl ?? imageUrl,
          publicarConImagen: generarConImagen
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsSaved(true);
        setStatusFeedback('¡Fue publicada nueva reseña y guardada exitosamente en disco!');
        alert(`¡PUBLICACIÓN GUARDADA EXITOSAMENTE EN DISCO!\n\nArtículo: "${temaToUse}"\nRuta: src/content/georreferencias/${slugConfirmado}/`);
        setTimeout(() => setIsSaved(false), 5000);
      } else {
        alert(`Aviso: ${data.error || 'Sincronizado con Keystatic. Presiona Save arriba.'}`);
      }
    } catch (e: any) {
      alert(`Sincronizado con Keystatic. Presiona el botón "Save" de Keystatic arriba.`);
    }
  };

  return (
    <div style={{
      padding: '24px',
      background: '#0a141d',
      color: '#e0e0e0',
      borderRadius: '12px',
      border: '1px solid #1e4976',
      fontFamily: 'Inter, system-ui, sans-serif',
      marginTop: '10px'
    }}>
      {/* Encabezado y Barra de Estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#64b5f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Motor de Georreferencias Arqueosemióticas (Gemini 3.1 Pro)
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#888' }}>
            Generación Geohistórica Multidimensional: Geología + Arqueología + Etnografía + Mitos + Saber Más
          </p>
        </div>

        {/* Botones de Control de Lienzo */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleLimpiarLienzo}
            style={{
              padding: '6px 12px',
              background: '#2d1b1b',
              color: '#ff8a80',
              border: '1px solid #c62828',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Borra el borrador actual y resetea el lienzo en blanco para evitar mezclar contenido"
          >
            Limpiar Lienzo
          </button>
        </div>
      </div>

      {/* Badge de Estado del Post */}
      <div style={{
        marginBottom: '16px',
        padding: '8px 14px',
        background: informe ? '#0d2818' : '#262210',
        border: informe ? '1px solid #2e7d32' : '1px solid #f57f17',
        borderRadius: '6px',
        fontSize: '0.78rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: informe ? '#4caf50' : '#ffeb3b',
            boxShadow: informe ? '0 0 8px #4caf50' : '0 0 8px #ffeb3b'
          }} />
          <span style={{ fontWeight: 700, color: informe ? '#a5d6a7' : '#fff59d' }}>
            {informe ? `LISTO PARA EDICIÓN (${informe.length} caracteres)` : 'LIENZO LIMPIO (Listo para nueva reseña)'}
          </span>
        </div>
        {statusFeedback && (
          <span style={{ color: '#e0e0e0', fontSize: '0.75rem', fontStyle: 'italic' }}>
            {statusFeedback}
          </span>
        )}
      </div>

      {/* Input de Nombre / Lugar */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '0.75rem', color: '#90caf9', display: 'block', marginBottom: '6px', fontWeight: 700 }}>
          SITIO / LUGAR A INVESTIGAR:
        </label>
        <input
          type="text"
          value={lugar}
          onChange={(e) => setLugar(e.target.value)}
          placeholder={effectiveTitle ? `DETECTADO: "${effectiveTitle}"` : "Ej: Cueva de las manos, Patagonia"}
          style={{
            width: '100%',
            padding: '14px',
            background: '#101e2c',
            border: '1px solid #285484',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.95rem',
            outline: 'none'
          }}
        />
        {effectiveTitle && !lugar && (
          <span style={{ fontSize: '0.72rem', color: '#81c784', marginTop: '4px', display: 'block' }}>
            ✓ Auto-detectado desde Keystatic: <strong>"{effectiveTitle}"</strong>
          </span>
        )}

        {/* Títulos Sugeridos por IA */}
        {titulosSugeridos && titulosSugeridos.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <span style={{ fontSize: '0.72rem', color: '#90caf9', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              TÍTULOS SUGERIDOS POR GEMINI (Haz clic para aplicar):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {titulosSugeridos.map((ts, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSeleccionarTituloSugerido(ts)}
                  style={{
                    padding: '6px 12px',
                    background: lugar === ts ? '#1b5e20' : '#14283c',
                    color: lugar === ts ? '#e8f5e9' : '#bbdefb',
                    border: lugar === ts ? '1px solid #4caf50' : '1px solid #29b6f6',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {ts}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toggle Separado para Generar Imagen */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        background: generarConImagen ? '#102536' : '#14141e',
        border: generarConImagen ? '1px solid #1e4976' : '1px solid #333',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <input
          type="checkbox"
          id="toggleGenImagenGeoref"
          checked={generarConImagen}
          onChange={(e) => setGenerarConImagen(e.target.checked)}
          style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#1976d2' }}
        />
        <label htmlFor="toggleGenImagenGeoref" style={{ fontSize: '0.88rem', color: generarConImagen ? '#e3f2fd' : '#aaa', cursor: 'pointer', fontWeight: 600 }}>
          {generarConImagen ? 'Modo Completo: Generar Informe + Portada Fotográfica (Nano Banana V2)' : 'Modo Texto Puro: Generar únicamente Informe Geohistórico Multidimensional'}
        </label>
      </div>

      {/* Botonera de Acción */}
      <div style={{ display: 'grid', gridTemplateColumns: generarConImagen ? '2fr 1fr' : '1fr', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={handleGenerarInforme}
          disabled={isLoading || isGeneratingArt}
          style={{
            padding: '16px',
            background: (isLoading || isGeneratingArt) ? '#222' : 'linear-gradient(135deg, #0d47a1, #1976d2)',
            color: (isLoading || isGeneratingArt) ? '#666' : '#fff',
            border: '1px solid #42a5f5',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: (isLoading || isGeneratingArt) ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(25, 118, 210, 0.4)'
          }}
        >
          {isLoading ? 'INVESTIGANDO GEOLOGÍA & ETNOGRAFÍA...' : 'GENERAR INFORME GEOHISTÓRICO MULTIDIMENSIONAL'}
        </button>

        {generarConImagen && (
          <button
            type="button"
            onClick={() => handleGenerarImagenSitio()}
            disabled={isLoading || isGeneratingArt}
            style={{
              padding: '16px',
              background: isGeneratingArt ? '#222' : '#6f42c1',
              color: isGeneratingArt ? '#666' : '#fff',
              border: '1px solid #8a57e3',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: (isLoading || isGeneratingArt) ? 'not-allowed' : 'pointer'
            }}
          >
            {isGeneratingArt ? 'GENERANDO...' : 'SOLO PORTADA'}
          </button>
        )}
      </div>

      {errorMsg && (
        <div style={{ color: '#ff5252', padding: '12px', background: 'rgba(255,82,82,0.1)', borderRadius: '6px', border: '1px solid #ff5252', marginBottom: '18px', fontSize: '0.8rem' }}>
          <strong>Aviso:</strong> {errorMsg}
        </div>
      )}

      {/* ÁREA DE TEXTO DEL INFORME */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '0.75rem', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: 700 }}>
          INFORME GEOHISTÓRICO (MARKDOWN):
        </label>
        <textarea
          value={informe}
          onChange={(e) => {
            const val = e.target.value;
            setInforme(val);
            onChange(val);
          }}
          placeholder="El informe de georreferencia generado por Gemini 3.1 Pro aparecerá aquí..."
          style={{
            width: '100%',
            height: '320px',
            background: '#0a0d12',
            color: '#eee',
            border: '1px solid #1e3a5f',
            padding: '16px',
            fontFamily: 'Georgia, serif',
            fontSize: '0.95rem',
            lineHeight: '1.6',
            borderRadius: '6px',
            resize: 'vertical'
          }}
        />
      </div>

      {/* PREVIEW DE PORTADA SI EXISTE */}
      {imageUrl && (
        <div style={{ marginBottom: '24px', textAlign: 'center', background: '#081018', padding: '16px', borderRadius: '8px', border: '1px solid #19436d' }}>
          <span style={{ fontSize: '0.75rem', color: '#90caf9', fontWeight: 700, display: 'block', marginBottom: '10px' }}>
            PORTADA FOTOGRÁFICA GENERADA
          </span>
          <img src={imageUrl} alt="Portada Sitio" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '6px', border: '1px solid #333' }} />
        </div>
      )}

      {/* BOTÓN CONFIRMAR EN DISCO */}
      <button
        type="button"
        onClick={handleConfirmarSincronizacion}
        disabled={!informe || informe.length < 10}
        style={{
          width: '100%',
          padding: '18px',
          background: (!informe || informe.length < 10) 
            ? '#1f2937' 
            : isSaved 
              ? 'linear-gradient(135deg, #1b5e20, #2e7d32)' 
              : 'linear-gradient(135deg, #0d47a1, #1565c0)',
          color: (!informe || informe.length < 10) ? '#666' : '#fff',
          border: '1px solid #42a5f5',
          borderRadius: '8px',
          fontWeight: 800,
          fontSize: '0.95rem',
          letterSpacing: '0.08em',
          cursor: (!informe || informe.length < 10) ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 14px rgba(21, 101, 192, 0.4)'
        }}
      >
        {isSaved ? '¡PUBLICACIÓN GUARDADA EXITOSAMENTE EN DISCO!' : 'CONFIRMAR & GUARDAR GEORREFERENCIA EN DISCO'}
      </button>
    </div>
  );
}
