<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // VisualLaboratory.svelte
  // Reimplementación nativa en Svelte de TgpVisualLaboratory (React)
  // ADN: TGP · Infraestructura Visual · Ingesta, Cloud Run & Cloudflare R2
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Config ────────────────────────────────────────────────────────────────
  const CLOUD_RUN_BASE = (typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.PUBLIC_TGP_MIND_URL
    : null) ?? 'http://localhost:3001';

  const CLOUD_RUN_ENDPOINT = `${CLOUD_RUN_BASE.replace(/\/$/, '')}/process-image`;

  const API_TOKEN = (typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.TGP_MIND_API_KEY || (import.meta as any).env?.TGP_API_TOKEN
    : null) ?? '2771';

  import { openGooglePicker } from '../lib/google-picker';

  const GOOGLE_PICKER_KEY = (typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.PUBLIC_GOOGLE_PICKER_API_KEY
    : null) ?? '';

  const GOOGLE_CLIENT_ID = (typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.PUBLIC_GOOGLE_CLIENT_ID
    : null) ?? '';

  // ── Estado reactivo ───────────────────────────────────────────────────────
  let imagenBase:       File | null  = null;
  let imagenProcesada:  string | null = null;  // data-URI resultante
  let estado:           'esperando' | 'procesando' | 'completado' = 'esperando';
  let estadoR2:         'idle' | 'subiendo' | 'exito' | 'error'  = 'idle';
  let r2Url:            string | null = null;
  let r2Folder          = 'laboratorio-visual';
  let copiado           = false;
  let errorMsg:         string | null = null;

  // ── Ref de DOM ────────────────────────────────────────────────────────────
  let fileInputEl: HTMLInputElement;

  // ── Declaraciones reactivas ───────────────────────────────────────────────
  $: sizeLabel = imagenBase
    ? `${imagenBase.name} · ${(imagenBase.size / 1024).toFixed(1)} KB`
    : null;

  let pickerLoading = false;

  // ── Manejo de archivo ─────────────────────────────────────────────────────
  function abrirSelector() {
    fileInputEl?.click();
  }

  function abrirGooglePickerModal() {
    pickerLoading = true;
    errorMsg = null;
    openGooglePicker({
      apiKey: GOOGLE_PICKER_KEY,
      clientId: GOOGLE_CLIENT_ID,
      onSelect: (file: File) => {
        pickerLoading = false;
        imagenBase = file;
        imagenProcesada = null;
        r2Url = null;
        estadoR2 = 'idle';
      },
      onError: (err) => {
        pickerLoading = false;
        errorMsg = `Google Picker: ${err.message}`;
      },
    });
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file) {
      imagenBase      = file;
      imagenProcesada = null;
      r2Url           = null;
      estadoR2        = 'idle';
      errorMsg        = null;
    }
  }

  // ── Procesamiento en Cloud Run ────────────────────────────────────────────
  async function procesarEnCloud(modo: string) {
    if (!imagenBase) return;
    estado   = 'procesando';
    estadoR2 = 'idle';
    r2Url    = null;
    errorMsg = null;

    const formData = new FormData();
    formData.append('file', imagenBase);
    formData.append('mode', modo);

    try {
      const res = await fetch(CLOUD_RUN_ENDPOINT, {
        method : 'POST',
        headers: { 'x-api-token': API_TOKEN },
        body   : formData,
      });

      if (!res.ok) throw new Error(`Error en Cloud Run: ${res.status} ${res.statusText}`);

      const data  = await res.json();
      imagenProcesada = data.data_uri;
      estado          = 'completado';
    } catch (err: any) {
      console.error('Error al procesar:', err);
      errorMsg = err.message ?? 'Error de conexión con Cloud Run.';
      estado   = 'esperando';
    }
  }

  // ── Inyección en Cloudflare R2 ────────────────────────────────────────────
  async function inyectarEnR2() {
    if (!imagenProcesada) return;
    estadoR2 = 'subiendo';
    copiado  = false;
    errorMsg = null;

    try {
      const res = await fetch('/api/upload-r2', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          dataUri : imagenProcesada,
          folder  : r2Folder || 'laboratorio-visual',
          filename: `tgp-curada-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al subir a Cloudflare R2');

      r2Url    = data.url;
      estadoR2 = 'exito';
    } catch (err: any) {
      console.error('Error en inyección a R2:', err);
      errorMsg = err.message ?? 'Error al inyectar en R2.';
      estadoR2 = 'error';
    }
  }

  // ── Commit GitHub (stub)  ─────────────────────────────────────────────────
  function commitGitHub() {
    alert('Opción preparada para commit automatizado a GitHub Content Layer.');
  }

  // ── Descarga local ────────────────────────────────────────────────────────
  function descargarLocal() {
    if (!imagenProcesada) return;
    const a       = document.createElement('a');
    a.href        = imagenProcesada;
    a.download    = `tgp-curada-${Date.now()}.png`;
    a.click();
  }

  // ── Copiar URL R2 ─────────────────────────────────────────────────────────
  async function copiarUrlR2() {
    if (!r2Url) return;
    await navigator.clipboard.writeText(r2Url);
    copiado = true;
    setTimeout(() => (copiado = false), 2500);
  }
</script>

<!-- ── TEMPLATE ──────────────────────────────────────────────────────────── -->
<div class="vl-root">

  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="vl-header">
    <div class="vl-header-left">
      <span class="vl-kicker">Infraestructura Visual TGP</span>
      <h2 class="vl-title">Laboratorio Visual · Ingesta &amp; Procesamiento</h2>
    </div>
    <div style="display:flex; align-items:center; gap:10px;">
      <a
        href="/tgp-app/"
        class="vl-btn vl-btn--gray"
        style="text-decoration:none; font-size:11px; padding:6px 14px; border-radius:9999px; display:inline-flex; align-items:center; gap:6px;"
        title="Volver al Hub de TGP App"
      >
        ← Volver a TGP App
      </a>
      <span class="vl-badge">R2 + Cloud Run</span>
    </div>
  </div>

  <!-- ── Error global ──────────────────────────────────────────────────── -->
  {#if errorMsg}
    <div class="vl-error">⚠ {errorMsg}</div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════
       PASO 1 · INGESTA
  ════════════════════════════════════════════════════════════════════ -->
  <section class="vl-section">
    <span class="vl-step-label">1 · Ingesta de Imagen Base</span>

    <div class="vl-ingesta-row">
      <button class="vl-btn vl-btn--primary" on:click={abrirGooglePickerModal} disabled={pickerLoading}>
        <span class="vl-btn-icon">✦</span>
        {pickerLoading ? 'Iniciando Google Picker…' : 'Extraer de Google Drive / Photos'}
      </button>

      <button class="vl-btn vl-btn--gray" on:click={abrirSelector}>
        Subir Archivo Local
      </button>

      <input
        bind:this={fileInputEl}
        type="file"
        accept="image/*"
        style="display:none"
        on:change={handleFileChange}
      />

      {#if sizeLabel}
        <span class="vl-file-chip">✓ {sizeLabel}</span>
      {/if}
    </div>

    {#if imagenBase}
      <!-- Miniatura de previsualización del archivo original -->
      <div class="vl-original-preview">
        <img
          src={URL.createObjectURL(imagenBase)}
          alt="Original"
          class="vl-original-img"
        />
        <div class="vl-original-meta">
          <span class="vl-original-name">{imagenBase.name}</span>
          <span class="vl-original-size">{(imagenBase.size / 1024).toFixed(1)} KB</span>
        </div>
      </div>
    {/if}
  </section>

  <!-- ═══════════════════════════════════════════════════════════════════
       PASO 2 · MOTORES DE TRANSFORMACIÓN
  ════════════════════════════════════════════════════════════════════ -->
  {#if imagenBase && estado !== 'procesando'}
    <section class="vl-section">
      <span class="vl-step-label">2 · Motores de Transformación (Cloud Run)</span>
      <div class="vl-motores-row">
        <button
          class="vl-btn vl-btn--green"
          on:click={() => procesarEnCloud('opencv')}
        >
          <span>◈</span> Rigor Estructural (OpenCV Canny)
        </button>
        <button
          class="vl-btn vl-btn--amber"
          on:click={() => procesarEnCloud('pipeline_ocv_iti')}
        >
          <span>✦</span> Deriva Estética (ITI / Vertex AI)
        </button>
      </div>
    </section>
  {/if}

  <!-- Estado: Procesando ─────────────────────────────────────────────── -->
  {#if estado === 'procesando'}
    <div class="vl-processing">
      <div class="vl-spinner"></div>
      <span>Procesando transformación en Google Cloud Run…</span>
    </div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════
       PASO 3 · DISTRIBUCIÓN
  ════════════════════════════════════════════════════════════════════ -->
  {#if imagenProcesada && estado === 'completado'}
    <section class="vl-result-panel">

      <!-- Cabecera del resultado -->
      <div class="vl-result-header">
        <span class="vl-result-ready">
          <span class="vl-ready-dot"></span>
          Imagen Curada Lista
        </span>
        <span class="vl-result-format">Base64 PNG</span>
      </div>

      <!-- Imagen procesada -->
      <div class="vl-result-img-wrap">
        <img
          src={imagenProcesada}
          alt="Imagen procesada"
          class="vl-result-img"
        />
      </div>

      <!-- ── Distribución y almacenamiento ──────────────────────────── -->
      <div class="vl-dist-panel">
        <div class="vl-dist-row">
          <span class="vl-dist-label">Destino de almacenamiento:</span>
          <div class="vl-folder-row">
            <span class="vl-folder-hint">Carpeta:</span>
            <select bind:value={r2Folder} class="vl-select">
              <option value="laboratorio-visual">laboratorio-visual/</option>
              <option value="ensayos">ensayos/</option>
              <option value="ensayos-cinematicos">ensayos-cinematicos/</option>
              <option value="arquetipos-globales">arquetipos-globales/</option>
              <option value="georreferencias">georreferencias/</option>
            </select>
          </div>
        </div>

        <!-- Botones de acción -->
        <div class="vl-actions-grid">
          <!-- R2 -->
          <button
            class="vl-btn vl-btn--blue"
            on:click={inyectarEnR2}
            disabled={estadoR2 === 'subiendo'}
          >
            {#if estadoR2 === 'subiendo'}
              <span class="vl-spinner vl-spinner--sm vl-spinner--blue"></span>
              Subiendo a R2…
            {:else}
              ☁️ Inyectar en Cloudflare R2
            {/if}
          </button>

          <!-- GitHub (stub) -->
          <button class="vl-btn vl-btn--purple" on:click={commitGitHub}>
            📦 Commit GitHub
          </button>

          <!-- Descarga local -->
          <button class="vl-btn vl-btn--gray" on:click={descargarLocal}>
            📥 Descargar Local
          </button>
        </div>

        <!-- Feedback R2: éxito -->
        {#if r2Url && estadoR2 === 'exito'}
          <div class="vl-r2-success">
            <div class="vl-r2-success-header">
              <span class="vl-r2-label">✓ Publicado en Cloudflare R2 CDN:</span>
              <button class="vl-copy-btn" on:click={copiarUrlR2}>
                {copiado ? '¡Copiado!' : 'Copiar URL'}
              </button>
            </div>
            <input
              type="text"
              readonly
              value={r2Url}
              class="vl-r2-url-input"
            />
          </div>
        {/if}

        <!-- Feedback R2: error -->
        {#if estadoR2 === 'error'}
          <div class="vl-error" style="margin-top:10px">
            Error al subir a R2. Revisá la consola para más detalles.
          </div>
        {/if}
      </div>
    </section>
  {/if}

</div>

<style>
  /* ── Root / tokens ────────────────────────────────────────────────────── */
  .vl-root {
    --bg:           #0a0a0a;
    --bg2:          #111;
    --bg3:          #151718;
    --border:       #2a2a2a;
    --border-soft:  #222;
    --accent-gold:  #c49a6c;
    --accent-green: #34d399;
    --accent-amber: #fbbf24;
    --accent-blue:  #60a5fa;
    --accent-purple:#c084fc;
    --text:         #d1d5db;
    --text-muted:   #9ca3af;
    --text-dim:     #6b7280;
    --font-serif:   'Cinzel', 'Georgia', serif;
    --font-mono:    'IBM Plex Mono', monospace;
    --radius:       12px;
    --radius-sm:    8px;

    background:    var(--bg);
    color:         var(--text);
    border:        1px solid var(--border);
    border-radius: var(--radius);
    padding:       24px;
    max-width:     900px;
    margin:        16px auto;
    font-family:   var(--font-mono);
    box-shadow:    0 24px 80px rgba(0,0,0,0.9);
  }

  /* ── Header ──────────────────────────────────────────────────────────── */
  .vl-header {
    display:         flex;
    align-items:     flex-start;
    justify-content: space-between;
    border-bottom:   1px solid var(--border-soft);
    padding-bottom:  16px;
    margin-bottom:   22px;
    gap:             12px;
    flex-wrap:       wrap;
  }
  .vl-header-left { display: flex; flex-direction: column; gap: 4px; }
  .vl-kicker {
    font-size:      9px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color:          rgba(196,154,108,0.8);
  }
  .vl-title {
    font-family:    var(--font-serif);
    font-size:      20px;
    font-weight:    400;
    color:          var(--accent-gold);
    letter-spacing: 0.05em;
    margin:         0;
  }
  .vl-badge {
    font-size:     10px;
    padding:       4px 10px;
    border-radius: 6px;
    background:    var(--bg2);
    border:        1px solid var(--border);
    color:         var(--text-muted);
    white-space:   nowrap;
    flex-shrink:   0;
  }

  /* ── Secciones ───────────────────────────────────────────────────────── */
  .vl-section {
    border-bottom:  1px solid var(--border-soft);
    padding-bottom: 22px;
    margin-bottom:  22px;
    display:        flex;
    flex-direction: column;
    gap:            14px;
  }
  .vl-step-label {
    font-size:      9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color:          var(--text-muted);
  }

  /* ── Botones base ────────────────────────────────────────────────────── */
  .vl-btn {
    display:        flex;
    align-items:    center;
    gap:            8px;
    padding:        9px 16px;
    border-radius:  var(--radius-sm);
    font-family:    var(--font-mono);
    font-size:      12px;
    font-weight:    500;
    cursor:         pointer;
    transition:     all 0.2s;
    border:         1px solid transparent;
    white-space:    nowrap;
  }
  .vl-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .vl-btn-icon { color: var(--accent-gold); }

  .vl-btn--primary {
    background: var(--bg3);
    border-color: var(--border);
    color: #e5e7eb;
  }
  .vl-btn--primary:hover:not(:disabled) {
    background: #25282a;
    border-color: rgba(196,154,108,0.5);
  }
  .vl-btn--green {
    background:   rgba(6,78,59,0.25);
    border-color: rgba(5,150,105,0.5);
    color:        var(--accent-green);
  }
  .vl-btn--green:hover:not(:disabled) { background: rgba(6,78,59,0.45); }
  .vl-btn--amber {
    background:   rgba(120,53,15,0.25);
    border-color: rgba(180,83,9,0.5);
    color:        var(--accent-amber);
  }
  .vl-btn--amber:hover:not(:disabled) { background: rgba(120,53,15,0.45); }
  .vl-btn--blue {
    background:   rgba(23,37,84,0.45);
    border-color: rgba(59,130,246,0.5);
    color:        var(--accent-blue);
  }
  .vl-btn--blue:hover:not(:disabled) { background: rgba(23,37,84,0.7); }
  .vl-btn--purple {
    background:   rgba(59,7,100,0.35);
    border-color: rgba(147,51,234,0.5);
    color:        var(--accent-purple);
  }
  .vl-btn--purple:hover:not(:disabled) { background: rgba(59,7,100,0.55); }
  .vl-btn--gray {
    background:   #1f2937;
    border-color: #374151;
    color:        #d1d5db;
  }
  .vl-btn--gray:hover:not(:disabled) { background: #374151; }

  /* ── Ingesta row ─────────────────────────────────────────────────────── */
  .vl-ingesta-row {
    display:     flex;
    flex-wrap:   wrap;
    align-items: center;
    gap:         10px;
  }
  .vl-file-chip {
    font-size:     10px;
    color:         var(--accent-green);
    background:    rgba(6,78,59,0.25);
    border:        1px solid rgba(5,150,105,0.4);
    padding:       5px 12px;
    border-radius: 6px;
  }

  /* ── Preview del original ────────────────────────────────────────────── */
  .vl-original-preview {
    display:       flex;
    align-items:   center;
    gap:           14px;
    background:    var(--bg2);
    border:        1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    padding:       10px 14px;
  }
  .vl-original-img {
    width:         56px;
    height:        56px;
    object-fit:    cover;
    border-radius: 6px;
    border:        1px solid var(--border);
    flex-shrink:   0;
  }
  .vl-original-meta {
    display:        flex;
    flex-direction: column;
    gap:            3px;
  }
  .vl-original-name {
    font-size:     11px;
    color:         var(--text);
    overflow:      hidden;
    text-overflow: ellipsis;
    white-space:   nowrap;
    max-width:     300px;
  }
  .vl-original-size {
    font-size: 10px;
    color:     var(--text-dim);
  }

  /* ── Motores row ─────────────────────────────────────────────────────── */
  .vl-motores-row {
    display:   flex;
    flex-wrap: wrap;
    gap:       10px;
  }

  /* ── Procesando ──────────────────────────────────────────────────────── */
  .vl-processing {
    display:       flex;
    align-items:   center;
    gap:           12px;
    padding:       18px 20px;
    background:    rgba(120,53,15,0.15);
    border:        1px solid rgba(180,83,9,0.35);
    border-radius: var(--radius-sm);
    margin-bottom: 20px;
    color:         var(--accent-amber);
    font-size:     13px;
  }

  /* ── Resultado / panel de distribución ───────────────────────────────── */
  .vl-result-panel {
    background:    var(--bg2);
    border:        1px solid #262626;
    border-radius: var(--radius);
    padding:       20px;
    display:       flex;
    flex-direction: column;
    gap:           16px;
  }
  .vl-result-header {
    display:         flex;
    align-items:     center;
    justify-content: space-between;
  }
  .vl-result-ready {
    display:     flex;
    align-items: center;
    gap:         8px;
    font-size:   10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color:       var(--accent-green);
    font-weight: 700;
  }
  .vl-ready-dot {
    width:         8px;
    height:        8px;
    border-radius: 50%;
    background:    var(--accent-green);
    flex-shrink:   0;
  }
  .vl-result-format {
    font-size: 9px;
    color:     var(--text-dim);
  }
  .vl-result-img-wrap {
    background:    rgba(0,0,0,0.6);
    border:        1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    padding:       12px;
    display:       flex;
    align-items:   center;
    justify-content: center;
  }
  .vl-result-img {
    max-height:  280px;
    max-width:   100%;
    object-fit:  contain;
    border:      1px solid var(--border);
    border-radius: 6px;
  }

  /* ── Panel distribución ──────────────────────────────────────────────── */
  .vl-dist-panel {
    border-top:  1px solid var(--border-soft);
    padding-top: 16px;
    display:     flex;
    flex-direction: column;
    gap:         14px;
  }
  .vl-dist-row {
    display:         flex;
    flex-wrap:       wrap;
    align-items:     center;
    justify-content: space-between;
    gap:             10px;
  }
  .vl-dist-label {
    font-size:      9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color:          var(--text-muted);
  }
  .vl-folder-row {
    display:     flex;
    align-items: center;
    gap:         8px;
  }
  .vl-folder-hint { font-size: 10px; color: var(--text-dim); }
  .vl-select {
    background:    var(--bg);
    border:        1px solid var(--border);
    color:         var(--text);
    font-family:   var(--font-mono);
    font-size:     11px;
    padding:       4px 10px;
    border-radius: 6px;
    outline:       none;
    cursor:        pointer;
    transition:    border-color 0.2s;
  }
  .vl-select:focus { border-color: var(--accent-gold); }

  /* ── Grid de acciones ────────────────────────────────────────────────── */
  .vl-actions-grid {
    display:               grid;
    grid-template-columns: repeat(3, 1fr);
    gap:                   8px;
  }
  @media (max-width: 600px) {
    .vl-actions-grid { grid-template-columns: 1fr; }
  }

  /* ── R2 éxito ────────────────────────────────────────────────────────── */
  .vl-r2-success {
    background:    rgba(6,78,59,0.2);
    border:        1px solid rgba(5,150,105,0.45);
    border-radius: var(--radius-sm);
    padding:       14px;
    display:       flex;
    flex-direction: column;
    gap:           8px;
  }
  .vl-r2-success-header {
    display:         flex;
    align-items:     center;
    justify-content: space-between;
  }
  .vl-r2-label {
    font-size:  10px;
    color:      var(--accent-green);
    font-weight: 700;
  }
  .vl-copy-btn {
    font-family:   var(--font-mono);
    font-size:     9px;
    background:    rgba(6,78,59,0.5);
    border:        none;
    border-radius: 4px;
    color:         #a7f3d0;
    padding:       3px 10px;
    cursor:        pointer;
    transition:    background 0.2s;
  }
  .vl-copy-btn:hover { background: rgba(6,78,59,0.8); }
  .vl-r2-url-input {
    width:         100%;
    background:    rgba(0,0,0,0.6);
    border:        1px solid rgba(5,150,105,0.35);
    border-radius: 4px;
    padding:       6px 10px;
    font-family:   var(--font-mono);
    font-size:     11px;
    color:         var(--text);
    outline:       none;
    box-sizing:    border-box;
  }

  /* ── Error global ────────────────────────────────────────────────────── */
  .vl-error {
    background:    rgba(220,38,38,0.08);
    border:        1px solid rgba(220,38,38,0.25);
    border-radius: var(--radius-sm);
    padding:       10px 14px;
    font-size:     11px;
    color:         #f87171;
    margin-bottom: 14px;
  }

  /* ── Spinners ────────────────────────────────────────────────────────── */
  .vl-spinner {
    display:       inline-block;
    width:         16px;
    height:        16px;
    border:        2px solid rgba(251,191,36,0.3);
    border-top-color: var(--accent-amber);
    border-radius: 50%;
    animation:     vl-spin 0.75s linear infinite;
    flex-shrink:   0;
  }
  .vl-spinner--sm {
    width:  12px;
    height: 12px;
  }
  .vl-spinner--blue {
    border-color:     rgba(96,165,250,0.3);
    border-top-color: var(--accent-blue);
  }
  @keyframes vl-spin {
    to { transform: rotate(360deg); }
  }
</style>
