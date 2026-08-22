import React, { useState, useRef } from 'react';

/**
 * AgenteEruditoTGP — Keystatic Custom Field Component
 *
 * Botón global "Agente Erudito Académico" que aparece en todas las
 * colecciones de TGP excepto Dirección de Arte (IA).
 *
 * Modos:
 *   - 'divulgativo'  → ERUDITO_DIVULGATIVO_PROMPT (voz Sagan)
 *   - 'academico'    → AGENTE_ERUDITO_ACADEMICO_PROMPT (formateador Markdown)
 *
 * El componente acepta el texto actual del campo `generadorTexto` (vía `value`)
 * y devuelve el texto procesado / generado al campo vía `onChange`.
 */

export function AgenteEruditoTGP({ value, onChange }: any) {
  const [modo, setModo] = useState<'divulgativo' | 'academico'>('divulgativo');
  const [tituloHint, setTituloHint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Detectar título del post desde el DOM de Keystatic
  const detectTitle = (): string => {
    if (tituloHint.trim()) return tituloHint.trim();
    const titleInput = document.querySelector<HTMLInputElement>(
      'input[name="title"], input[id^="title"], input[placeholder*="título"], input[placeholder*="Título"]'
    );
    return titleInput?.value?.trim() || '';
  };

  const handleRun = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const titulo = detectTitle();
    const textoActual = typeof value === 'string' ? value : (value?.value || '');

    // En modo académico necesitamos texto a reformatear
    if (modo === 'academico' && !textoActual.trim()) {
      setErrorMsg('Primero genera el texto con el motor principal para que el Agente Erudito lo formatee.');
      return;
    }

    setIsLoading(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/agente-erudito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo, titulo, textoActual }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.content) throw new Error('El agente no devolvió contenido.');

      onChange(data.content);
      setSuccessMsg(modo === 'divulgativo'
        ? '✦ Ensayo divulgativo generado. Revisa el Motor de Pensamiento.'
        : '✦ Texto reformateado con estándar académico TGP.'
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg(`Error del Agente Erudito: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsLoading(false);
    setErrorMsg('Generación cancelada.');
  };

  const baseBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '9px 18px', borderRadius: '8px', border: 'none',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.2s ease', letterSpacing: '0.02em',
    fontFamily: 'system-ui, sans-serif',
  };

  const primaryBtn: React.CSSProperties = {
    ...baseBtn,
    background: isLoading
      ? 'linear-gradient(135deg, #5c4a2a 0%, #7a6035 100%)'
      : 'linear-gradient(135deg, #C9A86C 0%, #a8844a 100%)',
    color: '#0a0a0c',
    opacity: isLoading ? 0.75 : 1,
    boxShadow: isLoading ? 'none' : '0 2px 12px rgba(201,168,108,0.35)',
  };

  const cancelBtn: React.CSSProperties = {
    ...baseBtn,
    background: 'rgba(255,80,80,0.12)',
    color: '#ff5050',
    border: '1px solid rgba(255,80,80,0.3)',
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    ...baseBtn,
    padding: '6px 14px',
    background: active ? 'rgba(201,168,108,0.18)' : 'transparent',
    color: active ? '#C9A86C' : '#888',
    border: `1px solid ${active ? 'rgba(201,168,108,0.45)' : 'rgba(255,255,255,0.1)'}`,
    fontSize: '12px',
  });

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(135deg, #0f0e0b 0%, #1a1710 100%)',
      border: '1px solid rgba(201,168,108,0.25)',
      borderRadius: '12px',
      padding: '20px 22px',
      marginTop: '8px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '18px' }}>✦</span>
        <div>
          <div style={{ color: '#C9A86C', fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em' }}>
            AGENTE ERUDITO ACADÉMICO
          </div>
          <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>
            Motor de prosa magistral · Erudición cálida TGP
          </div>
        </div>
      </div>

      {/* Selector de modo */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button style={tabBtn(modo === 'divulgativo')} onClick={() => setModo('divulgativo')}>
          📜 Divulgativo (Sagan)
        </button>
        <button style={tabBtn(modo === 'academico')} onClick={() => setModo('academico')}>
          🔬 Formateador Académico
        </button>
      </div>

      {/* Descripción del modo */}
      <div style={{
        background: 'rgba(201,168,108,0.06)',
        border: '1px solid rgba(201,168,108,0.15)',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '14px',
        fontSize: '12px',
        color: '#aaa',
        lineHeight: '1.6',
      }}>
        {modo === 'divulgativo'
          ? '📜 Genera un ensayo de nueva planta sobre el título detectado, con voz erudita y cálida (estilo Carl Sagan). El texto se cargará en el campo de contenido.'
          : '🔬 Reformatea el texto existente con Markdown impecable: doble espaciado, negritas selectivas, citas, listas de bibliografía y prosa sobria sin metacomentarios de IA.'
        }
      </div>

      {/* Input de título opcional */}
      {modo === 'divulgativo' && (
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Título o arquetipo (opcional — se detecta automáticamente)
          </label>
          <input
            type="text"
            value={tituloHint}
            onChange={e => setTituloHint(e.target.value)}
            placeholder="Ej: El Laberinto, Jung y el Inconsciente, La Torre de Babel..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '7px', padding: '9px 12px',
              color: '#e8e0d0', fontSize: '13px', outline: 'none',
            }}
          />
        </div>
      )}

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {!isLoading ? (
          <button style={primaryBtn} onClick={handleRun}>
            ✦ Usar Agente Erudito Académico
          </button>
        ) : (
          <>
            <button style={{ ...primaryBtn, cursor: 'not-allowed' }} disabled>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              {modo === 'divulgativo' ? 'Generando ensayo...' : 'Reformateando...'}
            </button>
            <button style={cancelBtn} onClick={handleCancel}>✕ Cancelar</button>
          </>
        )}
      </div>

      {/* Mensajes de estado */}
      {errorMsg && (
        <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: '8px', color: '#ff6b6b', fontSize: '12px' }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(201,168,108,0.08)', border: '1px solid rgba(201,168,108,0.25)', borderRadius: '8px', color: '#C9A86C', fontSize: '12px' }}>
          {successMsg}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}