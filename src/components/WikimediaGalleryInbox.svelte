<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // WikimediaGalleryInbox.svelte
  // Estudio Visual a Pantalla Completa (100vw / 100vh) para Wikimedia Commons (CC0 / PD)
  // Soporte Dual Día/Noche: Big Brand Gemini (Blanco Limpio) vs Carbón #121314 (Ambient Glow)
  // ─────────────────────────────────────────────────────────────────────────────
  import { onMount } from 'svelte';
  import {
    getWikimediaGallery,
    downloadWikimediaImageAsFile,
    type WikimediaImageItem
  } from '../lib/wikimedia-gallery';

  export let isOpen = false;
  export let onSelect: ((file: File) => void) | undefined = undefined;
  export let initialQuery = 'Ancient Egyptian cosmos, Nun god relief, Atum creation, Karnak temple, Hathor relief';

  let searchQuery = initialQuery;
  let isLoading = false;
  let error: string | null = null;
  let gallery: WikimediaImageItem[] = [];
  let selectedIndices: Set<number> = new Set();
  let previewImage: WikimediaImageItem | null = null; // Fancybox Lightbox modal
  let isIngesting = false;
  let cardSize: 'grande' | 'estandar' = 'grande';

  // Tema Dual: 'dia' (Gemini Brand blanco) vs 'noche' (#121314 con ambient glow)
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

  const PRESETS = [
    { label: '🏛 Mitología & Cosmogonía', query: 'Nun god relief, Atum creation, Egyptian cosmos, Karnak temple, Heliopolis obelisk' },
    { label: '🏺 Arqueología & Códices', query: 'Maya codex, Aztec stone calendar, Sumerian tablet, Minoan fresco, Roman mosaic' },
    { label: '👁 Geometría Sagrada', query: 'Sacred geometry stone, Roman labyrinth pavement, Rose window cathedral, Islamic geometric pattern' },
    { label: '🗿 Relieves & Epigrafía', query: 'Rosetta stone, Hieroglyph relief Abydos, Ashurbanipal lion hunt, Persepolis relief' },
    { label: '⚔️ Grecia & Roma', query: 'Parthenon frieze, Colosseum Rome, Alexander mosaic, Roman bust, Greek vase black figure' },
  ];

  async function ejecutarBusqueda(queryText?: string) {
    const q = queryText || searchQuery;
    if (!q.trim()) return;

    isLoading = true;
    error = null;
    selectedIndices.clear();
    selectedIndices = selectedIndices;

    try {
      const terms = q.split(',').map(t => t.trim()).filter(Boolean);
      const limit = Math.max(6, Math.ceil(24 / Math.max(1, terms.length)));
      const items = await getWikimediaGallery(terms, limit);

      gallery = items.slice(0, 36);
      if (gallery.length === 0) {
        error = 'No se encontraron imágenes CC0/PD para los términos indicados.';
      }
    } catch (err: any) {
      error = err.message || 'Error al conectar con la API de Wikimedia Commons.';
    } finally {
      isLoading = false;
    }
  }

  let prevIsOpen = false;
  $: if (isOpen && !prevIsOpen) {
    prevIsOpen = true;
    if (gallery.length === 0 && !isLoading) {
      ejecutarBusqueda();
    }
  } else if (!isOpen) {
    prevIsOpen = false;
  }

  function toggleSelect(index: number) {
    if (selectedIndices.has(index)) {
      selectedIndices.delete(index);
    } else {
      selectedIndices.add(index);
    }
    selectedIndices = selectedIndices;
  }

  function selectAll() {
    if (gallery.length === 0) return;
    gallery.forEach((_, idx) => selectedIndices.add(idx));
    selectedIndices = selectedIndices;
  }

  function clearSelection() {
    selectedIndices.clear();
    selectedIndices = selectedIndices;
  }

  async function confirmarIngesta() {
    if (selectedIndices.size === 0) return;
    isIngesting = true;
    error = null;

    try {
      const selectedImgs = Array.from(selectedIndices).map(idx => gallery[idx]);
      const downloadedFiles = await Promise.all(
        selectedImgs.map(img => downloadWikimediaImageAsFile(img))
      );
      
      if (onSelect) {
        for (const file of downloadedFiles) {
          onSelect(file);
        }
      } else {
        for (const file of downloadedFiles) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(file);
          a.download = file.name;
          a.click();
        }
      }
      
      isOpen = false;
      selectedIndices.clear();
      selectedIndices = selectedIndices;
    } catch (err: any) {
      error = `Error al procesar las imágenes: ${err.message}`;
    } finally {
      isIngesting = false;
    }
  }

  function openBookzine() {
    if (selectedIndices.size === 0) return;
    try {
      const selectedImgs = Array.from(selectedIndices).map(idx => {
        const img = gallery[idx];
        return {
          url: img.url,
          title: img.title || 'Sin título',
          author: img.author || 'Desconocido',
          licenseShortName: img.licenseShortName || 'CC0'
        };
      });
      sessionStorage.setItem('tgp_bookzine_queue', JSON.stringify(selectedImgs));
      window.open('/visor-revista', '_blank');
    } catch (err: any) {
      error = `Error al preparar la revista: ${err.message}`;
    }
  }

  function closeFancybox() {
    previewImage = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (previewImage) {
        previewImage = null;
      } else if (isOpen) {
        isOpen = false;
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- ESTUDIO A PANTALLA COMPLETA REAL (100vw x 100vh) -->
  <section
    id="wikimedia-inbox-section"
    class="fixed inset-0 z-[99999] w-screen h-screen overflow-y-auto flex flex-col animate-fadeIn transition-colors duration-300
    {theme === 'dia'
      ? 'bg-[#fbfcfe] text-slate-800 selection:bg-blue-100 selection:text-blue-900'
      : 'bg-[#121314] text-stone-200 selection:bg-emerald-900 selection:text-white'}"
  >
    <!-- AMBIENT GLOW DIFUSO (Solo en modo Noche) -->
    {#if theme === 'noche'}
      <div class="fixed -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none"></div>
      <div class="fixed top-1/3 -right-40 w-[550px] h-[550px] rounded-full bg-violet-500/10 blur-[150px] pointer-events-none"></div>
      <div class="fixed -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-amber-500/08 blur-[130px] pointer-events-none"></div>
    {/if}

    <!-- BARRA SUPERIOR FIJA / TOOLBAR CINEMÁTICA -->
    <header class="sticky top-0 z-40 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-sm shrink-0 transition-colors duration-300
      {theme === 'dia'
        ? 'bg-white/95 border-b border-slate-200/90'
        : 'bg-[#121314]/95 border-b border-white/10'}"
    >
      <div class="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <!-- TÍTULO & BRANDING -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm
            {theme === 'dia'
              ? 'bg-slate-100 border border-slate-200 text-blue-600'
              : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-400'}"
          >
            🏛
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-2 h-2 rounded-full {theme === 'dia' ? 'bg-blue-600' : 'bg-emerald-400 animate-pulse'}"></span>
              <span class="text-[11px] font-mono tracking-widest uppercase font-semibold
                {theme === 'dia' ? 'text-blue-700' : 'text-emerald-400'}"
              >
                Estudio Visual · Pantalla Completa
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-sans tracking-tight font-semibold
              {theme === 'dia' ? 'text-slate-900' : 'text-white'}"
            >
              Banco Wikimedia Commons (CC0 / PD)
            </h1>
          </div>
        </div>

        <!-- CONTROLES DE TEMA, VISTA Y SALIDA -->
        <div class="flex items-center gap-3">
          <!-- ☀️ / 🌙 CONMUTADOR DÍA / NOCHE (Gemini vs #121314 Glow) -->
          <button
            type="button"
            on:click={toggleTheme}
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all shadow-xs cursor-pointer
            {theme === 'dia'
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              : 'bg-[#1a1c1e] hover:bg-[#232628] text-amber-300 border-white/10 shadow-[0_0_15px_-3px_rgba(251,191,36,0.15)]'}"
            title="Alternar: Día (Brand Gemini) vs Noche (#121314 Glow)"
          >
            {#if theme === 'dia'}
              <span>☀️</span>
              <span class="font-sans font-semibold">Día · Gemini</span>
            {:else}
              <span>🌙</span>
              <span class="font-sans font-semibold">Noche · #121314</span>
            {/if}
          </button>

          <!-- CONMUTADOR DE TAMAÑO DE TARJETA -->
          <div class="flex items-center p-1 rounded-xl border
            {theme === 'dia' ? 'bg-slate-100 border-slate-200' : 'bg-[#181a1b] border-white/10'}"
          >
            <button
              type="button"
              class="px-3 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer
              {cardSize === 'grande'
                ? (theme === 'dia' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'bg-emerald-800 text-white font-bold')
                : (theme === 'dia' ? 'text-slate-600 hover:text-slate-900' : 'text-stone-400 hover:text-white')}"
              on:click={() => (cardSize = 'grande')}
              title="Tarjetas monumentales grandes (3 columnas)"
            >
              ⊞ Grandes
            </button>
            <button
              type="button"
              class="px-3 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer
              {cardSize === 'estandar'
                ? (theme === 'dia' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'bg-emerald-800 text-white font-bold')
                : (theme === 'dia' ? 'text-slate-600 hover:text-slate-900' : 'text-stone-400 hover:text-white')}"
              on:click={() => (cardSize = 'estandar')}
              title="Tarjetas estándar (4 columnas)"
            >
              ▦ Medias
            </button>
          </div>

          <span class="text-xs font-mono hidden sm:inline {theme === 'dia' ? 'text-slate-500' : 'text-stone-400'}">
            {gallery.length} fotos
          </span>

          <button
            type="button"
            class="px-4 py-2 text-xs font-sans font-medium rounded-xl border transition-all cursor-pointer shadow-xs flex items-center gap-1.5
            {theme === 'dia'
              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              : 'bg-[#181a1b] hover:bg-[#222527] text-stone-300 hover:text-white border-white/10 hover:border-emerald-500'}"
            on:click={() => (isOpen = false)}
            title="Cerrar y volver (Escape)"
          >
            ✕ Salir
          </button>
        </div>
      </div>

      <!-- SEGUNDA FILA: BUSCADOR AMPLIO & PRESETS -->
      <div class="max-w-7xl mx-auto mt-3.5 pt-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-t
        {theme === 'dia' ? 'border-slate-100' : 'border-white/5'}"
      >
        <!-- BUSCADOR LIBRE -->
        <div class="flex items-center gap-2 flex-1 max-w-3xl">
          <div class="relative flex-1">
            <span class="absolute left-3.5 top-2.5 text-sm {theme === 'dia' ? 'text-slate-400' : 'text-stone-500'}">🔍</span>
            <input
              type="text"
              bind:value={searchQuery}
              on:keydown={(e) => e.key === 'Enter' && ejecutarBusqueda()}
              placeholder="Buscar conceptos (ej: teseo minotauro, egipto piramide roja, coliseo romano, persepolis)..."
              class="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl focus:outline-none transition-all font-sans
              {theme === 'dia'
                ? 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                : 'bg-[#181a1b] border border-white/10 text-stone-100 focus:border-amber-400'}"
            />
          </div>
          <button
            type="button"
            disabled={isLoading}
            on:click={() => ejecutarBusqueda()}
            class="px-5 py-2.5 text-xs font-sans font-bold uppercase tracking-wider rounded-2xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-md
            {theme === 'dia'
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
              : 'bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black shadow-emerald-950/40'}"
          >
            {#if isLoading}
              <span class="animate-spin text-sm">⟳</span>
              <span>Buscando…</span>
            {:else}
              <span>✦ Buscar</span>
            {/if}
          </button>
        </div>

        <!-- COLECCIONES TEMÁTICAS -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[10px] font-mono uppercase mr-1 font-semibold {theme === 'dia' ? 'text-slate-400' : 'text-stone-500'}">Presets:</span>
          {#each PRESETS as p}
            <button
              type="button"
              on:click={() => { searchQuery = p.query; ejecutarBusqueda(p.query); }}
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border
              {theme === 'dia'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-[#181a1b] hover:bg-[#222527] text-stone-300 hover:text-white border-white/10'}"
            >
              {p.label}
            </button>
          {/each}
        </div>
      </div>
    </header>

    <!-- BARRA SECUNDARIA DE SELECCIÓN Y ACCIONES MASIVAS -->
    <div class="px-4 sm:px-8 py-2.5 shrink-0 border-b transition-colors
      {theme === 'dia' ? 'bg-slate-50/80 border-slate-200 text-slate-600' : 'bg-[#0f1011] border-white/5 text-stone-400'}"
    >
      <div class="max-w-7xl mx-auto flex items-center justify-between text-xs font-sans">
        <div class="flex items-center gap-3">
          {#if selectedIndices.size > 0}
            <span class="font-bold flex items-center gap-1.5 {theme === 'dia' ? 'text-blue-600' : 'text-amber-400'}">
              <span class="w-2 h-2 rounded-full {theme === 'dia' ? 'bg-blue-600' : 'bg-amber-400'}"></span>
              {selectedIndices.size} seleccionada{selectedIndices.size === 1 ? '' : 's'} para ingesta
            </span>
          {:else}
            <span class="{theme === 'dia' ? 'text-slate-400' : 'text-stone-500'}">Haz clic en las tarjetas para seleccionar tomas.</span>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            on:click={selectAll}
            class="px-3 py-1 rounded-lg text-xs cursor-pointer transition-colors border
            {theme === 'dia'
              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
              : 'bg-[#181a1b] hover:bg-[#222527] text-stone-300 hover:text-white border-white/10'}"
            title="Seleccionar todas las imágenes cargadas"
          >
            ⚡ Seleccionar Todas
          </button>
          <button
            type="button"
            on:click={clearSelection}
            class="px-3 py-1 text-xs cursor-pointer transition-colors
            {theme === 'dia' ? 'text-slate-500 hover:text-slate-900' : 'text-stone-400 hover:text-white'}"
          >
            Deseleccionar
          </button>
        </div>
      </div>
    </div>

    <!-- ÁREA PRINCIPAL: GALERÍA MONUMENTAL -->
    <main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 pb-28 relative z-10">
      {#if isLoading}
        <div class="py-28 flex flex-col items-center justify-center gap-4">
          <div class="flex gap-2.5">
            <div class="w-3.5 h-3.5 rounded-full {theme === 'dia' ? 'bg-blue-600' : 'bg-emerald-400'} animate-bounce"></div>
            <div class="w-3.5 h-3.5 rounded-full {theme === 'dia' ? 'bg-blue-600' : 'bg-emerald-400'} animate-bounce [animation-delay:0.15s]"></div>
            <div class="w-3.5 h-3.5 rounded-full {theme === 'dia' ? 'bg-blue-600' : 'bg-emerald-400'} animate-bounce [animation-delay:0.3s]"></div>
          </div>
          <span class="text-xs font-mono uppercase tracking-widest font-semibold
            {theme === 'dia' ? 'text-blue-700' : 'text-emerald-400'}"
          >
            Lanzando peticiones concurrentes a Wikimedia Commons…
          </span>
        </div>

      {:else if error}
        <div class="p-6 rounded-2xl text-sm flex items-center gap-3 shadow-lg border
          {theme === 'dia'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-red-950/60 border-red-700/60 text-red-200'}"
        >
          <span class="text-2xl">⚠</span>
          <div>
            <p class="font-bold">Aviso del Sistema</p>
            <p class="text-xs mt-0.5">{error}</p>
          </div>
        </div>

      {:else if gallery.length === 0}
        <div class="py-28 flex flex-col items-center justify-center text-center gap-3 border border-dashed rounded-3xl
          {theme === 'dia'
            ? 'border-slate-300 bg-white shadow-xs'
            : 'border-white/10 bg-[#161819]'}"
        >
          <span class="text-4xl">🏛</span>
          <h3 class="text-lg font-sans font-semibold {theme === 'dia' ? 'text-slate-800' : 'text-white'}">
            Galería a la espera de consulta
          </h3>
          <p class="text-xs max-w-md {theme === 'dia' ? 'text-slate-500' : 'text-stone-400'}">
            Escribe un término en el buscador superior para explorar y seleccionar obras en alta resolución.
          </p>
        </div>

      {:else}
        <!-- CUADRÍCULA MONUMENTAL BENTO SEGÚN SELECTOR DE TAMAÑO -->
        <div class="grid {cardSize === 'grande' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'}">
          {#each gallery as img, idx (img.url)}
            {@const isSelected = selectedIndices.has(idx)}

            <div
              class="group relative rounded-3xl overflow-hidden border transition-all duration-200 flex flex-col cursor-pointer
              {theme === 'dia'
                ? (isSelected
                    ? 'bg-white border-blue-600 ring-4 ring-blue-100 shadow-xl scale-[1.01]'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-sm hover:shadow-md hover:scale-[1.005]')
                : (isSelected
                    ? 'bg-[#181a1b] border-amber-400/90 ring-2 ring-amber-400/40 shadow-2xl shadow-amber-950/40 scale-[1.01]'
                    : 'bg-[#181a1b] border-white/10 hover:border-white/20 shadow-md hover:scale-[1.005]')}"
              on:click={() => toggleSelect(idx)}
            >
              <!-- IMAGEN CONTENEDOR AMPLIO -->
              <div class="relative {cardSize === 'grande' ? 'aspect-16/9 sm:aspect-16/10' : 'aspect-4/3'} overflow-hidden {theme === 'dia' ? 'bg-slate-100' : 'bg-black'}">
                <img
                  src={img.thumbUrl}
                  alt={img.title}
                  loading="lazy"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                <!-- GRADIENTE OSCURO INFERIOR -->
                <div class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>

                <!-- BADGE DE LICENCIA CC -->
                <div class="absolute top-3 left-3 px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase tracking-wider backdrop-blur-md shadow-sm font-semibold pointer-events-none
                  {theme === 'dia'
                    ? 'bg-white/90 text-slate-800 border border-slate-200'
                    : 'bg-black/75 text-emerald-400 border border-emerald-900'}"
                >
                  {img.licenseShortName}
                </div>

                <!-- BOTÓN INSPECCIONAR EN DETALLE (FANCYBOX LIGHTBOX) -->
                <button
                  type="button"
                  class="absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all opacity-80 group-hover:opacity-100 cursor-pointer shadow-md
                  {theme === 'dia'
                    ? 'bg-white/90 hover:bg-white text-slate-700 hover:text-black border border-slate-200'
                    : 'bg-black/70 hover:bg-black text-stone-200 hover:text-white border border-white/10'}"
                  on:click|stopPropagation={() => (previewImage = img)}
                  title="Inspeccionar en pantalla completa"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </button>

                <!-- CHECKMARK DE SELECCIÓN -->
                {#if isSelected}
                  <div class="absolute bottom-3 right-3 w-8 h-8 rounded-full text-sm font-black flex items-center justify-center shadow-xl border border-white/80 animate-fadeIn
                    {theme === 'dia'
                      ? 'bg-blue-600 text-white'
                      : 'bg-linear-to-br from-amber-300 to-amber-600 text-black'}"
                  >
                    ✓
                  </div>
                {/if}
              </div>

              <!-- METADATOS Y ACCIONES -->
              <div class="p-4 flex flex-col justify-between flex-1">
                <div>
                  <h4 class="text-xs font-sans font-semibold line-clamp-2 leading-snug mb-1 transition-colors
                    {theme === 'dia' ? 'text-slate-900 group-hover:text-blue-600' : 'text-stone-100 group-hover:text-amber-300'}"
                    title={img.title}
                  >
                    {img.title}
                  </h4>
                  <p class="text-[11px] font-sans truncate {theme === 'dia' ? 'text-slate-500' : 'text-stone-400'}">
                    <span class="{theme === 'dia' ? 'text-slate-400' : 'text-stone-500'}">Autor:</span> {img.author}
                  </p>
                </div>

                <div class="mt-4 pt-3 flex items-center justify-between border-t
                  {theme === 'dia' ? 'border-slate-100' : 'border-white/5'}"
                >
                  <span class="text-[10px] font-mono {theme === 'dia' ? 'text-slate-400' : 'text-stone-500'}">
                    Wikimedia CC
                  </span>
                  <button
                    type="button"
                    class="px-3.5 py-1.5 rounded-xl text-xs font-sans font-medium transition-all cursor-pointer
                    {isSelected
                      ? (theme === 'dia' ? 'bg-blue-600 text-white font-semibold' : 'bg-amber-400 text-black font-bold')
                      : (theme === 'dia'
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          : 'bg-[#222527] hover:bg-[#2c3033] text-stone-300 border border-white/10')}"
                    on:click|stopPropagation={() => toggleSelect(idx)}
                  >
                    {isSelected ? '✓ Seleccionada' : '+ Seleccionar'}
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </main>

    <!-- BARRA INFERIOR FLOTANTE DE CONFIRMACIÓN -->
    <footer class="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl py-3.5 px-4 sm:px-8 shadow-2xl border-t transition-colors
      {theme === 'dia'
        ? 'bg-white/95 border-slate-200 text-slate-700'
        : 'bg-[#121314]/95 border-white/10 text-stone-300'}"
    >
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="text-xs font-sans">
          {#if selectedIndices.size > 0}
            <span class="font-bold {theme === 'dia' ? 'text-blue-600' : 'text-emerald-400'}">
              {selectedIndices.size} imagen(es) seleccionadas
            </span> para descargar o ingestar.
          {:else}
            <span class="{theme === 'dia' ? 'text-slate-500' : 'text-stone-400'}">
              Haz clic en una o más fotos para enviarlas a tu mesa de trabajo o descargarlas.
            </span>
          {/if}
        </div>

        <div class="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            class="px-4 py-2.5 text-xs font-sans cursor-pointer transition-colors
            {theme === 'dia' ? 'text-slate-500 hover:text-slate-900' : 'text-stone-400 hover:text-white'}"
            on:click={() => (isOpen = false)}
          >
            Cerrar
          </button>

          <button
            type="button"
            disabled={selectedIndices.size === 0 || isIngesting}
            on:click={confirmarIngesta}
            class="flex-1 sm:flex-none px-6 py-2.5 text-xs font-sans font-bold uppercase tracking-wider rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed
            {theme === 'dia'
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
              : 'bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black shadow-emerald-950/40'}"
          >
            {#if isIngesting}
              <span class="animate-spin text-sm">⟳</span>
              <span>Descargando…</span>
            {:else}
              <span>✦ Ingestar / Descargar ({selectedIndices.size})</span>
            {/if}
          </button>

          <button
            type="button"
            disabled={selectedIndices.size === 0 || isIngesting}
            on:click={openBookzine}
            class="px-4 py-2.5 text-xs font-sans font-semibold rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 border disabled:opacity-40 disabled:cursor-not-allowed
            {theme === 'dia'
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              : 'bg-[#1e2022] hover:bg-[#282a2d] text-white border-white/10'}"
            title="Abre la selección en el visor interactivo tipo Revista"
          >
            📖 Ver en Bookzine
          </button>
        </div>
      </div>
    </footer>
  </section>
{/if}

<!-- ── LIGHTBOX / FANCYBOX PREVIEW MODAL ────────────────────────────────────── -->
{#if previewImage}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-fadeIn"
    on:click|self={closeFancybox}
  >
    <div class="relative max-w-5xl w-full max-h-[92vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border
      {theme === 'dia' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#181a1b] border-white/10 text-stone-100'}"
    >
      <!-- Barra superior Fancybox -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b
        {theme === 'dia' ? 'bg-slate-50 border-slate-200' : 'bg-[#121314] border-white/10'}"
      >
        <div class="truncate pr-4">
          <span class="text-[10px] font-mono tracking-widest uppercase font-semibold {theme === 'dia' ? 'text-blue-600' : 'text-emerald-400'}">
            Inspección de Detalle & Grano
          </span>
          <h3 class="text-sm font-sans font-semibold truncate">{previewImage.title}</h3>
        </div>
        <button
          type="button"
          class="p-2 rounded-xl text-sm font-mono transition-all cursor-pointer
          {theme === 'dia' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-[#222527] hover:bg-[#2c3033] text-stone-300 hover:text-white'}"
          on:click={closeFancybox}
        >
          ✕
        </button>
      </div>

      <!-- Imagen en Alta Resolución -->
      <div class="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/90 min-h-[300px]">
        <img
          src={previewImage.url}
          alt={previewImage.title}
          class="max-h-[68vh] max-w-full object-contain rounded-2xl shadow-sm"
        />
      </div>

      <!-- Barra inferior con metadatos y acción -->
      <div class="p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-sans border-t
        {theme === 'dia' ? 'bg-slate-50 border-slate-200' : 'bg-[#121314] border-white/10'}"
      >
        <div class="flex items-center gap-3">
          <span class="px-2.5 py-0.5 rounded-lg font-mono font-semibold
            {theme === 'dia' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}"
          >
            {previewImage.licenseShortName}
          </span>
          <span class="truncate max-w-xs {theme === 'dia' ? 'text-slate-600' : 'text-stone-300'}">
            Autor: {previewImage.author}
          </span>
          {#if previewImage.descriptionUrl}
            <a
              href={previewImage.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold hover:underline {theme === 'dia' ? 'text-blue-600' : 'text-emerald-400'}"
            >
              Ficha Commons ↗
            </a>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md
            {theme === 'dia'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-amber-400 hover:bg-amber-300 text-black'}"
            on:click={() => {
              const idx = gallery.findIndex(g => g.url === previewImage?.url);
              if (idx !== -1) {
                selectedIndices.add(idx);
                selectedIndices = selectedIndices;
              }
              closeFancybox();
            }}
          >
            ✓ Seleccionar esta imagen
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.99); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.15s ease-out forwards;
  }
</style>
