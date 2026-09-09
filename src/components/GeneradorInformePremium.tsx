import React, { useState } from 'react';
import { setNativeValue, injectIntoKeystaticDocumentEditor } from './GeneradorGeorreferenciaTGP';

export function GeneradorInformePremium({ value, onChange }: any) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<React.ReactNode | null>(null);
  
  // Toggle para el Modo Piloto Automático
  const [modoPiloto, setModoPiloto] = useState(true);

  const handleGenerate = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Leer el Título
    const tituloInput = document.querySelector<HTMLInputElement>('input[id^="titulo"]');
    const titulo = tituloInput?.value?.trim();

    if (!titulo) {
      setErrorMsg('Debes ingresar al menos el Título del Informe.');
      return;
    }

    let coleccion = 'liminal';
    let fuenteVisual = 'wikimedia';
    let directrices = '';
    let tags: string[] = [];

    // 2. Si es Modo Manual, raspar los campos
    if (!modoPiloto) {
      const directricesInput = document.querySelector<HTMLTextAreaElement>('textarea[id^="directrices"]') || document.querySelector<HTMLTextAreaElement>('textarea[aria-labelledby*="directrices"]');
      directrices = directricesInput?.value?.trim() || '';

      const labels = Array.from(document.querySelectorAll('label'));
      try {
        const coleccionLabel = labels.find(l => l.textContent?.includes('Colección Temática'));
        if (coleccionLabel && coleccionLabel.nextElementSibling) {
          const btn = coleccionLabel.nextElementSibling.querySelector('button');
          if (btn && btn.textContent) {
            const text = btn.textContent.toLowerCase();
            if (text.includes('heterodoxia')) coleccion = 'heterodoxia';
            else if (text.includes('anomalías')) coleccion = 'anomalias';
            else if (text.includes('apócrifa')) coleccion = 'apocrifa';
          }
        }

        const fuenteLabel = labels.find(l => l.textContent?.includes('Motor Gráfico'));
        if (fuenteLabel && fuenteLabel.nextElementSibling) {
          const btn = fuenteLabel.nextElementSibling.querySelector('button');
          if (btn && btn.textContent) {
            const text = btn.textContent.toLowerCase();
            if (text.includes('sintética')) fuenteVisual = 'sintetica';
          }
        }
      } catch (e) {
        console.warn("No se pudieron raspar los selects, usando defaults.");
      }
    }

    setLoading(true);

    try {
      const response = await fetch('/api/generate-premium-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          coleccion: modoPiloto ? undefined : coleccion,
          fuenteVisual: modoPiloto ? undefined : fuenteVisual,
          directrices: modoPiloto ? undefined : directrices,
          tags: modoPiloto ? undefined : [coleccion],
          modoPiloto
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido del servidor');
      }

      // 3. Inyectar metadatos inferidos si vienen del Modo Piloto
      let inferredSummary = null;
      if (data.metadataInferred) {
        const { volanta, coleccion: inferredCol, tags: inferredTags, fuenteVisual: inferredFuente } = data.metadataInferred;
        
        // Inyectar Volanta
        if (volanta) {
          const volantaInput = document.querySelector<HTMLTextAreaElement>('textarea[id^="volanta"]') || 
                               document.querySelector<HTMLInputElement>('input[id^="volanta"]');
          if (volantaInput) setNativeValue(volantaInput, volanta);
        }

        inferredSummary = (
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#cbd5e1' }}>
            <strong>IA infirió:</strong> Colección: <em>{inferredCol}</em> | Fuente: <em>{inferredFuente}</em> | Tags: <em>{inferredTags?.join(', ')}</em>
            <br />
            <span style={{ color: '#f59e0b' }}>⚠️ Nota: Asegúrate de seleccionar "{inferredCol}" en el menú desplegable si Keystatic no lo actualizó automáticamente.</span>
          </div>
        );
      }

      // 4. Inyectar imagen destacada
      if (data.imagenR2Url) {
        const imgInput = document.querySelector<HTMLInputElement>('input[id^="imagenDestacada"]') || 
                         document.querySelector<HTMLInputElement>('input[aria-labelledby*="imagenDestacada"]');
        if (imgInput) {
          setNativeValue(imgInput, data.imagenR2Url);
        }
      }

      // 5. Inyectar el cuerpo Markdown
      if (data.contenido) {
        const cuerpoPuro = data.contenido.replace(/^---[\s\S]+?---\n*/, '');
        injectIntoKeystaticDocumentEditor(cuerpoPuro);
      }

      setSuccessMsg(
        <div>
          ¡Generado con éxito! Se inyectó en el editor.
          {inferredSummary}
        </div>
      );
      onChange({ ranAt: new Date().toISOString() });

    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border: '1px solid #3f3f46',
      borderRadius: '8px',
      padding: '24px',
      background: '#18181b',
      color: '#f4f4f5',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      marginBottom: '32px'
    }}>
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#eab308' }}>
          ✦ Orquestador Cognitivo TGP
        </h3>
        <p style={{ margin: 0, fontSize: '14px', color: '#a1a1aa' }}>
          Este motor generará un ensayo denso delegando el proceso a TGP Mind (Gemini 2.5 Pro).
        </p>
      </div>

      {/* Botones de Toggle de Modo */}
      <div style={{ display: 'flex', gap: '8px', background: '#27272a', padding: '6px', borderRadius: '8px' }}>
        <button
          onClick={() => setModoPiloto(true)}
          style={{
            flex: 1,
            background: modoPiloto ? '#4f46e5' : 'transparent',
            color: modoPiloto ? '#fff' : '#a1a1aa',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: modoPiloto ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          🧠 Cero Fricción (Solo Título)
        </button>
        <button
          onClick={() => setModoPiloto(false)}
          style={{
            flex: 1,
            background: !modoPiloto ? '#4f46e5' : 'transparent',
            color: !modoPiloto ? '#fff' : '#a1a1aa',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: !modoPiloto ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          ⚙️ Manual (Lee todos los campos)
        </button>
      </div>

      <div style={{ fontSize: '13px', color: '#93c5fd', background: '#1e3a8a', padding: '10px', borderRadius: '6px' }}>
        {modoPiloto 
          ? "👉 Instrucción: Escribe el Título abajo. El sistema deducirá automáticamente la Colección, los Tags, la Volanta y la Fuente Visual."
          : "👉 Instrucción: Llena manualmente los campos de abajo (Título, Colección, Motor Gráfico y Directrices) y el motor los respetará estrictamente."}
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          background: loading ? '#52525b' : '#ea580c',
          color: '#fff',
          border: 'none',
          padding: '14px 24px',
          borderRadius: '6px',
          fontSize: '15px',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s'
        }}
      >
        {loading ? 'Generando Informe... (30 - 60s)' : '⚡ Disparar Generación Premium'}
      </button>

      {errorMsg && (
        <div style={{ color: '#ef4444', fontSize: '14px', padding: '12px', background: '#450a0a', borderRadius: '4px' }}>
          ❌ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{ color: '#10b981', fontSize: '14px', padding: '12px', background: '#064e3b', borderRadius: '4px' }}>
          ✓ {successMsg}
        </div>
      )}
    </div>
  );
}
