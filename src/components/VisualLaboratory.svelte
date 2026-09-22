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
  import WikimediaGalleryInbox from './WikimediaGalleryInbox.svelte';

  // Credenciales Google manejadas por el backend (Cloud Run) — sin exposicion en frontend

  // ── Estado reactivo ───────────────────────────────────────────────────────
  let imagenBase:       File | null  = null;
  let imagenProcesada:  string | null = null;  // data-URI resultante
  let estado:           'esperando' | 'procesando' | 'completado' = 'esperando';
  let estadoR2:         'idle' | 'subiendo' | 'exito' | 'error'  = 'idle';
  let r2Url:            string | null = null;
  let r2Folder          = 'laboratorio-visual';
  let copiado           = false;
  let errorMsg:         string | null = null;
  let isWikiInboxOpen   = false;

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
      onSelect: (file: File) => {
        pickerLoading = false;
        imagenBase = file;
        imagenProcesada = null;
        r2Url = null;
        estadoR2 = 'idle';
      },
      onError: (err) => {
        pickerLoading = false;
        if (err.message !== 'PICKER_RENDERED' && err.message !== 'PICKER_CLOSED' && err.message !== 'PICKER_TIMEOUT') {
          errorMsg = `Google Photos: ${err.message}`;
        }
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

  function handleWikiSelect(file: File) {
    imagenBase      = file;
    imagenProcesada = null;
    r2Url           = null;
    estadoR2        = 'idle';
    errorMsg        = null;
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

      <button class="vl-btn vl-btn--green" on:click={() => (isWikiInboxOpen = true)}>
        <span>🏛</span>
        Galería Wikimedia Commons (CC0)
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

    <!-- Galería Wikimedia Commons Integrada Inline en el Scroll -->
    <WikimediaGalleryInbox bind:isOpen={isWikiInboxOpen} onSelect={handleWikiSelect} />

</div>

<style>
  /* ── Root / tokens (Modo Claro Limpio · Mesa de Trabajo) ─────────────────── */
  .vl-root {
    --bg:           #ffffff;
    --bg2:          #f9fafb;
    --bg3:          #f4f4f5;
    --border:       #e4e4e7;
    --border-soft:  #f4f4f5;
    --accent-gold:  #b45309;
    --accent-green: #047857;
    --accent-amber: #b45309;
    --accent-blue:  #1d4ed8;
    --accent-purple:#6d28d9;
    --text:         #18181b;
    --text-muted:   #52525b;
    --text-dim:     #71717a;
    --font-serif:   'Cinzel', 'Georgia', serif;
    --font-mono:    'IBM Plex Mono', monospace;
    --radius:       16px;
    --radius-sm:    10px;

    background:    var(--bg);
    color:         var(--text);
    border:        1px solid var(--border);
    border-radius: var(--radius);
    padding:       28px;
    max-width:     100%;
    margin:        0 auto;
    font-family:   var(--font-mono);
    box-shadow:    0 1px 3px rgba(0,0,0,0.04);
  }

  /* ── Header ──────────────────────────────────────────────────────────── */
  .vl-header {
    display:         flex;
    align-items:     flex-start;
    justify-content: space-between;
    border-bottom:   1px solid var(--border);
    padding-bottom:  18px;
    margin-bottom:   24px;
    gap:             12px;
    flex-wrap:       wrap;
  }
  .vl-header-left { display: flex; flex-direction: column; gap: 4px; }
  .vl-kicker {
    font-size:      10px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color:          var(--accent-green);
    font-weight:    600;
  }
  .vl-title {
    font-family:    var(--font-serif);
    font-size:      22px;
    font-weight:    500;
    color:          var(--text);
    letter-spacing: 0.02em;
    margin:         0;
  }
  .vl-badge {
    font-size:     10px;
    font-weight:   500;
    padding:       4px 10px;
    border-radius: 6px;
    background:    var(--bg3);
    border:        1px solid var(--border);
    color:         var(--text-muted);
    white-space:   nowrap;
    flex-shrink:   0;
  }

  /* ── Secciones ───────────────────────────────────────────────────────── */
  .vl-section {
    border-bottom:  1px solid var(--border-soft);
    padding-bottom: 24px;
    margin-bottom:  24px;
    display:        flex;
    flex-direction: column;
    gap:            16px;
  }
  .vl-step-label {
    font-size:      10px;
    font-weight:    700;
    letter-spacing: 0.2em;
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
    font-weight:    600;
    cursor:         pointer;
    transition:     all 0.2s;
    border:         1px solid transparent;
    white-space:    nowrap;
  }
  .vl-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .vl-btn-icon { color: var(--accent-gold); }

  .vl-btn--primary {
    background: #ffffff;
    border-color: #d4d4d8;
    color: #18181b;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .vl-btn--primary:hover:not(:disabled) {
    background: #f4f4f5;
    border-color: #a1a1aa;
  }
  .vl-btn--green {
    background:   #ecfdf5;
    border-color: #a7f3d0;
    color:        #065f46;
    box-shadow:   0 1px 2px rgba(0,0,0,0.03);
  }
  .vl-btn--green:hover:not(:disabled) { background: #d1fae5; }
  .vl-btn--amber {
    background:   #fffbeb;
    border-color: #fde68a;
    color:        #92400e;
  }
  .vl-btn--amber:hover:not(:disabled) { background: #fef3c7; }
  .vl-btn--blue {
    background:   #eff6ff;
    border-color: #bfdbfe;
    color:        #1e40af;
  }
  .vl-btn--blue:hover:not(:disabled) { background: #dbeafe; }
  .vl-btn--purple {
    background:   #faf5ff;
    border-color: #e9d5ff;
    color:        #6b21a8;
  }
  .vl-btn--purple:hover:not(:disabled) { background: #f3e8ff; }
  .vl-btn--gray {
    background:   #f4f4f5;
    border-color: #e4e4e7;
    color:        #27272a;
  }
  .vl-btn--gray:hover:not(:disabled) { background: #e4e4e7; }

  /* ── Ingesta row ─────────────────────────────────────────────────────── */
  .vl-ingesta-row {
    display:     flex;
    flex-wrap:   wrap;
    align-items: center;
    gap:         10px;
  }
  .vl-file-chip {
    font-size:     11px;
    font-weight:   600;
    color:         #047857;
    background:    #ecfdf5;
    border:        1px solid #a7f3d0;
    padding:       5px 12px;
    border-radius: 6px;
  }

  /* ── Preview del original ────────────────────────────────────────────── */
  .vl-original-preview {
    display:       flex;
    align-items:   center;
    gap:           14px;
    background:    #f9fafb;
    border:        1px solid var(--border);
    border-radius: var(--radius-sm);
    padding:       12px 16px;
  }
  .vl-original-img {
    width:         56px;
    height:        56px;
    object-fit:    cover;
    border-radius: 8px;
    border:        1px solid #d4d4d8;
    flex-shrink:   0;
  }
  .vl-original-meta {
    display:        flex;
    flex-direction: column;
    gap:            3px;
  }
  .vl-original-name {
    font-size:     12px;
    font-weight:   600;
    color:         var(--text);
    overflow:      hidden;
    text-overflow: ellipsis;
    white-space:   nowrap;
    max-width:     360px;
  }
  .vl-original-size {
    font-size: 11px;
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
    background:    #fffbeb;
    border:        1px solid #fde68a;
    border-radius: var(--radius-sm);
    margin-bottom: 20px;
    color:         #92400e;
    font-size:     13px;
    font-weight:   500;
  }

  /* ── Resultado / panel de distribución ───────────────────────────────── */
  .vl-result-panel {
    background:    #f9fafb;
    border:        1px solid var(--border);
    border-radius: var(--radius);
    padding:       22px;
    display:       flex;
    flex-direction: column;
    gap:           16px;
    box-shadow:    0 1px 2px rgba(0,0,0,0.03);
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
    font-size:   11px;
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
    font-size: 10px;
    font-mono: var(--font-mono);
    color:     var(--text-dim);
  }
  .vl-result-img-wrap {
    background:    #ffffff;
    border:        1px solid var(--border);
    border-radius: var(--radius-sm);
    padding:       14px;
    display:       flex;
    align-items:   center;
    justify-content: center;
  }
  .vl-result-img {
    max-height:  340px;
    max-width:   100%;
    object-fit:  contain;
    border:      1px solid #e4e4e7;
    border-radius: 8px;
    background:  #fafafa;
  }

  /* ── Panel distribución ──────────────────────────────────────────────── */
  .vl-dist-panel {
    border-top:  1px solid var(--border);
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
    font-size:      10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color:          var(--text-muted);
    font-weight:    600;
  }
  .vl-folder-row {
    display:     flex;
    align-items: center;
    gap:         8px;
  }
  .vl-folder-hint { font-size: 11px; color: var(--text-dim); }
  .vl-select {
    background:    #ffffff;
    border:        1px solid #d4d4d8;
    color:         var(--text);
    font-family:   var(--font-mono);
    font-size:     12px;
    padding:       5px 12px;
    border-radius: 6px;
    outline:       none;
    cursor:        pointer;
    transition:    border-color 0.2s;
  }
  .vl-select:focus { border-color: var(--accent-green); }

  /* ── Grid de acciones ────────────────────────────────────────────────── */
  .vl-actions-grid {
    display:               grid;
    grid-template-columns: repeat(3, 1fr);
    gap:                   10px;
  }
  @media (max-width: 600px) {
    .vl-actions-grid { grid-template-columns: 1fr; }
  }

  /* ── R2 éxito ────────────────────────────────────────────────────────── */
  .vl-r2-success {
    background:    #ecfdf5;
    border:        1px solid #a7f3d0;
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
    font-size:  11px;
    color:      #065f46;
    font-weight: 700;
  }
  .vl-copy-btn {
    font-family:   var(--font-mono);
    font-size:     10px;
    font-weight:   600;
    background:    #d1fae5;
    border:        1px solid #a7f3d0;
    border-radius: 4px;
    color:         #065f46;
    padding:       4px 10px;
    cursor:        pointer;
    transition:    background 0.2s;
  }
  .vl-copy-btn:hover { background: #a7f3d0; }
  .vl-r2-url-input {
    width:         100%;
    background:    #ffffff;
    border:        1px solid #a7f3d0;
    border-radius: 6px;
    padding:       7px 12px;
    font-family:   var(--font-mono);
    font-size:     12px;
    color:         #065f46;
    outline:       none;
    box-sizing:    border-box;
  }

  /* ── Error global ────────────────────────────────────────────────────── */
  .vl-error {
    background:    #fef2f2;
    border:        1px solid #fecaca;
    border-radius: var(--radius-sm);
    padding:       12px 16px;
    font-size:     12px;
    color:         #b91c1c;
    margin-bottom: 16px;
  }

  /* ── Spinners ────────────────────────────────────────────────────────── */
  .vl-spinner {
    display:       inline-block;
    width:         16px;
    height:        16px;
    border:        2px solid rgba(180,83,9,0.3);
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
    border-color:     rgba(29,78,216,0.3);
    border-top-color: var(--accent-blue);
  }
  @keyframes vl-spin {
    to { transform: rotate(360deg); }
  }
</style>
