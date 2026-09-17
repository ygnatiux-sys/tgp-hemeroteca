<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // VisionInbox.svelte
  // Reimplementación nativa en Svelte de TgpVisionInbox (React)
  // ADN: TGP Scriptorium · Bandeja de Entrada Visual · Obsidian Void
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Props ─────────────────────────────────────────────────────────────────
  export let onResponse: ((response: string) => void) | undefined = undefined;
  export let onError:    ((error: string) => void)    | undefined = undefined;

  // ── Config ────────────────────────────────────────────────────────────────
  const API_KEY         = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_TGP_MIND_API_KEY : null) ?? '2771';
  const VISION_ENDPOINT = 'http://localhost:3001/api/vision';

  // ── Estado reactivo ───────────────────────────────────────────────────────
  let prompt     = '';
  let imageFile: File | null = null;
  let previewUrl: string | null = null;
  let isLoading  = false;
  let errorMsg: string | null = null;

  // ── Refs de DOM ───────────────────────────────────────────────────────────
  let fileInputEl: HTMLInputElement;

  // ── Declaraciones reactivas ───────────────────────────────────────────────
  $: canSubmit = !!imageFile && prompt.trim().length > 0 && !isLoading;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const [header, base64] = result.split(',');
        const mimeType = header.replace('data:', '').replace(';base64', '');
        resolve({ base64, mimeType });
      };
      reader.onerror = reject;
    });
  }

  // ── Manejo de archivo ─────────────────────────────────────────────────────
  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file && file.type.startsWith('image/')) {
      imageFile  = file;
      previewUrl = URL.createObjectURL(file);
      errorMsg   = null;
    } else if (file) {
      errorMsg = 'Solo se aceptan imágenes (JPG, PNG, WEBP, GIF…).';
    }
  }

  function clearImage() {
    imageFile  = null;
    previewUrl = null;
    if (fileInputEl) fileInputEl.value = '';
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!canSubmit || !imageFile) return;

    isLoading = true;
    errorMsg  = null;

    try {
      const { base64, mimeType } = await fileToBase64(imageFile);

      const res = await fetch(VISION_ENDPOINT, {
        method : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key'   : API_KEY,
        },
        body: JSON.stringify({ prompt, base64, mimeType }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);

      const data = await res.json();
      onResponse?.(data.response ?? '(Sin respuesta)');

      // Limpiar tras éxito
      prompt    = '';
      imageFile = null;
      previewUrl = null;
      if (fileInputEl) fileInputEl.value = '';

    } catch (err: any) {
      const msg = err.message ?? 'Error de conexión con TGP Mind.';
      errorMsg = msg;
      onError?.(msg);
    } finally {
      isLoading = false;
    }
  }
</script>

<!-- ── TEMPLATE ──────────────────────────────────────────────────────────── -->
<div class="vi-root">
  <!-- Header -->
  <div class="vi-header">
    <div class="vi-kicker">TGP Scriptorium · Bandeja de Entrada Visual</div>
    <h2 class="vi-title">Visión Analítica</h2>
  </div>

  <form class="vi-form" on:submit={handleSubmit}>

    <!-- ── Zona de carga de imagen ─────────────────────────────────────── -->
    <div class="vi-field">
      <label class="vi-label" for="vi-file-input">Documento Visual</label>

      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        class="vi-dropzone"
        class:vi-dropzone--has-image={!!previewUrl}
        on:click={() => fileInputEl?.click()}
      >
        <input
          bind:this={fileInputEl}
          id="vi-file-input"
          type="file"
          accept="image/*"
          style="display:none"
          on:change={handleFileChange}
        />

        {#if previewUrl}
          <img src={previewUrl} alt="Vista previa" class="vi-preview" />
          <div class="vi-preview-overlay">
            <span class="vi-preview-name">{imageFile?.name}</span>
            <button
              type="button"
              class="vi-preview-clear"
              on:click|stopPropagation={clearImage}
            >✕</button>
          </div>
        {:else}
          <div class="vi-drop-placeholder">
            <span class="vi-drop-icon">⊕</span>
            <span class="vi-drop-text">Arrastrá o hacé clic para seleccionar</span>
            <span class="vi-drop-sub">JPG · PNG · WEBP · GIF · TIFF</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Prompt analítico ────────────────────────────────────────────── -->
    <div class="vi-field">
      <label class="vi-label" for="vi-prompt">Prompt Analítico</label>
      <textarea
        id="vi-prompt"
        bind:value={prompt}
        class="vi-textarea"
        placeholder="Introducí tu instrucción de análisis: iconografía, composición, contexto histórico, atribución estilística…"
        disabled={isLoading}
        required
      ></textarea>
    </div>

    <!-- ── Error ───────────────────────────────────────────────────────── -->
    {#if errorMsg}
      <div class="vi-error">⚠ {errorMsg}</div>
    {/if}

    <!-- ── Submit ─────────────────────────────────────────────────────── -->
    <div class="vi-footer">
      <div class="vi-status" class:vi-status--ready={!!imageFile}>
        {#if imageFile}
          ✓ {imageFile.name} · {(imageFile.size / 1024).toFixed(1)} KB
        {:else}
          ◌ Sin imagen seleccionada
        {/if}
      </div>
      <button
        type="submit"
        class="vi-submit"
        disabled={!canSubmit}
      >
        {#if isLoading}
          <span class="vi-spinner"></span>
          Analizando…
        {:else}
          Procesar Imagen ↵
        {/if}
      </button>
    </div>

  </form>
</div>

<style>
  /* ── Root / tokens ────────────────────────────────────────────────────── */
  .vi-root {
    --bg:           #121413;
    --bg2:          #171b19;
    --bg3:          #1e2420;
    --border:       rgba(180,210,190,0.10);
    --border-hover: rgba(180,210,190,0.25);
    --accent:       #7eb89a;
    --accent2:      #a8d5b8;
    --text:         #dde8e2;
    --text-muted:   #7a9186;
    --text-dim:     rgba(221,232,226,0.40);
    --font-serif:   'Cinzel', 'Georgia', serif;
    --font-body:    'IBM Plex Serif', 'Newsreader', 'Georgia', serif;
    --font-mono:    'IBM Plex Mono', monospace;
    --radius:       10px;
    --error:        #e06060;

    background:    var(--bg);
    color:         var(--text);
    border:        1px solid var(--border);
    border-radius: 16px;
    padding:       28px;
    max-width:     680px;
    margin:        0 auto;
    font-family:   var(--font-body);
    box-shadow:    0 16px 64px rgba(0,0,0,0.8);
  }

  /* ── Header ─────────────────────────────────────────────────────────── */
  .vi-header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .vi-kicker {
    font-family:     var(--font-mono);
    font-size:       9px;
    letter-spacing:  0.3em;
    text-transform:  uppercase;
    color:           var(--accent);
    margin-bottom:   6px;
  }
  .vi-title {
    font-family:    var(--font-serif);
    font-size:      22px;
    font-weight:    400;
    color:          var(--text);
    letter-spacing: 0.08em;
    margin:         0;
  }

  /* ── Formulario ──────────────────────────────────────────────────────── */
  .vi-form {
    display:        flex;
    flex-direction: column;
    gap:            20px;
  }
  .vi-field {
    display:        flex;
    flex-direction: column;
    gap:            8px;
  }
  .vi-label {
    font-family:    var(--font-mono);
    font-size:      9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color:          var(--accent);
  }

  /* ── Dropzone ────────────────────────────────────────────────────────── */
  .vi-dropzone {
    border:          2px dashed var(--border);
    border-radius:   var(--radius);
    background:      var(--bg2);
    min-height:      180px;
    cursor:          pointer;
    display:         flex;
    align-items:     center;
    justify-content: center;
    position:        relative;
    overflow:        hidden;
    transition:      border-color 0.25s, background 0.25s;
  }
  .vi-dropzone:hover {
    border-color: var(--accent);
    background:   rgba(126,184,154,0.04);
  }
  .vi-dropzone--has-image {
    border-style:  solid;
    border-color:  var(--border-hover);
    min-height:    220px;
  }

  /* Placeholder interior */
  .vi-drop-placeholder {
    display:        flex;
    flex-direction: column;
    align-items:    center;
    gap:            8px;
    pointer-events: none;
  }
  .vi-drop-icon {
    font-size: 40px;
    opacity:   0.25;
  }
  .vi-drop-text {
    font-family:    var(--font-mono);
    font-size:      11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color:          var(--text-muted);
  }
  .vi-drop-sub {
    font-size: 10px;
    color:     var(--text-dim);
  }

  /* Preview */
  .vi-preview {
    width:      100%;
    max-height: 260px;
    object-fit: contain;
    display:    block;
  }
  .vi-preview-overlay {
    position:    absolute;
    bottom:      0;
    left:        0;
    right:       0;
    padding:     10px 14px;
    background:  linear-gradient(transparent, rgba(0,0,0,0.88));
    display:     flex;
    align-items: center;
    justify-content: space-between;
  }
  .vi-preview-name {
    font-family:   var(--font-mono);
    font-size:     10px;
    color:         rgba(255,255,255,0.6);
    white-space:   nowrap;
    overflow:      hidden;
    text-overflow: ellipsis;
    max-width:     80%;
  }
  .vi-preview-clear {
    background:  rgba(0,0,0,0.7);
    border:      1px solid rgba(255,255,255,0.15);
    border-radius: 50%;
    width:       26px;
    height:      26px;
    display:     flex;
    align-items: center;
    justify-content: center;
    cursor:      pointer;
    color:       rgba(255,255,255,0.6);
    font-size:   11px;
    transition:  all 0.2s;
  }
  .vi-preview-clear:hover { background: rgba(0,0,0,0.9); color: #fff; }

  /* ── Textarea ────────────────────────────────────────────────────────── */
  .vi-textarea {
    width:         100%;
    background:    var(--bg2);
    border:        1px solid var(--border);
    border-radius: var(--radius);
    padding:       14px 16px;
    color:         var(--text);
    font-family:   var(--font-body);
    font-size:     14px;
    line-height:   1.75;
    resize:        vertical;
    min-height:    120px;
    outline:       none;
    transition:    border-color 0.2s;
    scrollbar-width: thin;
    box-sizing:    border-box;
  }
  .vi-textarea:focus          { border-color: var(--accent); }
  .vi-textarea:disabled       { opacity: 0.5; cursor: not-allowed; }
  .vi-textarea::placeholder   { color: var(--text-dim); font-style: italic; }

  /* ── Error ───────────────────────────────────────────────────────────── */
  .vi-error {
    background:    rgba(220,80,80,0.08);
    border:        1px solid rgba(220,80,80,0.2);
    border-radius: 8px;
    padding:       10px 14px;
    font-family:   var(--font-mono);
    font-size:     11px;
    color:         var(--error);
  }

  /* ── Footer / Submit ─────────────────────────────────────────────────── */
  .vi-footer {
    display:         flex;
    align-items:     center;
    justify-content: space-between;
    gap:             12px;
    flex-wrap:       wrap;
  }
  .vi-status {
    font-family:    var(--font-mono);
    font-size:      10px;
    letter-spacing: 0.1em;
    color:          var(--text-muted);
  }
  .vi-status--ready { color: var(--accent); }

  .vi-submit {
    display:        flex;
    align-items:    center;
    gap:            8px;
    padding:        11px 26px;
    background:     rgba(126,184,154,0.12);
    border:         1px solid rgba(126,184,154,0.3);
    border-radius:  var(--radius);
    color:          var(--accent2);
    font-family:    var(--font-mono);
    font-size:      11px;
    font-weight:    600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    cursor:         pointer;
    transition:     all 0.2s;
  }
  .vi-submit:hover:not(:disabled) {
    background:    rgba(126,184,154,0.22);
    border-color:  rgba(126,184,154,0.55);
  }
  .vi-submit:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Spinner inline */
  .vi-spinner {
    display:       inline-block;
    width:         12px;
    height:        12px;
    border:        2px solid rgba(126,184,154,0.4);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation:     vi-spin 0.7s linear infinite;
    flex-shrink:   0;
  }
  @keyframes vi-spin {
    to { transform: rotate(360deg); }
  }
</style>
