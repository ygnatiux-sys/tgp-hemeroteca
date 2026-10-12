<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // ScriptoriumCapture.svelte
  // Reimplementación nativa en Svelte 5 de TgpVisionBoard (React)
  // Estética Material You / MD3 Light · Tailwind CSS puro
  // ─────────────────────────────────────────────────────────────────────────────
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { openGooglePicker } from '../lib/google-picker';
  import { ejecutarIngestaExhaustiva, ejecutarRedaccionPremium } from '../lib/vision-osint';
  import WikimediaGalleryInbox from './WikimediaGalleryInbox.svelte';

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
    tokenUsage?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
    motorUsado?: 'osint' | 'multimodal';
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
  // Credenciales Google manejadas por el backend (Cloud Run) — sin exposicion en frontend

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
  let isWikiInboxOpen = false;

  // ── Tema Dual: 'dia' (Brand Gemini limpio) vs 'noche' (#121314 con ambient glow) ──
  let theme: 'dia' | 'noche' = 'dia';

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tgp_ui_theme');
      if (saved === 'dia' || saved === 'noche') {
        theme = saved;
      }
    }
  });

  function toggleTheme() {
    theme = theme === 'dia' ? 'noche' : 'dia';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tgp_ui_theme', theme);
    }
  }

  // ── Estado Cascada Cognitiva & Puesto de Mando (Desk) ─────────────────────
  let showManualPrompt = true;
  let activePillLabel = 'Informe Base';
  let manualDensidad: 'breve' | 'profundo_breve' | 'premium' = 'profundo_breve';
  let manualModelo: 'flash' | 'pro' = 'pro';
  let selectedCollection = 'ensayosCinematicos';
  let visionMotor: 'osint' | 'multimodal' = 'osint';
  let selectedBot: 'omni' | 'assistant' | 'redes' | 'liminal' = 'omni';
  let abortController: AbortController | null = null;

  function cancelarIngesta() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isLoading = false;
    error = 'Ingesta cancelada por el usuario.';
  }

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

  function handleWikiSelect(file: File) {
    loadFile(file, 'local');
    imageName = file.name;
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
      onSelect: (file: File) => {
        pickerLoading = false;
        loadFile(file, 'google');
      },
      onError: (err) => {
        pickerLoading = false;
        if (err.message !== 'PICKER_RENDERED' && err.message !== 'PICKER_CLOSED' && err.message !== 'PICKER_TIMEOUT') {
          error = `Google Photos: ${err.message}`;
        }
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

    abortController = new AbortController();
    const signal = abortController.signal;

    isLoading = true;
    error = null;
    try {
      let resultText = '';
      let d1Id: string | undefined = undefined;
      let r2Url: string | undefined = undefined;
      let tokenUsage: any = undefined;

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
          } catch (imgErr: any) {
            if (imgErr?.name === 'AbortError') throw imgErr;
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
            bot: selectedBot,
          }),
          signal,
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
          motorUsado: 'multimodal',
        }, ...results];

        prompt = '';
        setTimeout(() => resultsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        return;
      }

      // FLUJO B: Presets de Cascada Cognitiva
      const { base64, mimeType } = await fileToBase64(imageFile!);
      const fullBase64 = `data:${mimeType};base64,${base64}`;

      if (visionMotor === 'multimodal') {
        // MODO GEMINI MULTIMODAL DIRECTO (análisis visual conceptual + auditoría de tokens)
        const targetModel = manualModelo === 'pro' ? 'gemini-2.5-pro' : 'gemini-3.8-flash';
        const res = await fetch(VISION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({
            prompt: finalPrompt,
            base64,
            mimeType,
            model: targetModel,
          }),
          signal,
        });

        if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
        const data = await res.json();
        resultText = data.response ?? '(Sin respuesta)';
        tokenUsage = data.usage;
      } else {
        // MODO GOOGLE CLOUD VISION OSINT CLÁSICO (OCR + coordenadas + fuentes web)
        try {
          const osintData = await ejecutarIngestaExhaustiva(EXHAUSTIVE_ENDPOINT, fullBase64, API_KEY);
          resultText = osintData.informe || '';
          d1Id = osintData.id;
          r2Url = osintData.imagen_url;
        } catch (osintErr: any) {
          if (osintErr?.name === 'AbortError') throw osintErr;
          console.warn('[Scriptorium] Falló ingesta exhaustiva, ejecutando fallback Vision directo:', osintErr);
          const res = await fetch(VISION_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
            body: JSON.stringify({ prompt: finalPrompt, base64, mimeType }),
            signal,
          });
          if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
          const data = await res.json();
          resultText = data.response ?? '(Sin respuesta)';
          tokenUsage = data.usage;
        }
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
        tokenUsage,
        motorUsado: visionMotor,
      }, ...results];

      setTimeout(() => resultsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        error = 'Ingesta cancelada por el usuario.';
      } else {
        error = err.message ?? 'Error de conexión con TGP Mind.';
      }
    } finally {
      isLoading = false;
      abortController = null;
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

  const isDev = Boolean(import.meta.env?.DEV);

  // ── Transmutación → Keystatic CMS (Solo en Dev / Desk Local) ─────────────
  async function transmuteToKeystatic(index: number, r: VisionResult) {
    if (!isDev) return;

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
        if (res.status === 404) {
          console.warn('[transmute] Endpoint local no disponible en producción');
          return;
        }
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
    <div class="w-full transition-all duration-300 select-auto {embedded ? (theme === 'dia' ? 'border border-slate-200/90 bg-white rounded-3xl shadow-[0_4px_30px_-5px_rgba(0,0,0,0.06)]' : 'border border-white/10 bg-[#121314] rounded-3xl shadow-2xl relative overflow-hidden text-stone-100') : (theme === 'dia' ? 'bg-white rounded-3xl shadow-2xl max-w-7xl h-[88vh] max-h-[88vh] overflow-hidden border border-slate-200' : 'bg-[#121314] rounded-3xl shadow-2xl max-w-7xl h-[88vh] max-h-[88vh] overflow-hidden border border-white/10 relative text-stone-100')} flex flex-col">

      <!-- Ambient Glow difuso en modo noche -->
      {#if theme === 'noche'}
        <div class="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>
        <div class="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-violet-500/10 blur-[130px] pointer-events-none"></div>
      {/if}

      <!-- Header del workspace -->
      <header class="flex items-center justify-between px-6 sm:px-10 py-4 border-b shrink-0 transition-colors duration-300 relative z-10 {theme === 'dia' ? 'border-slate-100 bg-white/95 text-[#1f1f1f]' : 'border-white/5 bg-[#131314]/95 text-white'}">
        <div class="flex items-center gap-3.5">
          <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-2xs {theme === 'dia' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-[#1e1f20] text-emerald-400 border border-white/10'}">
            ✦
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-sans tracking-tight font-bold {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-white'}">
              TGP Scriptorium · Ingestor Cognitivo
            </h1>
            <p class="text-xs sm:text-sm font-sans font-medium {theme === 'dia' ? 'text-[#444746]' : 'text-[#8e918f]'}">
              Data Lake OSINT & Transmutador Editorial a Hemeroteca
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          <!-- ☀️ / 🌙 CONMUTADOR DÍA / NOCHE -->
          <button
            type="button"
            on:click={toggleTheme}
            class="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-sans font-medium transition-all cursor-pointer {theme === 'dia' ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]' : 'bg-[#1e1f20] hover:bg-[#282a2c] text-amber-300 border border-white/10'}"
            title="Alternar: Día (Brand Gemini) vs Noche (#131314)"
          >
            {#if theme === 'dia'}
              <span>☀️</span>
              <span class="font-semibold">Día · Gemini</span>
            {:else}
              <span>🌙</span>
              <span class="font-semibold">Noche · #131314</span>
            {/if}
          </button>

          <a
            href="/tgp-app/"
            class="px-4 py-2 text-xs font-sans font-semibold rounded-full transition-all inline-flex items-center gap-1.5 {theme === 'dia' ? 'text-[#1a73e8] bg-[#e8f0fe] hover:bg-[#d2e3fc]' : 'text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800'}"
            title="Volver al Panel Principal de TGP App"
          >
            ← Hub
          </a>
          {#if !embedded}
            <button
              type="button"
              class="px-4 py-2 text-xs font-sans font-medium rounded-full transition-colors cursor-pointer {theme === 'dia' ? 'text-[#444746] bg-[#f0f4f9] hover:bg-[#e2e7ef]' : 'text-stone-300 bg-[#1e2022] hover:bg-[#282a2d] border border-white/10'}"
              on:click={() => (isOpen = false)}
            >
              ✕ Cerrar
            </button>
          {/if}
        </div>
      </header>

      <!-- Workspace en 2 columnas (45% Ingesta / 55% Puesto de Mando) -->
      <div class="flex flex-col lg:flex-row flex-1 {embedded ? 'items-start' : 'min-h-0 overflow-hidden'} divide-y lg:divide-y-0 lg:divide-x {theme === 'dia' ? 'divide-slate-100' : 'divide-white/5'}">

        <!-- ── COLUMNA IZQUIERDA (45%): Ingesta Visual y Visor ──────── -->
        <div class="w-full lg:w-[45%] p-5 sm:p-7 lg:p-8 flex flex-col gap-6 {embedded ? 'lg:sticky lg:top-4 self-start' : 'overflow-y-auto'} {theme === 'dia' ? 'bg-[#fcfdfe]' : 'bg-[#151718]'}">

          <!-- Selección / Ingesta de Imagen -->
          <div class="flex flex-col gap-2.5">
            <span class="block text-xs font-bold uppercase tracking-wider {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-stone-300'}">
              1. Selección de Imagen
            </span>

            {#if !previewUrl}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="border-2 border-dashed rounded-3xl p-7 lg:p-9 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-54 {isDragging ? 'border-[#1a73e8] bg-[#e8f0fe]/50 scale-[0.99]' : theme === 'dia' ? 'border-slate-200 bg-[#f8fafd] hover:bg-[#f0f4f9] hover:border-slate-300' : 'border-white/15 bg-[#1a1c1e] hover:bg-[#202225] hover:border-white/25'}"
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
                <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3 shadow-2xs {theme === 'dia' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'}">
                  ↑
                </div>
                <div class="text-sm sm:text-base font-semibold font-sans {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-stone-100'}">Arrastrá una imagen aquí</div>
                <div class="text-xs mt-1 font-sans {theme === 'dia' ? 'text-[#444746]' : 'text-stone-400'}">o hacé clic para explorar desde tu equipo</div>
                <div class="text-[11px] mt-2.5 font-mono {theme === 'dia' ? 'text-[#747775]' : 'text-stone-500'}">JPG · PNG · WEBP · GIF · TIFF</div>
              </div>
            {:else}
              <!-- FOTO PURA (100% NATIVA, CERO SCRIMS) -->
              <div class="flex flex-col gap-2.5">
                <div class="relative rounded-3xl overflow-hidden border {theme === 'dia' ? 'border-slate-200 bg-[#f0f4f9]' : 'border-white/15 bg-black'} aspect-video shadow-xs group flex items-center justify-center">
                  <img src={previewUrl} alt={imageName} class="w-full h-full object-contain" />
                  <button
                    type="button"
                    class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-xs transition-transform hover:scale-110 cursor-pointer shadow-md"
                    on:click={clearImage}
                    title="Quitar imagen"
                  >
                    ✕
                  </button>
                </div>
                <div class="flex items-center justify-between px-1 text-xs">
                  <span class="font-medium font-sans truncate max-w-[70%] {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-stone-200'}" title={imageName}>{imageName}</span>
                  <span class="text-[11px] font-sans font-semibold px-3 py-1 rounded-full {imageSource === 'google' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-[#e6f4ea] text-[#137333]'}">
                    {imageSource === 'google' ? 'Google Cloud' : 'Archivo Local'}
                  </span>
                </div>
              </div>
            {/if}
          </div>

          <!-- Separador -->
          <div class="flex items-center gap-3 text-xs {theme === 'dia' ? 'text-[#747775]' : 'text-stone-500'} font-medium">
            <div class="flex-1 h-px {theme === 'dia' ? 'bg-slate-200' : 'bg-white/10'}"></div>
            <span>o desde servicios en la nube</span>
            <div class="flex-1 h-px {theme === 'dia' ? 'bg-slate-200' : 'bg-white/10'}"></div>
          </div>

          <!-- Botón de apertura nativa del Google Picker -->
          <button
            type="button"
            class="w-full py-3.5 px-5 rounded-full font-sans font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed group {theme === 'dia' ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]' : 'bg-[#1e1f20] hover:bg-[#282a2c] text-blue-200 border border-white/10'}"
            on:click={abrirGooglePicker}
            disabled={pickerLoading}
          >
            <svg class="w-5 h-5 shrink-0 text-[#1a73e8] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
            </svg>
            <span>{pickerLoading ? 'Abriendo Google Fotos…' : 'Abrir desde Google Fotos'}</span>
          </button>

          <!-- Botón Galería Wikimedia Commons (CC0) -->
          <button
            type="button"
            class="w-full py-3.5 px-5 rounded-full font-sans font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer shadow-xs group {theme === 'dia' ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white' : 'bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#131314]'}"
            on:click={() => (isWikiInboxOpen = true)}
          >
            <span class="text-base group-hover:scale-110 transition-transform">✦</span>
            <span>Explorar Banco Wikimedia Commons</span>
          </button>

          <!-- Nota informativa anclada -->
          <div class="mt-auto p-4 rounded-2xl border text-xs leading-relaxed font-sans {theme === 'dia' ? 'bg-[#f0f4f9] border-transparent text-[#444746]' : 'bg-[#181a1b] border-white/5 text-stone-400'}">
            <strong class="{theme === 'dia' ? 'text-[#1f1f1f]' : 'text-stone-200'}">TGP Ingestor Cognitivo:</strong> Ingesta directa de archivos locales, Google Fotos y Wikimedia. Extrae datos y genera monografías listas para transmutar a Hemeroteca.
          </div>

        </div>

        <!-- ── COLUMNA DERECHA: Prompt + Resultados ───────────────────────── -->
        <!-- ── COLUMNA DERECHA (55%): Cascada Cognitiva & Puesto de Mando ────── -->
        <div class="w-full lg:w-[55%] p-5 sm:p-7 lg:p-8 flex flex-col gap-6 {embedded ? '' : 'overflow-hidden min-h-0'} {theme === 'dia' ? 'bg-white' : 'bg-[#131314]'}">
          <div class="flex flex-col gap-4 {embedded ? (theme === 'dia' ? 'border-b border-slate-100 pb-5' : 'border-b border-white/5 pb-5') : (theme === 'dia' ? 'bg-[#f8fafd] p-6 rounded-3xl border border-slate-100 shrink-0' : 'bg-[#1e1f20] p-6 rounded-3xl border border-white/5 shrink-0')}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-sans font-bold uppercase tracking-wider {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-stone-200'}">
                2. Cascada Cognitiva
              </span>
              <!-- Conmutador de Motor de Análisis -->
              <div class="flex items-center gap-1 p-1 rounded-full text-xs {theme === 'dia' ? 'bg-[#f0f4f9]' : 'bg-[#181a1b] border border-white/10'}">
                <button
                  type="button"
                  on:click={() => (visionMotor = 'osint')}
                  class="px-3 py-1 rounded-full font-medium transition-all cursor-pointer {visionMotor === 'osint' ? (theme === 'dia' ? 'bg-white text-[#1f1f1f] shadow-2xs font-semibold' : 'bg-[#25282a] text-white shadow-2xs font-semibold') : (theme === 'dia' ? 'text-[#747775] hover:text-[#1f1f1f]' : 'text-stone-400 hover:text-stone-200')}"
                  title="Google Cloud Vision (OCR + Coordenadas + Páginas web)"
                >
                  🌐 Cloud Vision OSINT
                </button>
                <button
                  type="button"
                  on:click={() => (visionMotor = 'multimodal')}
                  class="px-3 py-1 rounded-full font-medium transition-all cursor-pointer {visionMotor === 'multimodal' ? 'bg-[#1a73e8] text-white shadow-2xs font-semibold' : (theme === 'dia' ? 'text-[#747775] hover:text-[#1a73e8]' : 'text-stone-400 hover:text-[#8ab4f8]')}"
                  title="Gemini Multimodal Directo (Análisis visual conceptual y conteo de tokens)"
                >
                  ✦ Gemini Multimodal
                </button>
              </div>
            </div>

            <!-- Botón Principal (Informe Base) -->
            <button
              type="button"
              disabled={!hasImage || isLoading}
              on:click={() => triggerPreset('Informe Base', 'Realiza un informe neutral y exhaustivo de esta imagen. Describe literalmente qué se ve, extrae cualquier texto legible (OCR) y señala las entidades principales.')}
              class="w-full p-4 rounded-2xl font-sans font-semibold text-sm transition-all shadow-xs flex items-center justify-between group disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer {theme === 'dia' ? 'bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1a73e8]' : 'bg-[#1e1f20] hover:bg-[#282a2c] text-[#8ab4f8] border border-white/10'}"
            >
              <div class="flex items-center gap-3.5">
                <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform {theme === 'dia' ? 'bg-white text-[#1a73e8] shadow-xs' : 'bg-[#2d2f31] text-[#8ab4f8]'}">
                  ✦
                </div>
                <div class="text-left">
                  <div class="text-sm font-bold {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-white'}">Informe Base (OCR + Entidades)</div>
                  <div class="text-xs font-normal {theme === 'dia' ? 'text-[#444746]' : 'text-[#8e918f]'}">Lectura literal, transcripción de texto y catálogo de entidades</div>
                </div>
              </div>
              <span class="text-xs font-sans font-semibold px-3 py-1.5 rounded-full {theme === 'dia' ? 'bg-white text-[#1a73e8] shadow-xs' : 'bg-black/50 text-[#8ab4f8]'}">
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
                class="px-4 py-2 rounded-full text-xs font-sans font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                {activePillLabel === 'Arqueohistoria' && isLoading 
                  ? 'bg-amber-100 text-amber-900 font-semibold' 
                  : theme === 'dia' 
                    ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]'
                    : 'bg-[#1e1f20] hover:bg-[#282a2d] border border-white/10 text-stone-300 hover:text-amber-300'}"
              >
                🏺 Arqueohistoria
              </button>

              <!-- Chip 2: Hermenéutica -->
              <button
                type="button"
                disabled={!hasImage || isLoading}
                on:click={() => triggerPreset('Hermenéutica', 'Decodifica símbolos, geometría sagrada, iconografía o arquetipos. Analiza la materialidad, manufactura y erosión.')}
                class="px-4 py-2 rounded-full text-xs font-sans font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                {activePillLabel === 'Hermenéutica' && isLoading 
                  ? 'bg-purple-100 text-purple-900 font-semibold' 
                  : theme === 'dia'
                    ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]'
                    : 'bg-[#1e1f20] hover:bg-[#282a2d] border border-white/10 text-stone-300 hover:text-purple-300'}"
              >
                👁 Hermenéutica
              </button>

              <!-- Chip 3: Puesto de Mando (Modo Manual / ChatOps) -->
              <button
                type="button"
                on:click={() => (showManualPrompt = !showManualPrompt)}
                class="px-4 py-2 rounded-full text-xs font-sans font-medium transition-all cursor-pointer
                {showManualPrompt 
                  ? (theme === 'dia' ? 'bg-[#1f1f1f] text-white shadow-xs' : 'bg-[#8ab4f8] text-[#131314] shadow-xs')
                  : (theme === 'dia' ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]' : 'bg-[#1e1f20] hover:bg-[#282a2d] border border-white/10 text-stone-300')}"
              >
                🎛 Puesto de Mando {showManualPrompt ? '▲' : '▼'}
              </button>
            </div>

            <!-- PUESTO DE MANDO (DESK / INBOX AMPLIO) -->
            {#if showManualPrompt}
              <div class="mt-2 space-y-3 pt-1">
                <!-- Barra Horizontal Única: Destino + Densidad + Motor -->
                <div class="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl text-xs font-sans {theme === 'dia' ? 'bg-[#f0f4f9]' : 'bg-[#1e1f20] border border-white/10'}">
                  <!-- Grupo 1: Colección Destino -->
                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] font-sans font-semibold uppercase tracking-wider {theme === 'dia' ? 'text-[#444746]' : 'text-stone-400'} flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-pulse"></span>
                      Destino:
                    </span>
                    <select
                      bind:value={selectedCollection}
                      class="text-xs py-1.5 px-3 rounded-full font-semibold focus:outline-none shadow-2xs cursor-pointer border-0 {theme === 'dia' ? 'bg-white text-[#1f1f1f]' : 'bg-[#151718] text-stone-200'}"
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

                  <div class="hidden sm:block h-4 w-px {theme === 'dia' ? 'bg-slate-300/80' : 'bg-white/15'}"></div>

                  <!-- Grupo 2: Densidad -->
                  <div class="flex items-center gap-1">
                    <span class="text-[11px] font-sans uppercase font-semibold mr-0.5 {theme === 'dia' ? 'text-[#747775]' : 'text-stone-400'}">Densidad:</span>
                    <button
                      type="button"
                      on:click={() => (manualDensidad = 'breve')}
                      class="px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer
                        {manualDensidad === 'breve'
                          ? 'bg-[#1a73e8] text-white font-semibold'
                          : theme === 'dia' ? 'bg-white text-[#1f1f1f] hover:bg-slate-50' : 'bg-[#151718] text-stone-300 hover:bg-[#202225]'}"
                    >
                      ⚡ Breve
                    </button>
                    <button
                      type="button"
                      on:click={() => (manualDensidad = 'profundo_breve')}
                      class="px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer
                        {manualDensidad === 'profundo_breve'
                          ? 'bg-[#1a73e8] text-white font-semibold'
                          : theme === 'dia' ? 'bg-white text-[#1f1f1f] hover:bg-slate-50' : 'bg-[#151718] text-stone-300 hover:bg-[#202225]'}"
                    >
                      🧠 Profundo
                    </button>
                    <button
                      type="button"
                      on:click={() => (manualDensidad = 'premium')}
                      class="px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer
                        {manualDensidad === 'premium'
                          ? 'bg-purple-700 text-white font-semibold'
                          : theme === 'dia' ? 'bg-white text-purple-900 hover:bg-purple-50' : 'bg-[#151718] text-purple-300 hover:bg-purple-950/40'}"
                    >
                      🏛️ Tratado
                    </button>
                  </div>

                  <div class="hidden md:block h-4 w-px {theme === 'dia' ? 'bg-slate-300/80' : 'bg-white/15'}"></div>

                  <!-- Grupo 3: Motor -->
                  <div class="flex items-center gap-1">
                    <span class="text-[11px] font-sans uppercase font-semibold mr-0.5 {theme === 'dia' ? 'text-[#747775]' : 'text-stone-400'}">Motor:</span>
                    <button
                      type="button"
                      on:click={() => (manualModelo = 'flash')}
                      class="px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer
                        {manualModelo === 'flash'
                          ? 'bg-amber-600 text-white font-semibold'
                          : theme === 'dia' ? 'bg-white text-[#1f1f1f] hover:bg-amber-50' : 'bg-[#151718] text-stone-300 hover:bg-[#202225]'}"
                    >
                      ⚡ Flash
                    </button>
                    <button
                      type="button"
                      on:click={() => (manualModelo = 'pro')}
                      class="px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer
                        {manualModelo === 'pro'
                          ? 'bg-[#1a73e8] text-white font-semibold'
                          : theme === 'dia' ? 'bg-white text-[#1f1f1f] hover:bg-blue-50' : 'bg-[#151718] text-stone-300 hover:bg-[#202225]'}"
                    >
                      🧠 Pro
                    </button>
                  </div>

                  <div class="hidden lg:block h-4 w-px {theme === 'dia' ? 'bg-slate-300/80' : 'bg-white/15'}"></div>

                  <!-- Grupo 4: Bot Telegram -->
                  <div class="flex items-center gap-1">
                    <span class="text-[11px] font-sans uppercase font-semibold mr-0.5 {theme === 'dia' ? 'text-[#747775]' : 'text-stone-400'}">Bot:</span>
                    <select
                      bind:value={selectedBot}
                      class="text-xs py-1.5 px-3 rounded-full font-semibold focus:outline-none shadow-2xs cursor-pointer border-0 {theme === 'dia' ? 'bg-white text-[#1f1f1f]' : 'bg-[#151718] text-stone-200'}"
                      title="Selecciona el bot de Telegram a notificar"
                    >
                      <option value="omni">Omni Bot</option>
                      <option value="assistant">Erudito (Assistant)</option>
                      <option value="redes">Redes Sociales</option>
                      <option value="liminal">Liminal (Dev)</option>
                    </select>
                  </div>
                </div>

                <!-- Textarea Amplio Tipo Desk (Puesto de Mando) -->
                <textarea
                  bind:this={promptEl}
                  bind:value={prompt}
                  rows="4"
                  class="w-full px-5 py-4 text-sm rounded-2xl transition-all resize-y font-sans leading-relaxed min-h-28 {theme === 'dia' ? 'bg-[#f0f4f9] text-[#1f1f1f] placeholder-[#747775] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8] border border-transparent' : 'bg-[#1e1f20] text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-[#8ab4f8]/30 focus:border-[#8ab4f8] border border-white/10'}"
                  placeholder="Escribe tu consulta, mini-charla reflexiva o instrucción ChatOps. Admite Slash Commands directos (ej: /video fascinum romano o /hemeroteca pro 1500t El mito de Ícaro)..."
                  on:keydown={handlePromptKeydown}
                  disabled={isLoading}
                ></textarea>

                <!-- Footer del Desk con Botón de Ejecución Directa -->
                <div class="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                  <span class="text-xs font-sans {theme === 'dia' ? 'text-[#747775]' : 'text-stone-400'}">
                    💡 Admite diálogo extenso o Slash Commands directos hacia el Orquestador Cloud Run.
                  </span>
                  <button
                    type="button"
                    disabled={!prompt.trim() || isLoading}
                    on:click={() => handleSubmit(undefined, 'Manual')}
                    class="px-6 py-2.5 text-xs sm:text-sm font-sans font-semibold rounded-full transition-all shadow-xs hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 {theme === 'dia' ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white' : 'bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#131314]'}"
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
              <div class="h-full flex flex-col items-center justify-center py-12 gap-3.5 {theme === 'dia' ? 'text-slate-500' : 'text-stone-400'}">
                <div class="flex gap-2">
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.15s]"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.3s]"></div>
                </div>
                <div class="text-xs font-mono uppercase tracking-widest font-medium {theme === 'dia' ? 'text-slate-600' : 'text-stone-300'}">
                  {activePillLabel ? `Ejecutando ${activePillLabel} con ${visionMotor === 'multimodal' ? 'Gemini Multimodal' : 'Gemini Vision'}…` : 'Procesando…'}
                </div>
                <!-- Botón de STOP / Cancelar Ingesta -->
                <button
                  type="button"
                  on:click={cancelarIngesta}
                  class="mt-2 px-5 py-2 rounded-full text-xs font-sans font-semibold bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>🛑</span>
                  <span>Detener Ingesta</span>
                </button>
              </div>
            {:else if results.length === 0}
              <div class="h-full flex flex-col items-center justify-center py-16 text-center gap-2 {theme === 'dia' ? 'text-slate-400' : 'text-stone-500'}">
                <div class="text-3xl {theme === 'dia' ? 'text-slate-300' : 'text-stone-600'}">◈</div>
                <div class="text-sm font-medium {theme === 'dia' ? 'text-slate-600' : 'text-stone-400'}">
                  Carga una imagen y pulsa <strong class="{theme === 'dia' ? 'text-slate-800' : 'text-stone-200'}">Informe Base</strong> o cualquier píldora<br />para iniciar la cascada cognitiva.
                </div>
              </div>
            {:else}
              {#each results as r, i (i)}
                <div class="p-4 sm:p-5 rounded-2xl border flex flex-col gap-3.5 shadow-2xs {theme === 'dia' ? 'bg-slate-50/80 border-slate-200' : 'bg-[#181a1b] border-white/10'}">
                  <!-- Header con píldora, timestamp y badges de R2/D1 -->
                  <header class="flex flex-wrap items-center justify-between gap-2 border-b pb-3 {theme === 'dia' ? 'border-slate-200/80' : 'border-white/10'}">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-2xs
                        {r.pillLabel === 'Informe Base' ? (theme === 'dia' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800') :
                         r.pillLabel === 'Arqueohistoria' ? (theme === 'dia' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-amber-950/80 text-amber-300 border border-amber-800') :
                         r.pillLabel === 'Hermenéutica' ? (theme === 'dia' ? 'bg-purple-100 text-purple-900 border border-purple-200' : 'bg-purple-950/80 text-purple-300 border border-purple-800') :
                         (theme === 'dia' ? 'bg-slate-200 text-slate-800 border border-slate-300' : 'bg-[#202225] text-stone-300 border border-white/10')}">
                        {r.pillLabel || 'Informe Base'}
                      </span>
                      {#if r.d1Id}
                        <span class="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md {theme === 'dia' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-950/60 text-blue-300 border border-blue-800/60'}" title="Registro persistido en Cloudflare D1">
                          🗄 D1: {r.d1Id.slice(0, 8)}…
                        </span>
                      {/if}
                      {#if r.r2Url}
                        <a href={r.r2Url} target="_blank" rel="noopener noreferrer" class="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md {theme === 'dia' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:underline' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:underline'}" title="Ver imagen en Cloudflare R2">
                          ☁ R2 Image ↗
                        </a>
                      {/if}
                      {#if r.tokenUsage?.totalTokenCount}
                        <span class="text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full {theme === 'dia' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'}" title="Gasto de tokens Gemini">
                          ✦ {r.tokenUsage.totalTokenCount.toLocaleString()} tokens ({r.tokenUsage.promptTokenCount ?? 0}p · {r.tokenUsage.candidatesTokenCount ?? 0}r)
                        </span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[11px] font-mono {theme === 'dia' ? 'text-slate-500' : 'text-stone-400'}">
                        {r.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <button
                        type="button"
                        class="text-xs font-mono px-2 py-0.5 rounded transition-colors cursor-pointer {theme === 'dia' ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-stone-400 hover:text-stone-100 hover:bg-[#25282a]'}"
                        on:click={() => navigator.clipboard.writeText(r.response)}
                        title="Copiar Markdown al portapapeles"
                      >
                        Copiar
                      </button>
                    </div>
                  </header>

                  <!-- ── BARRA DE ACCIÓN PRINCIPAL (Siempre visible arriba) ── -->
                  <div class="p-2.5 rounded-xl border shadow-2xs flex flex-wrap items-center justify-between gap-2 {theme === 'dia' ? 'bg-white border-slate-200/90' : 'bg-[#151718] border-white/10'}">
                    {#if isDev}
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={r.transmuteStatus === 'sending' || r.transmuteStatus === 'success'}
                        on:click={() => transmuteToKeystatic(i, r)}
                        class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer disabled:cursor-not-allowed
                          {r.transmuteStatus === 'success'
                            ? (theme === 'dia' ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-emerald-950 border-emerald-700 text-emerald-300')
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
                        class="text-xs py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer shadow-2xs font-medium border {theme === 'dia' ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#1a1c1e] border-white/15 text-stone-200'}"
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
                    {/if}

                    <!-- Botón Ensayo Premium + Audio TTS -->
                    <button
                      type="button"
                      disabled={r.premiumLoading}
                      on:click={() => generarEnsayoAudio(i, r)}
                      class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs {theme === 'dia' ? 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900' : 'border-purple-800/80 bg-purple-950/50 hover:bg-purple-900/60 text-purple-200'}"
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
                    <div class="p-3 rounded-2xl flex flex-col gap-1.5 border {theme === 'dia' ? 'bg-purple-50/70 border-purple-200' : 'bg-purple-950/40 border-purple-900/60'}">
                      <div class="flex items-center justify-between text-xs font-semibold {theme === 'dia' ? 'text-purple-900' : 'text-purple-200'}">
                        <span>🎧 Audio Neuronal (es-AR):</span>
                        <a href={r.audioUrl} target="_blank" rel="noopener noreferrer" class="font-mono text-[11px] {theme === 'dia' ? 'text-purple-700' : 'text-purple-300'} hover:underline">Descargar MP3 ↗</a>
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
                    <div class="w-20 h-20 rounded-xl overflow-hidden border shrink-0 shadow-2xs {theme === 'dia' ? 'border-slate-200 bg-slate-100' : 'border-white/10 bg-black'}">
                      <img src={r.imagePreview} alt={r.imageName} class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-medium mb-2 line-clamp-1 italic {theme === 'dia' ? 'text-slate-500' : 'text-stone-400'}">
                        ↳ "{r.prompt}"
                      </div>
                      <div class="prose max-w-none text-xs leading-relaxed font-sans {theme === 'dia' ? 'prose-slate text-slate-800' : 'prose-invert text-stone-200'}">
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

<!-- ── GALERÍA WIKIMEDIA COMMONS A PANTALLA COMPLETA (Desanclada a nivel raíz) ──── -->
<WikimediaGalleryInbox bind:isOpen={isWikiInboxOpen} onSelect={handleWikiSelect} />
