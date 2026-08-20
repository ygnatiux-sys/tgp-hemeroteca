import React, { useState } from 'react';

export interface GeminiCinematicProps {
  value: string;
  onChange: (val: string) => void;
}

export function GeminiCinematicStudio({ value, onChange }: GeminiCinematicProps) {
  const [tema, setTema] = useState('');
  const [generarAmbos, setGenerarAmbos] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);

  // Auto-detectar título desde el campo de título de Keystatic si no se ha escrito manualmente
  const getEffectiveTopic = (): string => {
    if (tema.trim()) return tema.trim();
    if (typeof document !== 'undefined') {
      const titleInput = document.querySelector<HTMLInputElement>('input[name="title"], input[id^="title"]');
      if (titleInput && titleInput.value.trim()) return titleInput.value.trim();
    }
    return '';
  };

  // 1. Generar Escrito / Texto con Gemini 3.1 Pro
  const handleGenerateText = async (): Promise<string | null> => {
    const topic = getEffectiveTopic();
    if (!topic) {
      setStatusMsg({ type: 'error', text: 'Por favor, ingresa un título o tema para el ensayo.' });
      return null;
    }

    setIsGeneratingText(true);
    setStatusMsg({ type: 'info', text: 'Generando investigación y ensayo cinemático con Gemini 3.1 Pro...' });

    try {
      const res = await fetch('/api/generar-tgp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: topic, generarImagen: false })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar texto');

      const content = data.content || '';
      onChange(content);
      setStatusMsg({ type: 'success', text: '✅ Ensayo generado y sincronizado exitosamente.' });
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
        setStatusMsg({ type: 'success', text: '✅ Imagen cinemática materializada exitosamente.' });
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

  // 3. Generar Ambos Juntos (si el toggle está activo)
  const handleExecuteCombined = async () => {
    setStatusMsg(null);
    if (generarAmbos) {
      await handleGenerateText();
      await handleGenerateArt();
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
            Redacción Erudita (Gemini 3.1 Pro) & Dirección Visual (Flash Image)
          </p>
        </div>
      </div>

      {/* Input de Tema */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(239,235,227,0.7)', marginBottom: '6px' }}>
          Tema / Título para la IA (Opcional, detecta el título automáticamente):
        </label>
        <input
          type="text"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
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

      {/* Toggle para Generar Ambos Juntos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          id="toggleAmbos"
          checked={generarAmbos}
          onChange={(e) => setGenerarAmbos(e.target.checked)}
          style={{ cursor: 'pointer', accentColor: '#D4AF37' }}
        />
        <label htmlFor="toggleAmbos" style={{ fontSize: '12px', color: 'rgba(239,235,227,0.85)', cursor: 'pointer', userSelect: 'none' }}>
          Generar Escrito + Portada simultáneamente con un solo clic
        </label>
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

/**
 * Campo Keystatic aislado y tipado para Ensayos Cinemáticos
 */
export const geminiCinematicField = {
  kind: 'form' as const,
  label: 'Asistente IA Cinemático TGP',
  Input: GeminiCinematicStudio,
  defaultValue: () => '',
  parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
  serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || '') }),
  validate: (v: any) => v,
  reader: {
    parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
  },
};
