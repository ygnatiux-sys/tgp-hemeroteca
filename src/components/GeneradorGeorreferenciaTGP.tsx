import React, { useState, useEffect, useRef } from 'react';

/**
 * Helper para forzar la actualización del valor en inputs y textareas de React 18
 */
export function setNativeValue(element: HTMLElement | null, value: string) {
  if (!element || value === undefined || value === null) return;
  const proto = Object.getPrototypeOf(element);
  const descriptor =
    Object.getOwnPropertyDescriptor(proto, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    (element as any).value = value;
  }

  // Disparar los eventos sintéticos que React 18 escucha
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

/**
 * Helper para inyectar programáticamente texto Markdown en el editor ProseMirror (fields.document) de Keystatic
 */
export function injectIntoKeystaticDocumentEditor(markdownText: string): boolean {
  if (typeof document === 'undefined' || !markdownText) return false;

  const editorEl = document.querySelector<HTMLDivElement>(
    '[contenteditable="true"].ProseMirror, [contenteditable="true"][role="textbox"], [contenteditable="true"]'
  );

  if (!editorEl) {
    console.warn('[TGP] No se encontró el editor ProseMirror en el DOM.');
    return false;
  }

  try {
    editorEl.focus();

    // Seleccionar todo el contenido actual del editor para sobreescribirlo limpiamente
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // 1. Intentar execCommand('insertText')
    const success = document.execCommand('insertText', false, markdownText);

    // 2. Si no funcionó execCommand, intentar evento de pegado sintético (ClipboardEvent)
    if (!success) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', markdownText);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      editorEl.dispatchEvent(pasteEvent);
    }
    return true;
  } catch (err) {
    console.error('[TGP] Error inyectando en el editor ProseMirror:', err);
    return false;
  }
}

export function GeneradorGeorreferenciaTGP({ value, onChange }: any) {
  const [lugar, setLugar] = useState('');
  const [generarConImagen, setGenerarConImagen] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSynced, setIsSynced] = useState(false); // ← true cuando «Traspasar» fue ejecutado
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const [informe, setInforme] = useState(value || '');
  const [volanta, setVolanta] = useState('');
  const [saberMas, setSaberMas] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [titulosSugeridos, setTitulosSugeridos] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // ── TOGGLES DE METADATA OPCIONAL (Apagados por defecto - false) ──
  const [syncVolanta, setSyncVolanta] = useState(false);
  const [syncSaberMas, setSyncSaberMas] = useState(false);
  const [syncExcerpt, setSyncExcerpt] = useState(false);
  const [syncSitio, setSyncSitio] = useState(false);

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

  /**
   * SINCRONIZACIÓN TOTAL CON EL FORMULARIO DE KEYSTATIC Y EL EDITOR MARKDOC PROSEMIRROR
   * - Título, Slug, Fecha Actualizada y Editor Markdoc: SIEMPRE se inyectan.
   * - Volanta, Saber Más, Excerpt, Sitio: Se inyectan SOLO si su Toggle está activo.
   * - YouTube / Spotify: NUNCA se tocan (permanecen vacíos).
   */
  const syncAllKeystaticFields = (data?: {
    title?: string;
    volanta?: string;
    saberMas?: string;
    excerpt?: string;
    sitio?: string;
    contentMarkdown?: string;
  }) => {
    if (typeof document === 'undefined') return;

    const titleVal = data?.title || lugar || effectiveTitle || '';
    const volantaVal = data?.volanta ?? volanta;
    const saberMasVal = data?.saberMas ?? saberMas;
    const excerptVal = data?.excerpt ?? excerpt;
    const sitioVal = data?.sitio ?? (lugar || effectiveTitle || '');
    const contentVal = data?.contentMarkdown ?? informe;

    // 1. Título & Slug (OBLIGATORIO - SIEMPRE)
    if (titleVal) {
      const titleInputs = document.querySelectorAll<HTMLInputElement>(
        'input[name="title"], input[id^="title"], input[placeholder*="titulo"], input[placeholder*="tit"]'
      );
      titleInputs.forEach((el) => setNativeValue(el, titleVal));
    }

    // 2. Fecha Actualizada (OBLIGATORIO - SIEMPRE fecha de hoy YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name="date"], input[type="date"], input[id*="date"]'
    );
    dateInputs.forEach((el) => setNativeValue(el, todayStr));

    // 3. Volanta Hook (Condicional según toggle)
    if (syncVolanta && volantaVal) {
      const volantaEls = document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
        'textarea[name="volantaHook"], textarea[id*="volantaHook"], textarea[name*="volanta"], textarea[id*="volanta"], input[name="volantaHook"], input[id*="volantaHook"]'
      );
      volantaEls.forEach((el) => setNativeValue(el, volantaVal));
    }

    // 4. Saber Más Dato (Condicional según toggle)
    if (syncSaberMas && saberMasVal) {
      const saberEls = document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
        'textarea[name="saberMasDato"], textarea[id*="saberMasDato"], textarea[name*="saberMas"], textarea[id*="saberMas"], input[name="saberMasDato"], input[id*="saberMasDato"]'
      );
      saberEls.forEach((el) => setNativeValue(el, saberMasVal));
    }

    // 5. Excerpt / Sinopsis (Condicional según toggle)
    if (syncExcerpt && excerptVal) {
      const excEls = document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
        'textarea[name="excerpt"], textarea[id*="excerpt"]'
      );
      excEls.forEach((el) => setNativeValue(el, excerptVal));
    }

    // 6. Ubicación Geohistórica / Sitio (Condicional según toggle)
    if (syncSitio && sitioVal) {
      const sitioEls = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input[name="sitioGeohistorico"], input[id*="sitioGeohistorico"], input[name*="sitio"], input[id*="sitio"]'
      );
      sitioEls.forEach((el) => setNativeValue(el, sitioVal));
    }

    // 7. Inyección Forzada en el Editor ProseMirror / fields.document (OBLIGATORIO - SIEMPRE)
    if (contentVal) {
      injectIntoKeystaticDocumentEditor(contentVal);
      onChange(contentVal);
    }
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
        syncAllKeystaticFields({
          volanta: unnested.volantaHook,
          saberMas: unnested.saberMasDato,
          excerpt: unnested.excerpt,
          sitio: lugar || effectiveTitle,
          contentMarkdown: unnested.informeMarkdown
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
    syncAllKeystaticFields({ title: titulo, sitio: titulo });
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

      // Inyectar automáticamente en los campos de Keystatic y en el editor Markdoc
      syncAllKeystaticFields({
        title: data.titulosSugeridos?.[0] || temaToUse,
        volanta: data.volantaHook,
        saberMas: data.saberMasDato,
        excerpt: data.excerpt,
        sitio: temaToUse,
        contentMarkdown: data.informeMarkdown
      });

      saveToLocalBackup({
        informe: data.informeMarkdown,
        volanta: data.volantaHook,
        saberMas: data.saberMasDato,
        excerpt: data.excerpt,
        titulosSugeridos: data.titulosSugeridos
      });

      setStatusFeedback('Informe generado e inyectado en Keystatic. Listo para guardar.');
      
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

  // Helper: habilita / deshabilita el botón Save nativo de Keystatic en el DOM
  const lockKeystatiSave = (lock: boolean) => {
    if (typeof document === 'undefined') return;
    const saveButtons = document.querySelectorAll<HTMLButtonElement>(
      'button[type="submit"], form button[type="submit"], [data-keystatic-save-button], button'
    );
    saveButtons.forEach(btn => {
      const label = (btn.textContent || '').trim().toLowerCase();
      if (label === 'save' || label === 'guardar' || label === 'create') {
        if (lock) {
          btn.setAttribute('disabled', 'true');
          btn.setAttribute('title', '⚠️ Primero presiona «Traspasar Todo» para inyectar el contenido');
          btn.style.opacity = '0.35';
          btn.style.cursor = 'not-allowed';
        } else {
          btn.removeAttribute('disabled');
          btn.removeAttribute('title');
          btn.style.opacity = '';
          btn.style.cursor = '';
        }
      }
    });
  };

  // Activar lock al montar si no hay contenido sinc.
  useEffect(() => { if (!isSynced) lockKeystatiSave(true); }, []);
  useEffect(() => { lockKeystatiSave(!isSynced); }, [isSynced]);

  // 3. Acción Manual de Inyección / Traspasar Todo
  const handleTraspasarTodo = () => {
    const temaToUse = effectiveTitle || lugar.trim();
    if (!informe) return alert('No hay contenido generado para traspasar.');

    syncAllKeystaticFields({
      title: temaToUse,
      volanta,
      saberMas,
      excerpt,
      sitio: temaToUse,
      contentMarkdown: informe
    });

    setIsSynced(true);
    lockKeystatiSave(false);
    setStatusFeedback('✓ Datos inyectados en el formulario y editor Markdoc de Keystatic.');
  };

  // 4. Guardado Directo a Disco en la Colección Georreferencias
  const handleConfirmarSincronizacion = async () => {
    const temaToUse = effectiveTitle || lugar.trim();
    if (!informe) return alert('No hay contenido de informe geohistórico para guardar.');

    const slugConfirmado = (getSlugFromUrl() && getSlugFromUrl() !== 'new')
      ? getSlugFromUrl()! 
      : temaToUse.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');

    // Inyectar en Keystatic antes de guardar
    syncAllKeystaticFields({
      title: temaToUse,
      volanta,
      saberMas,
      excerpt,
      sitio: temaToUse,
      contentMarkdown: informe
    });

    try {
      const res = await fetch('/api/guardar-georreferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slugConfirmado,
          title: temaToUse,
          content: pendingRef.current.informe ?? informe,
          volantaHook: syncVolanta ? (pendingRef.current.volanta ?? volanta) : '',
          saberMasDato: syncSaberMas ? (pendingRef.current.saberMas ?? saberMas) : '',
          sitioGeohistorico: syncSitio ? temaToUse : '',
          excerpt: syncExcerpt ? (pendingRef.current.excerpt ?? excerpt) : '',
          category: 'Arqueosemiótica',
          imageUrl: pendingRef.current.imageUrl ?? imageUrl,
          publicarConImagen: generarConImagen
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsSaved(true);
        setStatusFeedback('¡Publicación guardada exitosamente en disco!');
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

      {/* ── PANEL MINIMALISTA DE TOGGLES DE METADATA OPCIONAL (Apagados por defecto en gris) ── */}
      <div style={{
        padding: '12px 14px',
        background: '#090d13',
        border: '1px solid #16202c',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⚙️ Metadatos Opcionales (Apagados por defecto)
          </span>
          <span style={{ fontSize: '0.65rem', color: '#4b5563' }}>
            Activa el checkbox solo si deseas sobreescribir ese campo
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: syncVolanta ? '#0d2847' : '#10141b',
            color: syncVolanta ? '#90caf9' : '#525b6a',
            border: syncVolanta ? '1px solid #1976d2' : '1px solid #1c2430',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: syncVolanta ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
            <input
              type="checkbox"
              checked={syncVolanta}
              onChange={(e) => setSyncVolanta(e.target.checked)}
              style={{ accentColor: '#1976d2', cursor: 'pointer' }}
            />
            Volanta / H2 Hook
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: syncSaberMas ? '#0d2847' : '#10141b',
            color: syncSaberMas ? '#90caf9' : '#525b6a',
            border: syncSaberMas ? '1px solid #1976d2' : '1px solid #1c2430',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: syncSaberMas ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
            <input
              type="checkbox"
              checked={syncSaberMas}
              onChange={(e) => setSyncSaberMas(e.target.checked)}
              style={{ accentColor: '#1976d2', cursor: 'pointer' }}
            />
            Saber Más (Dato Local)
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: syncExcerpt ? '#0d2847' : '#10141b',
            color: syncExcerpt ? '#90caf9' : '#525b6a',
            border: syncExcerpt ? '1px solid #1976d2' : '1px solid #1c2430',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: syncExcerpt ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
            <input
              type="checkbox"
              checked={syncExcerpt}
              onChange={(e) => setSyncExcerpt(e.target.checked)}
              style={{ accentColor: '#1976d2', cursor: 'pointer' }}
            />
            Excerpt / Sinopsis
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: syncSitio ? '#0d2847' : '#10141b',
            color: syncSitio ? '#90caf9' : '#525b6a',
            border: syncSitio ? '1px solid #1976d2' : '1px solid #1c2430',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: syncSitio ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
            <input
              type="checkbox"
              checked={syncSitio}
              onChange={(e) => setSyncSitio(e.target.checked)}
              style={{ accentColor: '#1976d2', cursor: 'pointer' }}
            />
            Ubicación Geohistórica
          </label>
        </div>
        <span style={{ fontSize: '0.67rem', color: '#4a5568', marginTop: '8px', display: 'block' }}>
          ✓ Obligatorios fijos: Título, Slug, Fecha actualizada y Editor Markdoc. YouTube y Spotify permanecen vacíos.
        </span>
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

      {/* Botonera de Acción de Generación */}
      <div style={{ display: 'grid', gridTemplateColumns: generarConImagen ? '2fr 1fr' : '1fr', gap: '12px', marginBottom: '18px' }}>
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
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 700 }}>
            INFORME GEOHISTÓRICO (MARKDOWN):
          </label>
          {informe && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(informe);
                alert('✓ Informe copiado al portapapeles.');
              }}
              style={{
                padding: '4px 10px',
                background: '#14283c',
                color: '#90caf9',
                border: '1px solid #285484',
                borderRadius: '4px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              📋 Copiar Markdown
            </button>
          )}
        </div>
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
        <div style={{ marginBottom: '20px', textAlign: 'center', background: '#081018', padding: '16px', borderRadius: '8px', border: '1px solid #19436d' }}>
          <span style={{ fontSize: '0.75rem', color: '#90caf9', fontWeight: 700, display: 'block', marginBottom: '10px' }}>
            PORTADA FOTOGRÁFICA GENERADA
          </span>
          <img src={imageUrl} alt="Portada Sitio" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '6px', border: '1px solid #333' }} />
        </div>
      )}

      {/* BADGE DE ESTADO DE SINCRONIZACIÓN */}
      {isSynced && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px',
          background: 'rgba(25, 118, 210, 0.12)',
          border: '1px solid #1976d2',
          borderRadius: '8px',
          marginBottom: '14px',
          fontSize: '0.8rem',
          color: '#90caf9',
          fontWeight: 700
        }}>
          ✅ Contenido traspasado — ya podés presionar «Save» en la barra de Keystatic.
        </div>
      )}
      {!isSynced && informe && informe.length > 10 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px',
          background: 'rgba(255, 152, 0, 0.08)',
          border: '1px solid #f57c00',
          borderRadius: '8px',
          marginBottom: '14px',
          fontSize: '0.78rem',
          color: '#ffb74d'
        }}>
          ⚠️ Hay contenido generado. Presioná «Traspasar Todo» antes de «Save» en Keystatic.
        </div>
      )}

      {/* BOTONERA DE ACCIÓN: TRASPASAR TODO & GUARDAR EN DISCO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
        {/* BOTÓN 1: TRASPASAR AL FORMULARIO & PROSEMIRROR */}
        <button
          type="button"
          onClick={handleTraspasarTodo}
          disabled={!informe || informe.length < 10}
          style={{
            padding: '16px',
            background: isSynced
              ? 'linear-gradient(135deg, #004d40, #00695c)'
              : (!informe || informe.length < 10)
                ? '#1b222d'
                : 'linear-gradient(135deg, #00695c, #00897b)',
            color: (!informe || informe.length < 10) ? '#666' : '#fff',
            border: isSynced ? '2px solid #00e5ff' : '1px solid #26a69a',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.9rem',
            letterSpacing: '0.04em',
            cursor: (!informe || informe.length < 10) ? 'not-allowed' : 'pointer',
            boxShadow: isSynced ? '0 0 16px rgba(0,229,255,0.3)' : '0 4px 12px rgba(0, 137, 123, 0.35)'
          }}
        >
          {isSynced ? '✅ TRASPASADO — Podés hacer Save' : '⚡ TRASPASAR TODO AL FORMULARIO & EDITOR'}
        </button>

        {/* BOTÓN 2: CONFIRMAR EN DISCO — solo activo si ya fue traspasado */}
        <button
          type="button"
          onClick={handleConfirmarSincronizacion}
          disabled={!isSynced || !informe || informe.length < 10}
          title={!isSynced ? 'Primero presioná «Traspasar Todo»' : ''}
          style={{
            padding: '16px',
            background: (!isSynced || !informe || informe.length < 10)
              ? '#1f2937'
              : isSaved
                ? 'linear-gradient(135deg, #1b5e20, #2e7d32)'
                : 'linear-gradient(135deg, #0d47a1, #1565c0)',
            color: (!isSynced || !informe || informe.length < 10) ? '#666' : '#fff',
            border: '1px solid #42a5f5',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.9rem',
            letterSpacing: '0.04em',
            cursor: (!isSynced || !informe || informe.length < 10) ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(21, 101, 192, 0.35)'
          }}
        >
          {isSaved ? '¡PUBLICACIÓN GUARDADA EN DISCO!' : '💾 CONFIRMAR & GUARDAR EN DISCO'}
        </button>
      </div>
    </div>
  );
}
