<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // ScriptoriumCapture.svelte
  // Reimplementación nativa en Svelte 5 de TgpVisionBoard (React)
  // ADN: TGP Scriptorium · Motor Cognitivo Multimodal · Obsidian Void aesthetic
  // ─────────────────────────────────────────────────────────────────────────────
  import { marked } from 'marked';

  // ── Tipos ─────────────────────────────────────────────────────────────────
  interface VisionResult {
    prompt: string;
    response: string;
    imagePreview: string;
    imageSource: 'local' | 'wikimedia';
    imageName: string;
    timestamp: Date;
  }

  interface WikiItem {
    title: string;
    url: string;
    thumb: string;
  }

  // ── Config ────────────────────────────────────────────────────────────────
  const API_KEY = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_TGP_MIND_API_KEY : null) ?? '2771';
  const VISION_ENDPOINT = 'http://localhost:3001/api/vision';

  // ── Estado del Trigger ────────────────────────────────────────────────────
  let isOpen = false;

  // ── Estado del Board ──────────────────────────────────────────────────────
  let imageFile: File | null = null;
  let imageUrl: string | null = null;
  let imageSource: 'local' | 'wikimedia' = 'local';
  let previewUrl: string | null = null;
  let imageName = '';
  let prompt = '';
  let isLoading = false;
  let isDragging = false;
  let results: VisionResult[] = [];
  let error: string | null = null;

  // Wikimedia
  let wikiQuery = '';
  let wikiResults: WikiItem[] = [];
  let wikiLoading = false;
  let wikiOpen = false;

  // Refs de DOM (Svelte bind:this)
  let promptEl: HTMLTextAreaElement;
  let resultsEl: HTMLDivElement;
  let fileInputEl: HTMLInputElement;

  // ── Declaraciones reactivas ────────────────────────────────────────────────
  $: if (isOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }

  $: hasImage = !!imageFile || !!imageUrl;
  $: canSubmit = hasImage && prompt.trim().length > 0 && !isLoading;

  // ── Helpers Base64 ────────────────────────────────────────────────────────
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

  async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], 'wikimedia-image', { type: blob.type });
    return fileToBase64(file);
  }

  // ── Carga de archivo local ────────────────────────────────────────────────
  function loadLocalFile(file: File) {
    if (!file.type.startsWith('image/')) {
      error = 'Solo se aceptan imágenes.';
      return;
    }
    imageFile = file;
    imageUrl = null;
    imageSource = 'local';
    imageName = file.name;
    previewUrl = URL.createObjectURL(file);
    error = null;
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) loadLocalFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) loadLocalFile(file);
  }

  function clearImage() {
    imageFile = null;
    imageUrl = null;
    previewUrl = null;
    imageName = '';
  }

  // ── Wikimedia Commons ─────────────────────────────────────────────────────
  async function searchWikimedia() {
    if (!wikiQuery.trim()) return;
    wikiLoading = true;
    wikiResults = [];
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(wikiQuery)}&srnamespace=6&srlimit=12&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data?.query?.search ?? [];
      const withThumbs = await Promise.all(
        pages.slice(0, 12).map(async (p: any) => {
          const title = p.title;
          const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=280&format=json&origin=*`;
          try {
            const infoRes = await fetch(infoUrl);
            const infoData = await infoRes.json();
            const pg = infoData?.query?.pages ?? {};
            const page: any = Object.values(pg)[0];
            const info = page?.imageinfo?.[0];
            return { title: title.replace('File:', ''), url: info?.url ?? '', thumb: info?.thumburl ?? info?.url ?? '' };
          } catch { return null; }
        })
      );
      wikiResults = withThumbs.filter(Boolean) as WikiItem[];
    } catch {
      error = 'Error consultando Wikimedia Commons.';
    } finally {
      wikiLoading = false;
    }
  }

  function selectWikiImage(item: WikiItem) {
    imageUrl = item.url;
    imageFile = null;
    imageSource = 'wikimedia';
    imageName = item.title;
    previewUrl = item.thumb;
    wikiOpen = false;
    error = null;
  }

  // ── Submit a Gemini Vision ────────────────────────────────────────────────
  async function handleSubmit(e?: Event) {
    e?.preventDefault();
    if (!canSubmit) return;
    isLoading = true;
    error = null;
    try {
      let base64: string;
      let mimeType: string;
      if (imageSource === 'local' && imageFile) {
        ({ base64, mimeType } = await fileToBase64(imageFile));
      } else if (imageSource === 'wikimedia' && imageUrl) {
        ({ base64, mimeType } = await urlToBase64(imageUrl));
      } else {
        throw new Error('Sin imagen disponible.');
      }
      const res = await fetch(VISION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ prompt, base64, mimeType }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      results = [{
        prompt,
        response: data.response ?? '(Sin respuesta)',
        imagePreview: previewUrl ?? '',
        imageSource,
        imageName,
        timestamp: new Date(),
      }, ...results];
      prompt = '';
      promptEl?.focus();
      // Scroll suave al panel de resultados
      setTimeout(() => resultsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err: any) {
      error = err.message ?? 'Error de conexión con TGP Mind.';
    } finally {
      isLoading = false;
    }
  }

  function handlePromptKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) isOpen = false;
  }

  function handleWikiKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') searchWikimedia();
  }
</script>

<!-- ── TRIGGER ─────────────────────────────────────────────────────────────── -->
<button
  type="button"
  id="tgp-vision-board-trigger"
  class="sc-trigger"
  on:click={() => (isOpen = true)}
>
  <div class="sc-trigger-inner">
    <div class="sc-trigger-left">
      <h2 class="sc-trigger-title">TGP Vision / Iconografía</h2>
      <p class="sc-trigger-desc">
        Análisis visual profundo, semiótica iconográfica y consulta directa en Wikimedia Commons.
      </p>
    </div>
    <span class="sc-trigger-badge">Multimodal</span>
  </div>
</button>

<!-- ── OVERLAY / BOARD ────────────────────────────────────────────────────── -->
{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="tvb-overlay tvb-root"
    on:click={handleOverlayClick}
    role="dialog"
    aria-modal="true"
    aria-label="TGP Vision Board"
  >
    <div class="tvb-board">

      <!-- Header -->
      <header class="tvb-header">
        <div>
          <div class="tvb-kicker">TGP Scriptorium · Motor Cognitivo Multimodal</div>
          <div class="tvb-title">Vision / Iconografía</div>
        </div>
        <button class="tvb-close" on:click={() => (isOpen = false)}>✕ Cerrar</button>
      </header>

      <div class="tvb-workspace">

        <!-- ── IZQUIERDA: Ingesta Visual ──────────────────────────────────── -->
        <div class="tvb-left">

          <!-- Dropzone o Preview -->
          <div>
            <span class="tvb-label">Archivo Local · Drag &amp; Drop</span>

            {#if !previewUrl}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="tvb-dropzone"
                class:dragging={isDragging}
                on:dragover={handleDragOver}
                on:dragleave={handleDragLeave}
                on:drop={handleDrop}
                on:click={() => fileInputEl?.click()}
              >
                <input
                  bind:this={fileInputEl}
                  type="file"
                  accept="image/*"
                  style="display:none"
                  on:change={handleFileChange}
                />
                <div class="tvb-dropzone-icon">⊕</div>
                <div class="tvb-dropzone-text">Arrastrá una imagen aquí</div>
                <div class="tvb-dropzone-sub">o hacé clic · JPG, PNG, WEBP, TIFF, GIF</div>
              </div>
            {:else}
              <div class="tvb-preview-wrap">
                <img src={previewUrl} alt={imageName} class="tvb-preview-img" />
                <div class="tvb-preview-overlay">
                  <span class="tvb-preview-name">{imageName}</span>
                  <span class="tvb-preview-badge">
                    {imageSource === 'wikimedia' ? 'Wikimedia' : 'Local'}
                  </span>
                </div>
                <button class="tvb-preview-clear" on:click={clearImage}>✕</button>
              </div>
            {/if}
          </div>

          <!-- Separador -->
          <div class="tvb-sep">o traer desde Wikimedia Commons</div>

          <!-- Wikimedia panel -->
          {#if !wikiOpen}
            <button class="tvb-wiki-btn" on:click={() => (wikiOpen = true)}>
              <span style="font-size:16px">🔭</span>
              Buscar en Wikimedia Commons
            </button>
          {:else}
            <div class="tvb-wiki-panel">
              <span class="tvb-label">Wikimedia Commons · Búsqueda Directa</span>
              <div class="tvb-wiki-search-row">
                <input
                  class="tvb-wiki-input"
                  placeholder="ej: Roman Forum, Byzantine icon..."
                  bind:value={wikiQuery}
                  on:keydown={handleWikiKeydown}
                />
                <button
                  class="tvb-wiki-search-btn"
                  on:click={searchWikimedia}
                  disabled={wikiLoading || !wikiQuery.trim()}
                >
                  {wikiLoading ? '…' : 'Buscar'}
                </button>
              </div>

              {#if wikiResults.length > 0}
                <div class="tvb-wiki-grid">
                  {#each wikiResults as item, i (i)}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                      class="tvb-wiki-thumb"
                      title={item.title}
                      on:click={() => selectWikiImage(item)}
                    >
                      <img src={item.thumb} alt={item.title} loading="lazy" />
                    </div>
                  {/each}
                </div>
              {:else if !wikiLoading && wikiQuery}
                <div class="tvb-wiki-empty">Sin resultados para "{wikiQuery}"</div>
              {/if}

              <button
                class="tvb-wiki-btn"
                style="padding:8px 12px;font-size:10px"
                on:click={() => (wikiOpen = false)}
              >
                ✕ Cerrar buscador
              </button>
            </div>
          {/if}

        </div>

        <!-- ── DERECHA: Prompt + Resultados ───────────────────────────────── -->
        <div class="tvb-right">
          <div class="tvb-right-top">
            <span class="tvb-label">Instrucción Analítica · Ctrl+Enter para enviar</span>
            <textarea
              bind:this={promptEl}
              bind:value={prompt}
              class="tvb-prompt-area"
              placeholder="Describí qué querés analizar: iconografía, composición, simbología, datación, contexto histórico, atribución estilística..."
              on:keydown={handlePromptKeydown}
              disabled={isLoading}
            ></textarea>
            <div class="tvb-action-row">
              <div class="tvb-status" class:has-image={!!previewUrl}>
                {previewUrl
                  ? `✓ Imagen lista · ${imageSource === 'wikimedia' ? 'Wikimedia Commons' : 'Archivo local'}`
                  : '◌ Sin imagen seleccionada'}
              </div>
              <button
                class="tvb-submit"
                on:click={handleSubmit}
                disabled={!canSubmit}
              >
                {isLoading ? 'Analizando…' : 'Procesar ↵'}
              </button>
            </div>
            {#if error}
              <div class="tvb-error">⚠ {error}</div>
            {/if}
          </div>

          <!-- Resultados -->
          <div class="tvb-results" bind:this={resultsEl}>
            {#if isLoading}
              <div class="tvb-loading">
                <div class="tvb-loading-dots">
                  <div class="tvb-dot"></div>
                  <div class="tvb-dot"></div>
                  <div class="tvb-dot"></div>
                </div>
                <div class="tvb-loading-text">Procesando con Gemini Vision…</div>
              </div>
            {:else if results.length === 0}
              <div class="tvb-results-empty">
                <div class="tvb-results-empty-icon">◈</div>
                <div class="tvb-results-empty-text">
                  Cargá una imagen y escribí tu instrucción<br />
                  para iniciar el análisis visual.
                </div>
              </div>
            {:else}
              {#each results as r, i (i)}
                <div class="tvb-result-card">
                  <div class="tvb-result-thumb">
                    <img src={r.imagePreview} alt={r.imageName} />
                  </div>
                  <div>
                    <div class="tvb-result-meta">
                      <span class="tvb-result-time">
                        {r.timestamp.toLocaleTimeString('es-AR', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </span>
                      <span class="tvb-result-model">gemini-vision</span>
                    </div>
                    <div class="tvb-result-prompt">↳ {r.prompt}</div>
                    <div class="tvb-result-response">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html marked.parse(r.response)}
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>

        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Trigger ──────────────────────────────────────────────────────────── */
  .sc-trigger {
    width: 100%;
    text-align: left;
    padding: 16px;
    border: 1px solid #263231;
    background: #161d1c;
    border-radius: 8px;
    cursor: pointer;
    display: block;
    transition: border-color 0.2s, background 0.2s;
  }
  .sc-trigger:hover {
    border-color: #4a5a58;
    background: #1c2423;
  }
  .sc-trigger-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sc-trigger-left { flex: 1; }
  .sc-trigger-title {
    font-size: 18px;
    font-family: 'Cinzel', 'Georgia', serif;
    color: #f0f2f1;
    font-weight: 400;
    margin: 0 0 4px;
  }
  .sc-trigger:hover .sc-trigger-title { color: #fff; }
  .sc-trigger-desc {
    font-size: 13px;
    color: #8a9a98;
    margin: 0;
    font-family: 'IBM Plex Serif', 'Georgia', serif;
  }
  .sc-trigger-badge {
    font-size: 9px;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #7eb89a;
    background: rgba(126,184,154,0.10);
    border: 1px solid rgba(126,184,154,0.25);
    padding: 3px 8px;
    border-radius: 20px;
    white-space: nowrap;
    margin-left: 12px;
  }

  /* ── Root tokens (Obsidian Void) ─────────────────────────────────────── */
  :global(.tvb-root) {
    --bg: #121413;
    --bg2: #171b19;
    --bg3: #1e2420;
    --border: rgba(180,210,190,0.10);
    --border-hover: rgba(180,210,190,0.25);
    --accent: #7eb89a;
    --accent2: #a8d5b8;
    --text: #dde8e2;
    --text-muted: #7a9186;
    --text-dim: rgba(221,232,226,0.40);
    --font-serif: 'Cinzel', 'Georgia', serif;
    --font-body: 'IBM Plex Serif', 'Newsreader', 'Georgia', serif;
    --font-mono: 'IBM Plex Mono', monospace;
    --radius: 10px;
  }

  /* ── Overlay ─────────────────────────────────────────────────────────── */
  :global(.tvb-overlay) {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(0,0,0,0.88);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 28px 16px;
    overflow-y: auto;
  }
  :global(.tvb-board) {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    width: 100%;
    max-width: 1200px;
    min-height: 80vh;
    display: grid;
    grid-template-rows: auto 1fr;
    box-shadow: 0 32px 120px rgba(0,0,0,0.9);
    overflow: hidden;
  }
  :global(.tvb-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 28px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
  }
  :global(.tvb-kicker) {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 4px;
  }
  :global(.tvb-title) {
    font-family: var(--font-serif);
    font-size: 20px;
    font-weight: 400;
    color: var(--text);
    letter-spacing: 0.08em;
  }
  :global(.tvb-close) {
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 14px;
    color: var(--text-muted);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: all 0.2s;
  }
  :global(.tvb-close:hover) {
    border-color: var(--border-hover);
    color: var(--text);
  }
  :global(.tvb-workspace) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    overflow: hidden;
  }
  @media (max-width: 860px) {
    :global(.tvb-workspace) { grid-template-columns: 1fr; }
  }
  :global(.tvb-left) {
    padding: 24px 24px 24px 28px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }
  :global(.tvb-label) {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8px;
    display: block;
  }
  :global(.tvb-dropzone) {
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    background: var(--bg2);
    min-height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.25s ease;
  }
  :global(.tvb-dropzone.dragging),
  :global(.tvb-dropzone:hover) {
    border-color: var(--accent);
    background: rgba(126,184,154,0.04);
  }
  :global(.tvb-dropzone-icon) { font-size: 36px; opacity: 0.3; }
  :global(.tvb-dropzone-text) {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: center;
  }
  :global(.tvb-dropzone-sub) { font-size: 10px; color: var(--text-dim); text-align: center; }
  :global(.tvb-preview-wrap) {
    position: relative;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg2);
  }
  :global(.tvb-preview-img) {
    width: 100%;
    max-height: 280px;
    object-fit: contain;
    display: block;
  }
  :global(.tvb-preview-overlay) {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px 14px;
    background: linear-gradient(transparent, rgba(0,0,0,0.85));
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  :global(.tvb-preview-name) {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255,255,255,0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }
  :global(.tvb-preview-badge) {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    background: rgba(126,184,154,0.15);
    color: var(--accent);
    padding: 3px 8px;
    border-radius: 20px;
    border: 1px solid rgba(126,184,154,0.2);
  }
  :global(.tvb-preview-clear) {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.7);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(255,255,255,0.6);
    font-size: 12px;
    transition: all 0.2s;
  }
  :global(.tvb-preview-clear:hover) { background: rgba(0,0,0,0.9); color: #fff; }
  :global(.tvb-sep) {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  :global(.tvb-sep::before),
  :global(.tvb-sep::after) {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
  :global(.tvb-wiki-btn) {
    width: 100%;
    padding: 12px 16px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.2s;
  }
  :global(.tvb-wiki-btn:hover) {
    border-color: var(--border-hover);
    color: var(--text);
    background: var(--bg3);
  }
  :global(.tvb-wiki-panel) {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  :global(.tvb-wiki-search-row) { display: flex; gap: 8px; }
  :global(.tvb-wiki-input) {
    flex: 1;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
  }
  :global(.tvb-wiki-input:focus) { border-color: var(--accent); }
  :global(.tvb-wiki-input::placeholder) { color: var(--text-dim); }
  :global(.tvb-wiki-search-btn) {
    padding: 8px 14px;
    background: rgba(126,184,154,0.12);
    border: 1px solid rgba(126,184,154,0.25);
    border-radius: 8px;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  :global(.tvb-wiki-search-btn:hover) { background: rgba(126,184,154,0.22); }
  :global(.tvb-wiki-search-btn:disabled) { opacity: 0.4; cursor: not-allowed; }
  :global(.tvb-wiki-grid) {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  :global(.tvb-wiki-thumb) {
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    aspect-ratio: 1;
    background: var(--bg3);
    transition: border-color 0.2s;
  }
  :global(.tvb-wiki-thumb:hover) { border-color: var(--accent); }
  :global(.tvb-wiki-thumb img) { width: 100%; height: 100%; object-fit: cover; display: block; }
  :global(.tvb-wiki-empty) {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px 0;
  }
  :global(.tvb-right) { display: flex; flex-direction: column; overflow: hidden; }
  :global(.tvb-right-top) {
    padding: 24px 28px 18px 24px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  :global(.tvb-prompt-area) {
    width: 100%;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.7;
    resize: vertical;
    min-height: 120px;
    outline: none;
    transition: border-color 0.2s;
    scrollbar-width: thin;
    box-sizing: border-box;
  }
  :global(.tvb-prompt-area:focus) { border-color: var(--accent); }
  :global(.tvb-prompt-area::placeholder) { color: var(--text-dim); font-style: italic; }
  :global(.tvb-action-row) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    gap: 12px;
  }
  :global(.tvb-status) {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.1em;
  }
  :global(.tvb-status.has-image) { color: var(--accent); }
  :global(.tvb-submit) {
    padding: 11px 24px;
    background: rgba(126,184,154,0.12);
    border: 1px solid rgba(126,184,154,0.3);
    border-radius: var(--radius);
    color: var(--accent2);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  :global(.tvb-submit:hover:not(:disabled)) {
    background: rgba(126,184,154,0.22);
    border-color: rgba(126,184,154,0.55);
  }
  :global(.tvb-submit:disabled) { opacity: 0.4; cursor: not-allowed; }
  :global(.tvb-error) {
    background: rgba(220,80,80,0.08);
    border: 1px solid rgba(220,80,80,0.2);
    border-radius: 8px;
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: #e06060;
    margin-top: 10px;
  }
  :global(.tvb-results) {
    flex: 1;
    overflow-y: auto;
    padding: 20px 28px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  :global(.tvb-results-empty) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 14px;
    opacity: 0.35;
  }
  :global(.tvb-results-empty-icon) { font-size: 40px; }
  :global(.tvb-results-empty-text) {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: center;
    line-height: 2;
  }
  :global(.tvb-loading) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
  }
  :global(.tvb-loading-dots) { display: flex; gap: 8px; }
  :global(.tvb-dot) {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: tvb-bounce 1.2s ease-in-out infinite;
  }
  :global(.tvb-dot:nth-child(2)) { animation-delay: 0.15s; }
  :global(.tvb-dot:nth-child(3)) { animation-delay: 0.30s; }
  :global(@keyframes tvb-bounce) {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50%       { transform: translateY(-8px); opacity: 1; }
  }
  :global(.tvb-loading-text) {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  :global(.tvb-result-card) {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 18px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
  }
  :global(.tvb-result-card:last-child) { border-bottom: none; padding-bottom: 0; }
  :global(.tvb-result-thumb) {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg2);
    height: 85px;
    flex-shrink: 0;
  }
  :global(.tvb-result-thumb img) { width: 100%; height: 100%; object-fit: cover; display: block; }
  :global(.tvb-result-meta) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  :global(.tvb-result-time) {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  :global(.tvb-result-model) {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--accent);
    background: rgba(126,184,154,0.08);
    padding: 2px 8px;
    border-radius: 20px;
    border: 1px solid rgba(126,184,154,0.15);
  }
  :global(.tvb-result-prompt) {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 10px;
    padding: 6px 10px;
    background: var(--bg2);
    border-radius: 6px;
    border-left: 2px solid var(--border-hover);
  }
  :global(.tvb-result-response) {
    font-family: var(--font-body);
    font-size: 14.5px;
    line-height: 1.9;
    color: var(--text);
  }
  :global(.tvb-result-response p)           { margin: 0 0 10px; }
  :global(.tvb-result-response p:last-child) { margin: 0; }
  :global(.tvb-result-response h1),
  :global(.tvb-result-response h2),
  :global(.tvb-result-response h3) {
    font-family: var(--font-serif);
    color: var(--text);
    margin: 14px 0 6px;
    font-size: 15px;
    font-weight: 400;
    letter-spacing: 0.05em;
  }
  :global(.tvb-result-response strong) { color: var(--accent2); }
  :global(.tvb-result-response em) { color: rgba(221,232,226,0.7); font-style: italic; }
  :global(.tvb-result-response blockquote) {
    border-left: 2px solid var(--accent);
    margin: 10px 0;
    padding: 6px 14px;
    color: rgba(221,232,226,0.7);
    font-style: italic;
  }
  :global(.tvb-result-response code) {
    font-family: var(--font-mono);
    font-size: 12px;
    background: rgba(0,0,0,0.4);
    padding: 1px 5px;
    border-radius: 4px;
    color: var(--accent);
  }
  :global(.tvb-result-response ul),
  :global(.tvb-result-response ol) { padding-left: 20px; margin: 8px 0; }
  :global(.tvb-result-response li) { margin-bottom: 4px; }
</style>
