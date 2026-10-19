<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // LabEditorialLauncher.svelte
  // Subcomponente: Asignación de Colección, Lanzador TGP, R2 & Motores Cloud Run
  // ─────────────────────────────────────────────────────────────────────────────
  import { extraerMetadatosInforme } from './lab-metadata';

  export let imagenBase: File | null = null;
  export let imagenProcesada: string | null = null;
  export let informeTexto: string | null = null;
  export let informeModoUsado: 'flash' | 'pro' | null = null;
  export let r2Url: string | null = null;
  export let estadoR2: 'idle' | 'subiendo' | 'exito' | 'error' = 'idle';
  export let estado: 'esperando' | 'procesando' | 'completado' = 'esperando';
  export let errorMsg: string | null = null;
  export let r2Folder: string = 'laboratorio-visual';

  const CLOUD_RUN_BASE = (typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.PUBLIC_TGP_MIND_URL
    : null) ?? 'http://localhost:3001';

  const CLOUD_RUN_ENDPOINT = `${CLOUD_RUN_BASE.replace(/\/$/, '')}/process-image`;
  const CLOUD_RUN_UPLOAD_R2 = `${CLOUD_RUN_BASE.replace(/\/$/, '')}/api/upload-r2`;

  const API_TOKEN = (typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.TGP_MIND_API_KEY || (import.meta as any).env?.TGP_API_TOKEN
    : null) ?? '2771';

  // ── Colecciones Destino ───────────────────────────────────────────────────
  type ColeccionDestino = 'ensayos' | 'ensayosCinematicos' | 'arquetiposGlobales' | 'informesPremium' | 'georreferencias';
  let destinoSeleccionado: ColeccionDestino = 'ensayos';

  interface InfoDestino {
    id: ColeccionDestino;
    nombre: string;
    icono: string;
    subtitulo: string;
    keystaticPath: string;
    publicUrl: string;
    descripcion: string;
  }

  const DESTINOS_TGP: Record<ColeccionDestino, InfoDestino> = {
    ensayos: {
      id: 'ensayos',
      nombre: 'Ensayo Estándar',
      icono: '📜',
      subtitulo: 'Hemeroteca General & Portada Home',
      keystaticPath: '/keystatic/collection/ensayos/create',
      publicUrl: '/archivo',
      descripcion: 'Publicación clásica de investigación con citas primarias, aparato crítico y metadatos completos.',
    },
    ensayosCinematicos: {
      id: 'ensayosCinematicos',
      nombre: 'Ensayo Cinemático',
      icono: '🎬',
      subtitulo: 'Dossier GSAP Fullscreen',
      keystaticPath: '/keystatic/collection/ensayosCinematicos/create',
      publicUrl: '/ensayos-cinematicos',
      descripcion: 'Experiencia inmersiva con galería cinemática GSAP, tipografía monumental y atmósfera audiovisual.',
    },
    arquetiposGlobales: {
      id: 'arquetiposGlobales',
      nombre: 'Arquetipo Global',
      icono: '🏛️',
      subtitulo: 'Genealogía Mitológica',
      keystaticPath: '/keystatic/collection/arquetiposGlobales/create',
      publicUrl: '/arquetipos',
      descripcion: 'Catálogo de esculturas, bustos, dioses y figuras arquetípicas del Puzzle.',
    },
    informesPremium: {
      id: 'informesPremium',
      nombre: 'Informe Premium / Colección',
      icono: '🧪',
      subtitulo: 'Liminal, Heterodoxia, Anomalías...',
      keystaticPath: '/keystatic/collection/informesPremium/create',
      publicUrl: '/colecciones/liminal',
      descripcion: 'Reporte monográfico exclusivo asignado a una de las 4 colecciones temáticas cerradas.',
    },
    georreferencias: {
      id: 'georreferencias',
      nombre: 'Georreferencia',
      icono: '🌐',
      subtitulo: 'Atlas Geohistórico / Mapa',
      keystaticPath: '/keystatic/collection/georreferencias/create',
      publicUrl: '/georreferencias',
      descripcion: 'Ficha territorial con coordenadas, fotos de yacimiento y micro-narrativas etnográficas locales.',
    },
  };

  // ── Publicación directa ───────────────────────────────────────────────────
  let guardandoPost = false;
  let postCreadoExitosamente: {
    slug: string;
    titulo: string;
    webUrl: string;
    keystaticUrl: string;
    coleccion: string;
  } | null = null;
  let errorGuardadoPost: string | null = null;
  let copiado = false;

  async function copiarUrlR2() {
    if (!r2Url) return;
    await navigator.clipboard.writeText(r2Url);
    copiado = true;
    setTimeout(() => (copiado = false), 2500);
  }

  function descargarLocal() {
    if (!imagenProcesada) return;
    const a = document.createElement('a');
    a.href = imagenProcesada;
    a.download = `tgp-curada-${Date.now()}.png`;
    a.click();
  }

  function commitGitHub() {
    alert('Opción preparada para commit automatizado a GitHub Content Layer.');
  }

  function abrirEditorConDraft(url: string) {
    if (informeTexto || imagenBase) {
      const meta = extraerMetadatosInforme(informeTexto || '', informeModoUsado, imagenBase?.name || '');
      const draft = {
        title: meta.titulo,
        slug: meta.slug,
        category: meta.categoria,
        excerpt: meta.excerpt,
        content: informeTexto || '',
        imageUrl: r2Url || null,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem('tgp_staging_draft', JSON.stringify(draft));
      } catch (e) {
        console.warn('No se pudo guardar tgp_staging_draft:', e);
      }
    }
    window.open(url, '_blank');
  }

  async function guardarPostDirecto(destinoId: ColeccionDestino) {
    if (!imagenBase && !informeTexto) return;
    guardandoPost = true;
    errorGuardadoPost = null;
    postCreadoExitosamente = null;

    try {
      const meta = extraerMetadatosInforme(informeTexto || '', informeModoUsado, imagenBase?.name || '');

      let finalImageUrl = r2Url;
      if (!finalImageUrl && imagenBase) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(imagenBase);
        finalImageUrl = await base64Promise;
      }

      let endpoint = '/api/guardar-ensayo';
      let webUrl = `/hemeroteca/${meta.slug}/`;
      let keystaticUrl = `/keystatic/collection/ensayos/item/${meta.slug}`;

      if (destinoId === 'ensayosCinematicos') {
        endpoint = '/api/guardar-cinematico';
        webUrl = `/ensayos-cinematicos/${meta.slug}/`;
        keystaticUrl = `/keystatic/collection/ensayosCinematicos/item/${meta.slug}`;
      } else if (destinoId === 'arquetiposGlobales') {
        endpoint = '/api/guardar-arquetipo';
        webUrl = `/arquetipos/${meta.slug}/`;
        keystaticUrl = `/keystatic/collection/arquetiposGlobales/item/${meta.slug}`;
      } else if (destinoId === 'informesPremium') {
        endpoint = '/api/guardar-informe-premium';
        webUrl = `/colecciones/liminal/`;
        keystaticUrl = `/keystatic/collection/informesPremium/item/${meta.slug}`;
      } else if (destinoId === 'georreferencias') {
        endpoint = '/api/guardar-georreferencia';
        webUrl = `/georreferencias/${meta.slug}/`;
        keystaticUrl = `/keystatic/collection/georreferencias/item/${meta.slug}`;
      }

      const payload: any = {
        slug: meta.slug,
        title: meta.titulo,
        content: informeTexto || `Artículo dedicado a ${meta.titulo}.`,
        excerpt: meta.excerpt,
        category: meta.categoria,
        imageUrl: finalImageUrl,
        publicarConImagen: true,
        tags: meta.tags,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el post.');
      }

      postCreadoExitosamente = {
        slug: meta.slug,
        titulo: meta.titulo,
        webUrl,
        keystaticUrl,
        coleccion: DESTINOS_TGP[destinoId].nombre,
      };

      try {
        localStorage.setItem('tgp_staging_draft', JSON.stringify({
          title: meta.titulo,
          slug: meta.slug,
          category: meta.categoria,
          excerpt: meta.excerpt,
          content: informeTexto || '',
          imageUrl: finalImageUrl,
          timestamp: Date.now(),
        }));
      } catch {}
    } catch (err: any) {
      console.error('Error guardando post directo:', err);
      errorGuardadoPost = err.message || 'No se pudo guardar el post.';
    } finally {
      guardandoPost = false;
    }
  }

  // ── Procesamiento en Cloud Run ────────────────────────────────────────────
  async function procesarEnCloud(modo: string) {
    if (!imagenBase) return;
    estado = 'procesando';
    estadoR2 = 'idle';
    r2Url = null;
    errorMsg = null;

    const formData = new FormData();
    formData.append('file', imagenBase);
    formData.append('mode', modo);

    try {
      const res = await fetch(CLOUD_RUN_ENDPOINT, {
        method: 'POST',
        headers: { 'x-api-token': API_TOKEN },
        body: formData,
      });

      if (!res.ok) throw new Error(`Error en Cloud Run: ${res.status} ${res.statusText}`);

      const data = await res.json();
      imagenProcesada = data.data_uri;
      estado = 'completado';
    } catch (err: any) {
      console.error('Error al procesar:', err);
      errorMsg = err.message ?? 'Error de conexión con Cloud Run.';
      estado = 'esperando';
    }
  }

  // ── Inyección en Cloudflare R2 ────────────────────────────────────────────
  async function inyectarEnR2() {
    if (!imagenProcesada) return;
    estadoR2 = 'subiendo';
    copiado = false;
    errorMsg = null;

    const payload = {
      dataUri: imagenProcesada,
      folder: r2Folder || 'laboratorio-visual',
      filename: `tgp-curada-${Date.now()}`,
      tema: 'Laboratorio Visual · Curaduría',
      origen: 'laboratorio-visual',
    };

    try {
      let res = await fetch(CLOUD_RUN_UPLOAD_R2, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_TOKEN,
          'x-api-token': API_TOKEN,
        },
        body: JSON.stringify(payload),
      }).catch((fetchErr) => {
        console.warn('Cloud Run upload unreachable, trying local fallback:', fetchErr);
        return null;
      });

      if (!res || !res.ok) {
        console.warn('Fallo en Cloud Run R2, ejecutando fallback a /api/upload-r2...');
        res = await fetch('/api/upload-r2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al subir a Cloudflare R2');

      r2Url = data.url;
      estadoR2 = 'exito';
    } catch (err: any) {
      console.error('Error en inyección a R2:', err);
      errorMsg = err.message ?? 'Error al inyectar en R2.';
      estadoR2 = 'error';
    }
  }
</script>

{#if imagenBase}
  {@const actual = DESTINOS_TGP[destinoSeleccionado]}
  <!-- PASO 3 · ASIGNACIÓN DE COLECCIÓN & LANZADOR AL ECOSISTEMA TGP -->
  <section class="vl-section vl-destination-section">
    <div class="vl-section-header">
      <span class="vl-step-label">3 · Asignación de Colección &amp; Lanzador TGP</span>
      <span class="vl-badge">Ruteo al CMS Keystatic &amp; Web</span>
    </div>

    <!-- Pastillas Selectoras de Destino -->
    <div class="vl-destinos-pills">
      {#each Object.values(DESTINOS_TGP) as dest}
        <button
          type="button"
          class="vl-destino-pill {destinoSeleccionado === dest.id ? 'is-active' : ''}"
          on:click={() => (destinoSeleccionado = dest.id)}
        >
          <span class="vl-pill-icon">{dest.icono}</span>
          <span class="vl-pill-name">{dest.nombre}</span>
        </button>
      {/each}
    </div>

    <!-- Ficha de Destino Seleccionado -->
    <div class="vl-destino-card">
      <div class="vl-destino-card-left">
        <div class="vl-destino-header">
          <span class="vl-destino-icon">{actual.icono}</span>
          <div>
            <h3 class="vl-destino-title">{actual.nombre}</h3>
            <p class="vl-destino-sub">{actual.subtitulo}</p>
          </div>
        </div>
        <p class="vl-destino-desc">{actual.descripcion}</p>

        <div class="vl-destino-routes">
          <div class="vl-route-item">
            <span class="vl-route-label">Editor Keystatic:</span>
            <a href={actual.keystaticPath} target="_blank" rel="noopener noreferrer" class="vl-route-link">
              {actual.keystaticPath} ↗
            </a>
          </div>
          <div class="vl-route-item">
            <span class="vl-route-label">Publicación Web:</span>
            <a href={actual.publicUrl} target="_blank" rel="noopener noreferrer" class="vl-route-link">
              {actual.publicUrl} ↗
            </a>
          </div>
        </div>
      </div>

      <div class="vl-destino-card-right">
        {#if guardandoPost}
          <div class="vl-processing" style="padding: 14px 20px;">
            <div class="vl-spinner vl-spinner--blue"></div>
            <span>Publicando en {actual.nombre} y escribiendo en disco…</span>
          </div>
        {:else if postCreadoExitosamente}
          <div class="vl-post-creado-card">
            <div class="vl-post-creado-head">
              <span>✅ ¡Post Publicado en {postCreadoExitosamente.coleccion}!</span>
              <span class="vl-post-creado-slug">{postCreadoExitosamente.slug}</span>
            </div>
            <p class="vl-post-creado-title">{postCreadoExitosamente.titulo}</p>
            <div class="vl-post-creado-actions">
              <a
                href={postCreadoExitosamente.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="vl-btn vl-btn--primary vl-btn--sm"
              >
                <span>👁️ Ver en la Web</span>
              </a>
              <a
                href={postCreadoExitosamente.keystaticUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="vl-btn vl-btn--amber vl-btn--sm"
              >
                <span>✏️ Editar en Keystatic</span>
              </a>
              <button
                type="button"
                class="vl-btn vl-btn--ghost vl-btn--sm"
                on:click={() => (postCreadoExitosamente = null)}
                title="Crear otra entrada"
              >
                Publicar Otro
              </button>
            </div>
          </div>
        {:else}
          {#if errorGuardadoPost}
            <div class="vl-error" style="margin-bottom: 8px;">⚠ {errorGuardadoPost}</div>
          {/if}

          <button
            type="button"
            class="vl-btn vl-btn--primary vl-btn--launcher"
            on:click={() => guardarPostDirecto(destinoSeleccionado)}
            disabled={!informeTexto && !imagenBase}
            title={!informeTexto ? 'Primero genera el informe Flash o Pro en el Paso 2' : `Guardar post directamente en ${actual.nombre}`}
          >
            <span>⚡ Publicar Directo en {actual.nombre}</span>
          </button>

          <button
            type="button"
            class="vl-btn vl-btn--ghost vl-btn--sm"
            style="margin-top: 6px;"
            on:click={() => abrirEditorConDraft(actual.keystaticPath)}
            title="Abrir formulario en blanco en Keystatic precargando este borrador"
          >
            <span>🚀 Abrir Formulario en Keystatic ↗</span>
          </button>
        {/if}

        {#if r2Url}
          <div class="vl-launcher-r2-hint" style="margin-top: 8px;">
            <span>✓ Portada en Cloudflare R2</span>
            <button type="button" class="vl-link-btn" on:click={copiarUrlR2}>
              {copiado ? '✓ Copiado' : 'Copiar URL R2'}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </section>
{/if}

<!-- PASO 4 · MOTORES DE TRANSFORMACIÓN VISUAL -->
{#if imagenBase && estado !== 'procesando'}
  <section class="vl-section">
    <span class="vl-step-label">4 · Motores de Transformación (Cloud Run)</span>
    <div class="vl-motores-row">
      <button
        class="vl-btn vl-btn--green"
        on:click={() => procesarEnCloud('opencv')}
      >
        <span>◈</span> Rigor Estructural (OpenCV Canny)
      </button>
      <button
        class="vl-btn vl-btn--amber"
        on:click={() => procesarEnCloud('pipeline_ocv_iti')}
      >
        <span>✦</span> Deriva Estética (ITI / Vertex AI)
      </button>
    </div>
  </section>
{/if}

<!-- Estado: Procesando -->
{#if estado === 'procesando'}
  <div class="vl-processing">
    <div class="vl-spinner"></div>
    <span>Procesando transformación en Google Cloud Run…</span>
  </div>
{/if}

<!-- PASO 5 · DISTRIBUCIÓN Y ALMACENAMIENTO -->
{#if imagenProcesada && estado === 'completado'}
  <section class="vl-result-panel">
    <div class="vl-result-header">
      <span class="vl-result-ready">
        <span class="vl-ready-dot"></span>
        Imagen Curada Lista
      </span>
      <span class="vl-result-format">Base64 PNG</span>
    </div>

    <div class="vl-result-img-wrap">
      <img
        src={imagenProcesada}
        alt="Imagen procesada"
        class="vl-result-img"
      />
    </div>

    <div class="vl-dist-panel">
      <div class="vl-dist-row">
        <span class="vl-dist-label">Destino de almacenamiento:</span>
        <div class="vl-folder-row">
          <span class="vl-folder-hint">Carpeta:</span>
          <select bind:value={r2Folder} class="vl-select">
            <option value="laboratorio-visual">laboratorio-visual/</option>
            <option value="ensayos">ensayos/</option>
            <option value="ensayos-cinematicos">ensayos-cinematicos/</option>
            <option value="arquetipos-globales">arquetipos-globales/</option>
            <option value="georreferencias">georreferencias/</option>
          </select>
        </div>
      </div>

      <div class="vl-actions-grid">
        <button
          class="vl-btn vl-btn--blue"
          on:click={inyectarEnR2}
          disabled={estadoR2 === 'subiendo'}
        >
          {#if estadoR2 === 'subiendo'}
            <span class="vl-spinner vl-spinner--sm vl-spinner--blue"></span>
            Subiendo a R2…
          {:else}
            ☁️ Inyectar en Cloudflare R2
          {/if}
        </button>

        <button class="vl-btn vl-btn--purple" on:click={commitGitHub}>
          📦 Commit GitHub
        </button>

        <button class="vl-btn vl-btn--gray" on:click={descargarLocal}>
          📥 Descargar Local
        </button>
      </div>

      {#if r2Url && estadoR2 === 'exito'}
        <div class="vl-r2-success">
          <div class="vl-r2-success-header">
            <span class="vl-r2-label">✓ Publicado en Cloudflare R2 CDN:</span>
            <button class="vl-copy-btn" on:click={copiarUrlR2}>
              {copiado ? '¡Copiado!' : 'Copiar URL'}
            </button>
          </div>
          <input
            type="text"
            readonly
            value={r2Url}
            class="vl-r2-url-input"
          />
        </div>
      {/if}

      {#if estadoR2 === 'error'}
        <div class="vl-error" style="margin-top:10px">
          {errorMsg || 'Error al subir a R2. Revisá la consola para más detalles.'}
        </div>
      {/if}
    </div>
  </section>
{/if}
