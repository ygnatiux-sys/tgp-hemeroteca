<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { gsap } from 'gsap';

  interface Attribution {
    author?: string;
    license?: string;
    licenseUrl?: string;
    sourceUrl?: string;
    title?: string;
  }

  interface Candidate {
    id: string;
    index: number;
    title: string;
    thumbUrl: string;
    url: string;
    width: number;
    height: number;
    aspectRatio: string;
    sourceType: string;
    attribution: Attribution;
  }

  interface PostItem {
    slug: string;
    title: string;
    hasHero: boolean;
    coverImage?: string;
    excerpt?: string;
  }

  // ── ESTADO REACTIVO ──────────────────────────────────────────────────────────
  let allPosts: PostItem[] = [];
  let selectedSlug: string = '';
  let currentPost: PostItem | null = null;
  let candidates: Candidate[] = [];
  let mode: 'hero' | 'video-array' = 'hero';

  // Búsqueda Manual Libre
  let searchInput: string = '';
  let isManualMode: boolean = false;
  let manualQueryTitle: string = '';

  // Selección: array ordenado de IDs de candidatos seleccionados
  let selectedCandidateIds: string[] = [];

  // Lightbox
  let lightboxCandidate: Candidate | null = null;
  let lightboxOpen: boolean = false;

  // Estados de carga y feedback
  let isLoading: boolean = false;
  let isProcessing: boolean = false;
  let statusMessage: { type: 'success' | 'error' | 'info'; text: string; details?: any } | null = null;

  // Referencias a elementos DOM para animaciones GSAP
  let cardRefs: Record<string, HTMLElement> = {};
  let skeletonRefs: HTMLElement[] = [];
  let skeletonTween: gsap.core.Tween | null = null;
  let lightboxBackdropEl: HTMLElement;
  let lightboxDialogEl: HTMLElement;
  let actionBarEl: HTMLElement;

  // ── CICLO DE VIDA Y CARGA INICIAL ───────────────────────────────────────────
  onMount(async () => {
    await cargarDatosIniciales();
  });

  async function cargarDatosIniciales() {
    isLoading = true;
    statusMessage = null;
    iniciarAnimacionEsqueletos();

    try {
      const res = await fetch('/api/local/candidatos');
      const data = await res.json();
      if (data.success) {
        allPosts = data.allPosts || [];
        if (data.defaultSlug) {
          selectedSlug = data.defaultSlug;
          currentPost = allPosts.find(p => p.slug === selectedSlug) || null;
          candidates = data.defaultCandidates || [];
          if (candidates.length === 0 && selectedSlug) {
            await seleccionarPost(selectedSlug, false);
          }
        }
      }
    } catch (err: any) {
      statusMessage = { type: 'error', text: `Error cargando datos: ${err.message}` };
    } finally {
      detenerAnimacionEsqueletos();
      isLoading = false;
    }
  }

  async function seleccionarPost(slug: string, forceRefresh = false) {
    isManualMode = false;
    manualQueryTitle = '';
    selectedSlug = slug;
    currentPost = allPosts.find(p => p.slug === slug) || null;
    selectedCandidateIds = [];
    isLoading = true;
    statusMessage = null;

    iniciarAnimacionEsqueletos();

    try {
      const url = `/api/local/candidatos?slug=${encodeURIComponent(slug)}${forceRefresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        candidates = data.candidates || [];
        if (candidates.length === 0) {
          statusMessage = {
            type: 'info',
            text: 'No se encontraron candidatos automáticos. Puedes intentar "Refrescar" o escribir un término manual arriba.'
          };
        } else if (mode === 'hero' && candidates.length > 0) {
          selectedCandidateIds = [candidates[0].id];
        }
      } else {
        statusMessage = { type: 'error', text: data.error || 'Error al obtener candidatos.' };
      }
    } catch (err: any) {
      statusMessage = { type: 'error', text: `Fallo de conexión: ${err.message}` };
    } finally {
      detenerAnimacionEsqueletos();
      isLoading = false;
      await tick();
      animarAparicionTarjetas();
    }
  }

  // ── BÚSQUEDA MANUAL POR TEXTO LIBRE ──────────────────────────────────────────
  async function ejecutarBusquedaManual() {
    const q = searchInput.trim();
    if (!q) return;

    isManualMode = true;
    manualQueryTitle = q;
    selectedCandidateIds = [];
    isLoading = true;
    statusMessage = null;

    iniciarAnimacionEsqueletos();

    try {
      const url = `/api/local/candidatos?query=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        selectedSlug = data.slug;
        currentPost = {
          slug: data.slug,
          title: `Búsqueda Libre: "${q}"`,
          hasHero: false,
          excerpt: '',
        };
        candidates = data.candidates || [];
        if (candidates.length === 0) {
          statusMessage = {
            type: 'info',
            text: `No se encontraron imágenes en Wikimedia Commons para "${q}". Prueba con un término alternativo en inglés o español.`
          };
        } else if (mode === 'hero' && candidates.length > 0) {
          selectedCandidateIds = [candidates[0].id];
        }
      } else {
        statusMessage = { type: 'error', text: data.error || 'Error en búsqueda manual.' };
      }
    } catch (err: any) {
      statusMessage = { type: 'error', text: `Fallo de conexión: ${err.message}` };
    } finally {
      detenerAnimacionEsqueletos();
      isLoading = false;
      await tick();
      animarAparicionTarjetas();
    }
  }

  function volverAModoPost() {
    isManualMode = false;
    searchInput = '';
    manualQueryTitle = '';
    if (allPosts.length > 0) {
      seleccionarPost(allPosts[0].slug);
    }
  }

  // ── ANIMACIONES GSAP ───────────────────────────────────────────────────────
  function iniciarAnimacionEsqueletos() {
    if (skeletonTween) skeletonTween.kill();
    tick().then(() => {
      const els = skeletonRefs.filter(Boolean);
      if (els.length > 0) {
        skeletonTween = gsap.fromTo(els,
          { opacity: 0.35, scale: 0.985 },
          { opacity: 0.85, scale: 1, duration: 0.75, stagger: 0.06, repeat: -1, yoyo: true, ease: 'sine.inOut' }
        );
      }
    });
  }

  function detenerAnimacionEsqueletos() {
    if (skeletonTween) {
      skeletonTween.kill();
      skeletonTween = null;
    }
  }

  function animarAparicionTarjetas() {
    const cards = Object.values(cardRefs).filter(Boolean);
    if (cards.length > 0) {
      gsap.fromTo(cards, 
        { opacity: 0, y: 20, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.05, ease: 'power2.out' }
      );
    }
  }

  function animarSeleccion(cardEl: HTMLElement, badgeEl?: HTMLElement) {
    if (!cardEl) return;
    gsap.fromTo(cardEl,
      { scale: 0.96 },
      { scale: 1, duration: 0.35, ease: 'back.out(2.2)' }
    );
    if (badgeEl) {
      gsap.fromTo(badgeEl,
        { scale: 0, rotation: -45 },
        { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(3)' }
      );
    }
  }

  // ── SELECCIÓN DE IMÁGENES ──────────────────────────────────────────────────
  function toggleSeleccion(candidate: Candidate) {
    const cardEl = cardRefs[candidate.id];

    if (mode === 'hero') {
      selectedCandidateIds = [candidate.id];
      animarSeleccion(cardEl);
    } else {
      const idx = selectedCandidateIds.indexOf(candidate.id);
      if (idx !== -1) {
        selectedCandidateIds = selectedCandidateIds.filter(id => id !== candidate.id);
      } else {
        if (selectedCandidateIds.length >= 7) {
          statusMessage = {
            type: 'info',
            text: 'Has alcanzado el límite máximo de 7 imágenes para el Video Array.'
          };
          return;
        }
        selectedCandidateIds = [...selectedCandidateIds, candidate.id];
        animarSeleccion(cardEl);
      }
    }
  }

  function cambiarModo(nuevoModo: 'hero' | 'video-array') {
    mode = nuevoModo;
    if (mode === 'hero' && selectedCandidateIds.length > 1) {
      selectedCandidateIds = [selectedCandidateIds[0]];
    }
  }

  // ── LIGHTBOX (GSAP OPEN / CLOSE) ───────────────────────────────────────────
  async function abrirLightbox(c: Candidate) {
    lightboxCandidate = c;
    lightboxOpen = true;
    await tick();

    if (lightboxBackdropEl && lightboxDialogEl) {
      gsap.fromTo(lightboxBackdropEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.28, ease: 'power2.out' }
      );
      gsap.fromTo(lightboxDialogEl,
        { opacity: 0, scale: 0.92, y: 25 },
        { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: 'power3.out' }
      );
    }
  }

  function cerrarLightbox() {
    if (lightboxBackdropEl && lightboxDialogEl) {
      gsap.to(lightboxDialogEl, {
        opacity: 0, scale: 0.94, y: 15, duration: 0.22, ease: 'power2.in',
      });
      gsap.to(lightboxBackdropEl, {
        opacity: 0, duration: 0.25, ease: 'power2.in',
        onComplete: () => {
          lightboxOpen = false;
          lightboxCandidate = null;
        }
      });
    } else {
      lightboxOpen = false;
      lightboxCandidate = null;
    }
  }

  // ── CONFIRMACIÓN Y ENVÍO A LA API LOCAL ─────────────────────────────────────
  async function confirmarYProcesar() {
    if (selectedCandidateIds.length === 0) {
      statusMessage = { type: 'error', text: 'Por favor, selecciona al menos una imagen antes de confirmar.' };
      return;
    }

    const itemsSeleccionados = selectedCandidateIds
      .map(id => candidates.find(c => c.id === id))
      .filter(Boolean);

    isProcessing = true;
    statusMessage = null;

    try {
      const payload = {
        slug: selectedSlug,
        collection: 'ensayos-cinematicos',
        mode,
        items: itemsSeleccionados,
      };

      const res = await fetch('/api/local/procesar-seleccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        statusMessage = {
          type: 'success',
          text: result.message || '¡Imágenes procesadas y persistidas con éxito!',
          details: result,
        };

        const post = allPosts.find(p => p.slug === selectedSlug);
        if (post) {
          post.hasHero = true;
          post.coverImage = result.coverImage || result.coverAssigned;
          allPosts = [...allPosts];
        }
      } else {
        statusMessage = { type: 'error', text: result.error || 'Error al procesar las imágenes.' };
      }
    } catch (err: any) {
      statusMessage = { type: 'error', text: `Fallo durante el procesamiento: ${err.message}` };
    } finally {
      isProcessing = false;
    }
  }
</script>

<div class="curador-root min-h-screen bg-[#060a08] text-stone-200 font-sans selection:bg-emerald-900 selection:text-white">
  <!-- ENCABEZADO SUPERIOR -->
  <header class="border-b border-[#141f18] bg-[#080e0a]/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5">
    <div class="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-[11px] font-mono tracking-widest uppercase text-emerald-400 font-semibold">TGP · Human-in-the-Loop</span>
        </div>
        <h1 class="text-2xl font-serif text-white tracking-wide mt-0.5">Control Visual & Curaduría de Arte</h1>
      </div>

      <!-- CONTROLES SUPERIORES: BUSCADOR MANUAL + SELECTOR DE POSTS -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- 1. BUSCADOR DE TEXTO LIBRE (MANUAL INPUT) -->
        <form on:submit|preventDefault={ejecutarBusquedaManual} class="flex items-center gap-1.5 flex-1 sm:flex-none">
          <div class="relative w-full sm:w-64 md:w-72">
            <input
              type="text"
              bind:value={searchInput}
              placeholder="Buscar tema libre (ej. Coliseo Romano)..."
              class="w-full bg-[#0d1511] text-xs text-stone-200 border border-[#1e2e24] focus:border-amber-400 rounded-lg pl-3 pr-7 py-2 focus:outline-none transition-colors placeholder:text-stone-500"
            />
            {#if searchInput}
              <button
                type="button"
                on:click={() => searchInput = ''}
                class="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs cursor-pointer"
              >
                ✕
              </button>
            {/if}
          </div>

          <button
            type="submit"
            disabled={isLoading || isProcessing || !searchInput.trim()}
            class="px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-lg transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Buscar Manual
          </button>
        </form>

        <div class="hidden sm:block h-5 w-px bg-[#18281e]"></div>

        <!-- 2. SELECTOR DE POST DE KEYSTATIC -->
        <div class="relative min-w-65 sm:min-w-70">
          <select
            class="w-full bg-[#0d1511] text-xs text-stone-200 border border-[#1e2e24] rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
            value={isManualMode ? '' : selectedSlug}
            on:change={(e) => seleccionarPost(e.currentTarget.value)}
          >
            {#if isManualMode}
              <option value="" disabled selected>— Tema Manual Activo —</option>
            {/if}
            {#each allPosts as p}
              <option value={p.slug}>
                {p.hasHero ? '✓' : '✗'} {p.title}
              </option>
            {/each}
          </select>
        </div>

        <button
          type="button"
          class="px-3 py-2 text-xs font-mono bg-[#111c15] hover:bg-[#18281e] text-emerald-300 border border-[#1e3025] hover:border-emerald-500 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          disabled={isLoading || isProcessing}
          on:click={() => isManualMode ? ejecutarBusquedaManual() : seleccionarPost(selectedSlug, true)}
          title="Forzar nueva búsqueda en Wikimedia"
        >
          <svg class="w-3.5 h-3.5 {isLoading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refrescar
        </button>
      </div>
    </div>
  </header>

  <!-- CONTENIDO PRINCIPAL -->
  <main class="max-w-7xl mx-auto px-4 sm:px-8 py-6 pb-36">
    <!-- BARRA DE CONFIGURACIÓN DEL CONTEXTO ACTIVO -->
    <div class="bg-[#0b120e] border border-[#16241b] rounded-2xl p-5 mb-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div>
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          {#if isManualMode}
            <span class="text-xs font-mono px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-600/70 font-semibold">
              Búsqueda Libre: "{manualQueryTitle}"
            </span>
            <span class="text-xs font-mono px-2 py-0.5 rounded bg-[#132018] text-stone-400 border border-[#1f3326]">
              Slug: {selectedSlug}
            </span>
            <button
              type="button"
              on:click={volverAModoPost}
              class="text-xs font-mono text-stone-400 hover:text-white underline cursor-pointer ml-1"
            >
              (✕ Volver a Posts)
            </button>
          {:else}
            <span class="text-xs font-mono px-2 py-0.5 rounded bg-[#132018] text-stone-400 border border-[#1f3326]">
              Slug: {selectedSlug || 'Ninguno'}
            </span>
            {#if currentPost?.hasHero}
              <span class="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                Hero Actual Asignado
              </span>
            {:else}
              <span class="text-xs font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60">
                Hero Vacío (Requiere Portada)
              </span>
            {/if}
          {/if}
        </div>
        <h2 class="text-xl sm:text-2xl font-serif text-white font-normal">
          {currentPost?.title || 'Selecciona un post o busca un tema'}
        </h2>
      </div>

      <!-- SELECTOR DUAL DE MODO -->
      <div class="flex items-center bg-[#070b09] p-1.5 rounded-xl border border-[#152219]">
        <button
          type="button"
          class="px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 {mode === 'hero' ? 'bg-emerald-800/90 text-white shadow-md font-semibold' : 'text-stone-400 hover:text-white'}"
          on:click={() => cambiarModo('hero')}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Modo Hero (1 Foto)
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 {mode === 'video-array' ? 'bg-[#997321] text-white shadow-md font-semibold' : 'text-stone-400 hover:text-white'}"
          on:click={() => cambiarModo('video-array')}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Modo Video Array (Hasta 7 Fotos)
        </button>
      </div>
    </div>

    <!-- FEEDBACK TOAST / ESTADOS -->
    {#if statusMessage}
      <div class="mb-6 p-4 rounded-xl border flex items-start gap-3 shadow-lg {statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-200' : statusMessage.type === 'error' ? 'bg-red-950/70 border-red-700/60 text-red-200' : 'bg-[#101b14] border-[#1d3224] text-stone-300'}">
        <span class="text-xl">
          {statusMessage.type === 'success' ? '✨' : statusMessage.type === 'error' ? '⚠️' : 'ℹ️'}
        </span>
        <div class="flex-1 text-sm">
          <p class="font-medium">{statusMessage.text}</p>
          {#if statusMessage.details?.coverImage}
            <p class="font-mono text-xs text-emerald-300 mt-1">
              Ruta asignada: {statusMessage.details.coverImage}
            </p>
          {/if}
          {#if statusMessage.details?.assetsArrayFile}
            <p class="font-mono text-xs text-amber-300 mt-1">
              Archivo DaVinci: {statusMessage.details.assetsArrayFile}
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- CUADRÍCULA DE ESQUELETOS (SKELETON PLACEHOLDERS CON GSAP) -->
    {#if isLoading || candidates.length === 0}
      <div class="mb-5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full {isLoading ? 'bg-amber-400 animate-ping' : 'bg-emerald-600'}"></span>
          <span class="text-xs font-mono uppercase tracking-wider text-stone-400 font-medium">
            {isLoading ? 'Rastreando Wikimedia Commons (10 Slots Designados en curso)...' : 'Cuadrícula Lista (10 Espacios esperando búsqueda)'}
          </span>
        </div>
        <span class="text-[11px] font-mono text-stone-500">10 slots 16:9</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each Array(10) as _, i}
          <div
            bind:this={skeletonRefs[i]}
            class="bg-[#0a0f0c] border border-[#142017] rounded-xl overflow-hidden p-0 flex flex-col shadow-lg transition-all"
          >
            <!-- CONTENEDOR 16:9 SKELETON -->
            <div class="relative w-full aspect-video bg-[#0d1511] flex items-center justify-center overflow-hidden">
              <!-- MEDALLA DE RANURA -->
              <div class="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/60 border border-[#1a2c20] text-[10px] font-mono text-emerald-400/80 font-semibold">
                Slot #{String(i + 1).padStart(2, '0')}
              </div>

              <!-- RETÍCULA CINEMÁTICA 16:9 -->
              <div class="w-16 h-10 border border-dashed border-[#1a2c20] rounded flex items-center justify-center opacity-40">
                <span class="text-[10px] font-mono text-stone-600">16:9</span>
              </div>

              <div class="absolute inset-0 bg-linear-to-t from-[#0a0f0c] via-transparent to-transparent pointer-events-none"></div>
            </div>

            <!-- PLACEHOLDERS DE METADATOS -->
            <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div class="space-y-2">
                <div class="h-3.5 bg-[#121c15] rounded-md w-3/4"></div>
                <div class="h-2.5 bg-[#0e1711] rounded-md w-1/2"></div>
              </div>
              <div class="pt-3 border-t border-[#121c15] flex items-center justify-between">
                <div class="h-2.5 bg-[#101b13] rounded w-16"></div>
                <div class="h-2.5 bg-[#142218] rounded w-20"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>

    {:else}
      <!-- GALERÍA REAL DE CANDIDATAS DISPONIBLES -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each candidates as cand, idx}
          {@const isSelected = selectedCandidateIds.includes(cand.id)}
          {@const selectionOrder = selectedCandidateIds.indexOf(cand.id) + 1}

          <div
            bind:this={cardRefs[cand.id]}
            class="group relative bg-[#0b120e] rounded-xl overflow-hidden border transition-all duration-300 cursor-pointer shadow-md flex flex-col {isSelected ? 'border-amber-400/90 ring-2 ring-amber-400/40 shadow-amber-950/40 shadow-2xl scale-[1.01]' : 'border-[#16241b] hover:border-[#273e31] hover:scale-[1.005]'}"
            on:click={() => toggleSeleccion(cand)}
          >
            <!-- CONTENEDOR DE IMAGEN (16:9 PREVIEW) -->
            <div class="relative w-full aspect-video bg-[#050806] overflow-hidden">
              <img
                src={cand.thumbUrl}
                alt={cand.title}
                loading="lazy"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              <!-- GRADIENTE OSCURO INFERIOR -->
              <div class="absolute inset-0 bg-linear-to-t from-[#0b120e] via-transparent to-black/30 pointer-events-none"></div>

              <!-- MEDALLA DE ORDEN NUMÉRICO / CHECK (GSAP TARGET) -->
              {#if isSelected}
                <div class="absolute top-3 left-3 flex items-center justify-center">
                  {#if mode === 'hero'}
                    <span class="px-2.5 py-1 rounded-md bg-emerald-500 text-black font-mono font-bold text-xs shadow-lg flex items-center gap-1">
                      ★ HERO
                    </span>
                  {:else}
                    <span class="w-8 h-8 rounded-full bg-linear-to-br from-amber-300 to-amber-600 text-black font-mono font-black text-sm shadow-xl flex items-center justify-center border border-white/60">
                      #{selectionOrder}
                    </span>
                  {/if}
                </div>
              {/if}

              <!-- BOTÓN INSPECCIONAR EN LIGHTBOX -->
              <button
                type="button"
                class="absolute top-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/90 text-stone-200 hover:text-white backdrop-blur-md border border-white/10 transition-all opacity-80 group-hover:opacity-100 cursor-pointer"
                on:click|stopPropagation={() => abrirLightbox(cand)}
                title="Inspeccionar en pantalla completa"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>

              <!-- BADGES TÉCNICOS -->
              <div class="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-stone-300 pointer-events-none">
                <span class="bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs">
                  {cand.width} × {cand.height} px
                </span>
                <span class="bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs text-amber-300">
                  {cand.aspectRatio}:1
                </span>
              </div>
            </div>

            <!-- METADATOS Y CRÉDITOS CC -->
            <div class="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h4 class="text-xs font-serif text-stone-100 line-clamp-2 leading-snug mb-2 font-normal" title={cand.title}>
                  {cand.title}
                </h4>

                <div class="text-[11px] text-stone-400 space-y-0.5 font-mono">
                  <p class="truncate" title={cand.attribution?.author}>
                    <span class="text-stone-500">Autor:</span> {cand.attribution?.author || 'Desconocido'}
                  </p>
                  <p class="truncate text-emerald-400/90" title={cand.attribution?.license}>
                    <span class="text-stone-500">Licencia:</span> {cand.attribution?.license || 'CC'}
                  </p>
                </div>
              </div>

              <!-- BOTÓN INFERIOR DE ACCIÓN -->
              <div class="mt-4 pt-3 border-t border-[#142017] flex items-center justify-between">
                <span class="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                  {cand.sourceType.replace(/_/g, ' ')}
                </span>
                <span class="text-xs font-medium {isSelected ? 'text-amber-400 font-semibold' : 'text-stone-400 group-hover:text-stone-200'}">
                  {isSelected ? (mode === 'hero' ? '✓ Seleccionada' : `Toma #${selectionOrder}`) : '+ Elegir'}
                </span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>

  <!-- BARRA DE ACCIÓN FLOTANTE (CONFIRMACIÓN HITL) -->
  <footer
    bind:this={actionBarEl}
    class="fixed bottom-0 left-0 right-0 z-40 bg-[#070d09]/95 backdrop-blur-lg border-t border-[#17271e] py-3.5 px-4 sm:px-8 shadow-2xl"
  >
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-[#0f1b13] border border-[#1e3326] flex items-center justify-center text-amber-400 font-mono font-bold text-lg">
          {selectedCandidateIds.length}
        </div>
        <div>
          <div class="text-xs font-mono uppercase tracking-wider text-stone-400">
            {mode === 'hero' ? 'Selección para Portada Web' : 'Selección para DaVinci Resolve'}
          </div>
          <div class="text-sm font-medium text-white">
            {selectedCandidateIds.length === 0 ? 'Selecciona al menos una foto' : `${selectedCandidateIds.length} ${selectedCandidateIds.length === 1 ? 'imagen elegida' : 'imágenes elegidas'}`}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <button
          type="button"
          class="flex-1 sm:flex-none px-6 py-3 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2 {selectedCandidateIds.length > 0 && !isProcessing ? 'bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black shadow-emerald-900/40' : 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-50'}"
          disabled={selectedCandidateIds.length === 0 || isProcessing}
          on:click={confirmarYProcesar}
        >
          {#if isProcessing}
            <svg class="w-4 h-4 animate-spin text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Procesando Sharp & WebP...
          {:else}
            <span>✓ Confirmar & Descargar en Disco</span>
          {/if}
        </button>
      </div>
    </div>
  </footer>

  <!-- MODAL LIGHTBOX A PANTALLA COMPLETA (GSAP ANIMATED) -->
  {#if lightboxOpen && lightboxCandidate}
    <div
      bind:this={lightboxBackdropEl}
      class="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8"
      on:click={cerrarLightbox}
    >
      <div
        bind:this={lightboxDialogEl}
        class="relative max-w-5xl w-full bg-[#090f0c] border border-[#1b2f22] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        on:click|stopPropagation
      >
        <!-- CABECERA LIGHTBOX -->
        <div class="p-4 border-b border-[#142218] flex items-center justify-between bg-[#060a08]">
          <div class="truncate pr-4">
            <span class="text-[10px] font-mono tracking-widest text-emerald-400 uppercase">Inspección de Grano & Enfoque</span>
            <h3 class="text-sm font-serif text-white truncate">{lightboxCandidate.title}</h3>
          </div>
          <button
            type="button"
            class="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white transition-all cursor-pointer"
            on:click={cerrarLightbox}
          >
            ✕
          </button>
        </div>

        <!-- VISOR CENTRAL DE IMAGEN -->
        <div class="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-75">
          <img
            src={lightboxCandidate.url}
            alt={lightboxCandidate.title}
            class="max-w-full max-h-[65vh] object-contain"
          />
        </div>

        <!-- PIE DE DETALLES Y LICENCIAS -->
        <div class="p-4 bg-[#090f0c] border-t border-[#142218] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-xs font-mono text-stone-300 space-y-1">
            <p><span class="text-stone-500">Resolución Original:</span> {lightboxCandidate.width} × {lightboxCandidate.height} px ({lightboxCandidate.aspectRatio}:1)</p>
            <p><span class="text-stone-500">Atribución CC:</span> {lightboxCandidate.attribution?.author} · {lightboxCandidate.attribution?.license}</p>
          </div>

          <div class="flex items-center gap-3">
            <a
              href={lightboxCandidate.url}
              target="_blank"
              rel="noopener noreferrer"
              class="px-3 py-1.5 rounded-lg text-xs font-mono text-stone-400 hover:text-white bg-[#111c15] border border-[#1b2d21] transition-all"
            >
              Abrir Original ↗
            </a>

            <button
              type="button"
              class="px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black transition-all cursor-pointer"
              on:click={() => {
                if (lightboxCandidate) toggleSeleccion(lightboxCandidate);
                cerrarLightbox();
              }}
            >
              {selectedCandidateIds.includes(lightboxCandidate.id) ? 'Deseleccionar' : 'Seleccionar esta foto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .curador-root {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }
</style>
