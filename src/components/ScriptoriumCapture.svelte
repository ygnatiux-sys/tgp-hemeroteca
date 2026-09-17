<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // ScriptoriumCapture.svelte
  // Reimplementación nativa en Svelte 5 de TgpVisionBoard (React)
  // Estética Material You / MD3 Light · Tailwind CSS puro
  // ─────────────────────────────────────────────────────────────────────────────
  import { marked } from 'marked';
  import { openGooglePicker } from '../lib/google-picker';

  // ── Tipos ─────────────────────────────────────────────────────────────────
  type TransmuteStatus = 'idle' | 'sending' | 'success' | 'error';

  interface VisionResult {
    prompt: string;
    pillLabel: string;
    response: string;
    imagePreview: string;
    imageSource: 'local' | 'google';
    imageName: string;
    timestamp: Date;
    transmuteStatus: TransmuteStatus;
    transmuteError?: string;
  }

  // ── Config ────────────────────────────────────────────────────────────────
  const API_KEY = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_TGP_MIND_API_KEY : null) ?? '2771';
  const VISION_ENDPOINT = import.meta.env.DEV
    ? 'http://localhost:3001/api/vision'
    : 'https://tgp-mind-713934653057.us-central1.run.app/api/vision';
  const GOOGLE_PICKER_KEY = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_GOOGLE_PICKER_API_KEY : null) ?? '';
  const GOOGLE_CLIENT_ID = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_GOOGLE_CLIENT_ID : null) ?? '';

  // ── Estado del Trigger ────────────────────────────────────────────────────
  let isOpen = false;

  // ── Estado del Board ──────────────────────────────────────────────────────
  let imageFile: File | null = null;
  let imageSource: 'local' | 'google' = 'local';
  let previewUrl: string | null = null;
  let imageName = '';
  let prompt = '';
  let isLoading = false;
  let isDragging = false;
  let results: VisionResult[] = [];
  let error: string | null = null;
  let pickerLoading = false;

  // ── Estado Cascada Cognitiva ──────────────────────────────────────────────
  let showManualPrompt = false;
  let activePillLabel = 'Informe Base';

  // Refs de DOM (Svelte bind:this)
  let promptEl: HTMLTextAreaElement;
  let resultsEl: HTMLDivElement;
  let fileInputEl: HTMLInputElement;

  // ── Bloqueo de Scroll al abrir modal ──────────────────────────────────────
  $: if (typeof document !== 'undefined') {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  $: hasImage = !!imageFile && !!previewUrl;
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

  // ── Carga de imagen (Local o Google Picker) ────────────────────────────────
  function loadFile(file: File, source: 'local' | 'google' = 'local') {
    if (!file.type.startsWith('image/')) {
      error = 'Solo se aceptan archivos de imagen (JPG, PNG, WEBP, GIF, TIFF).';
      return;
    }
    imageFile = file;
    imageSource = source;
    imageName = file.name;
    previewUrl = URL.createObjectURL(file);
    error = null;
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) loadFile(file, 'local');
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
    if (file) loadFile(file, 'local');
  }

  function clearImage() {
    imageFile = null;
    previewUrl = null;
    imageName = '';
    if (fileInputEl) fileInputEl.value = '';
  }

  // ── Google Picker Nativo (Drive / Fotos) ─────────────────────────────────
  function abrirGooglePicker() {
    pickerLoading = true;
    error = null;
    openGooglePicker({
      apiKey: GOOGLE_PICKER_KEY,
      clientId: GOOGLE_CLIENT_ID,
      onSelect: (file: File) => {
        pickerLoading = false;
        loadFile(file, 'google');
      },
      onError: (err) => {
        pickerLoading = false;
        error = `Google Picker: ${err.message}`;
      },
    });
  }

  // ── Disparadores Cascada Cognitiva ───────────────────────────────────────
  async function triggerPreset(label: string, presetPrompt: string) {
    if (!hasImage || isLoading) return;
    prompt = presetPrompt;
    activePillLabel = label;
    await handleSubmit(undefined, label, presetPrompt);
  }

  // ── Submit a Gemini Vision ────────────────────────────────────────────────
  async function handleSubmit(e?: Event, labelOverride?: string, promptOverride?: string) {
    e?.preventDefault();
    const finalPrompt = (promptOverride ?? prompt).trim();
    if (!hasImage || !finalPrompt || isLoading || !imageFile) return;
    const finalLabel = labelOverride ?? activePillLabel ?? 'Manual';
    isLoading = true;
    error = null;
    try {
      const { base64, mimeType } = await fileToBase64(imageFile);
      const res = await fetch(VISION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ prompt: finalPrompt, base64, mimeType }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      results = [{
        prompt: finalPrompt,
        pillLabel: finalLabel,
        response: data.response ?? '(Sin respuesta)',
        imagePreview: previewUrl ?? '',
        imageSource,
        imageName,
        timestamp: new Date(),
        transmuteStatus: 'idle',
      }, ...results];
      if (showManualPrompt) {
        prompt = '';
      }
      setTimeout(() => resultsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err: any) {
      error = err.message ?? 'Error de conexión con TGP Mind.';
    } finally {
      isLoading = false;
    }
  }

  function handlePromptKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit(undefined, 'Manual');
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) isOpen = false;
  }

  // ── Transmutación → Keystatic CMS ─────────────────────────────────────────
  let selectedCollection = 'ensayosCinematicos';

  async function transmuteToKeystatic(index: number, r: VisionResult) {
    results = results.map((item, i) =>
      i === index ? { ...item, transmuteStatus: 'sending', transmuteError: undefined } : item
    );
    try {
      const res = await fetch('/api/hemeroteca/transmute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: selectedCollection,
          pillLabel: r.pillLabel,
          prompt: r.prompt,
          response: r.response,
          imageName: r.imageName,
          imageSource: r.imageSource,
          timestamp: r.timestamp.toISOString(),
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      results = results.map((item, i) =>
        i === index ? { ...item, transmuteStatus: 'success' } : item
      );
    } catch (err: any) {
      results = results.map((item, i) =>
        i === index ? { ...item, transmuteStatus: 'error', transmuteError: err.message } : item
      );
    }
  }
</script>

<!-- ── TRIGGER ──────────────────────────────────────────────────────────── -->
<button
  type="button"
  id="tgp-vision-board-trigger"
  class="w-full text-left p-5 bg-[#161d1c] hover:bg-[#1c2423] border border-[#263231] hover:border-[#4a5a58] rounded-xl transition-all duration-200 cursor-pointer block group shadow-sm"
  on:click={() => (isOpen = true)}
>
  <div class="flex items-center justify-between gap-4">
    <div class="flex-1">
      <div class="flex items-center gap-2 mb-1">
        <h2 class="text-lg font-serif text-[#f0f2f1] group-hover:text-white transition-colors">
          TGP Vision / Iconografía
        </h2>
        <span class="text-[10px] uppercase font-mono tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full shrink-0">
          Modal Rápido
        </span>
      </div>
      <p class="text-sm text-[#8a9a98] leading-relaxed">
        Análisis visual profundo, semiótica iconográfica e ingesta directa con Google Drive / Fotos.
      </p>
    </div>
    <span class="inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 rounded-full shrink-0 shadow-xs">
      Multimodal
    </span>
  </div>
</button>

<!-- ── OVERLAY / BOARD MODAL (Material You Light) ────────────────────────── -->
{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none"
    on:click={handleOverlayClick}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="TGP Vision Board"
  >
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[88vh] max-h-[88vh] flex flex-col overflow-hidden border border-zinc-200 text-zinc-900 select-auto">

      <!-- Header del modal -->
      <header class="flex items-center justify-between px-6 md:px-8 py-4 border-b border-zinc-200 bg-zinc-50/95 shrink-0">
        <div>
          <div class="text-[11px] font-mono font-medium tracking-widest uppercase text-emerald-700">
            TGP Scriptorium · Motor Cognitivo Multimodal
          </div>
          <div class="text-xl font-bold text-zinc-900 mt-0.5">
            Vision / Iconografía
          </div>
        </div>
        <div class="flex items-center gap-3">
          <a
            href="/tgp-app/"
            class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-200 rounded-full transition-colors inline-flex items-center gap-1.5 shadow-xs"
            title="Volver al Panel Principal de TGP App"
          >
            ← Volver al Hub
          </a>
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 border border-zinc-200 rounded-full transition-colors cursor-pointer"
            on:click={() => (isOpen = false)}
          >
            ✕ Cerrar
          </button>
        </div>
      </header>

      <!-- Workspace en 2 columnas -->
      <div class="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">

        <!-- ── COLUMNA IZQUIERDA: Ingesta Visual (limpia y anclada) ──────── -->
        <div class="p-6 md:p-8 flex flex-col gap-5 overflow-y-auto bg-zinc-50/50">

          <!-- Selección / Ingesta de Imagen -->
          <div class="flex flex-col gap-2">
            <span class="block text-xs font-bold uppercase tracking-wider text-zinc-600">
              1. Selección de Imagen
            </span>

            {#if !previewUrl}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-55 {isDragging ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]' : 'border-zinc-300 bg-white hover:bg-zinc-50 hover:border-zinc-400'}"
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
                <div class="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-3 shadow-xs">
                  ↑
                </div>
                <div class="text-base font-semibold text-zinc-800">Arrastrá una imagen aquí</div>
                <div class="text-xs text-zinc-500 mt-1">o hacé clic para explorar desde tu equipo</div>
                <div class="text-[11px] text-zinc-400 mt-2 font-mono">JPG · PNG · WEBP · GIF · TIFF</div>
              </div>
            {:else}
              <div class="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 aspect-video shadow-md group flex items-center justify-center">
                <img src={previewUrl} alt={imageName} class="w-full h-full object-contain" />
                <div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-3.5 flex items-center justify-between text-white">
                  <span class="text-xs font-medium truncate max-w-[70%]" title={imageName}>{imageName}</span>
                  <span class="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full {imageSource === 'google' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}">
                    {imageSource === 'google' ? 'Google Cloud' : 'Archivo Local'}
                  </span>
                </div>
                <button
                  type="button"
                  class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center text-sm transition-transform hover:scale-110 cursor-pointer shadow-md"
                  on:click={clearImage}
                  title="Quitar imagen"
                >
                  ✕
                </button>
              </div>
            {/if}
          </div>

          <!-- Separador -->
          <div class="flex items-center gap-3 text-xs text-zinc-400 font-medium">
            <div class="flex-1 h-px bg-zinc-200"></div>
            <span>o desde tu nube de Google</span>
            <div class="flex-1 h-px bg-zinc-200"></div>
          </div>

          <!-- Botón de apertura nativa del Google Picker -->
          <button
            type="button"
            class="w-full py-4 px-5 rounded-2xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-900 font-semibold text-sm flex items-center justify-center gap-3 transition-all duration-150 cursor-pointer shadow-xs hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed group"
            on:click={abrirGooglePicker}
            disabled={pickerLoading}
          >
            <svg class="w-5 h-5 shrink-0 text-blue-600 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
            </svg>
            <span>{pickerLoading ? 'Abriendo Google Picker…' : 'Abrir Google Drive / Google Fotos'}</span>
          </button>

          <!-- Nota informativa anclada -->
          <div class="mt-auto p-4 rounded-xl bg-zinc-100/70 border border-zinc-200/80 text-[11px] text-zinc-500 leading-relaxed">
            <span class="font-semibold text-zinc-700">TGP Scriptorium:</span> Accedé a tus imágenes locales o navegá por tus carpetas y fotos en Google Cloud sin salir de la interfaz.
          </div>

        </div>

        <!-- ── COLUMNA DERECHA: Prompt + Resultados ───────────────────────── -->
        <!-- ── COLUMNA DERECHA: Cascada Cognitiva (Material You Light) ────── -->
        <div class="p-6 md:p-8 flex flex-col gap-5 overflow-hidden bg-white min-h-0">
          <div class="flex flex-col gap-3.5 shrink-0 bg-zinc-50 p-5 rounded-3xl border border-zinc-200 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-600">
                2. Cascada Cognitiva
              </span>
              <div class="text-xs font-medium {hasImage ? 'text-emerald-700' : 'text-zinc-400'} flex items-center gap-1.5">
                <span class="text-sm">{hasImage ? '✓' : '◌'}</span>
                <span>{hasImage ? 'Documento Listo' : 'Requiere Imagen'}</span>
              </div>
            </div>

            <!-- Botón Principal (Informe Base) -->
            <button
              type="button"
              disabled={!hasImage || isLoading}
              on:click={() => triggerPreset('Informe Base', 'Realiza un informe neutral y exhaustivo de esta imagen. Describe literalmente qué se ve, extrae cualquier texto legible (OCR) y señala las entidades principales.')}
              class="w-full p-4 rounded-2xl bg-emerald-100 hover:bg-emerald-200/90 text-emerald-900 border border-emerald-300 font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-between group disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-emerald-200/80 text-emerald-800 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
                  ✦
                </div>
                <div class="text-left">
                  <div class="text-sm font-bold text-emerald-950">Informe Base (OCR + Entidades)</div>
                  <div class="text-xs text-emerald-700 font-normal">Lectura literal, transcripción de texto y catálogo de entidades</div>
                </div>
              </div>
              <span class="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 bg-white/80 rounded-lg text-emerald-800 border border-emerald-200 shadow-2xs">
                {isLoading && activePillLabel === 'Informe Base' ? 'Procesando…' : 'Ejecutar ↵'}
              </span>
            </button>

            <!-- Fila de Píldoras (Chips) -->
            <div class="flex flex-wrap items-center gap-2 pt-0.5">
              <!-- Chip 1: Arqueohistoria -->
              <button
                type="button"
                disabled={!hasImage || isLoading}
                on:click={() => triggerPreset('Arqueohistoria', 'Realiza una inmersión arqueológica e histórica profunda. Identifica filiación estilística, contexto temporal, cruces culturales y anomalías.')}
                class="px-3.5 py-2 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                {activePillLabel === 'Arqueohistoria' && isLoading 
                  ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold' 
                  : 'bg-white hover:bg-amber-50 border-zinc-200 hover:border-amber-300 text-zinc-800 hover:text-amber-900 shadow-2xs'}"
              >
                🏺 Arqueohistoria
              </button>

              <!-- Chip 2: Hermenéutica -->
              <button
                type="button"
                disabled={!hasImage || isLoading}
                on:click={() => triggerPreset('Hermenéutica', 'Decodifica símbolos, geometría sagrada, iconografía o arquetipos. Analiza la materialidad, manufactura y erosión.')}
                class="px-3.5 py-2 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                {activePillLabel === 'Hermenéutica' && isLoading 
                  ? 'bg-purple-100 border-purple-300 text-purple-900 font-semibold' 
                  : 'bg-white hover:bg-purple-50 border-zinc-200 hover:border-purple-300 text-zinc-800 hover:text-purple-900 shadow-2xs'}"
              >
                👁 Hermenéutica
              </button>

              <!-- Chip 3: Manual (Ocultar/Revelar Textarea) -->
              <button
                type="button"
                on:click={() => (showManualPrompt = !showManualPrompt)}
                class="px-3.5 py-2 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer
                {showManualPrompt 
                  ? 'bg-zinc-900 border-zinc-900 text-white shadow-xs' 
                  : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700 shadow-2xs'}"
              >
                ✏ Manual {showManualPrompt ? '▲' : '▼'}
              </button>
            </div>

            <!-- Textarea Ocultable (Modo Manual) -->
            {#if showManualPrompt}
              <div class="mt-2 space-y-2 pt-2 border-t border-zinc-200/70">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
                    Prompt Libre Personalizado
                  </span>
                  <span class="text-[11px] font-mono text-zinc-400">Ctrl + Enter para enviar</span>
                </div>
                <textarea
                  bind:this={promptEl}
                  bind:value={prompt}
                  rows="3"
                  class="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-2xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none shadow-inner"
                  placeholder="Escribe tu consulta o instrucción específica de análisis..."
                  on:keydown={handlePromptKeydown}
                  disabled={isLoading}
                ></textarea>
                <div class="flex justify-end">
                  <button
                    type="button"
                    disabled={!hasImage || !prompt.trim() || isLoading}
                    on:click={() => handleSubmit(undefined, 'Manual')}
                    class="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading && activePillLabel === 'Manual' ? 'Analizando…' : 'Consultar Manualmente ↵'}
                  </button>
                </div>
              </div>
            {/if}

            {#if error}
              <div class="p-3.5 text-xs rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            {/if}
          </div>

          <!-- Feed de Resultados Apilados -->
          <div class="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1" bind:this={resultsEl}>
            {#if isLoading}
              <div class="h-full flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
                <div class="flex gap-2">
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.15s]"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.3s]"></div>
                </div>
                <div class="text-xs font-mono uppercase tracking-widest text-zinc-600 font-medium">
                  {activePillLabel ? `Ejecutando ${activePillLabel} con Gemini Vision…` : 'Procesando con Gemini Vision…'}
                </div>
              </div>
            {:else if results.length === 0}
              <div class="h-full flex flex-col items-center justify-center py-16 text-center text-zinc-400 gap-2">
                <div class="text-3xl text-zinc-300">◈</div>
                <div class="text-sm font-medium text-zinc-600">
                  Carga una imagen y pulsa <strong class="text-zinc-800">Informe Base</strong> o cualquier píldora<br />para iniciar la cascada cognitiva.
                </div>
              </div>
            {:else}
              {#each results as r, i (i)}
                <div class="p-5 rounded-3xl bg-zinc-50 border border-zinc-200 shadow-sm flex flex-col gap-4">
                  <header class="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-2xs
                        {r.pillLabel === 'Informe Base' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' :
                         r.pillLabel === 'Arqueohistoria' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                         r.pillLabel === 'Hermenéutica' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                         'bg-zinc-200 text-zinc-800 border border-zinc-300'}">
                        {r.pillLabel || 'Informe Base'}
                      </span>
                      <span class="text-[11px] font-mono text-zinc-500">
                        {r.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-600 bg-white border border-zinc-200 px-2 py-0.5 rounded-md">
                        gemini-vision
                      </span>
                      <button
                        type="button"
                        class="text-xs font-mono text-zinc-500 hover:text-zinc-900 px-2 py-0.5 rounded hover:bg-zinc-200 transition-colors cursor-pointer"
                        on:click={() => navigator.clipboard.writeText(r.response)}
                        title="Copiar Markdown al portapapeles"
                      >
                        Copiar
                      </button>
                    </div>
                  </header>

                  <div class="flex gap-4 items-start">
                    <div class="w-20 h-20 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shrink-0 shadow-2xs">
                      <img src={r.imagePreview} alt={r.imageName} class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-medium text-zinc-500 mb-2 line-clamp-1 italic">
                        ↳ "{r.prompt}"
                      </div>
                      <div class="prose prose-zinc max-w-none text-xs leading-relaxed text-zinc-800 font-sans">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html marked.parse(r.response)}
                      </div>
                    </div>
                  </div>

                  <!-- ── Botón Transmutar → Keystatic ──────────────────────── -->
                  <div class="pt-3 border-t border-zinc-200/80 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={r.transmuteStatus === 'sending' || r.transmuteStatus === 'success'}
                        on:click={() => transmuteToKeystatic(i, r)}
                        class="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all duration-200 cursor-pointer disabled:cursor-not-allowed
                          {r.transmuteStatus === 'success'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 opacity-80'
                            : r.transmuteStatus === 'error'
                            ? 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100'
                            : r.transmuteStatus === 'sending'
                            ? 'bg-zinc-100 border-zinc-300 text-zinc-500 opacity-70'
                            : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100 hover:border-zinc-400 shadow-2xs'}"
                      >
                        {#if r.transmuteStatus === 'sending'}
                          <span class="animate-spin text-sm">⟳</span>
                          <span>Enviando a Hemeroteca…</span>
                        {:else if r.transmuteStatus === 'success'}
                          <span>✅</span>
                          <span>Guardado en Keystatic</span>
                        {:else if r.transmuteStatus === 'error'}
                          <span>⚠</span>
                          <span>Reintentar Transmutación</span>
                        {:else}
                          <span>⚡</span>
                          <span>Guardar en Hemeroteca</span>
                        {/if}
                      </button>

                      <select
                        bind:value={selectedCollection}
                        class="text-xs py-2 px-3 bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer shadow-2xs font-medium"
                        title="Seleccionar colección de destino en Keystatic"
                      >
                        <option value="ensayosCinematicos">Ensayos Cinemáticos - GSAP</option>
                        <option value="ensayos">Ensayos</option>
                        <option value="arquetiposGlobales">Arquetipos Globales</option>
                        <option value="direccionDeArte">Dirección de Arte - IA</option>
                        <option value="georreferencias">Georreferencias Arqueosemióticas</option>
                        <option value="informesPremium">Informes Premium</option>
                      </select>
                    </div>

                    {#if r.transmuteStatus === 'error' && r.transmuteError}
                      <span class="text-[11px] text-red-600 font-mono truncate max-w-[50%]" title={r.transmuteError}>
                        {r.transmuteError}
                      </span>
                    {/if}
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
