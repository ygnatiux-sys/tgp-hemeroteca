import React, { useState } from 'react';

export function GeneradorTextoTGP({ value, onChange }: any) {
  const [titulo, setTitulo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  // El estado local se sincroniza con el valor que Keystatic ya tenga guardado
  const [ensayo, setEnsayo] = useState(value || '');

  const handleGenerarTexto = async () => {
    if (!titulo) return alert('Por favor, ingresa un tema para el ensayo.');
    setIsLoading(true);
    setErrorMsg(null);
    setIsPublished(false);

    try {
      const res = await fetch('/api/generar-tgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          titulo: titulo, 
          generarImagen: false 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el motor de texto');

      setEnsayo(data.content);
      onChange(data.content); 

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublicar = () => {
    // Sincronizamos el texto actual con Keystatic
    onChange(ensayo);
    setIsPublished(true);
    setTimeout(() => setIsPublished(false), 4000);
    alert('✅ Informe confirmado.\n\nAhora:\n1. Asegurate de que la imagen de portada esté cargada arriba.\n2. Desactivá el checkbox "Borrador" si querés publicar.\n3. Presioná "Save" en Keystatic para que aparezca en el inicio y el archivo.');
  };

  return (
    <div style={{
      padding: '20px',
      background: '#0a0a0a',
      color: '#e0e0e0',
      borderRadius: '8px',
      border: '1px solid #333',
      fontFamily: 'Inter, system-ui, sans-serif',
      marginTop: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#4caf50' }}>🧠 Motor de Pensamiento TGP</h3>
        <span style={{ fontSize: '0.7rem', color: '#666' }}>Fase 1: Narrativa & Profundidad</span>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="¿Sobre qué quieres reflexionar hoy? (ej. El mito de Sísifo en la era digital)"
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#1a1a1a', 
            border: '1px solid #444', 
            borderRadius: '4px', 
            color: '#fff', 
            marginBottom: '10px',
            fontSize: '0.9rem'
          }}
        />
      </div>

      <button
        type="button"
        onClick={handleGenerarTexto}
        disabled={isLoading || !titulo}
        style={{
          display: 'block',
          width: '100%',
          padding: '16px',
          marginTop: '10px',
          marginBottom: '10px',
          background: (isLoading || !titulo) ? '#333' : '#28a745', 
          color: (isLoading || !titulo) ? '#777' : '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '1rem',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.1em',
          cursor: (isLoading || !titulo) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: (isLoading || !titulo) ? 'none' : '0 4px 6px rgba(40, 167, 69, 0.3)'
        }}
      >
        {isLoading ? 'GENERANDO...' : 'GENERAR TEXTO DEL ENSAYO'}
      </button>

      {errorMsg && (
        <div style={{ color: '#ff5252', fontSize: '0.8rem', padding: '10px', background: 'rgba(255,82,82,0.1)', borderRadius: '4px', border: '1px solid #ff5252', marginBottom: '15px' }}>
          <strong>Error de Conexión:</strong> {errorMsg}
        </div>
      )}

      <div style={{ marginTop: '10px' }}>
        <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '5px' }}>CONTENIDO DEL ENSAYO:</label>
        <textarea
          value={ensayo}
          onChange={(e) => {
            setEnsayo(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="El ensayo aparecerá aquí. También puedes pegar texto manualmente."
          style={{
            width: '100%',
            height: '350px',
            background: '#111',
            color: '#eee',
            border: '1px solid #333',
            padding: '15px',
            fontFamily: 'serif',
            fontSize: '1rem',
            lineHeight: '1.6',
            borderRadius: '4px',
            resize: 'vertical' as const
          }}
        />
      </div>

      {/* ============================================================ */}
      {/* BOTÓN PRINCIPAL: PUBLICAR ENSAYO CON TEXTO + IMAGEN          */}
      {/* ============================================================ */}
      <div style={{ 
        marginTop: '24px', 
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
          📤 PUBLICACIÓN FINAL
        </p>
        <p style={{ 
          margin: '0 0 16px 0', 
          fontSize: '0.8rem', 
          color: '#aaa',
          lineHeight: '1.5'
        }}>
          Cuando el informe esté listo y la <strong style={{ color: '#fff' }}>imagen de portada</strong> esté cargada 
          (manual o generada por el Motor de Arte), presioná este botón y luego <strong style={{ color: '#4caf50' }}>Save</strong> en Keystatic.
          El ensayo aparecerá en el inicio y en el archivo automáticamente.
        </p>

        <button
          type="button"
          onClick={handlePublicar}
          disabled={!ensayo || ensayo.length < 50}
          style={{
            display: 'block',
            width: '100%',
            padding: '20px',
            background: (!ensayo || ensayo.length < 50) 
              ? '#1a1a1a' 
              : isPublished 
                ? 'linear-gradient(135deg, #1a5c1a, #2d8c2d)' 
                : 'linear-gradient(135deg, #1a4d1a, #2d7a2d)',
            color: (!ensayo || ensayo.length < 50) ? '#555' : '#fff',
            border: (!ensayo || ensayo.length < 50) ? '1px solid #333' : '1px solid #4caf50',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '1.1rem',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.15em',
            cursor: (!ensayo || ensayo.length < 50) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: (!ensayo || ensayo.length < 50) ? 'none' : '0 6px 20px rgba(45, 122, 45, 0.4)',
          }}
        >
          {isPublished 
            ? '✅ LISTO — DESACTIVÁ BORRADOR Y PRESIONÁ SAVE' 
            : '🚀 CONFIRMAR INFORME PARA PUBLICACIÓN'}
        </button>

        {ensayo && ensayo.length >= 50 && (
          <p style={{ 
            margin: '10px 0 0 0', 
            fontSize: '0.72rem', 
            color: '#5a9e5a',
            textAlign: 'center' as const
          }}>
            {ensayo.length.toLocaleString()} caracteres · Informe listo
          </p>
        )}
      </div>
    </div>
  );
}

