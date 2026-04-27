import React, { useState } from 'react';

// Exportación NOMBRADA para coincidir con la importación en keystatic.config.ts
export function GeneradorTGP() {
  const [tema, setTema] = useState('');
  const [generarImagen, setGenerarImagen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ content: string; imagePath: string | null } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerar = async () => {
    if (!tema) return alert('Por favor, ingresa un tema.');
    
    setLoading(true);
    setErrorMsg(null);
    setResultado(null);

    try {
      // Ya no enviamos "calidad", el backend sabe que debe usar la llave de Pospago.
      const response = await fetch('/api/generar-tgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: tema, generarImagen }),
      });

      const text = await response.text();
      console.log('--- RESPUESTA CRUDA DEL MOTOR TGP ---');
      console.log(text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('La respuesta del servidor no es un JSON válido.');
      }

      if (!response.ok) {
        throw new Error(data.error || `Error del servidor (${response.status})`);
      }

      setResultado(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copiarAlPortapapeles = (texto: string) => {
    if (!navigator.clipboard) {
      alert("Tu navegador no soporta el copiado automático. Por favor, copia el texto manualmente.");
      return;
    }
    navigator.clipboard.writeText(texto).then(() => {
      alert('¡Copiado con éxito!');
    });
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
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#4caf50' }}>✨ Motor Cognitivo TGP</h3>
        <span style={{ fontSize: '0.7rem', color: '#666' }}>v3.0 Pro Stable</span>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Tema del ensayo (ej. El mito de Osiris)..."
          style={{
            width: '100%',
            padding: '10px',
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '0.9rem'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={generarImagen}
            onChange={(e) => setGenerarImagen(e.target.checked)}
          />
          Arte Conceptual (Nano Banana 2)
        </label>
      </div>

      <button
        onClick={handleGenerar}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          background: loading ? '#222' : '#1b5e20',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Procesando análisis...' : '🚀 Iniciar Generación TGP'}
      </button>

      {errorMsg && (
        <div style={{ marginTop: '15px', color: '#ff5252', fontSize: '0.8rem', padding: '10px', background: 'rgba(255,82,82,0.1)', borderRadius: '4px' }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {resultado && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#111', borderRadius: '6px', border: '1px solid #222' }}>
          <p style={{ fontSize: '0.8rem', color: '#4caf50', marginBottom: '8px' }}>✓ Análisis y texto generados con éxito</p>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => copiarAlPortapapeles(resultado.content)}
              style={{ flex: 1, padding: '8px', fontSize: '0.8rem', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
              Copiar Ensayo
            </button>
            {resultado.imagePath && (
              <button
                onClick={() => copiarAlPortapapeles(resultado.imagePath!)}
                style={{ flex: 1, padding: '8px', fontSize: '0.8rem', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}
              >
                Copiar Ruta Imagen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}