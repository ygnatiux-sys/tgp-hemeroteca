import React, { useState } from 'react';

export function GeneradorTGP({ value, onChange }: any) {
  const [tema, setTema] = useState('');
  const [generarImagen, setGenerarImagen] = useState(false);
  const [atmosfera, setAtmosfera] = useState('museo');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previsualizacionImagen, setPrevisualizacionImagen] = useState<string | null>(null);

  // El estado local se sincroniza con el valor que Keystatic ya tenga guardado
  const [ensayo, setEnsayo] = useState(value || '');

  const handleGenerar = async () => {
    if (!tema) return alert('Por favor, ingresa un tema.');
    setLoading(true);
    setErrorMsg(null);
    setPrevisualizacionImagen(null);

    try {
      const response = await fetch('/api/generar-tgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: tema, generarImagen, generarTexto: true, atmosfera }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error en el motor');

      // Sincronización Doble: Local y Keystatic
      setEnsayo(data.content);
      onChange(data.content); 
      
      if (data.imagePath) {
        setPrevisualizacionImagen(data.imagePath);
      }
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
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
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#4caf50' }}>✨ Motor Cognitivo TGP</h3>
        <span style={{ fontSize: '0.7rem', color: '#666' }}>v3.1 Pro (Gemini 3.1)</span>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Tema del ensayo..."
          style={{ width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', marginBottom: '10px' }}
        />
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <select 
            value={atmosfera} 
            onChange={(e) => setAtmosfera(e.target.value)}
            style={{ padding: '8px', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '4px', flex: 1 }}
          >
            <option value="museo">Objeto de Museo (Luz dramática)</option>
            <option value="ruinas">Ruinas Históricas (Golden hour)</option>
            <option value="amanecer">Escena Histórica (Niebla/Amanecer)</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={generarImagen} 
              onChange={(e) => setGenerarImagen(e.target.checked)} 
            />
            Generar Arte (Nano Banana)
          </label>
        </div>
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
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {loading ? 'Procesando Motor...' : '🚀 Iniciar Generación TGP'}
      </button>

      {errorMsg && (
        <div style={{ color: '#ff5252', fontSize: '0.8rem', padding: '10px', background: 'rgba(255,82,82,0.1)', borderRadius: '4px', border: '1px solid #ff5252', marginBottom: '15px' }}>
          <strong>Error Crítico:</strong> {errorMsg}
        </div>
      )}

      {ensayo && (
        <div style={{ marginTop: '10px' }}>
          <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '5px' }}>VISTA PREVIA Y EDICIÓN:</label>
          <textarea
            value={ensayo}
            onChange={(e) => {
              setEnsayo(e.target.value);
              onChange(e.target.value);
            }}
            style={{
              width: '100%',
              height: '300px',
              background: '#111',
              color: '#eee',
              border: '1px solid #333',
              padding: '15px',
              fontFamily: 'serif',
              fontSize: '1rem',
              lineHeight: '1.6',
              borderRadius: '4px'
            }}
          />
          
          {previsualizacionImagen && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#111', borderRadius: '4px', border: '1px solid #333' }}>
              <label style={{ fontSize: '0.7rem', color: '#888', display: 'block', marginBottom: '5px' }}>ARTE CONCEPTUAL GENERADO (Nano Banana 2):</label>
              <img 
                src={previsualizacionImagen} 
                alt="Portada Generada" 
                style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #444', marginBottom: '10px' }} 
              />
              <a 
                href={previsualizacionImagen} 
                download="portada-tgp.png"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px',
                  background: '#1b5e20',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  textAlign: 'center',
                  fontSize: '0.8rem'
                }}
              >
                📥 Descargar Portada (PNG)
              </a>
              <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '10px' }}>
                Aviso: Descarga la portada y súbela al campo "Imagen de Portada" más abajo para guardarla en el ensayo.
              </p>
            </div>
          )}

          <p style={{ fontSize: '0.7rem', color: '#4caf50', marginTop: '15px' }}>
            ✓ Texto vinculado. El contenido se guardará al presionar "Save" en Keystatic.
          </p>
        </div>
      )}
    </div>
  );
}