<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // ScriptoriumCapture.svelte
  // Reimplementación nativa en Svelte 5 de TgpVisionBoard (React)
  // Estética Material You / MD3 Light · Tailwind CSS puro
  // ─────────────────────────────────────────────────────────────────────────────
  import { marked } from 'marked';
  import { openGooglePicker } from '../lib/google-picker';
  import { ejecutarIngestaExhaustiva, ejecutarRedaccionPremium } from '../lib/vision-osint';

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
    d1Id?: string;
    r2Url?: string;
    audioUrl?: string;
    premiumLoading?: boolean;
    premiumError?: string;
  }

  // ── Config ────────────────────────────────────────────────────────────────
  const API_KEY = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_TGP_MIND_API_KEY : null) ?? '2771';
  const TGP_MIND_URL = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_TGP_MIND_URL)
    ? import.meta.env.PUBLIC_TGP_MIND_URL
    : 'https://tgp-mind-713934653057.us-central1.run.app';
  const VISION_ENDPOINT = `${TGP_MIND_URL}/api/vision`;
  const EXHAUSTIVE_ENDPOINT = `${TGP_MIND_URL}/api/vision-exhaustivo`;
  const PREMIUM_ENDPOINT = `${TGP_MIND_URL}/api/redaccion-premium`;
  const BOT_GENERATE_ENDPOINT = `${TGP_MIND_URL}/api/bot/generate`;
  const GOOGLE_PICKER_KEY = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_GOOGLE_PICKER_API_KEY : null) || 'AIzaSyD7Cf-awQfcVb_9i1GJfmLKPngpp6bzoiM';
  const GOOGLE_CLIENT_ID = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_GOOGLE_CLIENT_ID : null) || '713934653057-f6er90sfdhmc6a8cjb3is51t2sjhgecv.apps.googleusercontent.com';

  // ── Prop de Integración ───────────────────────────────────────────────────
  export let embedded = false;

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

  // ── Estado Cascada Cognitiva & Puesto de Mando (Desk) ─────────────────────
  let showManualPrompt = true;
  let activePillLabel = 'Informe Base';
  let manualDensidad: 'breve' | 'profundo_breve' | 'premium' = 'profundo_breve';
  let manualModelo: 'flash' | 'pro' = 'pro';
  let selectedCollection = 'ensayosCinematicos';

  // Refs de DOM (Svelte bind:this)
  let promptEl: HTMLTextAreaElement;
  let resultsEl: HTMLDivElement;
  let fileInputEl: HTMLInputElement;

  // ── Bloqueo de Scroll al abrir modal (solo en modo popup) ──────────────────
  $: if (typeof document !== 'undefined') {
    if (isOpen && !embedded) {
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

  // ── Submit a Gemini Vision / Data Lake OSINT / Puesto de Mando ────────────
  async function handleSubmit(e?: Event, labelOverride?: string, promptOverride?: string) {
    e?.preventDefault();
    const finalPrompt = (promptOverride ?? prompt).trim();
    const finalLabel = labelOverride ?? activePillLabel ?? 'Manual';
    if (!finalPrompt || isLoading) return;
    if (finalLabel !== 'Manual' && (!hasImage || !imageFile)) return;

    isLoading = true;
    error = null;
    try {
      let resultText = '';
      let d1Id: string | undefined = undefined;
      let r2Url: string | undefined = undefined;

      // FLUJO A: Puesto de Mando (ChatOps Desk) → Enrutador Maestro Cloud Run
      if (finalLabel === 'Manual') {
        let photoUrl = '';

        if (imageFile) {
          try {
            const { base64, mimeType } = await fileToBase64(imageFile);
            const fullBase64 = `data:${mimeType};base64,${base64}`;
            const osintData = await ejecutarIngestaExhaustiva(EXHAUSTIVE_ENDPOINT, fullBase64, API_KEY);
            photoUrl = osintData.imagen_url || '';
            r2Url = osintData.imagen_url;
            d1Id = osintData.id;
          } catch (imgErr) {
            console.warn('[Scriptorium Desk] Continuó sin R2 previo:', imgErr);
          }
        }

        const res = await fetch(BOT_GENERATE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'X-Mini-App': 'true',
          },
          body: JSON.stringify({
            tema: finalPrompt,
            destino: selectedCollection,
            modelo: manualModelo,
            densidad: manualDensidad,
            modoLibrePrompt: finalPrompt,
            photoUrl: photoUrl || previewUrl || '',
            imagen: photoUrl ? 'r2' : (hasImage ? 'custom' : 'wikimedia'),
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Orquestador TGP (${res.status}): ${errText}`);
        }

        const data = await res.json();
        resultText = data.texto || data.response || '(Respuesta generada por TGP Mind)';
        if (data.imagenUrl && !r2Url) {
          r2Url = data.imagenUrl;
        }

        results = [{
          prompt: finalPrompt,
          pillLabel: `Puesto de Mando · ${selectedCollection}`,
          response: resultText,
          imagePreview: r2Url || previewUrl || '',
          imageSource,
          imageName: imageName || 'consulta-manual',
          timestamp: new Date(),
          transmuteStatus: 'idle',
          d1Id,
          r2Url,
        }, ...results];

        prompt = '';
        setTimeout(() => resultsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        return;
      }

      // FLUJO B: Presets de Cascada Cognitiva (OSINT Data Lake Clásico)
      const { base64, mimeType } = await fileToBase64(imageFile!);
      const fullBase64 = `data:${mimeType};base64,${base64}`;

      try {
        const osintData = await ejecutarIngestaExhaustiva(EXHAUSTIVE_ENDPOINT, fullBase64, API_KEY);
        resultText = osintData.informe || '';
        d1Id = osintData.id;
        r2Url = osintData.imagen_url;
      } catch (osintErr) {
        console.warn('[Scriptorium] Falló ingesta exhaustiva, ejecutando fallback Vision directo:', osintErr);
        const res = await fetch(VISION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ prompt: finalPrompt, base64, mimeType }),
        });
        if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
        const data = await res.json();
        resultText = data.response ?? '(Sin respuesta)';
      }

      results = [{
        prompt: finalPrompt,
        pillLabel: finalLabel,
        response: resultText,
        imagePreview: r2Url || previewUrl || '',
        imageSource,
        imageName,
        timestamp: new Date(),
        transmuteStatus: 'idle',
        d1Id,
        r2Url,
      }, ...results];

      setTimeout(() => resultsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err: any) {
      error = err.message ?? 'Error de conexión con TGP Mind.';
    } finally {
      isLoading = false;
    }
  }

  // ── Generar Ensayo Pro + Audio TTS (Google Cloud TTS es-AR) ─────────────
  async function generarEnsayoAudio(index: number, r: VisionResult) {
    results = results.map((item, i) =>
      i === index ? { ...item, premiumLoading: true, premiumError: undefined } : item
    );
    try {
      const data = await ejecutarRedaccionPremium(
        PREMIUM_ENDPOINT,
        r.d1Id || 'manual',
        API_KEY,
        r.response
      );
      results = results.map((item, i) =>
        i === index
          ? {
              ...item,
              premiumLoading: false,
              response: `${item.response}\n\n---\n\n### 🎙 Ensayo Premium Grounded (TGP Mind)\n\n${data.ensayo}`,
              audioUrl: data.audio_url || undefined,
            }
          : item
      );
    } catch (err: any) {
      results = results.map((item, i) =>
        i === index ? { ...item, premiumLoading: false, premiumError: err.message } : item
      );
    }
  }

  function handlePromptKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit(undefined, 'Manual');
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) isOpen = false;
  }

  // ── Transmutación → Keystatic CMS ─────────────────────────────────────────
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
          r2Url: r.r2Url,
          d1Id: r.d1Id,
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

{#if !embedded}
  <!-- ── TRIGGER (Solo si no está embebido) ──────────────────────────── -->
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
{/if}

<!-- ── WORKSPACE BOARD (Embebido o Modal) ────────────────────────────────── -->
{#if isOpen || embedded}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class={embedded ? 'w-full' : 'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none'}
    on:click={!embedded ? handleOverlayClick : undefined}
    role={!embedded ? 'dialog' : undefined}
    aria-modal={!embedded ? 'true' : undefined}
    aria-label="TGP Vision Board"
  >
    <div class="bg-white rounded-3xl shadow-xl w-full {embedded ? 'max-w-7xl' : 'max-w-6xl h-[88vh] max-h-[88vh] shadow-2xl overflow-hidden'} flex flex-col border border-zinc-200 text-zinc-900 select-auto">

      <!-- Header del workspace -->
      <header class="flex items-center justify-between px-6 md:px-8 py-3.5 border-b border-zinc-200 bg-zinc-50/95 shrink-0">
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
          {#if !embedded}
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 border border-zinc-200 rounded-full transition-colors cursor-pointer"
              on:click={() => (isOpen = false)}
            >
              ✕ Cerrar
            </button>
          {/if}
        </div>
      </header>

      <!-- Workspace en 2 columnas -->
      <div class="grid grid-cols-1 lg:grid-cols-2 flex-1 {embedded ? 'items-start' : 'min-h-0 overflow-hidden'} divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">

        <!-- ── COLUMNA IZQUIERDA: Ingesta Visual (limpia y anclada) ──────── -->
        <div class="p-6 md:p-8 flex flex-col gap-5 {embedded ? 'lg:sticky lg:top-6 self-start' : 'overflow-y-auto'} bg-zinc-50/50">

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
            <span>{pickerLoading ? 'Abriendo Google Fotos…' : 'Abrir mis Fotos (Google Fotos)'}</span>
          </button>

          <!-- Nota informativa anclada -->
          <div class="mt-auto p-4 rounded-xl bg-zinc-100/70 border border-zinc-200/80 text-[11px] text-zinc-500 leading-relaxed">
            <span class="font-semibold text-zinc-700">TGP Scriptorium:</span> Accedé a tus imágenes locales o navegá por tus carpetas y fotos en Google Cloud sin salir de la interfaz.
          </div>

        </div>

        <!-- ── COLUMNA DERECHA: Prompt + Resultados ───────────────────────── -->
        <!-- ── COLUMNA DERECHA: Cascada Cognitiva (Material You Light) ────── -->
        <div class="p-6 md:p-8 flex flex-col gap-6 {embedded ? '' : 'overflow-hidden min-h-0'} bg-white">
          <div class="flex flex-col gap-3.5 {embedded ? '' : 'shrink-0'} bg-zinc-50 p-5 rounded-3xl border border-zinc-200 shadow-sm">
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

              <!-- Chip 3: Puesto de Mando (Modo Manual / ChatOps) -->
              <button
                type="button"
                on:click={() => (showManualPrompt = !showManualPrompt)}
                class="px-3.5 py-2 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer
                {showManualPrompt 
                  ? 'bg-zinc-900 border-zinc-900 text-white shadow-xs' 
                  : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700 shadow-2xs'}"
              >
                🎛 Puesto de Mando {showManualPrompt ? '▲' : '▼'}
              </button>
            </div>

            <!-- PUESTO DE MANDO (DESK / INBOX AMPLIO) -->
            {#if showManualPrompt}
              <div class="mt-2 space-y-3 pt-3 border-t bg-zinc-50/60 p-4 rounded-2xl border border-zinc-200/90 shadow-2xs">
                
                <!-- Barra Superior del Desk: Destino Colección + Badges -->
                <div class="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-zinc-200/70">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Colección Destino:
                    </span>
                    <select
                      bind:value={selectedCollection}
                      class="text-xs py-1.5 px-3 bg-white border border-zinc-300 rounded-xl text-zinc-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                      title="Selecciona la colección de destino en Keystatic"
                    >
                      <option value="ensayosCinematicos">Ensayos Cinemáticos - GSAP</option>
                      <option value="ensayos">Ensayos</option>
                      <option value="arquetiposGlobales">Arquetipos Globales</option>
                      <option value="direccionDeArte">Dirección de Arte - IA</option>
                      <option value="georreferencias">Georreferencias Arqueosemióticas</option>
                      <option value="informesPremium">Informes Premium</option>
                    </select>
                  </div>
                  <span class="text-[11px] font-mono text-zinc-400">Ctrl + Enter para enviar</span>
                </div>

                <!-- Panel de Control de Tiers (Densidad + Motor) -->
                <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <!-- Selector de Densidad (3 Tiers) -->
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold mr-1">Densidad:</span>
                    <button
                      type="button"
                      on:click={() => (manualDensidad = 'breve')}
                      class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs
                        {manualDensidad === 'breve'
                          ? 'bg-emerald-600 text-white border-emerald-700 font-semibold'
                          : 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-200'}"
                    >
                      ⚡ Breve (~800t)
                    </button>
                    <button
                      type="button"
                      on:click={() => (manualDensidad = 'profundo_breve')}
                      class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs
                        {manualDensidad === 'profundo_breve'
                          ? 'bg-emerald-600 text-white border-emerald-700 font-semibold'
                          : 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-200'}"
                    >
                      🧠 Profundo (~1500t)
                    </button>
                    <button
                      type="button"
                      on:click={() => (manualDensidad = 'premium')}
                      class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs
                        {manualDensidad === 'premium'
                          ? 'bg-purple-700 text-white border-purple-800 font-semibold'
                          : 'bg-white text-purple-900 hover:bg-purple-50 border-purple-200'}"
                    >
                      🏛️ Tratado (+4500t)
                    </button>
                  </div>

                  <!-- Selector de Motor (Flash vs Pro) -->
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold mr-1">Motor:</span>
                    <button
                      type="button"
                      on:click={() => (manualModelo = 'flash')}
                      class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs
                        {manualModelo === 'flash'
                          ? 'bg-amber-600 text-white border-amber-700 font-semibold'
                          : 'bg-white text-zinc-700 hover:bg-amber-50 border-zinc-200'}"
                    >
                      ⚡ Flash
                    </button>
                    <button
                      type="button"
                      on:click={() => (manualModelo = 'pro')}
                      class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs
                        {manualModelo === 'pro'
                          ? 'bg-blue-600 text-white border-blue-700 font-semibold'
                          : 'bg-white text-zinc-700 hover:bg-blue-50 border-zinc-200'}"
                    >
                      🧠 Pro (Grounded)
                    </button>
                  </div>
                </div>

                <!-- Textarea Amplio Tipo Desk (Puesto de Mando) -->
                <textarea
                  bind:this={promptEl}
                  bind:value={prompt}
                  rows="6"
                  class="w-full px-4 py-3.5 text-sm bg-white border border-zinc-300 rounded-2xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-y shadow-inner font-sans leading-relaxed min-h-35"
                  placeholder="Escribe tu consulta, mini-charla reflexiva o instrucción ChatOps. Admite Slash Commands directos (ej: /video fascinum romano o /hemeroteca pro 1500t El mito de Ícaro)..."
                  on:keydown={handlePromptKeydown}
                  disabled={isLoading}
                ></textarea>

                <!-- Footer del Desk con Botón de Ejecución Directa -->
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span class="text-[11px] font-mono text-zinc-500">
                    💡 Admite diálogo extenso o Slash Commands directos hacia el Orquestador Cloud Run.
                  </span>
                  <button
                    type="button"
                    disabled={!prompt.trim() || isLoading}
                    on:click={() => handleSubmit(undefined, 'Manual')}
                    class="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                  >
                    {#if isLoading && activePillLabel === 'Manual'}
                      <span class="animate-spin text-sm">⟳</span>
                      <span>Orquestando en Cloud Run…</span>
                    {:else}
                      <span>⚡ Ejecutar en Puesto de Mando ↵</span>
                    {/if}
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
          <div class="{embedded ? 'space-y-4 pt-2' : 'flex-1 min-h-0 overflow-y-auto space-y-4 pr-1'}" bind:this={resultsEl}>
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
                  <!-- Header con píldora, timestamp y badges de R2/D1 -->
                  <header class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 pb-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-2xs
                        {r.pillLabel === 'Informe Base' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' :
                         r.pillLabel === 'Arqueohistoria' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                         r.pillLabel === 'Hermenéutica' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                         'bg-zinc-200 text-zinc-800 border border-zinc-300'}">
                        {r.pillLabel || 'Informe Base'}
                      </span>
                      {#if r.d1Id}
                        <span class="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200" title="Registro persistido en Cloudflare D1">
                          🗄 D1: {r.d1Id.slice(0, 8)}…
                        </span>
                      {/if}
                      {#if r.r2Url}
                        <a href={r.r2Url} target="_blank" rel="noopener noreferrer" class="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:underline" title="Ver imagen en Cloudflare R2">
                          ☁ R2 Image ↗
                        </a>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[11px] font-mono text-zinc-500">
                        {r.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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

                  <!-- ── BARRA DE ACCIÓN PRINCIPAL (Siempre visible arriba) ── -->
                  <div class="p-3 bg-white rounded-2xl border border-zinc-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={r.transmuteStatus === 'sending' || r.transmuteStatus === 'success'}
                        on:click={() => transmuteToKeystatic(i, r)}
                        class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer disabled:cursor-not-allowed
                          {r.transmuteStatus === 'success'
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                            : r.transmuteStatus === 'error'
                            ? 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100'
                            : r.transmuteStatus === 'sending'
                            ? 'bg-zinc-100 border-zinc-300 text-zinc-500 opacity-70'
                            : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white shadow-xs'}"
                      >
                        {#if r.transmuteStatus === 'sending'}
                          <span class="animate-spin text-sm">⟳</span>
                          <span>Guardando…</span>
                        {:else if r.transmuteStatus === 'success'}
                          <span>✅</span>
                          <span>Guardado en Keystatic</span>
                        {:else if r.transmuteStatus === 'error'}
                          <span>⚠ Reintentar</span>
                        {:else}
                          <span>⚡ Guardar en Hemeroteca</span>
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

                    <!-- Botón Ensayo Premium + Audio TTS -->
                    <button
                      type="button"
                      disabled={r.premiumLoading}
                      on:click={() => generarEnsayoAudio(i, r)}
                      class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                      title="Genera un ensayo profundo con Grounding y audio TTS es-AR"
                    >
                      {#if r.premiumLoading}
                        <span class="animate-spin text-xs">⟳</span>
                        <span>Generando Ensayo & Audio…</span>
                      {:else}
                        <span>🎙</span>
                        <span>Ensayo Pro + Audio TTS</span>
                      {/if}
                    </button>
                  </div>

                  {#if r.audioUrl}
                    <div class="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl flex flex-col gap-1.5">
                      <div class="flex items-center justify-between text-xs text-purple-900 font-semibold">
                        <span>🎧 Audio Neuronal (es-AR):</span>
                        <a href={r.audioUrl} target="_blank" rel="noopener noreferrer" class="font-mono text-[11px] text-purple-700 hover:underline">Descargar MP3 ↗</a>
                      </div>
                      <audio controls class="w-full h-8" src={r.audioUrl}></audio>
                    </div>
                  {/if}

                  {#if r.premiumError}
                    <div class="p-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl">
                      ⚠ Error al generar Ensayo Pro: {r.premiumError}
                    </div>
                  {/if}

                  <!-- Contenido Markdown y Vista de Imagen -->
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
                </div>
              {/each}
            {/if}
          </div>

        </div>
      </div>
    </div>
  </div>
{/if}
