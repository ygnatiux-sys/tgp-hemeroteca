import React, { useState, useEffect } from 'react';

export function GeneradorTextoTGP({ value, onChange }: any) {
  const [titulo, setTitulo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // El estado local se sincroniza con el valor que Keystatic ya tenga guardado
  const [ensayo, setEnsayo] = useState(value || '');



  const handleGenerarTexto = async () => {
    if (!titulo) return alert('Por favor, ingresa un tema para el ensayo.');
    setIsLoading(true);
    setErrorMsg(null);

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

      {/* --- INICIO INYECCIÓN EXPLÍCITA DE BOTÓN DE ACCIÓN --- */}
      <button
        type="button"
        onClick={handleGenerarTexto} // Asegúrate de usar la función correcta para texto
        disabled={isLoading || !titulo}
        style={{
          display: 'block',
          width: '100%',
          padding: '16px',
          marginTop: '20px',
          marginBottom: '20px',
          // Colores de ALTO CONTRASTE (Verde brillante si está activo, Gris oscuro si está deshabilitado)
          background: (isLoading || !titulo) ? '#333' : '#28a745', 
          color: (isLoading || !titulo) ? '#777' : '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          cursor: (isLoading || !titulo) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: (isLoading || !titulo) ? 'none' : '0 4px 6px rgba(40, 167, 69, 0.3)'
        }}
      >
        {isLoading ? 'GENERANDO...' : 'GENERAR TEXTO DEL ENSAYO'}
      </button>
      {/* --- FIN INYECCIÓN EXPLÍCITA DE BOTÓN DE ACCIÓN --- */}

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
          placeholder="El ensayo aparecerá aquí..."
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
            resize: 'vertical'
          }}
        />
      </div>
    </div>
  );
}

