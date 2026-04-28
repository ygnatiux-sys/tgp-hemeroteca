import React, { useState } from 'react';

const directricesVisuales: Record<string, any> = {
  "personalizado": {
    label: "✨ Estilo Personalizado (Manual)",
    contexto: "",
    camara: "",
    iluminacion: "",
    etalonaje: ""
  },
  "dark-academia": {
    label: "📚 Dark Academia (Investigación)",
    contexto: "rodeado de libros con encuadernación de cuero gastado, compases de bronce, mapas antiguos esparcidos. Atmósfera de investigación profunda.",
    camara: "Fotografía de formato medio, lente 50mm, enfoque preciso, ligera viñeta óptica, profundidad de campo reducida f/2.8",
    iluminacion: "Claroscuro intenso, luz cálida direccional imitando lámpara de queroseno, sombras dramáticas",
    etalonaje: "Estilo Dark Academia, paleta desaturada, tonos ámbar y sepia, negros densos, grano fotográfico antiguo"
  },
  "victorian-archeo": {
    label: "🏛️ Victorian Archeo",
    contexto: "rodeado de libros con encuadernación de cuero gastado, compases de bronce, mapas antiguos esparcidos. Atmósfera de investigación profunda.",
    camara: "Fotografía de formato medio, lente 50mm, enfoque preciso, ligera viñeta óptica, profundidad de campo reducida f/2.8",
    iluminacion: "Claroscuro intenso, luz cálida direccional imitando lámpara de queroseno, sombras dramáticas",
    etalonaje: "Estilo Dark Academia, paleta desaturada, tonos ámbar y sepia, negros densos, grano fotográfico antiguo"
  },
  "travel-senses": {
    label: "🌍 Travel & Senses (Descubrimiento)",
    contexto: "personas a lo lejos dando escala humana. Sensación de descubrimiento e inmersión en el entorno natural.",
    camara: "Fotografía analógica 35mm, estilo documental fotoperiodístico, lente gran angular 24mm",
    iluminacion: "Luz natural de Golden Hour, luz solar rasante, contraste orgánico",
    etalonaje: "Estética de película Kodachrome vintage, colores ricos, amarillos cálidos, verdes profundos"
  },
  "italian-interiors": {
    label: "🍷 Italian Interiors (Sofisticación)",
    contexto: "arquitectura renacentista de fondo, frescos desgastados, textiles de terciopelo, mármol. Ambiente clásico y opulento.",
    camara: "Fotografía de interiores arquitectónica, lente 35mm f/4, nitidez impecable, composición simétrica",
    iluminacion: "Luz difusa de ventanal, iluminación suave y envolvente, reflejos sutiles",
    etalonaje: "Tonos cálidos de terracota y verde oliva, contraste moderado, colores ricos y pictóricos"
  },
  "cine": {
    label: "🎬 Cine (Cinematográfico)",
    contexto: "Hyper-realistic historical setting, breathtaking depth of field, solemn and immersive environment, authentic historical grit.",
    camara: "Cinematic wide establishing sequence, 1970s Panavision anamorphic lens, filmed on Arri Alexa 65.",
    iluminacion: "Practical firelight mixed with cool ambient moonlight (dual color lighting), long dramatic shadows.",
    etalonaje: "Kodak Vision3 500T film stock, visceral muddy textures, subtle chromatic aberration at the edges, anamorphic blue lens flare."
  },
  "concepto": {
    label: "🧠 Concepto (Metáfora Visual)",
    contexto: "Visual metaphor, philosophical weight, hyper-detailed conceptual environment, monumental atmosphere, sharp focus on symbolic elements.",
    camara: "Avant-garde cinematic surrealism, medium format portrait orientation.",
    iluminacion: "Volumetric lighting piercing through ethereal geometric fog, deep dramatic contrast.",
    etalonaje: "Bleach bypass film process look (desaturated but high contrast), solemn muted tones, earthy monochrome spectrum."
  },
  "editorial": {
    label: "📰 Editorial (Fotoperiodismo de Lujo)",
    contexto: "Photorealistic museum archival quality, tack sharp focus on weathered ancient textures, pitch-black muted background, tactile material realism.",
    camara: "High-end editorial still life macro cinematography, Leica 100mm f/2.8 lens.",
    iluminacion: "Striking Chiaroscuro lighting, subtle Gobo shadow (pattern of an ancient window) cast over the subject, suspended dust particles illuminated by the light beam.",
    etalonaje: "Dark Academia color palette, Vogue aesthetic, 35mm film grain, subtle halation around highlights."
  }
};

export function ProbadorArteTGP({ value, onChange }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Inicializamos el estado con los nuevos campos
  const data = value || { 
    conceptoBase: '', 
    lineaEditorial: 'personalizado', 
    camara: '', 
    iluminacion: '', 
    color: '', 
    estetica: '', 
    imagenBase64: '' 
  };

  const handleChange = (field: string, text: string) => {
    onChange({ ...data, [field]: text });
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    const directriz = directricesVisuales[selected];
    
    onChange({ 
      ...data, 
      lineaEditorial: selected,
      estetica: directriz.contexto,
      camara: directriz.camara,
      iluminacion: directriz.iluminacion,
      color: directriz.etalonaje
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    
    // El Super Prompt interceptado
    const promptCombinado = `Sujeto principal: ${data.conceptoBase}. Entorno: ${data.estetica}. Dirección de cámara: ${data.camara}. Iluminación: ${data.iluminacion}. Postproducción: ${data.color}.`;

    try {
      const response = await fetch('/api/generar-arte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptCombinado })
      });

      const result = await response.json();

      if (result.success) {
        onChange({ ...data, imagenBase64: result.image });
      } else {
        setError(result.error || 'Error desconocido al generar la imagen');
      }
    } catch (err) {
      setError('Error de conexión con el endpoint de Astro.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px', marginBottom: '16px', 
    backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px', boxSizing: 'border-box' as const
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#242424', borderRadius: '8px', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif' }}>
      
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #333' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#60a5fa' }}>🧠 Director de Arte Automático</h3>
        
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>1. Concepto Base</label>
        <textarea 
          rows={2} 
          style={{...inputStyle, fontSize: '1.1em', borderColor: '#4b5563'}} 
          value={data.conceptoBase || ''} 
          onChange={(e) => handleChange('conceptoBase', e.target.value)} 
          placeholder="Ej: Una estela grabada en piedra basalto..." 
        />

        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>2. Línea Editorial (Presets)</label>
        <select 
          style={{...inputStyle, cursor: 'pointer'}} 
          value={data.lineaEditorial || 'personalizado'} 
          onChange={handleStyleChange}
        >
          {Object.entries(directricesVisuales).map(([key, styleData]) => (
            <option key={key} value={key}>{styleData.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ 
            background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', 
            padding: 0, fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '6px' 
          }}
        >
          {showAdvanced ? '🔽 Ocultar ajustes granulares (Excepciones)' : '▶️ Mostrar ajustes granulares (Excepciones)'}
        </button>
      </div>

      {showAdvanced && (
        <div style={{ padding: '16px', backgroundColor: '#1f1f1f', borderRadius: '6px', marginBottom: '20px' }}>
          <p style={{ fontSize: '0.85em', color: '#9ca3af', marginTop: 0, marginBottom: '16px' }}>
            Estos campos se autocompletan al elegir una línea editorial, pero puedes modificarlos libremente para excepciones puntuales.
          </p>
          
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Entorno / Contexto</label>
          <textarea rows={2} style={inputStyle} value={data.estetica} onChange={(e) => handleChange('estetica', e.target.value)} />

          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Cámara y Óptica</label>
          <textarea rows={2} style={inputStyle} value={data.camara} onChange={(e) => handleChange('camara', e.target.value)} />

          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Esquema de Iluminación</label>
          <textarea rows={2} style={inputStyle} value={data.iluminacion} onChange={(e) => handleChange('iluminacion', e.target.value)} />

          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9em' }}>Etalonaje y Color</label>
          <textarea rows={2} style={inputStyle} value={data.color} onChange={(e) => handleChange('color', e.target.value)} />
        </div>
      )}

      <button 
        onClick={handleGenerate} 
        disabled={loading || !data.conceptoBase}
        style={{
          width: '100%', padding: '14px', marginTop: '8px', cursor: loading || !data.conceptoBase ? 'not-allowed' : 'pointer',
          backgroundColor: loading ? '#444' : (data.conceptoBase ? '#2563eb' : '#374151'), 
          color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '1.05em',
          transition: 'background-color 0.2s'
        }}
      >
        {loading ? '🎨 Ensamblando imagen en Nano Banana...' : '🚀 Generar Previsualización Definitiva'}
      </button>

      {error && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#7f1d1d', borderRadius: '4px', color: 'white' }}>
          <strong>Error Crítico:</strong> {error}
        </div>
      )}

      {data.imagenBase64 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ marginBottom: '12px', color: '#9ca3af', borderBottom: '1px solid #333', paddingBottom: '8px' }}>VISTA PREVIA DEL ESTILO:</h4>
          <img src={data.imagenBase64} alt="Preview" style={{ width: '100%', borderRadius: '8px', border: '1px solid #444', marginBottom: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} />
          <a
            href={data.imagenBase64}
            download={`estilo-tgp-${data.conceptoBase ? data.conceptoBase.slice(0, 15).replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'generado'}.jpg`}
            style={{
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              width: '100%', 
              padding: '12px', 
              boxSizing: 'border-box',
              backgroundColor: '#10b981', 
              color: 'white', 
              borderRadius: '6px', 
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
          >
            ⬇️ Descargar a mi equipo
          </a>
        </div>
      )}
    </div>
  );
}
