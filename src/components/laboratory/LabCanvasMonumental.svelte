<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // LabCanvasMonumental.svelte
  // Subcomponente: Ingesta de imagen & Visualizador Canvas Monumental con Zoom
  // ─────────────────────────────────────────────────────────────────────────────
  import { openGooglePicker } from '../../lib/google-picker';

  export let imagenBase: File | null = null;
  export let imagenProcesada: string | null = null;
  export let isWikiInboxOpen: boolean = false;
  export let onFileSelect: (file: File) => void = () => {};
  export let onError: (err: string) => void = () => {};

  let fileInputEl: HTMLInputElement;
  let pickerLoading = false;
  let escalaCanvas: 'fit' | 'original' = 'fit';
  let imagenDimensiones: { width: number; height: number } | null = null;
  let vistaActual: 'original' | 'procesada' = 'original';

  $: sizeLabel = imagenBase
    ? `${imagenBase.name} · ${(imagenBase.size / 1024).toFixed(1)} KB`
    : null;

  function abrirSelector() {
    fileInputEl?.click();
  }

  function abrirGooglePickerModal() {
    pickerLoading = true;
    openGooglePicker({
      onSelect: (file: File) => {
        pickerLoading = false;
        onFileSelect(file);
      },
      onError: (err) => {
        pickerLoading = false;
        if (err.message !== 'PICKER_RENDERED' && err.message !== 'PICKER_CLOSED' && err.message !== 'PICKER_TIMEOUT') {
          onError(`Google Photos: ${err.message}`);
        }
      },
    });
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }

  function onImageLoad(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img) {
      imagenDimensiones = { width: img.naturalWidth, height: img.naturalHeight };
    }
  }
</script>

<section class="vl-section">
  <span class="vl-step-label">1 · Ingesta de Imagen Base</span>

  <div class="vl-ingesta-row">
    <button class="vl-btn vl-btn--primary" on:click={abrirGooglePickerModal} disabled={pickerLoading}>
      <span class="vl-btn-icon">✦</span>
      {pickerLoading ? 'Iniciando Google Picker…' : 'Extraer de Google Drive / Photos'}
    </button>

    <button class="vl-btn vl-btn--green" on:click={() => (isWikiInboxOpen = true)}>
      <span>🏛</span>
      Galería Wikimedia Commons (CC0)
    </button>

    <button class="vl-btn vl-btn--gray" on:click={abrirSelector}>
      Subir Archivo Local
    </button>

    <input
      bind:this={fileInputEl}
      type="file"
      accept="image/*"
      style="display:none"
      on:change={handleFileChange}
    />

    {#if sizeLabel}
      <span class="vl-file-chip">✓ {sizeLabel}</span>
    {/if}
  </div>

  {#if imagenBase}
    <!-- ESPACIO MONUMENTAL DE VISUALIZACIÓN (CANVAS CENTRAL) -->
    <div class="vl-monumental-container">
      <!-- Barra de herramientas del Canvas -->
      <div class="vl-monumental-bar">
        <div class="vl-monumental-title-wrap">
          <span class="vl-monumental-icon">👁</span>
          <span class="vl-monumental-filename">{imagenBase.name}</span>
          {#if imagenDimensiones}
            <span class="vl-canvas-badge">{imagenDimensiones.width} × {imagenDimensiones.height} px</span>
          {/if}
          <span class="vl-canvas-badge">{(imagenBase.size / 1024).toFixed(1)} KB</span>
          <span class="vl-canvas-badge">{imagenBase.type || 'image/webp'}</span>
        </div>

        <div class="vl-monumental-controls">
          {#if imagenProcesada}
            <div class="vl-toggle-group">
              <button
                type="button"
                class="vl-toggle-btn {vistaActual === 'original' ? 'is-active' : ''}"
                on:click={() => (vistaActual = 'original')}
              >
                Original
              </button>
              <button
                type="button"
                class="vl-toggle-btn {vistaActual === 'procesada' ? 'is-active' : ''}"
                on:click={() => (vistaActual = 'procesada')}
              >
                Procesada
              </button>
            </div>
          {/if}

          <div class="vl-toggle-group">
            <button
              type="button"
              class="vl-toggle-btn {escalaCanvas === 'fit' ? 'is-active' : ''}"
              on:click={() => (escalaCanvas = 'fit')}
              title="Ajustar imagen al espacio disponible"
            >
              Ajustar
            </button>
            <button
              type="button"
              class="vl-toggle-btn {escalaCanvas === 'original' ? 'is-active' : ''}"
              on:click={() => (escalaCanvas = 'original')}
              title="Ver tamaño 100% píxel real"
            >
              100% Píxel
            </button>
          </div>
        </div>
      </div>

      <!-- Escenario de la Imagen con Fondo de Descanso Visual -->
      <div class="vl-canvas-stage {escalaCanvas === 'original' ? 'is-scrollable' : ''}">
        <img
          src={vistaActual === 'procesada' && imagenProcesada ? imagenProcesada : URL.createObjectURL(imagenBase)}
          alt={imagenBase.name}
          class="vl-canvas-img {escalaCanvas === 'fit' ? 'is-fit' : 'is-real'}"
          on:load={onImageLoad}
        />
      </div>
    </div>
  {/if}
</section>
