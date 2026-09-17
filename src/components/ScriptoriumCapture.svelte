<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // ScriptoriumCapture.svelte
  // Reimplementación nativa en Svelte 5 de TgpVisionBoard (React)
  // Estética Material You / MD3 Light · Tailwind CSS puro
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
  $: if (typeof document !== 'undefined') {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
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

<!-- ── TRIGGER (Material You Light) ────────────────────────────────────── -->
<button
  type="button"
  id="tgp-vision-board-trigger"
  class="w-full text-left p-6 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer block group"
  on:click={() => (isOpen = true)}
>
  <div class="flex items-center justify-between gap-4">
    <div class="flex-1">
      <h2 class="text-xl font-bold text-zinc-900 mb-1 group-hover:text-zinc-950 transition-colors">
        TGP Vision / Iconografía
      </h2>
      <p class="text-sm text-zinc-600 leading-relaxed">
        Análisis visual profundo, semiótica iconográfica y consulta directa en Wikimedia Commons.
      </p>
    </div>
    <span class="inline-flex items-center px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-full shrink-0 shadow-xs">
      Multimodal
    </span>
  </div>
</button>

<!-- ── OVERLAY / BOARD MODAL (Material You Light) ────────────────────────── -->
{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-9998 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 overflow-y-auto"
    on:click={handleOverlayClick}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="TGP Vision Board"
  >
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-zinc-200 my-auto text-zinc-900 animate-in fade-in zoom-in-95 duration-150">

      <!-- Header del modal -->
      <header class="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-200 bg-zinc-50/90 shrink-0">
        <div>
          <div class="text-xs font-mono font-medium tracking-widest uppercase text-emerald-700">
            TGP Scriptorium · Motor Cognitivo Multimodal
          </div>
          <div class="text-2xl font-bold text-zinc-900 mt-0.5">
            Vision / Iconografía
          </div>
        </div>
        <button
          type="button"
          class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 border border-zinc-200 rounded-full transition-colors cursor-pointer"
          on:click={() => (isOpen = false)}
        >
          ✕ Cerrar
        </button>
      </header>

      <!-- Workspace en 2 columnas -->
      <div class="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">

        <!-- ── COLUMNA IZQUIERDA: Ingesta Visual ─────────────────────────── -->
        <div class="p-6 md:p-8 flex flex-col gap-6 overflow-y-auto bg-zinc-50/50">

          <!-- Dropzone o Preview -->
          <div>
            <span class="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
              Archivo Local · Drag &amp; Drop
            </span>

            {#if !previewUrl}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 {isDragging ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]' : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-400'}"
                on:dragover={handleDragOver}
                on:dragleave={handleDragLeave}
                on:drop={handleDrop}
                on:click={() => fileInputEl?.click()}
              >
                <input
                  bind:this={fileInputEl}
                  type="file"
                  accept="image/*"
                  class="hidden"
                  on:change={handleFileChange}
                />
                <div class="text-3xl text-zinc-400 mb-2">⊕</div>
                <div class="text-base font-semibold text-zinc-800">Arrastrá una imagen aquí</div>
                <div class="text-xs text-zinc-500 mt-1">o hacé clic para explorar · JPG, PNG, WEBP, TIFF, GIF</div>
              </div>
            {:else}
              <div class="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 aspect-video shadow-sm group">
                <img src={previewUrl} alt={imageName} class="w-full h-full object-contain" />
                <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between text-white">
                  <span class="text-xs font-medium truncate max-w-[70%]">{imageName}</span>
                  <span class="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full {imageSource === 'wikimedia' ? 'bg-amber-500/90 text-white' : 'bg-emerald-600 text-white'}">
                    {imageSource === 'wikimedia' ? 'Wikimedia' : 'Local'}
                  </span>
                </div>
                <button
                  type="button"
                  class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center text-sm transition-transform hover:scale-110 cursor-pointer shadow-md"
                  on:click={clearImage}
                  title="Quitar imagen"
                >
                  ✕
                </button>
              </div>
            {/if}
          </div>

          <!-- Separador -->
          <div class="flex items-center gap-3 text-xs text-zinc-400 font-medium my-0">
            <div class="flex-1 h-px bg-zinc-200"></div>
            <span>o traer desde Wikimedia Commons</span>
            <div class="flex-1 h-px bg-zinc-200"></div>
          </div>

          <!-- Wikimedia panel -->
          {#if !wikiOpen}
            <button
              type="button"
              class="w-full py-3 px-4 rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              on:click={() => (wikiOpen = true)}
            >
              <span class="text-base">🔭</span>
              Buscar en Wikimedia Commons
            </button>
          {:else}
            <div class="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-600">Wikimedia Commons · Búsqueda Directa</span>
              <div class="flex gap-2">
                <input
                  class="flex-1 px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  placeholder="ej: Roman Forum, Byzantine icon, Leonardo..."
                  bind:value={wikiQuery}
                  on:keydown={handleWikiKeydown}
                />
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  on:click={searchWikimedia}
                  disabled={wikiLoading || !wikiQuery.trim()}
                >
                  {wikiLoading ? 'Buscando…' : 'Buscar'}
                </button>
              </div>

              {#if wikiResults.length > 0}
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1 border border-zinc-100 rounded-xl bg-zinc-50/50">
                  {#each wikiResults as item, i (i)}
                    <button
                      type="button"
                      class="aspect-square rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-400 transition-all group cursor-pointer"
                      title={item.title}
                      on:click={() => selectWikiImage(item)}
                    >
                      <img src={item.thumb} alt={item.title} loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </button>
                  {/each}
                </div>
              {:else if !wikiLoading && wikiQuery}
                <div class="text-xs text-zinc-500 text-center py-4">Sin resultados para "{wikiQuery}"</div>
              {/if}

              <button
                type="button"
                class="text-xs font-medium text-zinc-500 hover:text-zinc-800 self-end mt-1 cursor-pointer transition-colors"
                on:click={() => (wikiOpen = false)}
              >
                ✕ Cerrar buscador
              </button>
            </div>
          {/if}

        </div>

        <!-- ── COLUMNA DERECHA: Prompt + Resultados ───────────────────────── -->
        <div class="p-6 md:p-8 flex flex-col gap-6 overflow-hidden bg-white">
          <div class="flex flex-col gap-3 shrink-0">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-600">Instrucción Analítica</span>
              <span class="text-[11px] font-mono text-zinc-400">Ctrl + Enter para enviar</span>
            </div>
            <textarea
              bind:this={promptEl}
              bind:value={prompt}
              rows="3"
              class="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-300 rounded-2xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none shadow-xs"
              placeholder="Describí qué querés analizar: iconografía, composición, simbología, datación, contexto histórico, atribución estilística..."
              on:keydown={handlePromptKeydown}
              disabled={isLoading}
            ></textarea>

            <div class="flex items-center justify-between gap-4 mt-1">
              <div class="text-xs font-medium {previewUrl ? 'text-emerald-700' : 'text-zinc-400'} flex items-center gap-1.5">
                <span class="text-sm">{previewUrl ? '✓' : '◌'}</span>
                <span>
                  {previewUrl
                    ? `Imagen lista (${imageSource === 'wikimedia' ? 'Wikimedia' : 'Local'})`
                    : 'Sin imagen seleccionada'}
                </span>
              </div>
              <button
                type="button"
                class="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                on:click={handleSubmit}
                disabled={!canSubmit}
              >
                <span>{isLoading ? 'Analizando…' : 'Procesar'}</span>
                <span class="text-xs">↵</span>
              </button>
            </div>

            {#if error}
              <div class="p-3.5 text-xs rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            {/if}
          </div>

          <!-- Feed de Resultados -->
          <div class="flex-1 overflow-y-auto space-y-4 pr-1 min-h-70" bind:this={resultsEl}>
            {#if isLoading}
              <div class="h-full flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
                <div class="flex gap-2">
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.15s]"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.3s]"></div>
                </div>
                <div class="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Procesando con Gemini Vision…
                </div>
              </div>
            {:else if results.length === 0}
              <div class="h-full flex flex-col items-center justify-center py-16 text-center text-zinc-400 gap-2">
                <div class="text-3xl text-zinc-300">◈</div>
                <div class="text-sm font-medium text-zinc-500">
                  Cargá una imagen y escribí tu instrucción<br />para iniciar el análisis visual.
                </div>
              </div>
            {:else}
              {#each results as r, i (i)}
                <div class="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 shadow-xs flex flex-col md:flex-row gap-5">
                  <div class="w-24 h-24 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 shrink-0 self-start">
                    <img src={r.imagePreview} alt={r.imageName} class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-[11px] font-mono text-zinc-400">
                        {r.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span class="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
                        gemini-vision
                      </span>
                    </div>
                    <div class="text-xs font-semibold text-zinc-800 mb-2 italic">
                      ↳ "{r.prompt}"
                    </div>
                    <div class="prose prose-zinc max-w-none text-xs leading-relaxed text-zinc-700">
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
