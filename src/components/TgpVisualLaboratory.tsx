import React, { useState } from 'react';

export function TgpVisualLaboratory() {
  const [imagenBase, setImagenBase] = useState<File | null>(null);
  const [imagenProcesada, setImagenProcesada] = useState<string | null>(null);
  const [estado, setEstado] = useState<string>("esperando");
  const [estadoR2, setEstadoR2] = useState<"idle" | "subiendo" | "exito" | "error">("idle");
  const [r2Url, setR2Url] = useState<string | null>(null);
  const [r2Folder, setR2Folder] = useState<string>("laboratorio-visual");
  const [copiado, setCopiado] = useState<boolean>(false);

  // Función de Google Picker (requiere gapi.load / OAuth)
  const abrirGooglePicker = () => {
    console.log("Iniciando Google Picker para Drive/Photos...");
    // Fallback directo a selector de archivos local
    document.getElementById('file-upload-fallback')?.click();
  };

  const handleFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImagenBase(e.target.files[0]);
      setImagenProcesada(null);
      setR2Url(null);
      setEstadoR2("idle");
    }
  };

  const procesarEnCloud = async (modo: string) => {
    setEstado("procesando");
    setEstadoR2("idle");
    setR2Url(null);

    const formData = new FormData();
    if (imagenBase) formData.append('file', imagenBase);
    formData.append('mode', modo);

    try {
      const endpoint = import.meta.env.TGP_CLOUD_RUN_URL || 'http://localhost:8080/process-image';
      const token = import.meta.env.TGP_API_TOKEN || 'token-desarrollo';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'x-api-token': token },
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Error en Cloud Run: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setImagenProcesada(data.data_uri);
      setEstado("completado");
    } catch (error) {
      console.error("Error al procesar:", error);
      alert("Error al conectar con Cloud Run. Ver consola.");
      setEstado("esperando");
    }
  };

  const inyectarEnR2 = async () => {
    if (!imagenProcesada) return;
    setEstadoR2("subiendo");
    setCopiado(false);

    try {
      const res = await fetch('/api/upload-r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUri: imagenProcesada,
          folder: r2Folder || 'laboratorio-visual',
          filename: `tgp-curada-${Date.now()}`
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al subir a Cloudflare R2');
      }

      setR2Url(data.url);
      setEstadoR2("exito");
    } catch (error: any) {
      console.error("Error en inyección a R2:", error);
      alert(`Error al inyectar en R2: ${error?.message || error}`);
      setEstadoR2("error");
    }
  };

  const copiarUrlR2 = () => {
    if (!r2Url) return;
    navigator.clipboard.writeText(r2Url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const descargarLocal = () => {
    if (!imagenProcesada) return;
    const a = document.createElement('a');
    a.href = imagenProcesada;
    a.download = `tgp-curada-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-6 shadow-2xl font-sans text-gray-300 my-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-[#222] pb-4 mb-6">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#c49a6c]/80 block">Infraestructura Visual TGP</span>
          <h2 className="text-xl font-serif text-[#c49a6c] tracking-wide">Laboratorio Visual TGP · Ingesta & Procesamiento</h2>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-[#1a1a1a] border border-[#333] font-mono text-gray-400">
          R2 + Cloud Run
        </span>
      </div>
      
      {/* 1. INGESTA */}
      <div className="border-b border-[#222] pb-6 mb-6">
        <label className="block text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">1. Ingesta de Imagen Base</label>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={abrirGooglePicker}
            className="bg-[#151718] hover:bg-[#25282a] border border-[#333] hover:border-[#c49a6c]/50 text-gray-200 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer flex items-center gap-2"
          >
            <span className="text-[#c49a6c]">✦</span> Extraer de Google Drive / Photos / Local
          </button>
          <input 
            id="file-upload-fallback" 
            type="file" 
            className="hidden" 
            onChange={handleFileFallback} 
            accept="image/*" 
          />
          {imagenBase && (
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-3 py-1.5 rounded-md">
              ✓ {imagenBase.name} ({(imagenBase.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>
      </div>

      {/* 2. PROCESAMIENTO */}
      {imagenBase && estado !== "procesando" && (
        <div className="border-b border-[#222] pb-6 mb-6">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-400 mb-2">2. Motores de Transformación (Cloud Run)</label>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => procesarEnCloud('opencv')} 
              className="border border-emerald-900/80 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/40 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>◈</span> Rigor Estructural (OpenCV Canny)
            </button>
            <button 
              onClick={() => procesarEnCloud('pipeline_ocv_iti')} 
              className="border border-amber-900/80 bg-amber-950/20 text-amber-400 hover:bg-amber-900/40 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>✦</span> Deriva Estética (ITI / Vertex AI)
            </button>
          </div>
        </div>
      )}

      {estado === "procesando" && (
        <div className="p-6 rounded-lg bg-amber-950/20 border border-amber-900/40 mb-6 flex items-center gap-3 text-amber-400 text-sm">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Procesando transformación en Google Cloud Run...</span>
        </div>
      )}

      {/* 3. DISTRIBUCIÓN Y CARGA AUTOMÁTICA A R2 */}
      {imagenProcesada && estado === "completado" && (
        <div className="bg-[#111] border border-[#262626] p-5 rounded-xl mt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Imagen Curada Lista
            </span>
            <span className="text-xs font-mono text-gray-500">Base64 PNG</span>
          </div>

          <div className="bg-black/60 rounded-lg p-3 border border-[#222] mb-4 flex items-center justify-center">
            <img 
              src={imagenProcesada} 
              alt="Generada" 
              className="max-h-72 max-w-full object-contain rounded border border-[#333]" 
            />
          </div>
          
          <div className="border-t border-[#222] pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Destino de almacenamiento:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono">Carpeta:</span>
                <select 
                  value={r2Folder} 
                  onChange={(e) => setR2Folder(e.target.value)}
                  className="bg-[#1a1a1a] border border-[#333] text-gray-200 text-xs rounded px-2.5 py-1 font-mono focus:border-[#c49a6c] outline-none"
                >
                  <option value="laboratorio-visual">laboratorio-visual/</option>
                  <option value="ensayos">ensayos/</option>
                  <option value="ensayos-cinematicos">ensayos-cinematicos/</option>
                  <option value="arquetipos-globales">arquetipos-globales/</option>
                  <option value="georreferencias">georreferencias/</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button 
                onClick={inyectarEnR2} 
                disabled={estadoR2 === "subiendo"}
                className={`py-2.5 px-3 rounded-lg text-xs font-medium font-mono transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  estadoR2 === "subiendo" 
                    ? "bg-blue-950/30 text-blue-400/50 border border-blue-900/30 cursor-not-allowed" 
                    : "bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border border-blue-800/60 shadow-lg shadow-blue-950/30"
                }`}
              >
                {estadoR2 === "subiendo" ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Subiendo a R2...</span>
                  </>
                ) : (
                  <>
                    <span>☁️</span> Inyectar en Cloudflare R2
                  </>
                )}
              </button>

              <button 
                onClick={() => {
                  alert("Opción preparada para commit automatizado a GitHub Content Layer.");
                }} 
                className="bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-800/60 py-2.5 px-3 rounded-lg text-xs font-medium font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📦</span> Commit GitHub
              </button>

              <button 
                onClick={descargarLocal} 
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 py-2.5 px-3 rounded-lg text-xs font-medium font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📥</span> Descargar Local
              </button>
            </div>

            {/* FEEDBACK R2 */}
            {r2Url && estadoR2 === "exito" && (
              <div className="mt-4 p-3.5 bg-emerald-950/30 border border-emerald-800/60 rounded-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">✓ Publicado en Cloudflare R2 CDN:</span>
                  <button 
                    onClick={copiarUrlR2}
                    className="text-[10px] font-mono bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    {copiado ? "¡Copiado!" : "Copiar URL"}
                  </button>
                </div>
                <input 
                  type="text" 
                  readOnly 
                  value={r2Url} 
                  className="w-full bg-black/60 border border-emerald-900/50 rounded px-2.5 py-1 text-xs font-mono text-gray-300 selection:bg-emerald-700" 
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
