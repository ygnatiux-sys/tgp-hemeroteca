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
    class="fixed inset-0 z-99999 w-screen h-screen overflow-y-auto flex flex-col animate-fadeIn transition-colors duration-300
    {theme === 'dia'
      ? 'bg-white text-[#1f1f1f] selection:bg-blue-100 selection:text-blue-900'
      : 'bg-[#131314] text-[#e3e3e3] selection:bg-emerald-900 selection:text-white'}"
  >
    <!-- AMBIENT GLOW DIFUSO (Solo en modo Noche) -->
    {#if theme === 'noche'}
      <div class="fixed -top-40 -left-40 w-125 h-125 rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none"></div>
      <div class="fixed top-1/3 -right-40 w-137.5 h-137.5 rounded-full bg-violet-500/10 blur-[150px] pointer-events-none"></div>
      <div class="fixed -bottom-40 left-1/3 w-125 h-125 rounded-full bg-amber-500/08 blur-[130px] pointer-events-none"></div>
    {/if}

    <!-- BARRA SUPERIOR FIJA / BRANDING GEMINI -->
    <header class="sticky top-0 z-40 backdrop-blur-xl px-5 sm:px-10 py-4 shrink-0 transition-colors duration-300
      {theme === 'dia'
        ? 'bg-white/90 border-b border-slate-100'
        : 'bg-[#131314]/90 border-b border-white/5'}"
    >
      <div class="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <!-- TÍTULO & BRANDING GEMINI -->
        <div class="flex items-center gap-3.5">
          <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-2xs
            {theme === 'dia'
              ? 'bg-[#e8f0fe] text-[#1a73e8]'
              : 'bg-[#1e1f20] text-emerald-400 border border-white/10'}"
          >
            ✦
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-sans tracking-tight font-bold
              {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-white'}"
            >
              Banco Wikimedia Commons
            </h1>
            <p class="text-xs sm:text-sm font-sans font-medium {theme === 'dia' ? 'text-[#444746]' : 'text-[#8e918f]'}">
              Curaduría visual en alta resolución · Dominio Público & CC
            </p>
          </div>
        </div>

        <!-- CONTROLES DE TEMA, VISTA Y SALIDA -->
        <div class="flex items-center gap-2.5">
          <!-- ☀️ / 🌙 CONMUTADOR DÍA / NOCHE -->
          <button
            type="button"
            on:click={toggleTheme}
            class="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-sans font-medium transition-all cursor-pointer
            {theme === 'dia'
              ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]'
              : 'bg-[#1e1f20] hover:bg-[#282a2c] text-amber-300 border border-white/10'}"
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

          <!-- CONMUTADOR DE TAMAÑO DE TARJETA -->
          <div class="flex items-center p-1 rounded-full
            {theme === 'dia' ? 'bg-[#f0f4f9]' : 'bg-[#1e1f20] border border-white/10'}"
          >
            <button
              type="button"
              class="px-3.5 py-1.5 rounded-full text-xs font-sans transition-all cursor-pointer
              {cardSize === 'grande'
                ? (theme === 'dia' ? 'bg-white text-[#1f1f1f] font-semibold shadow-xs' : 'bg-[#2d2f31] text-white font-semibold')
                : (theme === 'dia' ? 'text-[#444746] hover:text-[#1f1f1f]' : 'text-stone-400 hover:text-white')}"
              on:click={() => (cardSize = 'grande')}
              title="Tarjetas grandes"
            >
              ⊞ Grandes
            </button>
            <button
              type="button"
              class="px-3.5 py-1.5 rounded-full text-xs font-sans transition-all cursor-pointer
              {cardSize === 'estandar'
                ? (theme === 'dia' ? 'bg-white text-[#1f1f1f] font-semibold shadow-xs' : 'bg-[#2d2f31] text-white font-semibold')
                : (theme === 'dia' ? 'text-[#444746] hover:text-[#1f1f1f]' : 'text-stone-400 hover:text-white')}"
              on:click={() => (cardSize = 'estandar')}
              title="Tarjetas medianas"
            >
              ▦ Medias
            </button>
          </div>

          <button
            type="button"
            class="px-4 py-2 text-xs font-sans font-medium rounded-full transition-all cursor-pointer flex items-center gap-1.5
            {theme === 'dia'
              ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]'
              : 'bg-[#1e1f20] hover:bg-[#282a2c] text-[#e3e3e3] border border-white/10'}"
            on:click={() => (isOpen = false)}
            title="Cerrar y volver (Escape)"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>

      <!-- SEGUNDA FILA: BUSCADOR REDONDEADO GEMINI & PRESETS -->
      <div class="max-w-7xl mx-auto mt-4 pt-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-t
        {theme === 'dia' ? 'border-slate-100' : 'border-white/5'}"
      >
        <!-- BUSCADOR LIBRE -->
        <div class="flex items-center gap-2 flex-1 max-w-3xl">
          <div class="relative flex-1">
            <span class="absolute left-4 top-3 text-sm {theme === 'dia' ? 'text-[#747775]' : 'text-stone-400'}">🔍</span>
            <input
              type="text"
              bind:value={searchQuery}
              on:keydown={(e) => e.key === 'Enter' && ejecutarBusqueda()}
              placeholder="Escribe lo que buscas (ej: teseo minotauro, egipto piramide roja, coliseo romano)..."
              class="w-full pl-10 pr-5 py-2.5 text-sm rounded-full focus:outline-none transition-all font-sans
              {theme === 'dia'
                ? 'bg-[#f0f4f9] text-[#1f1f1f] placeholder-[#747775] focus:bg-white focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8] border border-transparent'
                : 'bg-[#1e1f20] text-stone-100 placeholder-stone-500 focus:border-[#8ab4f8] border border-white/10'}"
            />
          </div>
          <button
            type="button"
            disabled={isLoading}
            on:click={() => ejecutarBusqueda()}
            class="px-6 py-2.5 text-sm font-sans font-semibold rounded-full transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm
            {theme === 'dia'
              ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-blue-500/10'
              : 'bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#131314]'}"
          >
            {#if isLoading}
              <span class="animate-spin text-sm">⟳</span>
              <span>Buscando…</span>
            {:else}
              <span>Buscar</span>
            {/if}
          </button>
        </div>

        <!-- COLECCIONES TEMÁTICAS (PRESETS) -->
        <div class="flex flex-wrap items-center gap-1.5">
          {#each PRESETS as p}
            <button
              type="button"
              on:click={() => { searchQuery = p.query; ejecutarBusqueda(p.query); }}
              class="px-3.5 py-1.5 rounded-full text-xs font-sans font-medium transition-colors cursor-pointer
              {theme === 'dia'
                ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]'
                : 'bg-[#1e1f20] hover:bg-[#282a2c] text-[#e3e3e3] border border-white/10'}"
            >
              {p.label}
            </button>
          {/each}
        </div>
      </div>
    </header>

    <!-- BARRA SECUNDARIA LIMPIA: CONTEO & SELECCIÓN GLOBAL -->
    <div class="px-5 sm:px-10 py-2.5 shrink-0 transition-colors
      {theme === 'dia' ? 'bg-[#f8fafd] text-[#444746]' : 'bg-[#181a1b] text-stone-400'}"
    >
      <div class="max-w-7xl mx-auto flex items-center justify-between text-xs sm:text-sm font-sans">
        <div class="flex items-center gap-2">
          {#if selectedIndices.size > 0}
            <span class="font-semibold flex items-center gap-1.5 {theme === 'dia' ? 'text-[#1a73e8]' : 'text-emerald-400'}">
              <span class="w-2 h-2 rounded-full {theme === 'dia' ? 'bg-[#1a73e8]' : 'bg-emerald-400'}"></span>
              {selectedIndices.size} seleccionada{selectedIndices.size === 1 ? '' : 's'} para tu mesa de trabajo
            </span>
          {:else}
            <span class="{theme === 'dia' ? 'text-[#747775]' : 'text-stone-400'}">
              Toca cualquier tarjeta para seleccionar o inspeccionar en detalle.
            </span>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            on:click={selectAll}
            class="font-medium hover:underline cursor-pointer {theme === 'dia' ? 'text-[#1a73e8]' : 'text-emerald-400'}"
          >
            Seleccionar todas
          </button>
          {#if selectedIndices.size > 0}
            <button
              type="button"
              on:click={clearSelection}
              class="font-medium hover:underline cursor-pointer {theme === 'dia' ? 'text-[#747775] hover:text-[#1f1f1f]' : 'text-stone-400 hover:text-white'}"
            >
              Limpiar
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- ÁREA PRINCIPAL: GALERÍA MONUMENTAL LIMPIA (CERO SCRIMS / CERO MÁSCARAS) -->
    <main class="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-10 py-6 pb-36 relative z-10">
      {#if isLoading}
        <div class="py-32 flex flex-col items-center justify-center gap-4">
          <div class="flex gap-2.5">
            <div class="w-3 h-3 rounded-full {theme === 'dia' ? 'bg-[#1a73e8]' : 'bg-[#8ab4f8]'} animate-bounce"></div>
            <div class="w-3 h-3 rounded-full {theme === 'dia' ? 'bg-[#1a73e8]' : 'bg-[#8ab4f8]'} animate-bounce [animation-delay:0.15s]"></div>
            <div class="w-3 h-3 rounded-full {theme === 'dia' ? 'bg-[#1a73e8]' : 'bg-[#8ab4f8]'} animate-bounce [animation-delay:0.3s]"></div>
          </div>
          <span class="text-sm font-sans font-medium {theme === 'dia' ? 'text-[#444746]' : 'text-stone-400'}">
            Cargando obras de alta resolución desde Wikimedia Commons…
          </span>
        </div>

      {:else if error}
        <div class="p-6 rounded-3xl text-sm flex items-center gap-3 border
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
        <div class="py-32 flex flex-col items-center justify-center text-center gap-3 rounded-3xl border border-dashed
          {theme === 'dia'
            ? 'border-slate-200 bg-[#f8fafd]'
            : 'border-white/10 bg-[#1e1f20]'}"
        >
          <span class="text-4xl">✦</span>
          <h3 class="text-lg font-sans font-semibold {theme === 'dia' ? 'text-[#1f1f1f]' : 'text-white'}">
            Escribe un concepto para comenzar
          </h3>
          <p class="text-sm max-w-md {theme === 'dia' ? 'text-[#747775]' : 'text-stone-400'}">
            Prueba buscando nombres de monumentos, deidades, ciudades antiguas o periodos históricos.
          </p>
        </div>

      {:else}
        <!-- CUADRÍCULA LIMPIA ESTILO BENTO GEMINI -->
        <div class="grid {cardSize === 'grande' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5'}">
          {#each gallery as img, idx (img.url)}
            {@const isSelected = selectedIndices.has(idx)}

            <!-- TARJETA BENTO IMPECABLE -->
            <div
              class="group relative rounded-3xl overflow-hidden transition-all duration-200 flex flex-col border
              {theme === 'dia'
                ? (isSelected
                    ? 'bg-white border-[#1a73e8] ring-4 ring-[#1a73e8]/15 shadow-lg scale-[1.008]'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md')
                : (isSelected
                    ? 'bg-[#1e1f20] border-[#8ab4f8] ring-4 ring-[#8ab4f8]/20 shadow-xl scale-[1.008]'
                    : 'bg-[#1e1f20] border-white/10 hover:border-white/20 shadow-sm')}"
            >
              <!-- IMAGEN PURA (100% NATIVA, CERO SCRIMS, CERO MÁSCARAS) -->
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="relative {cardSize === 'grande' ? 'aspect-16/10' : 'aspect-4/3'} overflow-hidden cursor-pointer {theme === 'dia' ? 'bg-[#f0f4f9]' : 'bg-black'}"
                on:click={() => (previewImage = img)}
                title="Toca para ver en escala completa y alta definición"
              >
                <img
                  src={img.thumbUrl}
                  alt={img.title}
                  loading="lazy"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />

                <!-- CHECKMARK CIRCULAR GEMINI CUANDO ESTÁ SELECCIONADA -->
                {#if isSelected}
                  <div class="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md animate-fadeIn
                    {theme === 'dia' ? 'bg-[#1a73e8] text-white' : 'bg-[#8ab4f8] text-[#131314]'}"
                  >
                    ✓
                  </div>
                {/if}
              </div>

              <!-- CONTENIDO INFERIOR: TÍTULO Y ACCIÓN CLARA -->
              <div class="p-4 sm:p-5 flex flex-col justify-between flex-1 gap-3.5">
                <h4
                  class="text-sm sm:text-base font-sans font-semibold line-clamp-2 leading-snug cursor-pointer transition-colors
                  {theme === 'dia' ? 'text-[#1f1f1f] group-hover:text-[#1a73e8]' : 'text-[#e3e3e3] group-hover:text-[#8ab4f8]'}"
                  on:click={() => (previewImage = img)}
                  title={img.title}
                >
                  {img.title}
                </h4>

                <div class="flex items-center justify-between pt-1">
                  <!-- Botón Ver Grande -->
                  <button
                    type="button"
                    class="text-xs font-sans font-medium cursor-pointer transition-colors
                    {theme === 'dia' ? 'text-[#747775] hover:text-[#1f1f1f]' : 'text-stone-400 hover:text-white'}"
                    on:click={() => (previewImage = img)}
                  >
                    🔍 Ver detalle
                  </button>

                  <!-- Botón Seleccionar Píldora -->
                  <button
                    type="button"
                    class="px-4 py-1.5 rounded-full text-xs font-sans font-semibold transition-all cursor-pointer
                    {isSelected
                      ? (theme === 'dia'
                          ? 'bg-[#e8f0fe] text-[#1a73e8]'
                          : 'bg-[#283244] text-[#8ab4f8]')
                      : (theme === 'dia'
                          ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]'
                          : 'bg-[#2d2f31] hover:bg-[#383a3d] text-white')}"
                    on:click={() => toggleSelect(idx)}
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

    <!-- ── BARRA FLOTANTE TIPO ISLA GEMINI LIVE (CENTRADITA Y ELEGANTE) ────────── -->
    <div class="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <div
        class="pointer-events-auto backdrop-blur-2xl px-5 sm:px-7 py-3 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.18)] border flex items-center gap-3 sm:gap-4 transition-all
        {theme === 'dia'
          ? 'bg-white/95 border-slate-200 text-[#1f1f1f]'
          : 'bg-[#1e1f20]/95 border-white/10 text-white'}"
      >
        <!-- Contador -->
        <span class="text-xs sm:text-sm font-sans font-medium whitespace-nowrap {theme === 'dia' ? 'text-[#444746]' : 'text-stone-300'}">
          {#if selectedIndices.size > 0}
            <strong class="{theme === 'dia' ? 'text-[#1a73e8]' : 'text-[#8ab4f8]'}">{selectedIndices.size}</strong> seleccionada{selectedIndices.size === 1 ? '' : 's'}
          {:else}
            0 seleccionadas
          {/if}
        </span>

        <div class="h-4 w-px {theme === 'dia' ? 'bg-slate-200' : 'bg-white/10'}"></div>

        <!-- Botón Ingestar Azul Google -->
        <button
          type="button"
          disabled={selectedIndices.size === 0 || isIngesting}
          on:click={confirmarIngesta}
          class="px-5 sm:px-6 py-2 text-xs sm:text-sm font-sans font-semibold rounded-full transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs
          {theme === 'dia'
            ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
            : 'bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#131314]'}"
        >
          {#if isIngesting}
            <span class="animate-spin text-sm">⟳</span>
            <span>Descargando…</span>
          {:else}
            <span>✦ Ingestar ({selectedIndices.size})</span>
          {/if}
        </button>

        <!-- Botón Bookzine -->
        <button
          type="button"
          disabled={selectedIndices.size === 0 || isIngesting}
          on:click={openBookzine}
          class="px-4 py-2 text-xs sm:text-sm font-sans font-medium rounded-full transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed
          {theme === 'dia'
            ? 'bg-[#f0f4f9] hover:bg-[#e2e7ef] text-[#1f1f1f]'
            : 'bg-[#2d2f31] hover:bg-[#383a3d] text-white'}"
          title="Abre la selección en el visor interactivo tipo Revista"
        >
          📖 Bookzine
        </button>

        <!-- Botón Cerrar -->
        <button
          type="button"
          class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-sans transition-colors cursor-pointer
          {theme === 'dia' ? 'hover:bg-slate-100 text-[#747775] hover:text-[#1f1f1f]' : 'hover:bg-white/10 text-stone-400 hover:text-white'}"
          on:click={() => (isOpen = false)}
          title="Cerrar estudio"
        >
          ✕
        </button>
      </div>
    </div>
  </section>
{/if}

<!-- ── LIGHTBOX / FANCYBOX PREVIEW MODAL ────────────────────────────────────── -->
{#if previewImage}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-100000 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-fadeIn"
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
      <div class="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/90 min-h-75">
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
