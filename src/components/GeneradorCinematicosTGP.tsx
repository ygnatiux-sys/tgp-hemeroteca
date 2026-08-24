import React, { useState, useEffect, useRef } from 'react';

// ─── Helper: Setter nativo de React 18 ─────────────────────────────────────
// Keystatic usa inputs controlados por React. El simple `element.value = x`
// no dispara el estado interno de React. Este helper usa el setter nativo
// del prototipo para forzar que React detecte el cambio y valide el slug.
export function setNativeValue(element: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(element);
  const descriptor =
    Object.getOwnPropertyDescriptor(proto, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') ||
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    (element as any).value = value;
  }

  // Disparar todos los eventos que React 18 necesita para detectar el cambio
  element.dispatchEvent(new Event('input',  { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

export interface GeminiCinematicProps {
  value: string;
  onChange: (val: string) => void;
}

export function GeneradorCinematicosTGP({ value, onChange }: GeminiCinematicProps) {
  // ─── ESTADO INTERNO UNIFICADO ───
  let initialText = value;
  let initialImage = null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      initialText = parsed.text || '';
      initialImage = parsed.image || null;
    }
  } catch (e) {
    // Texto plano o vacío
  }

  const [generatedText, setGeneratedText] = useState(initialText);
  const [tema, setTema] = useState('');
  const [generarAmbos, setGenerarAmbos] = useState(true);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(initialImage);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);

  // ── Toggles para campos opcionales (default OFF) ──
  const [syncExcerpt, setSyncExcerpt] = useState(false);
  const [excerptIA, setExcerptIA] = useState<string>('');

  const pendingRef = useRef<{ text?: string; excerpt?: string; image?: string }>({});

  const getSlugFromUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    const parts = window.location.pathname.split('/');
    const itemIndex = parts.indexOf('item');
    if (itemIndex !== -1 && parts[itemIndex + 1]) {
      return parts[itemIndex + 1];
    }
    return null;
  };

  const currentSlug = getSlugFromUrl() || 'nuevo_ensayo_cinematico';
  const BACKUP_KEY = `tgp_cinematico_${currentSlug}`;

  useEffect(() => {
    if (value && value !== generatedText) {
      try {
        const parsed = JSON.parse(value);
        if (parsed?.text) setGeneratedText(parsed.text);
        if (parsed?.image) setPreviewImage(parsed.image);
      } catch (e) {
        setGeneratedText(value);
      }
    } else if (!value) {
      try {
        const savedBackup = localStorage.getItem(BACKUP_KEY);
        if (savedBackup && currentSlug !== 'new' && currentSlug !== 'nuevo_ensayo_cinematico') {
          const parsed = JSON.parse(savedBackup);
          if (parsed.text && !generatedText) {
            setGeneratedText(parsed.text);
            if (parsed.image) setPreviewImage(parsed.image);
            if (parsed.excerpt) setExcerptIA(parsed.excerpt);
          }
        }
      } catch (e) {}
    }
  }, [value, currentSlug]);

  // Sincronizar hacia Keystatic
  const syncToKeystatic = (newText: string, newImage: string | null) => {
    const payload = JSON.stringify({ text: newText, image: newImage });
    onChange(payload);
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({
        text: newText,
        image: newImage,
        excerpt: excerptIA,
        slug: currentSlug,
        updatedAt: new Date().toISOString()
      }));
    } catch (e) {}
  };

  // Auto-detectar título desde el campo de título de Keystatic
  const getEffectiveTopic = (): string => {
    if (tema.trim()) return tema.trim();
    if (typeof document !== 'undefined') {
      const titleInput = document.querySelector<HTMLInputElement>('input[name="title"], input[name="title.name"], input[id^="title"]');
      if (titleInput && titleInput.value.trim()) return titleInput.value.trim();
    }
    return '';
  };

  // ─── Inyectar en los campos DOM de Keystatic con setNativeValue ─────────────
  // OBLIGATORIO: Título y Slug (soluciona error "slug must not be empty")
  // CONDICIONAL: Excerpt
  const syncFieldsToKeystaticDOM = (titleToUse?: string, excToUse?: string) => {
    if (typeof document === 'undefined') return;

    const finalTitle = (titleToUse || getEffectiveTopic() || 'Ensayo Cinemático').trim();

    // 1. Inyección en el campo Título de Keystatic
    const titleInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name="title"], input[name="title.name"], input[id*="title"], input[placeholder*="titulo"], input[placeholder*="tit"]'
    );
    titleInputs.forEach(el => setNativeValue(el, finalTitle));

    // 2. Inyección directa en el campo Slug de Keystatic
    const slugValue = finalTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const slugInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name="title.slug"], input[name="slug"], input[id*="slug"], input[placeholder*="slug"]'
    );
    slugInputs.forEach(el => setNativeValue(el, slugValue));

    // 3. CONDICIONAL: Excerpt
    if (syncExcerpt && excToUse) {
      const excTextareas = document.querySelectorAll<HTMLTextAreaElement>(
        'textarea[name="excerpt"], textarea[id*="excerpt"], textarea[placeholder*="excerpt"], textarea[placeholder*="resumen"]'
      );
      excTextareas.forEach(el => setNativeValue(el, excToUse));
    }
  };

  // 1. Generar Escrito / Texto con Gemini 3.1 Pro
  const handleGenerateText = async (): Promise<string | null> => {
    const topic = getEffectiveTopic();
    if (!topic) {
      setStatusMsg({ type: 'error', text: 'Por favor, ingresa un título o tema para el ensayo cinemático.' });
      return null;
    }

    // Auto-sincronizar título y slug de inmediato
    syncFieldsToKeystaticDOM(topic);

    setIsGeneratingText(true);
    setStatusMsg({ type: 'info', text: 'Generando investigación y ensayo cinemático GSAP con Gemini 3.1 Pro...' });

    try {
      const res = await fetch('/api/generar-tgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: topic, generarImagen: false })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar texto');

      const content = data.content || '';
      const generatedExcerpt = data.excerpt || '';
      if (generatedExcerpt) setExcerptIA(generatedExcerpt);

      setGeneratedText(content);
      syncToKeystatic(content, previewImage);
      syncFieldsToKeystaticDOM(topic, generatedExcerpt);
      
      setStatusMsg({ type: 'success', text: '✅ Ensayo y Slug sincronizados exitosamente con Keystatic.' });
      return content;
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Error en texto: ${err.message || 'Fallo de conexión'}` });
      return null;
    } finally {
      setIsGeneratingText(false);
    }
  };

  // 2. Generar Arte / Portada con Gemini Flash + Nano Banana
  const handleGenerateArt = async (): Promise<string | null> => {
    const topic = getEffectiveTopic();
    if (!topic) {
      setStatusMsg({ type: 'error', text: 'Por favor, ingresa un título o tema para generar la imagen.' });
      return null;
    }

    syncFieldsToKeystaticDOM(topic);

    setIsGeneratingArt(true);
    setStatusMsg({ type: 'info', text: 'Direccionando y materializando arte cinemático 16:9...' });

    try {
      const res = await fetch('/api/generar-tgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: topic, generarImagen: true, estilo: 'dark-academia' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar imagen');

      if (data.imageUrl) {
        setPreviewImage(data.imageUrl);
        setPreviewPrompt(data.imagePrompt || null);
        syncToKeystatic(generatedText, data.imageUrl);
        syncFieldsToKeystaticDOM(topic);
        
        setStatusMsg({ type: 'success', text: '✅ Imagen cinemática materializada y vinculada.' });
        return data.imageUrl;
      } else {
        setPreviewPrompt(data.imagePrompt || null);
        setStatusMsg({ type: 'info', text: data.warning || 'Dirección de arte lista.' });
        return null;
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Error en arte: ${err.message || 'Fallo de conexión'}` });
      return null;
    } finally {
      setIsGeneratingArt(false);
    }
  };

  // 3. Generar Ambos Juntos
  const handleExecuteCombined = async () => {
    setStatusMsg(null);
    const topic = getEffectiveTopic();
    if (!topic) {
      setStatusMsg({ type: 'error', text: 'Por favor, ingresa un título o tema antes de generar.' });
      return;
    }

    syncFieldsToKeystaticDOM(topic);

    if (generarAmbos) {
      const textResult = await handleGenerateText();
      
      setIsGeneratingArt(true);
      setStatusMsg({ type: 'info', text: 'Ensayo cinemático completado. Materializando arte 16:9...' });
      
      try {
        const res = await fetch('/api/generar-tgp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: topic, generarImagen: true, estilo: 'dark-academia' })
        });
        const data = await res.json();
        
        if (data.imageUrl) {
          setPreviewImage(data.imageUrl);
          setPreviewPrompt(data.imagePrompt || null);
          syncToKeystatic(textResult || generatedText, data.imageUrl);
          syncFieldsToKeystaticDOM(topic);
          setStatusMsg({ type: 'success', text: '✅ Ensayo, Portada y Slug GSAP sincronizados exitosamente.' });
        }
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: `Error en arte: ${err.message || 'Fallo de conexión'}` });
      } finally {
        setIsGeneratingArt(false);
      }
    }
  };

  const isBusy = isGeneratingText || isGeneratingArt;

  return (
    <div style={{
      backgroundColor: '#0c0d0e',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '20px',
      color: '#EFEBE3',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      marginTop: '12px',
      marginBottom: '16px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D4AF37', fontWeight: 700 }}>
            🎬 Asistente de IA Cinemático (GSAP)
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(239,235,227,0.6)', letterSpacing: '0.05em' }}>
            Redacción Erudita (Gemini 3.1 Pro), Dirección Visual & Sincronización de Slug
          </p>
        </div>
      </div>

      {/* Input de Tema */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(239,235,227,0.7)' }}>
            Tema / Título para la IA:
          </label>
          <button
            type="button"
            onClick={() => syncFieldsToKeystaticDOM(tema)}
            style={{
              background: 'none',
              border: 'none',
              color: '#D4AF37',
              fontSize: '11px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0
            }}
          >
            ⚡ Forzar Slug en Keystatic
          </button>
        </div>
        <input
          type="text"
          value={tema}
          onChange={(e) => {
            setTema(e.target.value);
            syncFieldsToKeystaticDOM(e.target.value);
          }}
          placeholder="Ej: El Tapir Sudamericano y las Rutas Andinas..."
          style={{
            width: '100%',
            backgroundColor: '#16171a',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '6px',
            padding: '10px 12px',
            color: '#fff',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Toggles de Sincronización y Opciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {/* Toggle Ambos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="toggleAmbosCine"
            checked={generarAmbos}
            onChange={(e) => setGenerarAmbos(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: '#D4AF37' }}
          />
          <label htmlFor="toggleAmbosCine" style={{ fontSize: '12px', color: 'rgba(239,235,227,0.85)', cursor: 'pointer', userSelect: 'none' }}>
            Generar Escrito + Portada simultáneamente con un solo clic
          </label>
        </div>

        {/* Toggle Excerpt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="toggleExcerptCine"
            checked={syncExcerpt}
            onChange={(e) => {
              setSyncExcerpt(e.target.checked);
              if (e.target.checked && excerptIA) {
                syncFieldsToKeystaticDOM(tema, excerptIA);
              }
            }}
            style={{ cursor: 'pointer', accentColor: '#D4AF37' }}
          />
          <label htmlFor="toggleExcerptCine" style={{ fontSize: '12px', color: 'rgba(239,235,227,0.7)', cursor: 'pointer', userSelect: 'none' }}>
            Autocompletar campo "Excerpt / Resumen" en Keystatic (Opcional)
          </label>
        </div>
      </div>

      {/* Botones de Acción */}
      <div style={{ display: 'grid', gridTemplateColumns: generarAmbos ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        {generarAmbos ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleExecuteCombined}
            style={{
              backgroundColor: isBusy ? '#333' : '#D4AF37',
              color: isBusy ? '#888' : '#0c0d0e',
              border: 'none',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {isBusy ? '⚡ Procesando Ambos...' : '⚡ Generar Escrito + Arte Completo'}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleGenerateText}
              style={{
                backgroundColor: isGeneratingText ? '#1b382b' : '#1e4620',
                color: '#8ef5a4',
                border: '1px solid rgba(142,245,164,0.3)',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {isGeneratingText ? '✍️ Redactando...' : '1. Generar Escrito (Pro)'}
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={handleGenerateArt}
              style={{
                backgroundColor: isGeneratingArt ? '#381c3d' : '#4a154b',
                color: '#e4a1f5',
                border: '1px solid rgba(228,161,245,0.3)',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {isGeneratingArt ? '🎨 Renderizando...' : '2. Generar Portada (Flash)'}
            </button>
          </>
        )}
      </div>

      {/* Notificaciones de Estado */}
      {statusMsg && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          marginBottom: '12px',
          backgroundColor: statusMsg.type === 'error' ? 'rgba(239,68,68,0.15)' : statusMsg.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
          border: `1px solid ${statusMsg.type === 'error' ? 'rgba(239,68,68,0.4)' : statusMsg.type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(59,130,246,0.4)'}`,
          color: statusMsg.type === 'error' ? '#fca5a5' : statusMsg.type === 'success' ? '#86efac' : '#93c5fd'
        }}>
          {statusMsg.text}
        </div>
      )}

      {/* Vista previa de imagen generada */}
      {previewImage && (
        <div style={{ marginTop: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000' }}>
          <img src={previewImage} alt="Arte Generado" style={{ width: '100%', height: 'auto', display: 'block' }} />
          {previewPrompt && (
            <p style={{ padding: '8px 12px', margin: 0, fontSize: '11px', color: 'rgba(239,235,227,0.6)', fontStyle: 'italic' }}>
              Prompt: {previewPrompt}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export const geminiCinematicField = {
  kind: 'form' as const,
  label: 'Asistente IA Cinemático TGP',
  Input: GeneradorCinematicosTGP,
  defaultValue: () => '',
  parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
  serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || '') }),
  validate: (v: any) => v,
  reader: {
    parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
  },
};
