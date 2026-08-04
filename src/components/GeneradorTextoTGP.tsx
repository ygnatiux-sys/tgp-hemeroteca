import React, { useState, useEffect, useRef } from 'react';

export function GeneradorTextoTGP({ value, onChange }: any) {
  const [titulo, setTitulo] = useState('');
  const [generarAmbosJuntos, setGenerarAmbosJuntos] = useState(true);
  
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [isNewPost, setIsNewPost] = useState(false);

  // Estado local para el texto del ensayo, excerpt y sugerencias
  const [ensayo, setEnsayo] = useState(value || '');
  const [excerptIA, setExcerptIA] = useState<string>('');
  const [categoryIA, setCategoryIA] = useState<string>('');

  const [arteResult, setArteResult] = useState<{
    imageUrl: string | null;
    imagePrompt: string;
    brief: string;
    resolvedDirection?: any;
  } | null>(null);

  // Ref acumulador para evitar race conditions al guardar
  // Almacena el dato más reciente de cada campo durante una sesión de generación
  const pendingRef = useRef<{ text?: string; excerpt?: string; category?: string; imageUrl?: string }>({});

  // Extraer el slug actual de la URL de Keystatic
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
  // Key de backup local AISLADA POR SLUG (Evita contaminación cruzada entre posts)
  const BACKUP_KEY = `tgp_essay_post_${currentSlug}`;

  // Sincronizar estado local con Keystatic si value cambia externamente y cargar backup si existe
  useEffect(() => {
    if (value && value !== ensayo) {
      setEnsayo(value);
    } else if (!value) {
      try {
        const savedBackup = localStorage.getItem(BACKUP_KEY);
        if (savedBackup && currentSlug !== 'new' && currentSlug !== 'nuevo_post') {
          const parsed = JSON.parse(savedBackup);
          if (parsed.ensayo && !ensayo) {
            setEnsayo(parsed.ensayo);
            if (parsed.excerptIA) setExcerptIA(parsed.excerptIA);
            if (parsed.categoryIA) setCategoryIA(parsed.categoryIA);
            if (parsed.arteResult) setArteResult(parsed.arteResult);
          }
        }
      } catch (e) {
        console.warn('Error leyendo backup local:', e);
      }
    }
  }, [value, currentSlug]);

  // Guardar copia de seguridad automáticamente en LocalStorage cada vez que cambie algo clave
  const saveToLocalBackup = (dataToSave: {
    ensayo?: string;
    excerptIA?: string;
    categoryIA?: string;
    arteResult?: any;
  }) => {
    try {
      const currentBackup = JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}');
      const updated = {
        ...currentBackup,
        ...dataToSave,
        slug: currentSlug,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error guardando en backup local:', e);
    }
  };

  // Limpiar lienzo para empezar de cero sin arrastrar datos viejos
  const handleLimpiarLienzo = () => {
    if (ensayo && !window.confirm('¿Estás seguro de que deseas limpiar el lienzo de este post? Se restablecerán todos los campos en blanco.')) {
      return;
    }
    setEnsayo('');
    onChange('');
    setExcerptIA('');
    setCategoryIA('');
    setArteResult(null);
    setGeorefResult(null);
    setTitulo('');
    pendingRef.current = {};
    try {
      localStorage.removeItem(BACKUP_KEY);
    } catch (e) {}
  };

  // Detectar si estamos en un post NUEVO (URL contiene /create)
  const isCreatingNewPost = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.includes('/create') || window.location.pathname.includes('/new');
  };

  // Auto-detectar el título del post desde el DOM de Keystatic si 'titulo' está vacío
  const detectPostTitle = (): string => {
    if (titulo.trim()) return titulo.trim();
    
    // 1. Buscar en el input de título de Keystatic
    const titleInput = document.querySelector<HTMLInputElement>('input[name="title"], input[id^="title"]');
    if (titleInput && titleInput.value.trim()) {
      return titleInput.value.trim();
    }
    
    // 2. Extraer del slug en la URL si está editando
    const slug = getSlugFromUrl();
    if (slug) {
      return slug.replace(/-/g, ' ');
    }

    // 3. Extraer del primer párrafo o primera línea del ensayo si existe
    if (ensayo) {
      const firstLine = ensayo.slice(0, 120).replace(/^[#\s]+/, '').split('\n')[0].trim();
      if (firstLine) return firstLine;
    }

    return '';
  };

  const effectiveTopic = detectPostTitle();

  const [publicarConImagen, setPublicarConImagen] = useState(true);
  const [sitioGeohistoricoInput, setSitioGeohistoricoInput] = useState('');

  /**
   * Guardado seguro a disco: SOLO opera si hay un slug confirmado de URL.
   * Para posts nuevos (/create), los datos se acumulan en pendingRef y
   * se guardan cuando el usuario presiona "Confirmar & Guardar" manualmente.
   */
  const handleSaveDirectlyToDisk = async (overrides?: { text?: string; excerpt?: string; category?: string; image?: string; sitio?: string; conImagen?: boolean }) => {
    const slugToUse = getSlugFromUrl();

    // GUARD: Si no hay slug (post nuevo), NO guardar a disco.
    // Keystatic maneja el save inicial. Nosotros solo actualizamos posts EXISTENTES.
    if (!slugToUse) {
      console.info('[TGP] Post nuevo detectado: omitiendo guardado a disco. Keystatic manejará el save inicial.');
      return null;
    }

    const temaToUse = effectiveTopic;
    const textToUse = overrides?.text !== undefined ? overrides.text : (pendingRef.current.text ?? ensayo);
    const excToUse = overrides?.excerpt !== undefined ? overrides.excerpt : (pendingRef.current.excerpt ?? excerptIA);
    const catToUse = overrides?.category !== undefined ? overrides.category : (pendingRef.current.category ?? categoryIA);
    const imgToUse = overrides?.image !== undefined ? overrides.image : (pendingRef.current.imageUrl ?? arteResult?.imageUrl);
    const sitioToUse = overrides?.sitio !== undefined ? overrides.sitio : (sitioGeohistoricoInput || temaToUse);
    const conImagenToUse = overrides?.conImagen !== undefined ? overrides.conImagen : publicarConImagen;

    try {
      const res = await fetch('/api/guardar-ensayo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slugToUse,
          title: temaToUse,
          content: textToUse,
          excerpt: excToUse,
          category: catToUse,
          imageUrl: imgToUse,
          sitioGeohistorico: sitioToUse,
          publicarConImagen: conImagenToUse
        })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Error guardando directamente en disco:', e);
    }
  };

  // Inyectar automáticamente la categoría y el excerpt en los campos de Keystatic
  const syncFieldsToKeystaticDOM = (suggestedCategory?: string, suggestedExcerpt?: string) => {
    const catToUse = suggestedCategory || categoryIA;
    const excToUse = suggestedExcerpt || excerptIA;

    if (catToUse) {
      const catSelect = document.querySelector<HTMLSelectElement>('select[name="category"], select');
      if (catSelect) {
        catSelect.value = catToUse;
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

  // 1. Generación de Texto con Gemini 3.1 Pro (Incluye Excerpt 2-4 renglones y Categoría IA)
  const handleGenerarTexto = async (): Promise<{ content: string; excerpt: string; category: string } | null> => {
    const temaFinal = detectPostTitle() || titulo.trim();
    if (!temaFinal) { alert('Por favor, escribe un título arriba en Keystatic o ingresa un tema aquí.'); return null; }
    
    // Fallback de confirmación si ya existe texto
    if (ensayo && ensayo.length > 50) {
      const confirmar = window.confirm(`Este post ya tiene un ensayo redactado (${ensayo.length} caracteres). ¿Estás seguro de que deseas regenerarlo y sobreescribir el contenido?`);
      if (!confirmar) return null;
    }

    setIsGeneratingText(true);
    setErrorMsg(null);
    setIsPublished(false);

    try {
      const res = await fetch('/api/generar-tgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          titulo: temaFinal, 
          generarImagen: false 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el motor de texto');

      setEnsayo(data.content);
      onChange(data.content); // Sincronización inmediata de generadorTexto en Keystatic

      if (data.excerpt) setExcerptIA(data.excerpt);
      if (data.category) setCategoryIA(data.category);

      // Acumular en pendingRef
      pendingRef.current.text = data.content;
      pendingRef.current.excerpt = data.excerpt;
      pendingRef.current.category = data.category;

      // Inyectar en el formulario de Keystatic (categoría, excerpt)
      syncFieldsToKeystaticDOM(data.category, data.excerpt);

      // Backup local
      saveToLocalBackup({
        ensayo: data.content,
        excerptIA: data.excerpt,
        categoryIA: data.category
      });

      return { content: data.content, excerpt: data.excerpt, category: data.category };

    } catch (err: any) {
      setErrorMsg(`Texto: ${err.message}`);
      return null;
    } finally {
      setIsGeneratingText(false);
    }
  };

  // 2. Generación de Arte Especializado con Nano Banana V2 / Semantic Router
  const handleGenerarArte = async (): Promise<string | null> => {
    const temaFinal = detectPostTitle() || titulo.trim() || 'Ensayo conceptual y filosófico';
    const currentSlug = getSlugFromUrl();

    setIsGeneratingArt(true);
    setErrorMsg(null);
    setIsPublished(false);

    try {
      const res = await fetch('/api/generar-arte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: currentSlug,
          mode: 'intelligent',
          intelligentInput: {
            title: temaFinal,
            concept: temaFinal
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

      // Acumular imageUrl en ref y en local backup
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

  // 2b. Generar Ficha de Georreferencias Arqueosemióticas (Gemini 3.1 Pro)
  const [isGeneratingGeoref, setIsGeneratingGeoref] = useState(false);
  const [georefResult, setGeorefResult] = useState<{
    volantaHook: string;
    informeMarkdown: string;
    excerpt: string;
    saberMasDato: string;
  } | null>(null);

  const handleGenerarGeorreferencia = async () => {
    const lugarToUse = detectPostTitle() || titulo.trim();
    if (!lugarToUse) return alert('Por favor, ingresa o auto-detecta un lugar o tema (ej. Aramu Muru, Perú).');

    setIsGeneratingGeoref(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/generar-georreferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lugar: lugarToUse })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error generando georreferencia');

      const georefData = {
        volantaHook: data.volantaHook,
        informeMarkdown: data.informeMarkdown,
        excerpt: data.excerpt,
        saberMasDato: data.saberMasDato
      };

      setGeorefResult(georefData);
      if (data.excerpt) setExcerptIA(data.excerpt);

      // Anexar automáticamente la Georreferencia al final del ensayo o como bloque principal
      const newEssayContent = ensayo 
        ? `${ensayo.trim()}\n\n---\n\n${data.informeMarkdown}`
        : data.informeMarkdown;

      setEnsayo(newEssayContent);
      onChange(newEssayContent);
      pendingRef.current.text = newEssayContent;
      if (data.excerpt) pendingRef.current.excerpt = data.excerpt;

      syncFieldsToKeystaticDOM(categoryIA || 'Arqueosemiótica', data.excerpt);

      saveToLocalBackup({
        ensayo: newEssayContent,
        excerptIA: data.excerpt,
        categoryIA: categoryIA || 'Arqueosemiótica'
      });

      alert('INFORME DE GEORREFERENCIAS ARQUEOSEMIÓTICAS GENERADO E INYECTADO');

    } catch (err: any) {
      setErrorMsg(`Georreferencia: ${err.message}`);
    } finally {
      setIsGeneratingGeoref(false);
    }
  };

  const handleGuardarEnColeccionGeorreferencias = async () => {
    if (!georefResult) return alert('Primero debes generar la georreferencia.');
    const temaToUse = detectPostTitle() || titulo.trim();
    if (!temaToUse) return alert('Debes proporcionar un nombre o título para la georreferencia.');

    const slug = temaToUse.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');

    try {
      const res = await fetch('/api/guardar-georreferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          title: temaToUse,
          content: georefResult.informeMarkdown,
          volantaHook: georefResult.volantaHook,
          saberMasDato: georefResult.saberMasDato,
          sitioGeohistorico: sitioGeohistoricoInput || temaToUse,
          excerpt: georefResult.excerpt,
          category: 'Arqueosemiótica',
          imageUrl: pendingRef.current.imageUrl || arteResult?.imageUrl,
          publicarConImagen
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`GEORREFERENCIA GUARDADA EN LA COLECCIÓN INDEPENDIENTE:\n\nsrc/content/georreferencias/${slug}/`);
      } else {
        alert(`Error guardando georreferencia: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error de conexión: ${e.message}`);
    }
  };

  // 3. Ejecución Unificada: genera texto y arte en memoria de forma segura
  const handleGenerarAmbos = async () => {
    const temaFinal = detectPostTitle() || titulo.trim();
    if (!temaFinal) return alert('Por favor, ingresa un título en Keystatic arriba para iniciar la generación.');

    pendingRef.current = {};
    const isNew = isCreatingNewPost();
    setIsNewPost(isNew);
    
    if (generarAmbosJuntos) {
      const textResult = await handleGenerarTexto();
      const imageUrl = await handleGenerarArte();
      
      if (textResult || imageUrl) {
        setIsPublished(true);
      }
    } else {
      await handleGenerarTexto();
    }
  };

  const handleConfirmarSincronizacion = async () => {
    if (!ensayo) return alert('No hay texto de ensayo generado para guardar.');
    onChange(ensayo);
    syncFieldsToKeystaticDOM();
    setIsPublished(true);

    const slugConfirmado = getSlugFromUrl();
    if (slugConfirmado) {
      // Post existente: guardar directamente a disco
      await handleSaveDirectlyToDisk({
        text: pendingRef.current.text ?? ensayo,
        excerpt: pendingRef.current.excerpt ?? excerptIA,
        category: pendingRef.current.category ?? categoryIA,
        image: pendingRef.current.imageUrl ?? arteResult?.imageUrl
      });
      alert('ENSAYO, EXCERPT, CATEGORÍA Y PORTADA GUARDADOS EXITOSAMENTE!');
    } else {
      // Post nuevo: solo sincronizar con Keystatic, el Save lo hace el usuario
      alert('DATOS SINCRONIZADOS CON KEYSTATIC.\n\nAhora presiona el botón "Save" / "Create" de Keystatic para crear el post en el sistema de archivos.');
    }

    setTimeout(() => setIsPublished(false), 4000);
  };

  const isGlobalLoading = isGeneratingText || isGeneratingArt;

  return (
    <div style={{
      padding: '24px',
      background: '#0a0a0a',
      color: '#e0e0e0',
      borderRadius: '12px',
      border: '1px solid #333',
      fontFamily: 'Inter, system-ui, sans-serif',
      marginTop: '10px'
    }}>
      {/* Encabezado Principal y Controles de Lienzo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Motor de Generación Unificado TGP
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#888' }}>
            Redacción de Ensayo + Excerpt/Quote + Categoría Sugerida (Gemini 3.1 Pro)
          </p>
        </div>

        {/* Botón de Reset / Limpiar Lienzo */}
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
          title="Borra el borrador actual y resetea el lienzo en blanco"
        >
          Limpiar Lienzo
        </button>
      </div>

      {/* Badge de Estado del Post */}
      <div style={{
        marginBottom: '16px',
        padding: '8px 14px',
        background: ensayo ? '#0d2818' : '#262210',
        border: ensayo ? '1px solid #2e7d32' : '1px solid #f57f17',
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
            background: ensayo ? '#4caf50' : '#ffeb3b',
            boxShadow: ensayo ? '0 0 8px #4caf50' : '0 0 8px #ffeb3b'
          }} />
          <span style={{ fontWeight: 700, color: ensayo ? '#a5d6a7' : '#fff59d' }}>
            {ensayo ? `LISTO PARA EDICIÓN (${ensayo.length} caracteres cargados)` : 'LIENZO LIMPIO (Listo para nuevo artículo)'}
          </span>
        </div>
        <span style={{ color: '#aaa', fontSize: '0.72rem' }}>
          ID: {currentSlug}
        </span>
      </div>

      {/* AVISO PARA POSTS NUEVOS */}
      {isNewPost && (
        <div style={{
          marginBottom: '18px',
          padding: '12px 16px',
          background: 'rgba(255, 193, 7, 0.08)',
          border: '1px solid rgba(255, 193, 7, 0.4)',
          borderRadius: '8px',
          fontSize: '0.82rem',
          color: '#ffd54f',
          lineHeight: '1.5'
        }}>
          <strong>POST NUEVO DETECTADO:</strong> Generá el texto y portada libremente. Al terminar, usá el botón <strong>"Create"</strong> de Keystatic arriba para crear el post. Luego podrás guardar actualizaciones directas desde aquí.
        </div>
      )}

      {/* Indicador de Tema Auto-detectado */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '0.75rem', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
          TEMA / TÍTULO PARA LA IA:
        </label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={effectiveTopic ? `TÍTULO AUTO-DETECTADO: "${effectiveTopic}"` : "Escribe un tema (o deja vacío para auto-detectar el título del post)"}
          style={{ 
            width: '100%', 
            padding: '14px', 
            background: '#141414', 
            border: '1px solid #444', 
            borderRadius: '6px', 
            color: '#fff', 
            fontSize: '0.95rem',
            outline: 'none'
          }}
        />
        {effectiveTopic && !titulo && (
          <span style={{ fontSize: '0.72rem', color: '#81c784', marginTop: '4px', display: 'block' }}>
            ✓ Auto-detectado desde el post: <strong>"{effectiveTopic}"</strong>
          </span>
        )}
      </div>

      {/* CONTROLES DE COLECCIÓN Y TOGGLE DE IMAGEN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64b5f6', display: 'block', marginBottom: '6px', fontWeight: 700 }}>
            SITIO / LUGAR GEOHISTÓRICO:
          </label>
          <input
            type="text"
            value={sitioGeohistoricoInput}
            onChange={(e) => setSitioGeohistoricoInput(e.target.value)}
            placeholder={effectiveTopic ? `Ej: ${effectiveTopic}` : "Ej: Aramu Muru (Perú), Tikal, Bonampak..."}
            style={{
              width: '100%',
              padding: '12px',
              background: '#121c24',
              border: '1px solid #1e4976',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '22px' }}>
          <input
            type="checkbox"
            id="toggleConImagen"
            checked={publicarConImagen}
            onChange={(e) => setPublicarConImagen(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1976d2' }}
          />
          <label htmlFor="toggleConImagen" style={{ fontSize: '0.85rem', color: publicarConImagen ? '#90caf9' : '#888', cursor: 'pointer', fontWeight: 600 }}>
            {publicarConImagen ? 'Publicar con Imagen de Portada' : 'Publicar sin Imagen (Edición Texto Puro)'}
          </label>
        </div>
      </div>

      {/* Checkbox Toggle para modo de disparo */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '14px 18px', 
        background: generarAmbosJuntos ? '#121912' : '#191924', 
        border: generarAmbosJuntos ? '1px solid #254025' : '1px solid #3b3b54', 
        borderRadius: '8px',
        marginBottom: '20px',
        transition: 'all 0.2s ease'
      }}>
        <input 
          type="checkbox" 
          id="toggleAmbos"
          checked={generarAmbosJuntos} 
          onChange={(e) => setGenerarAmbosJuntos(e.target.checked)} 
          style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#28a745' }}
        />
        <label htmlFor="toggleAmbos" style={{ fontSize: '0.9rem', color: generarAmbosJuntos ? '#d0ebd0' : '#d4c7ff', cursor: 'pointer', fontWeight: 600 }}>
          {generarAmbosJuntos ? 'Modo Simultáneo Activado (Texto + Excerpt + Portada en 1 clic)' : 'Modo Manual / Paso a Paso (Selecciona Texto o Portada individualmente)'}
        </label>
      </div>

      {/* Botones de Acción (2 Pasos o 1 Clic según toggle) */}
      <div style={{ display: 'grid', gridTemplateColumns: generarAmbosJuntos ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        {generarAmbosJuntos ? (
          <button
            type="button"
            onClick={handleGenerarAmbos}
            disabled={isGlobalLoading}
            style={{
              padding: '16px',
              background: isGlobalLoading ? '#222' : 'linear-gradient(135deg, #1b5e20, #2e7d32)', 
              color: isGlobalLoading ? '#666' : '#fff',
              border: '1px solid #4caf50',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '1rem',
              letterSpacing: '0.08em',
              cursor: isGlobalLoading ? 'not-allowed' : 'pointer',
              boxShadow: isGlobalLoading ? 'none' : '0 4px 15px rgba(46, 125, 50, 0.4)'
            }}
          >
            {isGlobalLoading 
              ? (isGeneratingText ? 'GENERANDO ENSAYO & EXCERPT...' : 'MATERIALIZANDO PORTADA...') 
              : 'GENERAR ENSAYO, EXCERPT Y PORTADA'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGenerarTexto}
              disabled={isGlobalLoading}
              style={{
                padding: '16px',
                background: isGeneratingText ? '#222' : '#28a745', 
                color: isGeneratingText ? '#666' : '#fff',
                border: '1px solid #34ce57',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: isGeneratingText ? 'not-allowed' : 'pointer',
                boxShadow: isGeneratingText ? 'none' : '0 4px 12px rgba(40, 167, 69, 0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              {isGeneratingText ? 'GENERANDO...' : '1. GENERAR TEXTO & EXCERPT'}
            </button>

            <button
              type="button"
              onClick={handleGenerarArte}
              disabled={isGlobalLoading}
              style={{
                padding: '16px',
                background: isGeneratingArt ? '#222' : '#6f42c1', 
                color: isGeneratingArt ? '#666' : '#fff',
                border: '1px solid #8a57e3',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: isGlobalLoading ? 'not-allowed' : 'pointer',
                boxShadow: isGlobalLoading ? 'none' : '0 4px 12px rgba(111, 66, 193, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {isGeneratingArt ? 'MATERIALIZANDO...' : '2. GENERAR PORTADA INTELIGENTE'}
            </button>
          </>
        )}
      </div>

      {/* BOTÓN DEDICADO: GEORREFERENCIAS ARQUEOSEMIÓTICAS */}
      <div style={{ marginBottom: '24px' }}>
        <button
          type="button"
          onClick={handleGenerarGeorreferencia}
          disabled={isGeneratingGeoref || isGlobalLoading}
          style={{
            width: '100%',
            padding: '16px',
            background: isGeneratingGeoref 
              ? '#222' 
              : 'linear-gradient(135deg, #0d47a1, #1976d2)',
            color: isGeneratingGeoref ? '#888' : '#fff',
            border: '1px solid #42a5f5',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.95rem',
            letterSpacing: '0.05em',
            cursor: (isGeneratingGeoref || isGlobalLoading) ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(25, 118, 210, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {isGeneratingGeoref 
            ? 'INVESTIGANDO GEOLOGÍA, ETNOGRAFÍA & HISTORIA LOCAL...' 
            : 'GENERAR GEORREFERENCIA ARQUEOSEMIÓTICA (Gemini 3.1 Pro)'}
        </button>
      </div>

      {errorMsg && (
        <div style={{ color: '#ff5252', fontSize: '0.8rem', padding: '12px', background: 'rgba(255,82,82,0.1)', borderRadius: '6px', border: '1px solid #ff5252', marginBottom: '18px' }}>
          <strong>Error de Generación:</strong> {errorMsg}
        </div>
      )}

      {/* BLOQUE GEORREFERENCIA RESULTADO */}
      {georefResult && (
        <div style={{
          marginBottom: '24px',
          padding: '18px',
          background: '#0a141d',
          border: '1px solid #1e4976',
          borderRadius: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64b5f6', fontWeight: 800, letterSpacing: '0.1em' }}>
              FICHA DE GEORREFERENCIAS ARQUEOSEMIÓTICAS GENERADA
            </span>
          </div>

          <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#90caf9', fontStyle: 'italic', fontWeight: 600 }}>
            H2 Hook / Volanta: "{georefResult.volantaHook}"
          </p>

          {georefResult.saberMasDato && (
            <div style={{ padding: '10px 14px', background: '#102030', borderLeft: '3px solid #64b5f6', borderRadius: '4px', fontSize: '0.8rem', color: '#e3f2fd', marginBottom: '12px' }}>
              <strong>Saber Más (Dato Local No Divulgado):</strong> {georefResult.saberMasDato}
            </div>
          )}

          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#81c784', flex: 1 }}>
              ✓ Este informe multidimensional (Geología + Arqueología + Etnografía + Teorías Alternativas + Saber Más) ya fue inyectado al contenido.
            </span>
            <button
              type="button"
              onClick={handleGuardarEnColeccionGeorreferencias}
              style={{
                padding: '8px 14px',
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(25, 118, 210, 0.4)'
              }}
            >
              Guardar en Colección Georreferencias
            </button>
          </div>
        </div>
      )}

      {/* MOSTRAR EXCERPT SUGERIDO Y CATEGORÍA IA */}
      {(excerptIA || categoryIA) && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '16px', 
          background: '#131813', 
          border: '1px solid #285428', 
          borderRadius: '8px' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: '#81c784', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              SINOPSIS (EXCERPT) & CATEGORÍA SUGERIDAS POR IA
            </span>
            {categoryIA && (
              <span style={{ fontSize: '0.7rem', padding: '3px 8px', background: '#254725', color: '#b9f6ca', borderRadius: '4px', fontWeight: 700 }}>
                CATEGORÍA: {categoryIA}
              </span>
            )}
          </div>

          {excerptIA && (
            <blockquote style={{ 
              margin: '0 0 10px 0', 
              paddingLeft: '14px', 
              borderLeft: '3px solid #4caf50', 
              fontSize: '0.9rem', 
              fontStyle: 'italic', 
              color: '#d0ebd0',
              lineHeight: '1.5'
            }}>
              "{excerptIA}"
            </blockquote>
          )}

          <button
            type="button"
            onClick={async () => {
              syncFieldsToKeystaticDOM(categoryIA, excerptIA);
              await handleSaveDirectlyToDisk({ category: categoryIA, excerpt: excerptIA });
            }}
            style={{
              padding: '6px 12px',
              background: '#2e7d32',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ✓ Aplicar y Guardar Categoría y Excerpt
          </button>
        </div>
      )}

      {/* ÁREA DE TEXTO DEL ENSAYO */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '0.75rem', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.05em' }}>
          CONTENIDO DEL ENSAYO:
        </label>
        <textarea
          value={ensayo}
          onChange={(e) => {
            const val = e.target.value;
            setEnsayo(val);
            onChange(val); // Inmediatamente notificar a Keystatic
          }}
          placeholder="El ensayo redactado por Gemini 3.1 Pro aparecerá aquí..."
          style={{
            width: '100%',
            height: '320px',
            background: '#111',
            color: '#eee',
            border: '1px solid #333',
            padding: '16px',
            fontFamily: 'Georgia, serif',
            fontSize: '1rem',
            lineHeight: '1.6',
            borderRadius: '6px',
            resize: 'vertical' as const
          }}
        />
      </div>

      {/* VISTA PREVIA DE PORTADA ESPECIALIZADA NANO BANANA V2 */}
      {arteResult && (
        <div style={{ 
          marginBottom: '24px', 
          padding: '18px', 
          background: '#121216', 
          border: '1px solid #3d3b54', 
          borderRadius: '10px' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', color: '#a594fd', fontWeight: 700, letterSpacing: '0.1em' }}>
              PORTADA ESPECIALIZADA NANO BANANA V2
            </span>
            {arteResult.resolvedDirection?.selectedPresetName && (
              <span style={{ 
                fontSize: '0.7rem', 
                padding: '4px 8px', 
                background: '#2c2547', 
                color: '#d4c7ff', 
                borderRadius: '4px',
                border: '1px solid #5a4b9c',
                fontWeight: 600
              }}>
                PRESET IA: {arteResult.resolvedDirection.selectedPresetName}
              </span>
            )}
          </div>

          {arteResult.imageUrl ? (
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <img 
                src={arteResult.imageUrl} 
                alt="Portada Generada" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '360px', 
                  borderRadius: '6px', 
                  border: '1px solid #444',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                }} 
              />
              <div style={{ marginTop: '10px' }}>
                <a 
                  href={arteResult.imageUrl} 
                  download={`portada-${effectiveTopic || 'ensayo'}.png`}
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    background: '#333',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    textDecoration: 'none',
                    fontWeight: 600,
                    border: '1px solid #555'
                  }}
                >
                  Descargar Imagen de Portada
                </a>
              </div>
            </div>
          ) : (
            <div style={{ padding: '15px', background: '#1a1a1a', borderRadius: '4px', fontSize: '0.8rem', color: '#ffb74d' }}>
              Dirección de Arte generada pero sin render visual. Prompt: {arteResult.imagePrompt}
            </div>
          )}
        </div>
      )}

      {/* BOTÓN PRINCIPAL DE CONFIRMACIÓN CONJUNTA */}
      <div style={{ 
        padding: '20px', 
        background: 'linear-gradient(135deg, #0d1f0d, #1a2e1a)',
        border: '1px solid #2d5a2d',
        borderRadius: '10px'
      }}>
        <p style={{ 
          margin: '0 0 6px 0', 
          fontSize: '0.65rem', 
          color: '#5a9e5a', 
          textTransform: 'uppercase' as const,
          letterSpacing: '0.2em',
          fontWeight: 700
        }}>
          PASO FINAL DE VINCULACIÓN
        </p>
        <p style={{ 
          margin: '0 0 16px 0', 
          fontSize: '0.8rem', 
          color: '#aaa',
          lineHeight: '1.5'
        }}>
          Presioná este botón para guardar el ensayo, la categoría, la sinopsis y la portada directamente en el sistema de archivos de la hemeroteca.
        </p>

        <button
          type="button"
          onClick={handleConfirmarSincronizacion}
          disabled={!ensayo || ensayo.length < 10}
          style={{
            display: 'block',
            width: '100%',
            padding: '18px',
            background: (!ensayo || ensayo.length < 10) 
              ? '#1a1a1a' 
              : isPublished 
                ? 'linear-gradient(135deg, #1a5c1a, #2d8c2d)' 
                : 'linear-gradient(135deg, #1a4d1a, #2d7a2d)',
            color: (!ensayo || ensayo.length < 10) ? '#555' : '#fff',
            border: (!ensayo || ensayo.length < 10) ? '1px solid #333' : '1px solid #4caf50',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '1rem',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.12em',
            cursor: (!ensayo || ensayo.length < 10) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: (!ensayo || ensayo.length < 10) ? 'none' : '0 6px 20px rgba(45, 122, 45, 0.4)',
          }}
        >
          {isPublished 
            ? 'ENSAYO Y METADATOS GUARDADOS EN DISCO' 
            : 'CONFIRMAR ENSAYO Y PORTADA EN LA HEMEROTECA'}
        </button>
      </div>
    </div>
  );
}
