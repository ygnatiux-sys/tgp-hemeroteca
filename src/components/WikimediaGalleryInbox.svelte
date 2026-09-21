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
  $: if (isOpen && typeof document !== 'undefined') {
    setTimeout(() => {
      const el = document.getElementById('wikimedia-inbox-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

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

  let prevIsOpen = false;
  // Carga automática inicial una sola vez al abrir (previene bucles reactivos y 429)
  $: if (isOpen && !prevIsOpen) {
    prevIsOpen = true;
    if (gallery.length === 0 && !isLoading) {
      ejecutarBusqueda();
    }
  } else if (!isOpen) {
    prevIsOpen = false;
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
  <!-- Panel Integrado Inline en la Mesa de Trabajo (En el scroll libre, sin modal invasivo) -->
  <section
    id="wikimedia-inbox-section"
    class="w-full mt-6 rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-sm overflow-hidden flex flex-col scroll-mt-6 animate-fadeIn transition-all duration-300"
  >
    <!-- Header del Inbox -->
    <header class="flex items-center justify-between px-5 py-4 border-b border-zinc-200 bg-zinc-50 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-base shadow-2xs">
          🏛
        </div>
        <div>
          <div class="text-[11px] font-mono tracking-widest uppercase text-emerald-700 font-semibold">
            Banco Wikimedia Commons · Licencia Libre (CC0 / PD)
          </div>
          <h3 class="text-base font-serif font-medium text-zinc-900">
            Galería Concurrente & Ingesta Visual
          </h3>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <span class="text-xs font-mono text-zinc-500 hidden sm:inline">
          {gallery.length} imágenes cargadas
        </span>
        <button
          type="button"
          class="px-3.5 py-1.5 text-xs font-mono font-medium text-zinc-700 hover:text-zinc-950 bg-white hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors cursor-pointer shadow-2xs"
          on:click={() => (isOpen = false)}
        >
          ✕ Ocultar Galería
        </button>
      </div>
    </header>

    <!-- Barra de Búsqueda & Presets -->
    <div class="p-4 bg-white border-b border-zinc-200 flex flex-col gap-3 shrink-0">
      <!-- Input de conceptos -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <span class="absolute left-3 top-2.5 text-zinc-400 text-xs">🔍</span>
          <input
            type="text"
            bind:value={searchQuery}
            on:keydown={(e) => e.key === 'Enter' && ejecutarBusqueda()}
            placeholder="Términos separados por coma (ej: Nun god relief, Atum creation, Karnak temple)..."
            class="w-full pl-8 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white font-mono transition-all"
          />
        </div>
        <button
          type="button"
          disabled={isLoading}
          on:click={() => ejecutarBusqueda()}
          class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-2xs"
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
        <span class="text-[10px] font-mono uppercase text-zinc-400 mr-1 font-semibold">Colecciones:</span>
        {#each PRESETS as p}
          <button
            type="button"
            on:click={() => { searchQuery = p.query; ejecutarBusqueda(p.query); }}
            class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition-colors cursor-pointer"
          >
            {p.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Barra de herramientas de selección rápida -->
    <div class="px-5 py-2.5 bg-zinc-50/80 border-b border-zinc-200 flex items-center justify-between text-xs font-mono shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-zinc-500">Selección:</span>
        {#if selectedIndex !== null}
          <span class="text-emerald-800 font-bold bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
            ✓ Imagen #{selectedIndex + 1}
          </span>
        {:else}
          <span class="text-zinc-400">Ninguna seleccionada</span>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          on:click={autoSelectBest}
          class="px-2.5 py-1 bg-white hover:bg-zinc-100 text-zinc-700 rounded text-[11px] border border-zinc-200 cursor-pointer shadow-2xs"
          title="Seleccionar automáticamente la imagen con mayor resolución"
        >
          ⚡ Auto-seleccionar Mejor
        </button>
        <button
          type="button"
          on:click={clearSelection}
          class="px-2 py-1 text-zinc-500 hover:text-zinc-800 text-[11px] cursor-pointer"
        >
          Deseleccionar
        </button>
      </div>
    </div>

    <!-- Área de la Grilla de Imágenes (Scroll Nativo) -->
    <div class="p-4 sm:p-5 min-h-75">
      {#if isLoading}
        <div class="h-64 flex flex-col items-center justify-center gap-3 text-zinc-500">
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
        <div class="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      {:else if gallery.length === 0}
        <div class="h-64 flex flex-col items-center justify-center text-center text-zinc-400 gap-2">
          <span class="text-3xl">🏛</span>
          <p class="text-sm text-zinc-500">Ingresa términos de búsqueda para poblar la galería con imágenes CC0.</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {#each gallery as img, idx (img.url)}
            <div
              class="group relative rounded-xl overflow-hidden border transition-all duration-150 flex flex-col bg-white
              {selectedIndex === idx
                ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-md scale-[1.01]'
                : 'border-zinc-200 hover:border-zinc-300 shadow-2xs'}"
            >
              <!-- Imagen Thumbnail con click para previsualizar Fancybox -->
              <div class="relative aspect-4/3 bg-zinc-100 overflow-hidden cursor-pointer">
                <button
                  type="button"
                  class="w-full h-full block cursor-zoom-in"
                  on:click={() => (previewImage = img)}
                  aria-label="Inspeccionar {img.title} en pantalla completa"
                >
                  <img
                    src={img.thumbUrl}
                    alt={img.title}
                    loading="lazy"
                    class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>

                <!-- Badge de Licencia -->
                <div class="absolute top-2 left-2 bg-white/90 backdrop-blur-xs text-[9px] font-mono uppercase tracking-wider text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 shadow-2xs pointer-events-none font-semibold">
                  {img.licenseShortName}
                </div>

                <!-- Botón de Inspección / Fancybox Zoom -->
                <button
                  type="button"
                  class="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-zinc-700 hover:text-zinc-900 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow border border-zinc-200"
                  on:click|stopPropagation={() => (previewImage = img)}
                  title="Inspeccionar en detalle (Fancybox)"
                >
                  🔍
                </button>

                <!-- Checkmark de Selección -->
                {#if selectedIndex === idx}
                  <div class="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow">
                    ✓
                  </div>
                {/if}
              </div>

              <!-- Metadata & Botón de Selección -->
              <div class="p-2.5 flex flex-col gap-1.5 flex-1 justify-between text-left bg-white">
                <div>
                  <h4 class="text-[11px] font-semibold text-zinc-800 line-clamp-1 group-hover:text-zinc-950" title={img.title}>
                    {img.title}
                  </h4>
                  <span class="text-[10px] text-zinc-500 line-clamp-1">
                    {img.author}
                  </span>
                </div>

                <button
                  type="button"
                  class="w-full py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold transition-colors cursor-pointer
                  {selectedIndex === idx
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200'}"
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
    <footer class="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div class="text-[11px] font-mono text-zinc-600">
        {#if selectedIndex !== null}
          <span>Archivo listo: <strong class="text-zinc-900">{gallery[selectedIndex]?.title.slice(0, 40)}…</strong></span>
        {:else}
          <span>Seleccioná una imagen de la grilla para usar en la mesa de trabajo.</span>
        {/if}
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="px-4 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 cursor-pointer"
          on:click={() => (isOpen = false)}
        >
          Ocultar
        </button>
        <button
          type="button"
          disabled={selectedIndex === null || isIngesting}
          on:click={confirmarIngesta}
          class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
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
  </section>
{/if}

<!-- ── LIGHTBOX / FANCYBOX PREVIEW MODAL ────────────────────────────────────── -->
{#if previewImage}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
    on:click|self={closeFancybox}
  >
    <div class="relative max-w-4xl max-h-[90vh] bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
      <!-- Barra superior Fancybox -->
      <div class="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
        <span class="text-xs font-mono font-medium text-zinc-800 truncate max-w-[80%]">
          {previewImage.title}
        </span>
        <button
          type="button"
          class="text-zinc-500 hover:text-zinc-900 text-sm font-mono cursor-pointer"
          on:click={closeFancybox}
        >
          ✕
        </button>
      </div>

      <!-- Imagen en Alta Resolución -->
      <div class="flex-1 overflow-auto flex items-center justify-center p-4 bg-zinc-100/70">
        <img
          src={previewImage.url}
          alt={previewImage.title}
          class="max-h-[68vh] max-w-full object-contain rounded-lg shadow-sm"
        />
      </div>

      <!-- Barra inferior con metadatos y acción -->
      <div class="p-3 bg-white border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-3 font-mono text-[11px] text-zinc-600">
          <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
            {previewImage.licenseShortName}
          </span>
          <span>Autor: {previewImage.author}</span>
          {#if previewImage.descriptionUrl}
            <a
              href={previewImage.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="text-emerald-700 hover:underline font-semibold"
            >
              Ficha Commons ↗
            </a>
          {/if}
        </div>

        <button
          type="button"
          class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
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
