import React, { useState, useEffect } from 'react';

export function MotorArteTGP({ value, onChange }: any) {
  const [tema, setTema] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previsualizacionImagen, setPrevisualizacionImagen] = useState<string | null>(null);
  const [promptAplicado, setPromptAplicado] = useState<string | null>(null);
  const [estilo, setEstilo] = useState('editorial');
  
  const [arteMetadata, setArteMetadata] = useState(value || '');


  const handleMaterializarArte = async () => {
    if (!tema) return alert('Por favor, ingresa el concepto visual o título del ensayo.');
    if (!atmosfera) return alert('No hay estilos disponibles.');

    setLoading(true);
    setErrorMsg(null);
    setPrevisualizacionImagen(null);
    setPromptAplicado(null);

    try {
      const res = await fetch('/api/generar-tgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          titulo: tema, 
          generarImagen: true, 
          estilo 
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.imageUrl) {
        setPrevisualizacionImagen(data.imageUrl);
        setPromptAplicado(data.imagePrompt);
        setArteMetadata(data.imagePrompt);
        onChange(data.imagePrompt);
      } else {
        if (data.imagePrompt) {
          setPromptAplicado(data.imagePrompt);
          setArteMetadata(data.imagePrompt);
          onChange(data.imagePrompt);
        }
        throw new Error(data.error || 'Nano Banana 2 no pudo materializar el arte.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '24px',
      background: '#080808',
      color: '#fff',
      borderRadius: '12px',
      border: '1px solid #1a1a1a',
      fontFamily: '"Inter", system-ui, sans-serif',
      marginTop: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.05em', color: '#ffca28', textTransform: 'uppercase' }}>
          Dirección de Arte Dinámica
        </h3>
        <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700 }}>MODULAR IA v3.5</span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Título o Concepto Clave..."
          style={{ 
            width: '100%', 
            padding: '14px', 
            background: '#111', 
            border: '1px solid #222', 
            borderRadius: '6px', 
            color: '#fff', 
            marginBottom: '12px',
            fontSize: '0.95rem',
            outline: 'none'
          }}
        />
        
        <select 
          id="estilo_visual" 
          name="estilo_visual" 
          value={estilo} 
          onChange={(e) => setEstilo(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#111', 
            border: '1px solid #222', 
            color: '#fff', 
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            appearance: 'none'
          }}
        >
          <option value="editorial">Editorial de Reliquia (Objetos/Museo)</option>
          <option value="cine">Cine de Expedición (Ruinas/Paisajes)</option>
          <option value="concepto">Concepto Filosófico (Abstracción)</option>
        </select>
      </div>

      <button
        onClick={handleMaterializarArte}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px',
          background: loading ? '#1a1a1a' : '#fff',
          color: loading ? '#444' : '#000',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '20px',
          transition: 'all 0.3s ease',
          fontSize: '0.85rem'
        }}
      >
        {loading ? 'Ensamblando Prompt...' : 'Materializar con Estilo Dinámico'}
      </button>

      {errorMsg && (
        <div style={{ color: '#ff5252', fontSize: '0.75rem', padding: '12px', background: 'rgba(255,82,82,0.05)', borderRadius: '6px', border: '1px solid rgba(255,82,82,0.2)', marginBottom: '20px' }}>
          {errorMsg}
        </div>
      )}

      {previsualizacionImagen && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #222' }}>
            <img src={previsualizacionImagen} alt="Arte Materializado" style={{ width: '100%', display: 'block' }} />
          </div>
          
          {promptAplicado && (
            <div style={{ marginTop: '20px', padding: '16px', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #1a1a1a' }}>
              <label style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Prompt Ensamblado por Capas
              </label>
              <p style={{ fontSize: '0.8rem', color: '#888', margin: 0, lineHeight: '1.5' }}>
                {promptAplicado}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
