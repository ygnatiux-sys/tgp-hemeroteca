<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // ScriptoriumForenseViewer.svelte
  // Visor inmersivo Notion-style / Docs de registros forenses extraídos vía GAS
  // Layout: Left Sidebar (Scroll) | Main Canvas Docs (Scroll) | Right Sidebar
  // Svelte 5 · CSS Vanilla + Tailwind · Read-Only (Sprint 1)
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Tipos ────────────────────────────────────────────────────────────────────
  interface RegistroForense {
    timestamp: string;
    analisis_imagen: string;
    plots_principales: string[];
    aportes_secundarios: string[];
    imagenes: string[];
  }

  interface ApiResponse {
    status: string;
    total: number;
    registros: RegistroForense[];
  }

  // ── Config ───────────────────────────────────────────────────────────────────
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxDAInTvmvfJZsMKbgpkYAP8wEedpAvRIv5t2s_QcNbUUaZp8h2bMr5A9XoII2_5C9hCw/exec';
  const GAS_URL    = (import.meta as any).env?.PUBLIC_GAS_FORENSIC_URL || DEFAULT_GAS_URL;
  const GAS_TOKEN  = (import.meta as any).env?.PUBLIC_GAS_FORENSIC_TOKEN ?? 'forense2026';

  // ── Estado global ────────────────────────────────────────────────────────────
  let registros: RegistroForense[] = $state([]);
  let loading = $state(true);
  let fetchError: string | null = $state(null);
  let activeIndex = $state(0);

  // ── Estado sidebars ──────────────────────────────────────────────────────────
  let leftOpen  = $state(true);
  let rightOpen = $state(false);

  // ── Derived ──────────────────────────────────────────────────────────────────
  let activeRecord = $derived(registros[activeIndex] ?? null);

  // ── Parseo robusto de payload ────────────────────────────────────────────────
  function parseRegistrosPayload(data: any): RegistroForense[] {
    if (!data) return [];
    let list: any[] = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (Array.isArray(data.registros)) {
      list = data.registros;
    } else if (data.data && Array.isArray(data.data)) {
      list = data.data;
    } else if (typeof data === 'string' || data.text) {
      return parseTextToRegistros(typeof data === 'string' ? data : data.text);
    }

    if (list.length === 0 && typeof data === 'object') {
      // Intento de encontrar alguna propiedad con array
      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) {
          list = data[k];
          break;
        }
      }
    }

    return list.map((item, idx) => ({
      timestamp: item.timestamp || item.fecha || `2026-09-1${9 - idx} 12:00:00`,
      analisis_imagen: item.analisis_imagen || item.analisis || item.descripcion || '',
      plots_principales: Array.isArray(item.plots_principales)
        ? item.plots_principales
        : (Array.isArray(item.plots) ? item.plots : (item.plots_principales ? [String(item.plots_principales)] : [])),
      aportes_secundarios: Array.isArray(item.aportes_secundarios)
        ? item.aportes_secundarios
        : (Array.isArray(item.aportes) ? item.aportes : (item.aportes_secundarios ? [String(item.aportes_secundarios)] : [])),
      imagenes: Array.isArray(item.imagenes)
        ? item.imagenes
        : (item.imagen ? [item.imagen] : [])
    }));
  }

  function parseTextToRegistros(rawText: string): RegistroForense[] {
    const chunks = rawText.split(/(?:---|📅\s*Registro Forense:?|Registro Forense:?)/i).filter(c => c.trim().length > 0);
    return chunks.map(chunk => {
      const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
      const tsMatch = chunk.match(/(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?)/);
      return {
        timestamp: tsMatch ? tsMatch[1] : 'Registro Histórico',
        analisis_imagen: lines.slice(0, 3).join(' '),
        plots_principales: lines.filter(l => l.startsWith('•') || l.startsWith('-')).map(l => l.replace(/^[•\-]\s*/, '')),
        aportes_secundarios: [],
        imagenes: []
      };
    });
  }

  // ── Fetch datos desde GAS ────────────────────────────────────────────────────
  async function fetchRegistros() {
    loading = true;
    fetchError = null;
    try {
      if (!GAS_URL) throw new Error('Endpoint GAS no configurado');
      const url = `${GAS_URL}?token=${GAS_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (raw.status === 'unauthorized') throw new Error('Token inválido — revisa PUBLIC_GAS_FORENSIC_TOKEN');
      const parsed = parseRegistrosPayload(raw);
      if (parsed.length === 0) throw new Error('Respuesta sin registros');
      registros = parsed;
      activeIndex = 0;
    } catch (err: any) {
      fetchError = err.message ?? 'Error de conexión';
      registros = getDemoData();
    } finally {
      loading = false;
    }
  }

  // ── Demo data extendido (Historial completo cuando no hay red) ────────────────
  function getDemoData(): RegistroForense[] {
    return [
      {
        timestamp: '2026-09-19 03:30:00',
        analisis_imagen: 'Captura de publicación en Facebook mostrando un grupo de debate sobre arqueología mesopotámica. El post incluye una imagen de tablillas cuneiformes con texto en español sobre su origen administrativo en la dinastía Ur III.',
        plots_principales: [
          'La escritura cuneiforme como tecnología política y de control contable, no solo comunicativa.',
          'Debate sobre el rol del templo en la distribución y monopolio de recursos en Ur.',
          'Cuestionamiento de la narrativa euro-céntrica sobre los orígenes de la administración pública.',
        ],
        aportes_secundarios: [
          'Mención de la influencia del clima en la migración sumeria hacia el sur de la cuenca aluvial.',
          'Referencia a excavaciones recientes en Tell Eridu con dataciones radiocarbónicas actualizadas.',
          'Usuario comparte enlace a artículo de JSTOR sobre sellos cilíndricos y burocracia.',
        ],
        imagenes: []
      },
      {
        timestamp: '2026-09-18 21:15:44',
        analisis_imagen: 'Imagen de meme filosófico con cita atribuida a Platón sobre la caverna. Fondo oscuro con texto tipográfico en bronce. Publicación viral con más de 800 comentarios discutiendo simulacro e hiperrealidad.',
        plots_principales: [
          'Discusión sobre si los algoritmos de recomendación en redes sociales constituyen una actualización de las sombras de la caverna.',
          'Debate sobre la responsabilidad del filósofo moderno en la esfera pública digital.',
        ],
        aportes_secundarios: [
          'Referencia al concepto de hipervigilancia y enjambre digital de Byung-Chul Han.',
          'Comparación con el panóptico de Bentham y la reinterpretación foucaultiana en plataformas sociales.',
        ],
        imagenes: []
      },
      {
        timestamp: '2026-09-17 18:42:10',
        analisis_imagen: 'Fotografía de archivo documental de un periódico del año 1934 con titular sobre la reforma agraria y los debates en el senado provincial.',
        plots_principales: [
          'Tensión histórica entre la propiedad comunal de la tierra y los modelos de colonización privada.',
          'Análisis de las actas taquigráficas citadas en el debate de comisión de hacienda.',
        ],
        aportes_secundarios: [
          'Señalamiento del rol de la prensa gráfica independiente de la década del 30.',
          'Identificación de correspondencia epistolar entre legisladores y federaciones agrarias.',
        ],
        imagenes: []
      },
      {
        timestamp: '2026-09-16 11:20:05',
        analisis_imagen: 'Infografía cartográfica de las rutas marítimas coloniales del Atlántico Sur entre los siglos XVII y XVIII, destacando puntos de avituallamiento.',
        plots_principales: [
          'Evolución de los nodos de tráfico mercante y su correlato con las fortificaciones costeras.',
          'Discusión sobre la asimetría en el registro cartográfico oficial versus bitácoras de capitanes.',
        ],
        aportes_secundarios: [
          'Cita al archivo de Indias de Sevilla respecto a los registros de avería y naufragios.',
          'Datos complementarios sobre botánica medicinal transportada en los convoyes.',
        ],
        imagenes: []
      },
      {
        timestamp: '2026-09-15 09:05:30',
        analisis_imagen: 'Manuscrito litúrgico medieval con glosas marginales en latín e idioma romance incipiente, proveniente de un códice monacal.',
        plots_principales: [
          'Las glosas marginales como evidencia viva de la transición lingüística pre-renacentista.',
          'El scriptorium monástico como espacio de conservación y simultánea censura hermenéutica.',
        ],
        aportes_secundarios: [
          'Comparación paleográfica de tipos de tinta ferrogálica.',
          'Nota sobre la influencia de las escuelas catedralicias en la formalización sintáctica.',
        ],
        imagenes: []
      }
    ];
  }

  function selectRecord(i: number) {
    activeIndex = i;
  }

  function formatDate(ts: string): string {
    try {
      const d = new Date(ts.replace(' ', 'T'));
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch { return ts; }
  }

  $effect(() => {
    fetchRegistros();
  });
</script>

<!-- ═══════════════════════════════════════════════════════════════════
  LAYOUT RAÍZ
════════════════════════════════════════════════════════════════════ -->
<div class="sfv-root">

  <!-- ── LEFT SIDEBAR ─────────────────────────────────────────────── -->
  <aside class="sfv-sidebar-left" class:collapsed={!leftOpen}>
    <div class="sfv-sidebar-header">
      <span class="sfv-sidebar-icon">🗂️</span>
      {#if leftOpen}
        <span class="sfv-sidebar-title">Índice Forense</span>
      {/if}
      <button class="sfv-toggle-btn" onclick={() => leftOpen = !leftOpen} title="Colapsar panel">
        {leftOpen ? '‹' : '›'}
      </button>
    </div>

    {#if leftOpen}
      <div class="sfv-sidebar-content">
        <div class="sfv-sidebar-section-label">Registros</div>
        {#if loading}
          {#each Array(3) as _, i}
            <div class="sfv-skeleton-row"></div>
          {/each}
        {:else if registros.length === 0}
          <p class="sfv-empty-hint">Sin registros aún.</p>
        {:else}
          <ul class="sfv-index-list">
            {#each registros as r, i}
              <li>
                <button
                  class="sfv-index-item"
                  class:active={i === activeIndex}
                  onclick={() => selectRecord(i)}
                >
                  <span class="sfv-index-dot"></span>
                  <span class="sfv-index-ts">{r.timestamp.slice(0, 10)}</span>
                  <span class="sfv-index-preview">
                    {r.analisis_imagen.slice(0, 38)}...
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="sfv-sidebar-footer">
          <button class="sfv-reload-btn" onclick={fetchRegistros} disabled={loading}>
            {loading ? 'Cargando...' : 'Recargar'}
          </button>
        </div>
      </div>
    {/if}
  </aside>

  <!-- ── MAIN CANVAS (Contenedor de lectura independiente tipo Docs) ── -->
  <main class="sfv-canvas">

    {#if loading}
      <div class="sfv-doc-container max-w-4xl mx-auto w-full px-6 sm:px-12 py-10 space-y-6">
        <div class="sfv-skeleton-pills"></div>
        <div class="sfv-skeleton-row h-10 w-3/4"></div>
        <div class="sfv-skeleton-block h-28"></div>
        <div class="sfv-skeleton-block h-36"></div>
      </div>

    {:else if !activeRecord}
      <div class="sfv-empty-state">
        <span>📭</span>
        <p>No hay registros forenses aún. Usa el Bookmarklet para capturar el primero.</p>
      </div>

    {:else}
      <!-- ── CONTENEDOR CENTRALIZADO TIPO GOOGLE DOCS ────────────────── -->
      <article class="sfv-doc-container max-w-4xl mx-auto w-full px-6 sm:px-12 py-10">

        <!-- 1. Mini Pills de Metadatos Superiores -->
        <header class="mb-6">
          <div class="sfv-pills-row flex flex-wrap gap-2 items-center mb-4">
            <span class="sfv-mini-pill">
              <span class="mr-1">📅</span> {formatDate(activeRecord.timestamp)}
            </span>
            <span class="sfv-mini-pill sfv-mini-pill--accent">
              <span class="mr-1">🎯</span> Plots: {activeRecord.plots_principales.length}
            </span>
            <span class="sfv-mini-pill sfv-mini-pill--tertiary">
              <span class="mr-1">💡</span> Aportes: {activeRecord.aportes_secundarios.length}
            </span>
            {#if activeRecord.imagenes.length > 0}
              <span class="sfv-mini-pill">
                <span class="mr-1">🖼️</span> Imágenes: {activeRecord.imagenes.length}
              </span>
            {/if}
            {#if fetchError}
              <span class="sfv-mini-pill sfv-mini-pill--warn">
                <span class="mr-1">⚠️</span> Modo demo
              </span>
            {/if}
          </div>

          <!-- Título del documento de lectura -->
          <h1 class="sfv-doc-title text-2xl sm:text-3xl font-semibold tracking-tight text-(--sfv-text)">
            Registro Forense · {activeRecord.timestamp.slice(0, 10)}
          </h1>
        </header>

        <!-- 2. Evidencia Visual adjunta (si existe, sin máscaras ni gradientes) -->
        {#if activeRecord.imagenes && activeRecord.imagenes.length > 0}
          <div class="sfv-doc-gallery mb-8">
            {#each activeRecord.imagenes as img, idx}
              <figure class="sfv-doc-figure mb-4">
                <img
                  src={img}
                  alt={`Evidencia visual ${idx + 1}`}
                  class="sfv-doc-img rounded-2xl max-h-110 w-auto mx-auto object-contain shadow-sm border border-(--sfv-border)"
                />
                <figcaption class="text-xs text-center mt-2 text-(--sfv-text-muted)">
                  Evidencia visual #{idx + 1}
                </figcaption>
              </figure>
            {/each}
          </div>
        {/if}

        <!-- 3. Cuerpo del Informe: Texto Limpio de Documento -->
        <div class="sfv-doc-body space-y-8">

          <!-- Sección: Análisis del Contexto Visual -->
          <section class="sfv-doc-section">
            <h2 class="sfv-doc-h2 text-lg font-semibold text-(--sfv-text) mb-3 flex items-center gap-2">
              <span>🖼️</span> Análisis del Contexto Visual
            </h2>
            <p class="sfv-doc-paragraph leading-relaxed text-(--sfv-text-dim) text-[0.98rem]">
              {activeRecord.analisis_imagen || 'Sin análisis disponible para este registro.'}
            </p>
          </section>

          <!-- Sección: Plots Principales -->
          <section class="sfv-doc-section">
            <h2 class="sfv-doc-h2 text-lg font-semibold text-(--sfv-text) mb-3 flex items-center gap-2">
              <span>🎯</span> Plots Principales
              <span class="sfv-count-badge text-xs px-2 py-0.5 rounded-full font-medium ml-1">
                {activeRecord.plots_principales.length}
              </span>
            </h2>
            {#if activeRecord.plots_principales.length > 0}
              <ul class="sfv-doc-list space-y-3">
                {#each activeRecord.plots_principales as plot}
                  <li class="sfv-doc-item flex items-baseline gap-3 text-(--sfv-text) leading-relaxed text-[0.96rem]">
                    <span class="sfv-bullet-dot w-2 h-2 rounded-full shrink-0 mt-2 bg-(--sfv-accent)"></span>
                    <span>{plot}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="sfv-empty-hint">Sin plots registrados.</p>
            {/if}
          </section>

          <!-- Sección: Aportes Secundarios y Contexto -->
          <section class="sfv-doc-section">
            <h2 class="sfv-doc-h2 text-lg font-semibold text-(--sfv-text) mb-3 flex items-center gap-2">
              <span>💡</span> Aportes Secundarios y Contexto
              <span class="sfv-count-badge sfv-count-badge--secondary text-xs px-2 py-0.5 rounded-full font-medium ml-1">
                {activeRecord.aportes_secundarios.length}
              </span>
            </h2>
            {#if activeRecord.aportes_secundarios.length > 0}
              <ul class="sfv-doc-list space-y-3">
                {#each activeRecord.aportes_secundarios as aporte}
                  <li class="sfv-doc-item flex items-baseline gap-3 text-(--sfv-text-dim) leading-relaxed text-[0.96rem]">
                    <span class="sfv-bullet-dot sfv-bullet-dot--secondary w-2 h-2 rounded-full shrink-0 mt-2 bg-(--sfv-tertiary)"></span>
                    <span>{aporte}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="sfv-empty-hint">Sin aportes secundarios.</p>
            {/if}
          </section>

        </div>
      </article>

    {/if}
  </main>

  <!-- ── RIGHT SIDEBAR ──────────────────────────────────────────────── -->
  <aside class="sfv-sidebar-right" class:collapsed={!rightOpen}>
    <div class="sfv-sidebar-header sfv-sidebar-header--right">
      <button class="sfv-toggle-btn" onclick={() => rightOpen = !rightOpen} title="Panel IA">
        {rightOpen ? '›' : '‹'}
      </button>
      {#if rightOpen}
        <span class="sfv-sidebar-title">Motor IA</span>
        <span class="sfv-sidebar-icon">🤖</span>
      {/if}
    </div>

    {#if rightOpen}
      <div class="sfv-sidebar-content sfv-sidebar-content--right">
        <div class="sfv-sidebar-section-label">Acciones</div>
        <button class="sfv-action-btn" disabled={!activeRecord || loading}>
          <span>✨</span> Profundizar con Gemini
        </button>
        <button class="sfv-action-btn sfv-action-btn--secondary" disabled={!activeRecord || loading}>
          <span>📲</span> Enviar resumen a Telegram
        </button>
        <button class="sfv-action-btn sfv-action-btn--secondary" disabled={!activeRecord || loading}>
          <span>📄</span> Exportar como Markdown
        </button>

        <div class="sfv-sidebar-section-label" style="margin-top: 1.5rem;">Info del Doc</div>
        <div class="sfv-info-row">
          <span class="sfv-info-label">Total registros</span>
          <span class="sfv-info-value">{registros.length}</span>
        </div>
        <div class="sfv-info-row">
          <span class="sfv-info-label">Seleccionado</span>
          <span class="sfv-info-value">#{activeIndex + 1}</span>
        </div>
        <div class="sfv-doc-link">
          <a
            href="https://docs.google.com/document/d/118g7dpIhdjIBJqGeVaa6ZCUmEAEtdg3mBBwQKFO2wj0/edit"
            target="_blank"
            rel="noopener noreferrer"
          >
            🔗 Abrir Google Doc
          </a>
        </div>
      </div>
    {/if}
  </aside>
</div>

<style>
  :root {
    /* ── Paletas de Material You (Algoritmo Monet) - Modo Oscuro UX-Friendly ── */
    /* El Fondo Base: Gris grafito suave, evitando el negro abisal (#121314) */
    --sfv-bg: #1E2023;
    /* Neutral 2: surface_variant (#2A2D31) para superficies y contenedores Bento */
    --sfv-surface-variant: #2A2D31;
    --sfv-surface: #24262A;             /* Sidebars container */
    --sfv-surface2: #2A2D31;            /* Contenedores Bento y lectura */
    --sfv-surface3: #35383E;            /* Hover en modo oscuro */
    --sfv-border: #2A2D31;
    --sfv-border2: rgba(255, 255, 255, 0.08);

    /* Textos & Contrastes (Escala de Brillos Crítica) */
    --sfv-text: #E1E2E5;                /* On Surface / Tone 90-95 */
    --sfv-text-dim: #C4C7C8;            /* On Surface Variant / Tone 80 */
    --sfv-text-muted: #8E9194;          /* Tone 60 */

    /* Accent 1 (Tone 80 - Primary): Azul pastel vibrante sin neón */
    --sfv-accent: #AECBFA;
    --sfv-accent-graphic: #669DF6;      /* Tone 70: Elementos gráficos */
    --sfv-accent-dim: rgba(174, 203, 250, 0.14);
    --sfv-accent-container: #D2E3FC;    /* Tone 90 */

    /* Accent 2 (Tone 80 - Secondary): Chips de filtrado */
    --sfv-secondary: #BEC7E0;
    --sfv-secondary-dim: rgba(190, 199, 224, 0.14);

    /* Accent 3 (Tone 80 - Tertiary): Toque humano lila cálido */
    --sfv-tertiary: #D7BDEB;
    --sfv-tertiary-dim: rgba(215, 189, 235, 0.14);
    --sfv-gold: #D7BDEB;

    /* Geometría Bento */
    --sfv-radius-bento: 28px;           /* Tarjetas grandes Bento de Pixel */
    --sfv-radius-btn: 16px;             /* Botones e interruptores */
    --sfv-radius-sm: 14px;              /* Pills y elementos de lista */

    /* Elevaciones Material You */
    --sfv-elevation-rest: 0 1px 3px rgba(18, 19, 20, 0.25), 0 1px 2px rgba(18, 19, 20, 0.15);
    --sfv-elevation-hover: 0 4px 12px rgba(18, 19, 20, 0.35), 0 2px 4px rgba(18, 19, 20, 0.2);
    --sfv-elevation-active: 0 4px 8px rgba(18, 19, 20, 0.45);

    --sfv-sidebar-w: 240px;
    --sfv-sidebar-w-collapsed: 52px;
    --sfv-right-w: 220px;
    --sfv-transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ── Modo Claro (Algoritmo Monet Light) ────────────────────────────── */
  :global(html.theme-light) .sfv-root {
    --sfv-bg: #F8F9FA;                  /* Neutral 1: Lienzo claro */
    --sfv-surface-variant: #E1E2E5;     /* Neutral 2: Tarjetas Bento claras */
    --sfv-surface: #EFF0F3;             /* Sidebars claros */
    --sfv-surface2: #E1E2E5;            /* Contenedores Bento */
    --sfv-surface3: #D4D6DB;            /* Hover claro */
    --sfv-border: #E1E2E5;
    --sfv-border2: #D0D2D7;

    --sfv-text: #001D4A;                /* Tone 10: Contraste Máximo lectura */
    --sfv-text-dim: #383B40;
    --sfv-text-muted: #6F7278;

    --sfv-accent: #1A73E8;              /* Tone 40: Primario de marca claro */
    --sfv-accent-graphic: #15408F;      /* Tone 30: Alto contraste */
    --sfv-accent-dim: rgba(26, 115, 232, 0.12);
    --sfv-accent-container: #D2E3FC;    /* Tone 90 */

    --sfv-secondary: #555F71;           /* Accent 2 Modo Claro */
    --sfv-secondary-dim: rgba(85, 95, 113, 0.12);

    --sfv-tertiary: #6C538C;            /* Accent 3 Modo Claro */
    --sfv-tertiary-dim: rgba(108, 83, 140, 0.12);
    --sfv-gold: #6C538C;

    --sfv-elevation-rest: 0 1px 3px rgba(60, 64, 67, 0.15), 0 1px 2px rgba(60, 64, 67, 0.1);
    --sfv-elevation-hover: 0 4px 12px rgba(60, 64, 67, 0.18), 0 2px 4px rgba(60, 64, 67, 0.12);
    --sfv-elevation-active: 0 4px 8px rgba(60, 64, 67, 0.25);
  }

  .sfv-root {
    display: flex;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    width: 100%;
    background: var(--sfv-bg);
    color: var(--sfv-text);
    font-family: 'Outfit', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    transition: background 0.25s ease, color 0.25s ease;
  }

  /* ── Sidebars ─────────────────────────────────────────────────────── */
  .sfv-sidebar-left {
    width: var(--sfv-sidebar-w);
    min-width: var(--sfv-sidebar-w);
    height: 100%;
    min-height: 0;
    background: var(--sfv-surface);
    border-right: 1px solid var(--sfv-border);
    display: flex;
    flex-direction: column;
    transition: width var(--sfv-transition), min-width var(--sfv-transition);
    overflow: hidden;
    flex-shrink: 0;
  }
  .sfv-sidebar-left.collapsed {
    width: var(--sfv-sidebar-w-collapsed);
    min-width: var(--sfv-sidebar-w-collapsed);
  }
  .sfv-sidebar-right {
    width: var(--sfv-right-w);
    min-width: var(--sfv-right-w);
    height: 100%;
    min-height: 0;
    background: var(--sfv-surface);
    border-left: 1px solid var(--sfv-border);
    display: flex;
    flex-direction: column;
    transition: width var(--sfv-transition), min-width var(--sfv-transition);
    overflow: hidden;
    flex-shrink: 0;
  }
  .sfv-sidebar-right.collapsed {
    width: var(--sfv-sidebar-w-collapsed);
    min-width: var(--sfv-sidebar-w-collapsed);
  }

  .sfv-sidebar-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 0.875rem;
    border-bottom: 1px solid var(--sfv-border);
    white-space: nowrap;
    overflow: hidden;
    flex-shrink: 0;
  }
  .sfv-sidebar-header--right { justify-content: flex-end; }
  .sfv-sidebar-icon { font-size: 1.05rem; flex-shrink: 0; }
  .sfv-sidebar-title {
    font-size: 0.76rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--sfv-text-dim);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sfv-toggle-btn {
    background: none;
    border: none;
    color: var(--sfv-text-muted);
    cursor: pointer;
    padding: 0.3rem 0.45rem;
    border-radius: var(--sfv-radius-sm);
    font-size: 1rem;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
  }
  .sfv-toggle-btn:hover { color: var(--sfv-text); background: var(--sfv-surface2); }

  .sfv-sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.85rem 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .sfv-sidebar-content--right { padding: 1rem 0.85rem; gap: 0.65rem; }
  .sfv-sidebar-section-label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--sfv-text-muted);
    padding: 0.5rem 0.5rem 0.25rem;
  }

  .sfv-index-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .sfv-index-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    background: none;
    border: none;
    border-radius: var(--sfv-radius-sm);
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s ease, transform 0.15s ease;
    position: relative;
    overflow: hidden;
  }
  .sfv-index-item:hover { background: var(--sfv-surface2); }
  .sfv-index-item.active {
    background: var(--sfv-accent-dim);
  }
  .sfv-index-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--sfv-text-muted);
    position: absolute;
    top: 50%; left: 0.45rem;
    transform: translateY(-50%);
    transition: background 0.2s;
  }
  .sfv-index-item.active .sfv-index-dot { background: var(--sfv-accent); }
  .sfv-index-ts { font-size: 0.74rem; font-family: 'Outfit', monospace; color: var(--sfv-text-dim); padding-left: 0.85rem; }
  .sfv-index-preview { font-size: 0.7rem; color: var(--sfv-text-muted); padding-left: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Sparkle Ripple efecto sutil para items interactivos */
  .sfv-index-item::after,
  .sfv-action-btn::after,
  .sfv-reload-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(174, 203, 250, 0.3) 0%, rgba(255, 255, 255, 0.08) 40%, transparent 70%);
    opacity: 0;
    transform: scale(0.3);
    transition: transform 0.25s ease-out, opacity 0.25s ease-out;
    pointer-events: none;
    border-radius: inherit;
  }
  .sfv-index-item:active::after,
  .sfv-action-btn:active::after,
  .sfv-reload-btn:active::after {
    opacity: 1;
    transform: scale(2.2);
    transition: 0s;
  }

  .sfv-sidebar-footer { margin-top: auto; padding: 0.75rem 0.5rem 0.25rem; border-top: 1px solid var(--sfv-border); }
  .sfv-reload-btn {
    width: 100%;
    background: var(--sfv-surface2);
    border: none;
    box-shadow: var(--sfv-elevation-rest);
    color: var(--sfv-text-dim);
    border-radius: var(--sfv-radius-btn);
    padding: 0.55rem 0.75rem;
    font-size: 0.74rem;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .sfv-reload-btn:hover:not(:disabled) {
    background: var(--sfv-surface3);
    color: var(--sfv-text);
    box-shadow: var(--sfv-elevation-hover);
    transform: translateY(-1px);
  }
  .sfv-reload-btn:active:not(:disabled) {
    box-shadow: var(--sfv-elevation-active);
    transform: translateY(0);
  }
  .sfv-reload-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── Canvas de Lectura (Layout tipo Google Docs) ─────────────────── */
  .sfv-canvas {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    background: var(--sfv-bg);
    scroll-behavior: smooth;
  }

  .sfv-doc-container {
    max-width: 56rem;
    margin: 0 auto;
    width: 100%;
    padding: 2.5rem 2rem;
  }

  /* Mini Pills de metadatos superiores */
  .sfv-pills-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .sfv-mini-pill {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 500;
    background: var(--sfv-surface2);
    color: var(--sfv-text);
    box-shadow: var(--sfv-elevation-rest);
    transition: background 0.2s ease, transform 0.15s ease;
  }
  .sfv-mini-pill:hover {
    transform: translateY(-1px);
    background: var(--sfv-surface3);
  }
  .sfv-mini-pill--accent {
    background: var(--sfv-accent-dim);
    color: var(--sfv-accent);
  }
  .sfv-mini-pill--tertiary {
    background: var(--sfv-tertiary-dim);
    color: var(--sfv-tertiary);
  }
  .sfv-mini-pill--warn {
    background: rgba(242, 192, 55, 0.12);
    color: #ffd97d;
  }

  /* Tipografía y secciones del documento */
  .sfv-doc-title {
    font-size: 1.85rem;
    font-weight: 600;
    color: var(--sfv-text);
    margin: 0 0 1.5rem;
    letter-spacing: -0.015em;
    line-height: 1.3;
  }

  .sfv-doc-section {
    margin-bottom: 2.25rem;
  }

  .sfv-doc-h2 {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--sfv-text);
    margin: 0 0 0.75rem;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sfv-doc-paragraph {
    font-size: 0.98rem;
    line-height: 1.8;
    color: var(--sfv-text-dim);
    margin: 0;
  }

  .sfv-doc-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sfv-doc-item {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    font-size: 0.96rem;
    line-height: 1.75;
    color: var(--sfv-text);
  }

  .sfv-bullet-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 0.6rem;
    background: var(--sfv-accent);
    box-shadow: 0 0 4px rgba(174, 203, 250, 0.4);
  }
  .sfv-bullet-dot--secondary {
    background: var(--sfv-tertiary);
    box-shadow: 0 0 4px rgba(215, 189, 235, 0.4);
  }

  .sfv-count-badge {
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--sfv-accent-dim);
    color: var(--sfv-accent);
    padding: 0.15rem 0.55rem;
    border-radius: 9999px;
  }
  .sfv-count-badge--secondary {
    background: var(--sfv-tertiary-dim);
    color: var(--sfv-tertiary);
  }

  .sfv-doc-gallery {
    margin: 1.5rem 0 2rem;
  }
  .sfv-doc-figure {
    margin: 0 auto;
    text-align: center;
  }
  .sfv-doc-img {
    max-height: 440px;
    width: auto;
    margin: 0 auto;
    border-radius: 1rem;
    box-shadow: var(--sfv-elevation-rest);
    border: 1px solid var(--sfv-border);
  }

  /* ── Right sidebar acciones (Pixel Quick Settings Style) ──────────── */
  .sfv-action-btn {
    width: 100%; display: flex; align-items: center; gap: 0.65rem;
    background: var(--sfv-surface2);
    border: none;
    color: var(--sfv-text);
    border-radius: var(--sfv-radius-btn); /* 16px */
    padding: 0.75rem 0.95rem;
    font-size: 0.8rem;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer; text-align: left;
    box-shadow: var(--sfv-elevation-rest);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    white-space: nowrap; overflow: hidden;
    position: relative;
  }
  .sfv-action-btn:hover:not(:disabled) {
    background: var(--sfv-surface3);
    color: #fff;
    box-shadow: var(--sfv-elevation-hover);
    transform: translateY(-1px);
  }
  .sfv-action-btn:active:not(:disabled) {
    /* Elevación táctil Pixel: la sombra se expande sutilmente simulando levantarse */
    box-shadow: var(--sfv-elevation-active);
    transform: translateY(0);
  }
  .sfv-action-btn:disabled { opacity: 0.35; cursor: default; }
  .sfv-action-btn--secondary {
    background: rgba(255, 255, 255, 0.03);
    color: var(--sfv-text-dim);
  }

  .sfv-info-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.45rem 0.25rem; font-size: 0.75rem;
    border-bottom: 1px solid var(--sfv-border);
  }
  .sfv-info-label { color: var(--sfv-text-muted); }
  .sfv-info-value { color: var(--sfv-text-dim); font-weight: 600; font-family: 'Outfit', monospace; }

  .sfv-doc-link { margin-top: 1.25rem; }
  .sfv-doc-link a {
    display: block; width: 100%; text-align: center; font-size: 0.76rem;
    font-weight: 500;
    color: var(--sfv-accent); text-decoration: none;
    background: var(--sfv-accent-dim);
    border-radius: var(--sfv-radius-btn); /* 16px */
    padding: 0.65rem 0.75rem;
    box-shadow: var(--sfv-elevation-rest);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .sfv-doc-link a:hover {
    background: rgba(168, 199, 250, 0.22);
    box-shadow: var(--sfv-elevation-hover);
    transform: translateY(-1px);
  }

  /* ── Skeleton ────────────────────────────────────────────────────── */
  @keyframes sfv-shimmer {
    from { background-position: -600px 0; }
    to   { background-position: 600px 0; }
  }
  .sfv-skeleton-pills, .sfv-skeleton-block, .sfv-skeleton-row {
    background: linear-gradient(90deg, var(--sfv-surface) 25%, var(--sfv-surface3) 50%, var(--sfv-surface) 75%);
    background-size: 600px 100%;
    animation: sfv-shimmer 1.5s infinite linear;
    border-radius: var(--sfv-radius-btn);
  }
  .sfv-skeleton-pills { height: 32px; width: 60%; }
  .sfv-skeleton-block { border-radius: 1rem; }
  .sfv-skeleton-row { height: 36px; margin: 2px 0; }

  .sfv-empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; flex: 1; padding: 3rem; text-align: center;
    color: var(--sfv-text-dim); font-size: 0.9rem; min-height: 60vh;
  }
  .sfv-empty-state span { font-size: 2.5rem; }
  .sfv-empty-hint { font-size: 0.75rem; color: var(--sfv-text-muted); font-style: italic; margin: 0; padding: 0.5rem; }

  .sfv-canvas::-webkit-scrollbar,
  .sfv-sidebar-content::-webkit-scrollbar { width: 5px; }
  .sfv-canvas::-webkit-scrollbar-track,
  .sfv-sidebar-content::-webkit-scrollbar-track { background: transparent; }
  .sfv-canvas::-webkit-scrollbar-thumb,
  .sfv-sidebar-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 999px; }

  @media (max-width: 768px) {
    .sfv-sidebar-left:not(.collapsed), .sfv-sidebar-right:not(.collapsed) {
      position: absolute; z-index: 100; height: 100%; top: 0;
      box-shadow: 4px 0 24px rgba(0,0,0,0.6);
    }
    .sfv-sidebar-left:not(.collapsed) { left: 0; }
    .sfv-sidebar-right:not(.collapsed) { right: 0; }
    .sfv-doc-container { padding: 1.5rem 1rem; }
    .sfv-doc-title { font-size: 1.45rem; }
  }
</style>
