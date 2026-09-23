import React, { useState } from 'react';
import { PRESETS_ARTE, type EditorialPreset, type LineaEditorialKey } from '../config/presetsArte';

export interface ProbadorArteData {
  conceptoBase: string;
  sujetoIA: string;
  lineaEditorial: LineaEditorialKey;
  usarManuales: boolean;
  overrideCamara: string;
  overrideIluminacion: string;
  overrideColor: string;
  imagenBase64?: string;
  // Campos legacy para retrocompatibilidad
  camara?: string;
  iluminacion?: string;
  color?: string;
  estetica?: string;
}

export function ProbadorArteTGP({ value, onChange }: { value: any; onChange: (val: ProbadorArteData) => void }) {
  const [loadingSujeto, setLoadingSujeto] = useState(false);
  const [loadingImagen, setLoadingImagen] = useState(false);
  const [error, setError] = useState('');

  // Estado inicial normalizado con fallbacks
  const data: ProbadorArteData = {
    conceptoBase: value?.conceptoBase || '',
    sujetoIA: value?.sujetoIA || '',
    lineaEditorial: (value?.lineaEditorial in PRESETS_ARTE) ? value.lineaEditorial : 'archivo-museo',
    usarManuales: Boolean(value?.usarManuales),
    overrideCamara: value?.overrideCamara || value?.camara || '',
    overrideIluminacion: value?.overrideIluminacion || value?.iluminacion || '',
    overrideColor: value?.overrideColor || value?.color || '',
    imagenBase64: value?.imagenBase64 || '',
  };

  const currentPreset: EditorialPreset = PRESETS_ARTE[data.lineaEditorial] || PRESETS_ARTE['archivo-museo'];

  // Técnica efectiva (Preset o Overrides Manuales)
  const efectivaCamara = data.usarManuales ? data.overrideCamara : currentPreset.camara;
  const efectivaIluminacion = data.usarManuales ? data.overrideIluminacion : currentPreset.iluminacion;
  const efectivaColor = data.usarManuales ? data.overrideColor : currentPreset.color;

  const handleChange = (field: keyof ProbadorArteData, val: any) => {
    onChange({ ...data, [field]: val });
  };

  // 1. Generación de Sujeto mediante Gemini (/api/generar-sujeto)
  const handleGenerateSujeto = async () => {
    if (!data.conceptoBase.trim()) return;
    setLoadingSujeto(true);
    setError('');

    try {
      const response = await fetch('/api/generar-sujeto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conceptoBase: data.conceptoBase }),
      });

      const result = await response.json();
      if (result.success && result.sujetoIA) {
        handleChange('sujetoIA', result.sujetoIA);
      } else {
        setError(result.error || 'Error al generar sujeto en inglés con Gemini');
      }
    } catch (err) {
      setError('Error de conexión al endpoint /api/generar-sujeto');
    } finally {
      setLoadingSujeto(false);
    }
  };

  // 2. Concatenación Estricta: [sujetoIA] + [Camara] + [Iluminacion] + [Color]
  const buildFinalPrompt = (): string => {
    const sujeto = data.sujetoIA.trim() || data.conceptoBase.trim();
    const camara = efectivaCamara.trim();
    const iluminacion = efectivaIluminacion.trim();
    const color = efectivaColor.trim();

    return [sujeto, camara, iluminacion, color].filter(Boolean).join(' ');
  };

  // 3. Generación de Imagen Definitiva
  const handleGenerateImagen = async () => {
    setLoadingImagen(true);
    setError('');

    const promptCombinado = buildFinalPrompt();

    try {
      const response = await fetch('/api/generar-arte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: promptCombinado,
          mode: 'manual',
        }),
      });

      const result = await response.json();

      if (result.success && result.image) {
        onChange({ ...data, imagenBase64: result.image });
      } else {
        setError(result.error || 'Error al generar la imagen.');
      }
    } catch (err) {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoadingImagen(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    marginBottom: '14px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #333',
    borderRadius: '4px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const readOnlyStyle: React.CSSProperties = {
    ...inputStyle,
    backgroundColor: '#111827',
    color: '#9ca3af',
    border: '1px solid #1f2937',
    cursor: 'not-allowed',
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#242424', borderRadius: '8px', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* SECCIÓN 1: SUJETO (CONCEPTO + GEMINI) */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #333' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#60a5fa', fontSize: '1.2em' }}>
          Motor Nano Banana (Modelo Sujeto + Envoltorio)
        </h3>

        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '0.95em' }}>
          1. Concepto Base (Español)
        </label>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <textarea 
            rows={2} 
            style={{ ...inputStyle, marginBottom: 0, flex: 1, borderColor: '#4b5563' }} 
            value={data.conceptoBase} 
            onChange={(e) => handleChange('conceptoBase', e.target.value)} 
            placeholder="Ej: Una vasija de obsidiana maya con inscripciones jeroglíficas..." 
          />
          <button
            type="button"
            onClick={handleGenerateSujeto}
            disabled={loadingSujeto || !data.conceptoBase.trim()}
            style={{
              padding: '0 16px',
              backgroundColor: loadingSujeto || !data.conceptoBase.trim() ? '#374151' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: loadingSujeto || !data.conceptoBase.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              fontSize: '0.9em',
            }}
          >
            {loadingSujeto ? 'Traduciendo...' : 'Generar Sujeto (IA)'}
          </button>
        </div>

        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '0.95em' }}>
          2. Sujeto IA aislado (Inglés Descriptivo)
        </label>
        <textarea 
          rows={2} 
          style={{ ...inputStyle, borderColor: data.sujetoIA ? '#10b981' : '#333' }} 
          value={data.sujetoIA} 
          onChange={(e) => handleChange('sujetoIA', e.target.value)} 
          placeholder="A Mayan obsidian vessel with sharp hand-carved hieroglyphs on its polished dark surface..." 
        />
      </div>

      {/* SECCIÓN 2: TÉCNICA (PRESET VS OVERRIDES) */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #333' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '0.95em' }}>
          3. Línea Editorial (Preset Fotográfico)
        </label>
        <select 
          style={{ ...inputStyle, cursor: 'pointer' }} 
          value={data.lineaEditorial} 
          onChange={(e) => handleChange('lineaEditorial', e.target.value as LineaEditorialKey)}
        >
          {Object.entries(PRESETS_ARTE).map(([key, preset]) => (
            <option key={key} value={key}>{preset.label}</option>
          ))}
        </select>

        {/* Toggle Overrides Manuales */}
        <div style={{ marginTop: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox"
            id="toggle-manuales"
            checked={data.usarManuales}
            onChange={(e) => handleChange('usarManuales', e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="toggle-manuales" style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9em', color: data.usarManuales ? '#f59e0b' : '#9ca3af' }}>
            Activar Overrides Manuales (Modo Granular de Excepciones)
          </label>
        </div>

        {/* Campos de Técnica */}
        <div style={{ padding: '16px', backgroundColor: '#1a1a1a', borderRadius: '6px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#9ca3af' }}>
            Cámara y Óptica {data.usarManuales && <span style={{ color: '#f59e0b' }}>(Anulación Manual)</span>}
          </label>
          {data.usarManuales ? (
            <textarea 
              rows={2} 
              style={inputStyle} 
              value={data.overrideCamara} 
              onChange={(e) => handleChange('overrideCamara', e.target.value)}
              placeholder={currentPreset.camara}
            />
          ) : (
            <textarea rows={2} style={readOnlyStyle} value={currentPreset.camara} readOnly />
          )}

          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#9ca3af' }}>
            Esquema de Iluminación {data.usarManuales && <span style={{ color: '#f59e0b' }}>(Anulación Manual)</span>}
          </label>
          {data.usarManuales ? (
            <textarea 
              rows={2} 
              style={inputStyle} 
              value={data.overrideIluminacion} 
              onChange={(e) => handleChange('overrideIluminacion', e.target.value)}
              placeholder={currentPreset.iluminacion}
            />
          ) : (
            <textarea rows={2} style={readOnlyStyle} value={currentPreset.iluminacion} readOnly />
          )}

          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#9ca3af' }}>
            Etalonaje y Color {data.usarManuales && <span style={{ color: '#f59e0b' }}>(Anulación Manual)</span>}
          </label>
          {data.usarManuales ? (
            <textarea 
              rows={2} 
              style={inputStyle} 
              value={data.overrideColor} 
              onChange={(e) => handleChange('overrideColor', e.target.value)}
              placeholder={currentPreset.color}
            />
          ) : (
            <textarea rows={2} style={readOnlyStyle} value={currentPreset.color} readOnly />
          )}
        </div>
      </div>

      {/* PROMPT CONCATENADO PREVIEW */}
      <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#111827', border: '1px border #1f2937', borderRadius: '6px' }}>
        <span style={{ fontSize: '0.75em', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>
          Prompt Final Concatenado ([SujetoIA] + [Camara] + [Iluminacion] + [Color]):
        </span>
        <code style={{ fontSize: '0.85em', color: '#34d399', wordBreak: 'break-word' }}>
          {buildFinalPrompt() || '(Ingresa un concepto base para ver el prompt ensamblado...)'}
        </code>
      </div>

      {/* BOTÓN GENERAR IMAGEN */}
      <button 
        type="button"
        onClick={handleGenerateImagen} 
        disabled={loadingImagen || (!data.conceptoBase && !data.sujetoIA)}
        style={{
          width: '100%', 
          padding: '14px', 
          cursor: loadingImagen || (!data.conceptoBase && !data.sujetoIA) ? 'not-allowed' : 'pointer',
          backgroundColor: loadingImagen ? '#444' : ((data.conceptoBase || data.sujetoIA) ? '#2563eb' : '#374151'), 
          color: 'white', 
          border: 'none', 
          borderRadius: '6px', 
          fontWeight: 'bold', 
          fontSize: '1.05em',
          transition: 'background-color 0.2s',
        }}
      >
        {loadingImagen ? 'Generando imagen en Nano Banana...' : 'Generar Previsualización Definitiva'}
      </button>

      {error && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#7f1d1d', borderRadius: '4px', color: 'white', fontSize: '0.9em' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {data.imagenBase64 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ marginBottom: '12px', color: '#9ca3af', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
            VISTA PREVIA DEL ESTILO:
          </h4>
          <img 
            src={data.imagenBase64} 
            alt="Preview" 
            style={{ width: '100%', borderRadius: '8px', border: '1px solid #444', marginBottom: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} 
          />
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
              transition: 'background-color 0.2s',
            }}
          >
            Descargar a mi equipo
          </a>
        </div>
      )}
    </div>
  );
}
