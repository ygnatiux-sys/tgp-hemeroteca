<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // WikimediaGalleryInbox.svelte
  // Estudio Visual a Pantalla Completa (100vw / 100vh) para Wikimedia Commons (CC0 / PD)
  // Búsqueda concurrente Promise.all, inspección en alta resolución e ingesta directa
  // ─────────────────────────────────────────────────────────────────────────────
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
  let cardSize: 'grande' | 'estandar' = 'grande'; // Selector de tamaño de tarjetas

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
    selectedIndices = selectedIndices; // reactividad
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
        // Si no hay onSelect (ej: vista directa), descargar en el navegador
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
    class="fixed inset-0 z-50 w-screen h-screen bg-[#070b09] text-stone-200 overflow-y-auto flex flex-col animate-fadeIn selection:bg-emerald-900 selection:text-white"
  >
    <!-- BARRA SUPERIOR FIJA / TOOLBAR CINEMÁTICA -->
    <header class="sticky top-0 z-40 bg-[#090f0c]/95 backdrop-blur-md border-b border-[#15231a] px-4 sm:px-8 py-3.5 shadow-xl shrink-0">
      <div class="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <!-- TÍTULO & BRANDING -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 flex items-center justify-center font-bold text-lg shadow-sm">
            🏛
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[11px] font-mono tracking-widest uppercase text-emerald-400 font-semibold">
                Estudio Visual · Pantalla Completa
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-serif text-white tracking-wide">
              Banco Wikimedia Commons (CC0 / PD)
            </h1>
          </div>
        </div>

        <!-- CONTROLES DE VISTA Y SALIDA -->
        <div class="flex items-center gap-3">
          <!-- CONMUTADOR DE TAMAÑO DE TARJETA -->
          <div class="flex items-center bg-[#0d1612] p-1 rounded-lg border border-[#1b2f23]">
            <button
              type="button"
              class="px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer {cardSize === 'grande' ? 'bg-emerald-800 text-white font-bold' : 'text-stone-400 hover:text-white'}"
              on:click={() => (cardSize = 'grande')}
              title="Tarjetas monumentales grandes (3 columnas)"
            >
              ⊞ Grandes
            </button>
            <button
              type="button"
              class="px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer {cardSize === 'estandar' ? 'bg-emerald-800 text-white font-bold' : 'text-stone-400 hover:text-white'}"
              on:click={() => (cardSize = 'estandar')}
              title="Tarjetas estándar (4 columnas)"
            >
              ▦ Medias
            </button>
          </div>

          <span class="text-xs font-mono text-stone-400 hidden sm:inline">
            {gallery.length} fotos cargadas
          </span>

          <button
            type="button"
            class="px-4 py-2 text-xs font-mono font-medium text-stone-300 hover:text-white bg-[#121c16] hover:bg-[#1a2920] rounded-lg border border-[#1e3025] hover:border-emerald-500 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            on:click={() => (isOpen = false)}
            title="Cerrar y volver a la mesa (o presiona Escape)"
          >
            ✕ Salir / Cerrar
          </button>
        </div>
      </div>

      <!-- SEGUNDA FILA: BUSCADOR AMPLIO & PRESETS -->
      <div class="max-w-7xl mx-auto mt-3.5 pt-3 border-t border-[#121c15] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <!-- BUSCADOR LIBRE -->
        <div class="flex items-center gap-2 flex-1 max-w-3xl">
          <div class="relative flex-1">
            <span class="absolute left-3.5 top-2.5 text-stone-500 text-sm">🔍</span>
            <input
              type="text"
              bind:value={searchQuery}
              on:keydown={(e) => e.key === 'Enter' && ejecutarBusqueda()}
              placeholder="Buscar conceptos (ej: teseo minotauro, egipto piramide roja, coliseo romano, persepolis)..."
              class="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-[#0d1511] border border-[#1e2e24] focus:border-amber-400 rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none font-mono transition-all shadow-inner"
            />
          </div>
          <button
            type="button"
            disabled={isLoading}
            on:click={() => ejecutarBusqueda()}
            class="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-lg"
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
          <span class="text-[10px] font-mono uppercase text-stone-500 mr-1 font-semibold">Presets:</span>
          {#each PRESETS as p}
            <button
              type="button"
              on:click={() => { searchQuery = p.query; ejecutarBusqueda(p.query); }}
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#0f1813] hover:bg-[#18281e] text-stone-300 hover:text-white border border-[#1b2b21] hover:border-emerald-600 transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          {/each}
        </div>
      </div>
    </header>

    <!-- BARRA SECUNDARIA DE SELECCIÓN Y ACCIONES MASIVAS -->
    <div class="bg-[#0a0f0c] border-b border-[#142017] px-4 sm:px-8 py-2.5 shrink-0">
      <div class="max-w-7xl mx-auto flex items-center justify-between text-xs font-mono">
        <div class="flex items-center gap-3">
          {#if selectedIndices.size > 0}
            <span class="text-amber-400 font-bold flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              {selectedIndices.size} seleccionada{selectedIndices.size === 1 ? '' : 's'} para ingesta
            </span>
          {:else}
            <span class="text-stone-500">Haz clic en las tarjetas para seleccionar tomas.</span>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            on:click={selectAll}
            class="px-3 py-1 bg-[#101914] hover:bg-[#18261e] text-stone-300 hover:text-white rounded text-xs border border-[#1a2c20] cursor-pointer transition-colors"
            title="Seleccionar todas las imágenes cargadas"
          >
            ⚡ Seleccionar Todas
          </button>
          <button
            type="button"
            on:click={clearSelection}
            class="px-3 py-1 text-stone-400 hover:text-white text-xs cursor-pointer"
          >
            Deseleccionar
          </button>
        </div>
      </div>
    </div>

    <!-- ÁREA PRINCIPAL: GALERÍA MONUMENTAL -->
    <main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 pb-28">
      {#if isLoading}
        <!-- ESTADO DE CARGA ESPACIOSO -->
        <div class="py-28 flex flex-col items-center justify-center gap-4 text-stone-400">
          <div class="flex gap-2.5">
            <div class="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-bounce"></div>
            <div class="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.15s]"></div>
            <div class="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.3s]"></div>
          </div>
          <span class="text-xs font-mono uppercase tracking-widest text-emerald-400/90 font-medium">
            Lanzando peticiones concurrentes a Wikimedia Commons…
          </span>
        </div>

      {:else if error}
        <div class="p-6 bg-red-950/60 border border-red-700/60 rounded-2xl text-red-200 text-sm flex items-center gap-3 shadow-lg">
          <span class="text-2xl">⚠</span>
          <div>
            <p class="font-bold">Aviso del Sistema</p>
            <p class="text-xs mt-0.5">{error}</p>
          </div>
        </div>

      {:else if gallery.length === 0}
        <div class="py-28 flex flex-col items-center justify-center text-center text-stone-500 gap-3 border border-dashed border-[#17271e] rounded-3xl bg-[#090e0b]">
          <span class="text-4xl">🏛</span>
          <h3 class="text-base font-serif text-white">Galería a la espera de consulta</h3>
          <p class="text-xs text-stone-400 max-w-md">Escribe un término en el buscador superior para explorar y seleccionar obras en alta resolución.</p>
        </div>

      {:else}
        <!-- CUADRÍCULA MONUMENTAL SEGÚN SELECTOR DE TAMAÑO -->
        <div class="grid {cardSize === 'grande' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'}">
          {#each gallery as img, idx (img.url)}
            {@const isSelected = selectedIndices.has(idx)}

            <div
              class="group relative rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col bg-[#0b120e] cursor-pointer
              {isSelected
                ? 'border-amber-400/90 ring-2 ring-amber-400/40 shadow-2xl shadow-amber-950/40 scale-[1.01]'
                : 'border-[#15231a] hover:border-[#243a2c] shadow-lg hover:scale-[1.005]'}"
              on:click={() => toggleSelect(idx)}
            >
              <!-- IMAGEN CONTENEDOR AMPLIO -->
              <div class="relative {cardSize === 'grande' ? 'aspect-16/9 sm:aspect-16/10' : 'aspect-4/3'} bg-[#050806] overflow-hidden">
                <img
                  src={img.thumbUrl}
                  alt={img.title}
                  loading="lazy"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                <!-- GRADIENTE OSCURO -->
                <div class="absolute inset-0 bg-gradient-to-t from-[#0b120e] via-transparent to-black/30 pointer-events-none"></div>

                <!-- BADGE DE LICENCIA CC -->
                <div class="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-900 shadow-md font-semibold pointer-events-none">
                  {img.licenseShortName}
                </div>

                <!-- BOTÓN INSPECCIONAR EN DETALLE (FANCYBOX LIGHTBOX) -->
                <button
                  type="button"
                  class="absolute top-3 right-3 p-2 rounded-lg bg-black/70 hover:bg-black text-stone-200 hover:text-white backdrop-blur-md border border-white/10 transition-all opacity-80 group-hover:opacity-100 cursor-pointer shadow-lg"
                  on:click|stopPropagation={() => (previewImage = img)}
                  title="Inspeccionar en pantalla completa"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </button>

                <!-- CHECKMARK DE SELECCIÓN -->
                {#if isSelected}
                  <div class="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-black font-black text-sm flex items-center justify-center shadow-xl border border-white/80 animate-fadeIn">
                    ✓
                  </div>
                {/if}
              </div>

              <!-- METADATOS Y ACCIONES -->
              <div class="p-4 flex flex-col justify-between flex-1 bg-[#0b120e]">
                <div>
                  <h4 class="text-xs font-serif text-stone-100 line-clamp-2 leading-snug mb-1 font-normal group-hover:text-amber-300 transition-colors" title={img.title}>
                    {img.title}
                  </h4>
                  <p class="text-[11px] font-mono text-stone-400 truncate">
                    <span class="text-stone-500">Autor:</span> {img.author}
                  </p>
                </div>

                <div class="mt-4 pt-3 border-t border-[#132017] flex items-center justify-between">
                  <span class="text-[10px] font-mono text-stone-500">
                    Commons HQ
                  </span>
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer
                    {isSelected
                      ? 'bg-amber-400 text-black font-bold'
                      : 'bg-[#101b14] hover:bg-[#18281e] text-stone-300 border border-[#1b2f22]'}"
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
    <footer class="fixed bottom-0 left-0 right-0 z-40 bg-[#070d09]/95 backdrop-blur-xl border-t border-[#16251c] py-3.5 px-4 sm:px-8 shadow-2xl">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="text-xs font-mono text-stone-300">
          {#if selectedIndices.size > 0}
            <span class="text-emerald-400 font-bold">{selectedIndices.size} imagen(es) seleccionadas</span> para descargar o ingestar.
          {:else}
            <span class="text-stone-400">Haz clic en una o más fotos para enviarlas a tu mesa de trabajo o descargarlas.</span>
          {/if}
        </div>

        <div class="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            class="px-4 py-2.5 text-xs font-mono text-stone-400 hover:text-white cursor-pointer"
            on:click={() => (isOpen = false)}
          >
            Cerrar
          </button>

          <button
            type="button"
            disabled={selectedIndices.size === 0 || isIngesting}
            on:click={confirmarIngesta}
            class="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
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
            class="px-4 py-2.5 bg-[#121c16] hover:bg-[#1a2920] border border-[#1f3326] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
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
    class="fixed inset-0 z-60 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-fadeIn"
    on:click|self={closeFancybox}
  >
    <div class="relative max-w-5xl w-full max-h-[92vh] bg-[#090f0c] border border-[#1c2e22] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
      <!-- Barra superior Fancybox -->
      <div class="flex items-center justify-between px-5 py-3.5 bg-[#060a08] border-b border-[#142218]">
        <div class="truncate pr-4">
          <span class="text-[10px] font-mono tracking-widest text-emerald-400 uppercase">Inspección de Detalle & Grano</span>
          <h3 class="text-sm font-serif text-white truncate">{previewImage.title}</h3>
        </div>
        <button
          type="button"
          class="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white transition-all cursor-pointer"
          on:click={closeFancybox}
        >
          ✕
        </button>
      </div>

      <!-- Imagen en Alta Resolución -->
      <div class="flex-1 overflow-auto flex items-center justify-center p-4 bg-black min-h-[300px]">
        <img
          src={previewImage.url}
          alt={previewImage.title}
          class="max-h-[68vh] max-w-full object-contain rounded-lg shadow-sm"
        />
      </div>

      <!-- Barra inferior con metadatos y acción -->
      <div class="p-4 bg-[#090f0c] border-t border-[#142218] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div class="flex items-center gap-3 text-stone-300">
          <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
            {previewImage.licenseShortName}
          </span>
          <span class="truncate max-w-xs">Autor: {previewImage.author}</span>
          {#if previewImage.descriptionUrl}
            <a
              href={previewImage.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="text-emerald-400 hover:underline font-semibold"
            >
              Ficha Commons ↗
            </a>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-lg font-mono text-xs transition-colors cursor-pointer shadow-md"
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
