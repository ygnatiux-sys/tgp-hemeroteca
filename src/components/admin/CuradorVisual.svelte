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

  // ── Tema Dual: 'dia' (Brand Gemini limpio) vs 'noche' (Carbón Pixel #121314) ──
  let theme: 'dia' | 'noche' = 'dia';

  onMount(async () => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tgp_ui_theme');
      if (saved === 'dia' || saved === 'noche') {
        theme = saved;
      }
    }
    await cargarDatosIniciales();
  });

  function toggleTheme() {
    theme = theme === 'dia' ? 'noche' : 'dia';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tgp_ui_theme', theme);
    }
  }

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

<div class="curador-root min-h-screen font-sans transition-colors duration-300
  {theme === 'dia'
    ? 'bg-white text-[#1f1f1f] selection:bg-blue-100 selection:text-blue-900'
    : 'bg-[#121314] text-[#e3e3e3] selection:bg-blue-950 selection:text-white'}"
>
  <!-- AMBIENT GLOW DIFUSO (Solo en modo Noche) -->
  {#if theme === 'noche'}
    <div class="fixed -top-40 -left-40 w-125 h-125 rounded-full bg-blue-500/08 blur-[140px] pointer-events-none"></div>
    <div class="fixed top-1/3 -right-40 w-137.5 h-137.5 rounded-full bg-violet-500/08 blur-[150px] pointer-events-none"></div>
  {/if}

  <!-- ENCABEZADO SUPERIOR -->
  <header class="sticky top-0 z-40 backdrop-blur-xl px-4 sm:px-8 py-3.5 border-b transition-colors duration-300
    {theme === 'dia'
      ? 'bg-white/90 border-slate-100'
      : 'bg-[#131314]/90 border-white/5'}"
  >
    <div class="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <!-- BRANDING & TÍTULO ALUSIVO -->
      <div class="flex items-center gap-3.5">
        <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-2xs shrink-0
          {theme === 'dia' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-[#1e1f20] text-emerald-400 border border-white/10'}"
        >
          ✦
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-semibold tracking-wider uppercase
              {theme === 'dia' ? 'text-[#1a73e8]' : 'text-emerald-400'}">
              TGP Remediation
            </span>
          </div>
          <h1 class="text-xl sm:text-2xl font-sans tracking-tight font-bold
            {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-white'}">
            Asignador de Portadas
          </h1>
          <p class="text-xs font-sans font-medium mt-0.5
            {theme === 'dia' ? 'text-[#444746]' : 'text-[#8e918f]'}">
            Detecta posts sin portada (Hero Vacío), busca en Wikimedia Commons y asigna portadas a disco y Keystatic.
          </p>
        </div>
      </div>

      <!-- CONTROLES SUPERIORES: BUSCADOR MANUAL + SELECTOR DE POSTS + THEME TOGGLE -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- ☀️ / 🌙 CONMUTADOR DÍA / NOCHE -->
        <button
          type="button"
          on:click={toggleTheme}
          class="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-sans font-medium transition-all cursor-pointer shadow-2xs
          {theme === 'dia' ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]' : 'bg-[#1e1f20] hover:bg-[#282a2c] text-amber-300 border border-white/10'}"
          title="Alternar: Día (Brand Gemini) vs Noche (Carbón Pixel)"
        >
          {#if theme === 'dia'}
            <span>☀️</span>
            <span class="font-semibold">Día · Gemini</span>
          {:else}
            <span>🌙</span>
            <span class="font-semibold">Noche · Carbón</span>
          {/if}
        </button>

        <a
          href="/tgp-app/"
          class="px-4 py-2 text-xs font-sans font-semibold rounded-full transition-all inline-flex items-center gap-1.5 shadow-2xs
          {theme === 'dia' ? 'text-[#1a73e8] bg-[#e8f0fe] hover:bg-[#d2e3fc]' : 'text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800'}"
          title="Volver al Hub de TGP App"
        >
          ← Hub
        </a>

        <div class="hidden sm:block h-5 w-px {theme === 'dia' ? 'bg-slate-200' : 'bg-white/10'}"></div>

        <!-- 1. BUSCADOR DE TEXTO LIBRE (MANUAL INPUT) -->
        <form on:submit|preventDefault={ejecutarBusquedaManual} class="flex items-center gap-1.5 flex-1 sm:flex-none">
          <div class="relative w-full sm:w-60 md:w-68">
            <input
              type="text"
              bind:value={searchInput}
              placeholder="Buscar tema libre (ej. Coliseo)..."
              class="w-full text-xs rounded-full pl-3.5 pr-7 py-2 focus:outline-none transition-all
              {theme === 'dia'
                ? 'bg-[#f0f4f9] text-[#1f1f1f] placeholder-[#747775] border border-transparent focus:bg-white focus:border-[#1a73e8]'
                : 'bg-[#1e1f20] text-stone-200 placeholder-stone-500 border border-white/10 focus:border-[#8ab4f8]'}"
            />
            {#if searchInput}
              <button
                type="button"
                on:click={() => searchInput = ''}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            {/if}
          </div>

          <button
            type="submit"
            disabled={isLoading || isProcessing || !searchInput.trim()}
            class="px-4 py-2 text-xs font-sans font-semibold rounded-full transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap
            {theme === 'dia'
              ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
              : 'bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#131314]'}"
          >
            Buscar Manual
          </button>
        </form>

        <!-- 2. SELECTOR DE POST DE KEYSTATIC -->
        <div class="relative min-w-56 sm:min-w-64">
          <select
            class="w-full text-xs rounded-full px-3.5 py-2 pr-8 focus:outline-none transition-all cursor-pointer font-medium
            {theme === 'dia'
              ? 'bg-[#f0f4f9] text-[#1f1f1f] border border-transparent focus:border-[#1a73e8]'
              : 'bg-[#1e1f20] text-stone-200 border border-white/10 focus:border-[#8ab4f8]'}"
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
          class="px-3.5 py-2 text-xs font-sans font-semibold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50
          {theme === 'dia'
            ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]'
            : 'bg-[#1e1f20] hover:bg-[#282a2c] text-stone-200 border border-white/10'}"
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
    <div class="rounded-3xl p-6 mb-8 border transition-colors duration-300 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6
      {theme === 'dia'
        ? 'bg-[#f8fafd] border-slate-100'
        : 'bg-[#1e1f20] border-white/10'}"
    >
      <div>
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          {#if isManualMode}
            <span class="text-xs font-mono px-3 py-1 rounded-full font-semibold
              {theme === 'dia' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-amber-950/80 text-amber-300 border border-amber-800'}">
              Búsqueda Libre: "{manualQueryTitle}"
            </span>
            <span class="text-xs font-mono px-3 py-1 rounded-full
              {theme === 'dia' ? 'bg-slate-200 text-slate-700' : 'bg-[#151718] text-stone-400 border border-white/10'}">
              Slug: {selectedSlug}
            </span>
            <button
              type="button"
              on:click={volverAModoPost}
              class="text-xs font-sans text-[#1a73e8] hover:underline cursor-pointer ml-1"
            >
              (✕ Volver a Posts)
            </button>
          {:else}
            <span class="text-xs font-mono px-3 py-1 rounded-full
              {theme === 'dia' ? 'bg-slate-200 text-slate-700' : 'bg-[#151718] text-stone-400 border border-white/10'}">
              Slug: {selectedSlug || 'Ninguno'}
            </span>
            {#if currentPost?.hasHero}
              <span class="text-xs font-mono px-3 py-1 rounded-full font-semibold
                {theme === 'dia' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'}">
                Hero Asignado ✓
              </span>
            {:else}
              <span class="text-xs font-mono px-3 py-1 rounded-full font-semibold
                {theme === 'dia' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-amber-950/80 text-amber-300 border border-amber-800'}">
                Hero Vacío (Requiere Portada) ✗
              </span>
            {/if}
          {/if}
        </div>
        <h2 class="text-xl sm:text-2xl font-sans font-bold
          {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-white'}">
          {currentPost?.title || 'Selecciona un post o busca un tema'}
        </h2>
      </div>

      <!-- SELECTOR DUAL DE MODO (PÍLDORAS) -->
      <div class="flex items-center p-1 rounded-full border
        {theme === 'dia' ? 'bg-[#f0f4f9] border-slate-200' : 'bg-[#151718] border-white/10'}">
        <button
          type="button"
          class="px-4 py-2 rounded-full text-xs font-sans font-semibold transition-all cursor-pointer flex items-center gap-2
          {mode === 'hero'
            ? 'bg-[#1a73e8] text-white shadow-xs'
            : (theme === 'dia' ? 'text-[#444746] hover:text-[#1f1f1f]' : 'text-stone-400 hover:text-white')}"
          on:click={() => cambiarModo('hero')}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Modo Hero (1 Foto)
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-full text-xs font-sans font-semibold transition-all cursor-pointer flex items-center gap-2
          {mode === 'video-array'
            ? 'bg-amber-600 text-white shadow-xs'
            : (theme === 'dia' ? 'text-[#444746] hover:text-[#1f1f1f]' : 'text-stone-400 hover:text-white')}"
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
      <div class="mb-6 p-4 rounded-2xl border flex items-start gap-3 shadow-xs
        {statusMessage.type === 'success'
          ? (theme === 'dia' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/70 border-emerald-800 text-emerald-200')
          : statusMessage.type === 'error'
            ? (theme === 'dia' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-red-950/70 border-red-800 text-red-200')
            : (theme === 'dia' ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-blue-950/60 border-blue-800 text-blue-200')}"
      >
        <span class="text-xl">
          {statusMessage.type === 'success' ? '✨' : statusMessage.type === 'error' ? '⚠️' : 'ℹ️'}
        </span>
        <div class="flex-1 text-sm font-sans">
          <p class="font-semibold">{statusMessage.text}</p>
          {#if statusMessage.details?.coverImage}
            <p class="font-mono text-xs mt-1 text-[#1a73e8]">
              Ruta asignada: {statusMessage.details.coverImage}
            </p>
          {/if}
          {#if statusMessage.details?.assetsArrayFile}
            <p class="font-mono text-xs mt-1 text-amber-600">
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
          <span class="inline-block w-2.5 h-2.5 rounded-full {isLoading ? 'bg-amber-400 animate-ping' : (theme === 'dia' ? 'bg-emerald-500' : 'bg-emerald-400')}"></span>
          <span class="text-xs font-sans uppercase tracking-wider font-semibold {theme === 'dia' ? 'text-[#444746]' : 'text-stone-400'}">
            {isLoading ? 'Rastreando Wikimedia Commons (10 Slots en curso)...' : 'Cuadrícula Lista (10 Espacios esperando búsqueda)'}
          </span>
        </div>
        <span class="text-[11px] font-mono {theme === 'dia' ? 'text-slate-400' : 'text-stone-500'}">10 slots 16:9</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each Array(10) as _, i}
          <div
            bind:this={skeletonRefs[i]}
            class="rounded-3xl overflow-hidden border p-0 flex flex-col shadow-xs transition-all
            {theme === 'dia' ? 'bg-[#f8fafd] border-slate-200' : 'bg-[#1e1f20] border-white/10'}"
          >
            <!-- CONTENEDOR 16:9 SKELETON -->
            <div class="relative w-full aspect-video flex items-center justify-center overflow-hidden
              {theme === 'dia' ? 'bg-[#edf2f7]' : 'bg-[#151718]'}">
              <div class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold
                {theme === 'dia' ? 'bg-white text-slate-600 shadow-2xs' : 'bg-[#1e1f20] text-stone-400 border border-white/10'}">
                Slot #{String(i + 1).padStart(2, '0')}
              </div>
              <div class="w-16 h-10 border border-dashed rounded flex items-center justify-center opacity-40
                {theme === 'dia' ? 'border-slate-400 text-slate-500' : 'border-white/20 text-stone-500'}">
                <span class="text-[10px] font-mono">16:9</span>
              </div>
            </div>

            <!-- PLACEHOLDERS DE METADATOS -->
            <div class="p-5 space-y-3 flex-1 flex flex-col justify-between">
              <div class="space-y-2">
                <div class="h-4 rounded-md w-3/4 {theme === 'dia' ? 'bg-slate-200' : 'bg-[#2a2b2e]'}"></div>
                <div class="h-3 rounded-md w-1/2 {theme === 'dia' ? 'bg-slate-100' : 'bg-[#252629]'}"></div>
              </div>
              <div class="pt-3 border-t flex items-center justify-between
                {theme === 'dia' ? 'border-slate-100' : 'border-white/10'}">
                <div class="h-3 rounded w-16 {theme === 'dia' ? 'bg-slate-200' : 'bg-[#2a2b2e]'}"></div>
                <div class="h-3 rounded w-20 {theme === 'dia' ? 'bg-slate-200' : 'bg-[#2a2b2e]'}"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>

    {:else}
      <!-- GALERÍA REAL DE CANDIDATAS DISPONIBLES (CERO SCRIMS NI MÁSCARAS) -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each candidates as cand, idx}
          {@const isSelected = selectedCandidateIds.includes(cand.id)}
          {@const selectionOrder = selectedCandidateIds.indexOf(cand.id) + 1}

          <div
            bind:this={cardRefs[cand.id]}
            class="group relative rounded-3xl overflow-hidden border transition-all duration-300 cursor-pointer flex flex-col
            {isSelected
              ? (theme === 'dia'
                  ? 'border-[#1a73e8] ring-3 ring-[#1a73e8]/20 bg-white shadow-xl scale-[1.01]'
                  : 'border-[#8ab4f8] ring-3 ring-[#8ab4f8]/30 bg-[#1e1f20] shadow-xl scale-[1.01]')
              : (theme === 'dia'
                  ? 'bg-white border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md hover:scale-[1.005]'
                  : 'bg-[#1e1f20] border-white/10 hover:border-white/20 shadow-xs hover:scale-[1.005]')}"
            on:click={() => toggleSeleccion(cand)}
          >
            <!-- CONTENEDOR DE IMAGEN (16:9 PREVIEW, 100% NÍTIDA, SIN SCRIM) -->
            <div class="relative w-full aspect-video overflow-hidden {theme === 'dia' ? 'bg-[#f0f4f9]' : 'bg-black'}">
              <img
                src={cand.thumbUrl}
                alt={cand.title}
                loading="lazy"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              <!-- MEDALLA DE SELECCIÓN -->
              {#if isSelected}
                <div class="absolute top-3 left-3 flex items-center justify-center">
                  {#if mode === 'hero'}
                    <span class="px-3 py-1.5 rounded-full bg-[#1a73e8] text-white font-sans font-bold text-xs shadow-lg flex items-center gap-1">
                      ★ HERO
                    </span>
                  {:else}
                    <span class="w-8 h-8 rounded-full bg-amber-500 text-black font-mono font-black text-sm shadow-xl flex items-center justify-center border-2 border-white">
                      #{selectionOrder}
                    </span>
                  {/if}
                </div>
              {/if}

              <!-- BOTÓN INSPECCIONAR EN LIGHTBOX -->
              <button
                type="button"
                class="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all opacity-80 group-hover:opacity-100 cursor-pointer shadow-md"
                on:click|stopPropagation={() => abrirLightbox(cand)}
                title="Inspeccionar en detalle"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>

              <!-- BADGES TÉCNICOS INFERIORES -->
              <div class="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono pointer-events-none">
                <span class="bg-black/60 text-white px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                  {cand.width} × {cand.height} px
                </span>
                <span class="bg-black/60 text-amber-300 px-2.5 py-0.5 rounded-full backdrop-blur-xs font-semibold">
                  {cand.aspectRatio}:1
                </span>
              </div>
            </div>

            <!-- METADATOS Y CRÉDITOS CC -->
            <div class="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h4 class="text-xs font-sans font-semibold line-clamp-2 leading-snug mb-2.5 {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-stone-100'}" title={cand.title}>
                  {cand.title}
                </h4>

                <div class="text-[11px] space-y-1 font-sans {theme === 'dia' ? 'text-[#444746]' : 'text-stone-400'}">
                  <p class="truncate" title={cand.attribution?.author}>
                    <span class="font-medium {theme === 'dia' ? 'text-[#747775]' : 'text-stone-500'}">Autor:</span> {cand.attribution?.author || 'Desconocido'}
                  </p>
                  <p class="truncate {theme === 'dia' ? 'text-[#1a73e8]' : 'text-emerald-400'}" title={cand.attribution?.license}>
                    <span class="font-medium {theme === 'dia' ? 'text-[#747775]' : 'text-stone-500'}">Licencia:</span> {cand.attribution?.license || 'CC'}
                  </p>
                </div>
              </div>

              <!-- BOTÓN INFERIOR DE ACCIÓN -->
              <div class="mt-4 pt-3.5 border-t flex items-center justify-between
                {theme === 'dia' ? 'border-slate-100' : 'border-white/10'}">
                <span class="text-[10px] font-mono uppercase tracking-wider {theme === 'dia' ? 'text-[#747775]' : 'text-stone-500'}">
                  {cand.sourceType.replace(/_/g, ' ')}
                </span>
                <span class="text-xs font-sans font-semibold {isSelected ? (theme === 'dia' ? 'text-[#1a73e8]' : 'text-amber-400') : (theme === 'dia' ? 'text-[#444746] group-hover:text-[#1a73e8]' : 'text-stone-400 group-hover:text-stone-200')}">
                  {isSelected ? (mode === 'hero' ? '✓ Seleccionada' : `Toma #${selectionOrder}`) : '+ Elegir'}
                </span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>

  <!-- BARRA DE ACCIÓN FLOTANTE (PÍLDORA ESTILO GEMINI LIVE) -->
  <footer
    bind:this={actionBarEl}
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl px-6 py-3.5 border flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors duration-300
    {theme === 'dia'
      ? 'bg-white/95 border-slate-200/90 text-[#1f1f1f]'
      : 'bg-[#1e1f20]/95 border-white/10 text-white'}"
  >
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-base shadow-2xs
        {theme === 'dia' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-[#151718] text-amber-400 border border-white/10'}">
        {selectedCandidateIds.length}
      </div>
      <div>
        <div class="text-[11px] font-sans font-semibold uppercase tracking-wider {theme === 'dia' ? 'text-[#747775]' : 'text-stone-400'}">
          {mode === 'hero' ? 'Selección para Portada Web' : 'Selección para DaVinci Resolve'}
        </div>
        <div class="text-sm font-sans font-bold {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-white'}">
          {selectedCandidateIds.length === 0 ? 'Selecciona al menos una foto' : `${selectedCandidateIds.length} ${selectedCandidateIds.length === 1 ? 'imagen elegida' : 'imágenes elegidas'}`}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 w-full sm:w-auto">
      <button
        type="button"
        class="w-full sm:w-auto px-6 py-2.5 rounded-full font-sans text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2
        {selectedCandidateIds.length > 0 && !isProcessing
          ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
          : (theme === 'dia' ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60' : 'bg-[#2a2b2e] text-stone-500 cursor-not-allowed opacity-50')}"
        disabled={selectedCandidateIds.length === 0 || isProcessing}
        on:click={confirmarYProcesar}
      >
        {#if isProcessing}
          <svg class="w-4 h-4 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Procesando Sharp & WebP...
        {:else}
          <span>✓ Confirmar & Descargar en Disco</span>
        {/if}
      </button>
    </div>
  </footer>

  <!-- MODAL LIGHTBOX A PANTALLA COMPLETA (GSAP ANIMATED) -->
  {#if lightboxOpen && lightboxCandidate}
    <div
      bind:this={lightboxBackdropEl}
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8"
      on:click={cerrarLightbox}
    >
      <div
        bind:this={lightboxDialogEl}
        class="relative max-w-5xl w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border
        {theme === 'dia' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#181a1b] border-white/10 text-stone-100'}"
        on:click|stopPropagation
      >
        <!-- CABECERA LIGHTBOX -->
        <div class="px-5 py-3.5 border-b flex items-center justify-between
          {theme === 'dia' ? 'bg-slate-50 border-slate-200' : 'bg-[#121314] border-white/10'}">
          <div class="truncate pr-4">
            <span class="text-[10px] font-mono tracking-widest uppercase font-semibold
              {theme === 'dia' ? 'text-[#1a73e8]' : 'text-emerald-400'}">
              Inspección de Grano & Detalle
            </span>
            <h3 class="text-sm font-sans font-semibold truncate">{lightboxCandidate.title}</h3>
          </div>
          <button
            type="button"
            class="p-2 rounded-xl text-sm font-mono transition-all cursor-pointer
            {theme === 'dia' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-[#222527] hover:bg-[#2c3033] text-stone-300 hover:text-white'}"
            on:click={cerrarLightbox}
          >
            ✕
          </button>
        </div>

        <!-- VISOR CENTRAL DE IMAGEN -->
        <div class="relative flex-1 bg-black/90 flex items-center justify-center overflow-hidden min-h-75 p-4">
          <img
            src={lightboxCandidate.url}
            alt={lightboxCandidate.title}
            class="max-w-full max-h-[65vh] object-contain rounded-2xl"
          />
        </div>

        <!-- PIE DE DETALLES Y LICENCIAS -->
        <div class="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4
          {theme === 'dia' ? 'bg-slate-50 border-slate-200' : 'bg-[#121314] border-white/10'}">
          <div class="text-xs font-sans space-y-1 {theme === 'dia' ? 'text-slate-600' : 'text-stone-300'}">
            <p><span class="font-semibold {theme === 'dia' ? 'text-slate-800' : 'text-stone-400'}">Resolución:</span> {lightboxCandidate.width} × {lightboxCandidate.height} px ({lightboxCandidate.aspectRatio}:1)</p>
            <p><span class="font-semibold {theme === 'dia' ? 'text-slate-800' : 'text-stone-400'}">Atribución CC:</span> {lightboxCandidate.attribution?.author} · {lightboxCandidate.attribution?.license}</p>
          </div>

          <div class="flex items-center gap-3">
            <a
              href={lightboxCandidate.url}
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2 rounded-full text-xs font-sans font-semibold transition-all
              {theme === 'dia' ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-[#222527] hover:bg-[#2c3033] text-stone-200'}"
            >
              Abrir Original ↗
            </a>

            <button
              type="button"
              class="px-5 py-2 rounded-full text-xs font-sans font-semibold text-white transition-all cursor-pointer shadow-xs
              {theme === 'dia' ? 'bg-[#1a73e8] hover:bg-[#1557b0]' : 'bg-[#8ab4f8] text-[#131314] hover:bg-[#aecbfa]'}"
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
