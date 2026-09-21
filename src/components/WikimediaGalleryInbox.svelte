<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // WikimediaGalleryInbox.svelte
  // Inbox tipo Fancybox / Lightbox para exploración de imágenes Wikimedia CC0 / PD
  // Integra búsqueda concurrente Promise.all y descarga binaria transparente
  // ─────────────────────────────────────────────────────────────────────────────
  import {
    getWikimediaGallery,
    downloadWikimediaImageAsFile,
    type WikimediaImageItem
  } from '../lib/wikimedia-gallery';

  export let isOpen = false;
  export let onSelect: (file: File) => void;
  export let initialQuery = 'Ancient Egyptian cosmos, Nun god relief, Atum creation, Karnak temple, Hathor relief';

  let searchQuery = initialQuery;
  let isLoading = false;
  let error: string | null = null;
  let gallery: WikimediaImageItem[] = [];
  let selectedIndex: number | null = null;
  let previewImage: WikimediaImageItem | null = null; // Fancybox Lightbox modal
  let isIngesting = false;

  const PRESETS = [
    { label: '🏛 Mitología & Cosmogonía', query: 'Nun god relief, Atum creation, Egyptian cosmos, Karnak temple, Heliopolis obelisk' },
    { label: '🏺 Arqueología & Códices', query: 'Maya codex, Aztec stone calendar, Sumerian tablet, Minoan fresco, Roman mosaic' },
    { label: '👁 Geometría Sagrada', query: 'Sacred geometry stone, Roman labyrinth pavement, Rose window cathedral, Islamic geometric pattern' },
    { label: '🗿 Relieves & Epigrafía', query: 'Rosetta stone, Hieroglyph relief Abydos, Ashurbanipal lion hunt, Persepolis relief' }
  ];

  async function ejecutarBusqueda(queryText?: string) {
    const q = queryText || searchQuery;
    if (!q.trim()) return;

    isLoading = true;
    error = null;
    selectedIndex = null;

    try {
      const terms = q.split(',').map(t => t.trim()).filter(Boolean);
      // Solicitar 3 por término para alcanzar ~15 imágenes con Promise.all
      const limit = Math.max(2, Math.ceil(15 / Math.max(1, terms.length)));
      const items = await getWikimediaGallery(terms, limit);

      gallery = items.slice(0, 16);
      if (gallery.length === 0) {
        error = 'No se encontraron imágenes CC0 para los términos indicados.';
      } else {
        // Auto-selección inteligente de la primera imagen por defecto
        selectedIndex = 0;
      }
    } catch (err: any) {
      error = err.message || 'Error al conectar con la API de Wikimedia Commons.';
    } finally {
      isLoading = false;
    }
  }

  // Carga automática inicial al abrir
  $: if (isOpen && gallery.length === 0 && !isLoading) {
    ejecutarBusqueda();
  }

  function toggleSelect(index: number) {
    selectedIndex = selectedIndex === index ? null : index;
  }

  function autoSelectBest() {
    if (gallery.length === 0) return;
    // Seleccionar la de mayor resolución disponible
    let bestIdx = 0;
    let maxPixels = 0;
    gallery.forEach((img, idx) => {
      const pixels = (img.width || 0) * (img.height || 0);
      if (pixels > maxPixels) {
        maxPixels = pixels;
        bestIdx = idx;
      }
    });
    selectedIndex = bestIdx;
  }

  function clearSelection() {
    selectedIndex = null;
  }

  async function confirmarIngesta() {
    if (selectedIndex === null || !gallery[selectedIndex]) return;
    isIngesting = true;
    error = null;

    try {
      const img = gallery[selectedIndex];
      const file = await downloadWikimediaImageAsFile(img);
      onSelect(file);
      isOpen = false;
    } catch (err: any) {
      error = `Error al procesar la imagen seleccionada: ${err.message}`;
    } finally {
      isIngesting = false;
    }
  }

  function closeFancybox() {
    previewImage = null;
  }
</script>

{#if isOpen}
  <!-- Overlay Backdrop -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn"
    on:click|self={() => (isOpen = false)}
  >
    <!-- Modal Container (tipo Fancybox Workbench) -->
    <div class="bg-zinc-900 border border-zinc-700/80 text-zinc-100 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden select-auto">

      <!-- Header del Inbox -->
      <header class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 flex items-center justify-center font-bold text-base">
            🏛
          </div>
          <div>
            <div class="text-[11px] font-mono tracking-widest uppercase text-emerald-400 font-semibold">
              Banco Wikimedia Commons · Licencia Libre (CC0 / PD)
            </div>
            <h3 class="text-base font-serif font-light text-zinc-100">
              Galería Concurrente & Ingesta Visual
            </h3>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-mono text-zinc-400 hidden sm:inline">
            {gallery.length} imágenes cargadas
          </span>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
            on:click={() => (isOpen = false)}
          >
            ✕ Cerrar
          </button>
        </div>
      </header>

      <!-- Barra de Búsqueda & Presets -->
      <div class="p-4 bg-zinc-900/90 border-b border-zinc-800 flex flex-col gap-3 shrink-0">
        <!-- Input de conceptos -->
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <span class="absolute left-3 top-2.5 text-zinc-400 text-xs">🔍</span>
            <input
              type="text"
              bind:value={searchQuery}
              on:keydown={(e) => e.key === 'Enter' && ejecutarBusqueda()}
              placeholder="Términos separados por coma (ej: Nun god relief, Atum creation, Karnak temple)..."
              class="w-full pl-8 pr-3 py-2 text-xs bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>
          <button
            type="button"
            disabled={isLoading}
            on:click={() => ejecutarBusqueda()}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {#if isLoading}
              <span class="animate-spin text-xs">⟳</span>
              <span>Buscando…</span>
            {:else}
              <span>✦ Buscar</span>
            {/if}
          </button>
        </div>

        <!-- Presets temáticos rápidos -->
        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <span class="text-[10px] font-mono uppercase text-zinc-500 mr-1">Colecciones:</span>
          {#each PRESETS as p}
            <button
              type="button"
              on:click={() => { searchQuery = p.query; ejecutarBusqueda(p.query); }}
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Barra de herramientas de selección rápida -->
      <div class="px-5 py-2.5 bg-zinc-950/60 border-b border-zinc-800/60 flex items-center justify-between text-xs font-mono shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-zinc-400">Selección:</span>
          {#if selectedIndex !== null}
            <span class="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
              ✓ Imagen #{selectedIndex + 1}
            </span>
          {:else}
            <span class="text-zinc-500">Ninguna seleccionada</span>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            on:click={autoSelectBest}
            class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] border border-zinc-700 cursor-pointer"
            title="Seleccionar automáticamente la imagen con mayor resolución"
          >
            ⚡ Auto-seleccionar Mejor
          </button>
          <button
            type="button"
            on:click={clearSelection}
            class="px-2 py-1 text-zinc-400 hover:text-zinc-200 text-[11px] cursor-pointer"
          >
            Deseleccionar
          </button>
        </div>
      </div>

      <!-- Área de la Grilla de Imágenes (Scroll Nativo) -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 min-h-[300px]">
        {#if isLoading}
          <div class="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <div class="flex gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"></div>
              <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.15s]"></div>
              <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.3s]"></div>
            </div>
            <span class="text-xs font-mono uppercase tracking-widest text-zinc-500">
              Lanzando peticiones concurrentes a Wikimedia Commons…
            </span>
          </div>
        {:else if error}
          <div class="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        {:else if gallery.length === 0}
          <div class="h-64 flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
            <span class="text-3xl">🏛</span>
            <p class="text-sm">Ingresa términos de búsqueda para poblar la galería con imágenes CC0.</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {#each gallery as img, idx (img.url)}
              <div
                class="group relative rounded-xl overflow-hidden border transition-all duration-150 flex flex-col bg-zinc-950
                {selectedIndex === idx
                  ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg scale-[1.01]'
                  : 'border-zinc-800 hover:border-zinc-600'}"
              >
                <!-- Imagen Thumbnail con click para previsualizar Fancybox -->
                <div class="relative aspect-4/3 bg-zinc-900 overflow-hidden cursor-pointer">
                  <img
                    src={img.thumbUrl}
                    alt={img.title}
                    loading="lazy"
                    class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    on:click={() => (previewImage = img)}
                  />

                  <!-- Badge de Licencia -->
                  <div class="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-[9px] font-mono uppercase tracking-wider text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/40 pointer-events-none">
                    {img.licenseShortName}
                  </div>

                  <!-- Botón de Inspección / Fancybox Zoom -->
                  <button
                    type="button"
                    class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                    on:click|stopPropagation={() => (previewImage = img)}
                    title="Inspeccionar en pantalla completa (Fancybox)"
                  >
                    🔍
                  </button>

                  <!-- Checkmark de Selección -->
                  {#if selectedIndex === idx}
                    <div class="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-emerald-500 text-black font-bold text-xs flex items-center justify-center shadow">
                      ✓
                    </div>
                  {/if}
                </div>

                <!-- Metadata & Botón de Selección -->
                <div class="p-2.5 flex flex-col gap-1.5 flex-1 justify-between text-left">
                  <div>
                    <h4 class="text-[11px] font-medium text-zinc-200 line-clamp-1 group-hover:text-white" title={img.title}>
                      {img.title}
                    </h4>
                    <span class="text-[10px] text-zinc-500 line-clamp-1">
                      {img.author}
                    </span>
                  </div>

                  <button
                    type="button"
                    class="w-full py-1 px-2 rounded-md text-[10px] font-mono font-semibold transition-colors cursor-pointer
                    {selectedIndex === idx
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}"
                    on:click={() => toggleSelect(idx)}
                  >
                    {selectedIndex === idx ? '✓ Seleccionada' : '+ Seleccionar'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer con Acción de Ingesta -->
      <footer class="p-4 bg-zinc-950 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div class="text-[11px] font-mono text-zinc-400">
          {#if selectedIndex !== null}
            <span>Archivo listo: <strong class="text-zinc-200">{gallery[selectedIndex]?.title.slice(0, 40)}…</strong></span>
          {:else}
            <span>Selecciona una imagen de la grilla para usar en la mesa de trabajo.</span>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-white cursor-pointer"
            on:click={() => (isOpen = false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={selectedIndex === null || isIngesting}
            on:click={confirmarIngesta}
            class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow cursor-pointer flex items-center gap-2"
          >
            {#if isIngesting}
              <span class="animate-spin text-sm">⟳</span>
              <span>Descargando imagen…</span>
            {:else}
              <span>✦ Ingestar en Mesa de Trabajo ↵</span>
            {/if}
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<!-- ── LIGHTBOX / FANCYBOX PREVIEW MODAL ────────────────────────────────────── -->
{#if previewImage}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-60 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 animate-fadeIn"
    on:click|self={closeFancybox}
  >
    <div class="relative max-w-4xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
      <!-- Barra superior Fancybox -->
      <div class="flex items-center justify-between px-4 py-2.5 bg-black/80 border-b border-zinc-800">
        <span class="text-xs font-mono text-zinc-300 truncate max-w-[80%]">
          {previewImage.title}
        </span>
        <button
          type="button"
          class="text-zinc-400 hover:text-white text-sm font-mono cursor-pointer"
          on:click={closeFancybox}
        >
          ✕
        </button>
      </div>

      <!-- Imagen en Alta Resolución -->
      <div class="flex-1 overflow-auto flex items-center justify-center p-2 bg-black/60">
        <img
          src={previewImage.url}
          alt={previewImage.title}
          class="max-h-[70vh] max-w-full object-contain rounded"
        />
      </div>

      <!-- Barra inferior con metadatos y acción -->
      <div class="p-3 bg-zinc-950 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
          <span class="px-2 py-0.5 rounded bg-zinc-800 text-emerald-400">
            {previewImage.licenseShortName}
          </span>
          <span>Autor: {previewImage.author}</span>
          {#if previewImage.descriptionUrl}
            <a
              href={previewImage.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="text-zinc-400 hover:text-emerald-400 underline"
            >
              Ficha Commons ↗
            </a>
          {/if}
        </div>

        <button
          type="button"
          class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer"
          on:click={() => {
            const idx = gallery.findIndex(g => g.url === previewImage?.url);
            if (idx !== -1) selectedIndex = idx;
            closeFancybox();
          }}
        >
          ✓ Seleccionar esta imagen
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.15s ease-out forwards;
  }
</style>
