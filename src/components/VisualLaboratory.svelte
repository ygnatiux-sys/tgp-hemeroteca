<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // VisualLaboratory.svelte
  // Reimplementación nativa en Svelte de TgpVisualLaboratory (React)
  // ADN: TGP · Infraestructura Visual · Ingesta, Cloud Run & Cloudflare R2
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Config ────────────────────────────────────────────────────────────────
  const CLOUD_RUN_BASE = (typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.PUBLIC_TGP_MIND_URL
    : null) ?? 'http://localhost:3001';

  const CLOUD_RUN_ENDPOINT = `${CLOUD_RUN_BASE.replace(/\/$/, '')}/process-image`;
  const CLOUD_RUN_UPLOAD_R2 = `${CLOUD_RUN_BASE.replace(/\/$/, '')}/api/upload-r2`;

  const API_TOKEN = (typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.TGP_MIND_API_KEY || (import.meta as any).env?.TGP_API_TOKEN
    : null) ?? '2771';

  import { onMount } from 'svelte';
  import { openGooglePicker } from '../lib/google-picker';
  import WikimediaGalleryInbox from './WikimediaGalleryInbox.svelte';

  // ── Modo Día (Gemini) / Noche (Carbón Pixel) ──────────────────────────────
  let darkMode = false;

  onMount(() => {
    const saved = localStorage.getItem('tgp_r2_staging_dark');
    if (saved !== null) {
      darkMode = saved === 'true';
    } else {
      darkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }
  });

  function toggleDarkMode() {
    darkMode = !darkMode;
    try {
      localStorage.setItem('tgp_r2_staging_dark', String(darkMode));
    } catch {}
  }

  // Credenciales Google manejadas por el backend (Cloud Run) — sin exposicion en frontend

  // ── Estado reactivo ───────────────────────────────────────────────────────
  let imagenBase:       File | null  = null;
  let imagenProcesada:  string | null = null;  // data-URI resultante
  let estado:           'esperando' | 'procesando' | 'completado' = 'esperando';
  let estadoR2:         'idle' | 'subiendo' | 'exito' | 'error'  = 'idle';
  let r2Url:            string | null = null;
  let r2Folder          = 'laboratorio-visual';
  let copiado           = false;
  let errorMsg:         string | null = null;
  let isWikiInboxOpen   = false;

  // ── Estado Informe IA (Gemini Vision Flash vs Pro) ────────────────────────
  let modoHover:        'flash' | 'pro' | null = null;
  let estadoInforme:    'idle' | 'generando' | 'completado' | 'error' = 'idle';
  let informeTexto:     string | null = null;
  let informeModoUsado: 'flash' | 'pro' | null = null;
  let informeError:     string | null = null;
  let copiadoInforme    = false;

  // ── Ref de DOM ────────────────────────────────────────────────────────────
  let fileInputEl: HTMLInputElement;

  // ── Declaraciones reactivas ───────────────────────────────────────────────
  $: sizeLabel = imagenBase
    ? `${imagenBase.name} · ${(imagenBase.size / 1024).toFixed(1)} KB`
    : null;

  let pickerLoading = false;

  // ── Manejo de archivo ─────────────────────────────────────────────────────
  function abrirSelector() {
    fileInputEl?.click();
  }

  function abrirGooglePickerModal() {
    pickerLoading = true;
    errorMsg = null;
    openGooglePicker({
      onSelect: (file: File) => {
        pickerLoading = false;
        imagenBase = file;
        imagenProcesada = null;
        r2Url = null;
        estadoR2 = 'idle';
      },
      onError: (err) => {
        pickerLoading = false;
        if (err.message !== 'PICKER_RENDERED' && err.message !== 'PICKER_CLOSED' && err.message !== 'PICKER_TIMEOUT') {
          errorMsg = `Google Photos: ${err.message}`;
        }
      },
    });
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file) {
      imagenBase      = file;
      imagenProcesada = null;
      r2Url           = null;
      estadoR2        = 'idle';
      errorMsg        = null;
      limpiarInforme();
    }
  }

  function handleWikiSelect(file: File) {
    imagenBase      = file;
    imagenProcesada = null;
    r2Url           = null;
    estadoR2        = 'idle';
    errorMsg        = null;
    limpiarInforme();
  }

  // ── Generación de Informe con IA (Gemini Multimodal Directo) ─────────────
  async function generarInformeIA(modo: 'flash' | 'pro') {
    if (!imagenBase) return;
    estadoInforme = 'generando';
    informeModoUsado = modo;
    informeError = null;
    copiadoInforme = false;

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(imagenBase);
      const base64Data = await base64Promise;

      const res = await fetch('/api/informe-imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: imagenBase.type || 'image/jpeg',
          modo,
          nombreArchivo: imagenBase.name,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar informe con Gemini');
      }

      informeTexto = data.informe;
      estadoInforme = 'completado';
    } catch (err: any) {
      console.error('Error generando informe IA:', err);
      informeError = err.message || 'Error de conexión con el motor de IA.';
      estadoInforme = 'error';
    }
  }

  async function copiarInforme() {
    if (!informeTexto) return;
    await navigator.clipboard.writeText(informeTexto);
    copiadoInforme = true;
    setTimeout(() => (copiadoInforme = false), 2500);
  }

  function limpiarInforme() {
    informeTexto = null;
    estadoInforme = 'idle';
    informeModoUsado = null;
    informeError = null;
    copiadoInforme = false;
  }

  // ── Procesamiento en Cloud Run ────────────────────────────────────────────
  async function procesarEnCloud(modo: string) {
    if (!imagenBase) return;
    estado   = 'procesando';
    estadoR2 = 'idle';
    r2Url    = null;
    errorMsg = null;

    const formData = new FormData();
    formData.append('file', imagenBase);
    formData.append('mode', modo);

    try {
      const res = await fetch(CLOUD_RUN_ENDPOINT, {
        method : 'POST',
        headers: { 'x-api-token': API_TOKEN },
        body   : formData,
      });

      if (!res.ok) throw new Error(`Error en Cloud Run: ${res.status} ${res.statusText}`);

      const data  = await res.json();
      imagenProcesada = data.data_uri;
      estado          = 'completado';
    } catch (err: any) {
      console.error('Error al procesar:', err);
      errorMsg = err.message ?? 'Error de conexión con Cloud Run.';
      estado   = 'esperando';
    }
  }

  // ── Inyección en Cloudflare R2 ────────────────────────────────────────────
  async function inyectarEnR2() {
    if (!imagenProcesada) return;
    estadoR2 = 'subiendo';
    copiado  = false;
    errorMsg = null;

    const payload = {
      dataUri : imagenProcesada,
      folder  : r2Folder || 'laboratorio-visual',
      filename: `tgp-curada-${Date.now()}`,
      tema    : 'Laboratorio Visual · Curaduría',
      origen  : 'laboratorio-visual',
    };

    try {
      // 1. Prioridad: Pipeline centralizado de TGP Mind (Sharp WebP + R2 CDN + D1)
      let res = await fetch(CLOUD_RUN_UPLOAD_R2, {
        method : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_TOKEN,
          'x-api-token': API_TOKEN,
        },
        body   : JSON.stringify(payload),
      }).catch((fetchErr) => {
        console.warn('Cloud Run upload unreachable, trying local fallback:', fetchErr);
        return null;
      });

      // 2. Fallback resiliente a endpoint local de Astro si Cloud Run no responde
      if (!res || !res.ok) {
        console.warn('Fallo en Cloud Run R2, ejecutando fallback a /api/upload-r2...');
        res = await fetch('/api/upload-r2', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al subir a Cloudflare R2');

      r2Url    = data.url;
      estadoR2 = 'exito';
    } catch (err: any) {
      console.error('Error en inyección a R2:', err);
      errorMsg = err.message ?? 'Error al inyectar en R2.';
      estadoR2 = 'error';
    }
  }

  // ── Commit GitHub (stub)  ─────────────────────────────────────────────────
  function commitGitHub() {
    alert('Opción preparada para commit automatizado a GitHub Content Layer.');
  }

  // ── Descarga local ────────────────────────────────────────────────────────
  function descargarLocal() {
    if (!imagenProcesada) return;
    const a       = document.createElement('a');
    a.href        = imagenProcesada;
    a.download    = `tgp-curada-${Date.now()}.png`;
    a.click();
  }

  // ── Copiar URL R2 ─────────────────────────────────────────────────────────
  async function copiarUrlR2() {
    if (!r2Url) return;
    await navigator.clipboard.writeText(r2Url);
    copiado = true;
    setTimeout(() => (copiado = false), 2500);
  }
</script>

<!-- ── TEMPLATE ──────────────────────────────────────────────────────────── -->
<div class="vl-root {darkMode ? 'theme-dark' : 'theme-light'}">

  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="vl-header">
    <div class="vl-header-left">
      <span class="vl-kicker">TGP R2 Staging · Conversor &amp; Subida R2</span>
      <h1 class="vl-title">Mesa de Staging Visual</h1>
      <p class="vl-brief">
        Mesa de pruebas rápida para procesar imágenes sueltas, aplicar transformaciones de visión por computadora (OpenCV / ITI) y subirlas a Cloudflare R2 con registro en D1.
      </p>
    </div>
    <div class="vl-header-actions">
      <a
        href="/tgp-app/"
        class="vl-btn vl-btn--ghost"
        title="Volver al Hub de TGP App"
      >
        ← Hub
      </a>

      <!-- Conmutador Día (Gemini) / Noche (Carbón Pixel) -->
      <button
        type="button"
        class="vl-btn vl-btn--ghost vl-theme-toggle"
        on:click={toggleDarkMode}
        title={darkMode ? 'Cambiar a modo Día (Gemini)' : 'Cambiar a modo Noche (Carbón Pixel)'}
      >
        {#if darkMode}
          <span style="font-size:14px;">☀️</span> Día Gemini
        {:else}
          <span style="font-size:14px;">🌙</span> Noche Carbón
        {/if}
      </button>

      <span class="vl-badge">R2 + Cloud Run</span>
    </div>
  </div>

  <!-- ── Error global ──────────────────────────────────────────────────── -->
  {#if errorMsg}
    <div class="vl-error">⚠ {errorMsg}</div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════
       PASO 1 · INGESTA
  ════════════════════════════════════════════════════════════════════ -->
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
      <!-- Miniatura de previsualización del archivo original -->
      <div class="vl-original-preview">
        <img
          src={URL.createObjectURL(imagenBase)}
          alt="Original"
          class="vl-original-img"
        />
        <div class="vl-original-meta">
          <span class="vl-original-name">{imagenBase.name}</span>
          <span class="vl-original-size">{(imagenBase.size / 1024).toFixed(1)} KB</span>
        </div>
      </div>
    {/if}
  </section>

  <!-- ═══════════════════════════════════════════════════════════════════
       PASO 2 · DIAGNÓSTICO & ANÁLISIS CON IA (GEMINI MULTIMODAL)
  ════════════════════════════════════════════════════════════════════ -->
  {#if imagenBase}
    <section class="vl-section vl-ai-section">
      <div class="vl-section-header">
        <span class="vl-step-label">2 · Diagnóstico &amp; Análisis Visual (Gemini Multimodal Directo)</span>
        <span class="vl-badge vl-badge--cyan">1 Paso · Zero Cloud Run</span>
      </div>

      <!-- BOTONERA DE ELECCIÓN (FLASH VS PRO) -->
      <div class="vl-ai-buttons-row">
        <button
          type="button"
          class="vl-btn vl-btn--flash {informeModoUsado === 'flash' ? 'vl-btn--active' : ''}"
          on:mouseenter={() => (modoHover = 'flash')}
          on:mouseleave={() => (modoHover = null)}
          on:click={() => generarInformeIA('flash')}
          disabled={estadoInforme === 'generando'}
        >
          <span class="vl-btn-icon">⚡</span>
          <span>Informe Flash (&lt; 2s)</span>
          <span class="vl-btn-subtag">Triage Rápido</span>
        </button>

        <button
          type="button"
          class="vl-btn vl-btn--pro {informeModoUsado === 'pro' ? 'vl-btn--active' : ''}"
          on:mouseenter={() => (modoHover = 'pro')}
          on:mouseleave={() => (modoHover = null)}
          on:click={() => generarInformeIA('pro')}
          disabled={estadoInforme === 'generando'}
        >
          <span class="vl-btn-icon">🧠</span>
          <span>Informe Pro (Erudito)</span>
          <span class="vl-btn-subtag">Dossier Semiótico</span>
        </button>
      </div>

      <!-- TARJETA HUD PRE-VUELO (WARNING & ESPECIFICACIÓN ANTES DE CLICKEAR) -->
      <div
        class="vl-hud-preview {modoHover === 'flash'
          ? 'vl-hud--flash'
          : modoHover === 'pro'
          ? 'vl-hud--pro'
          : 'vl-hud--idle'}"
      >
        {#if modoHover === 'flash'}
          <div class="vl-hud-content">
            <div class="vl-hud-top">
              <span class="vl-hud-pill vl-hud-pill--flash">⚡ PRE-VUELO · ESPECIFICACIÓN FLASH</span>
              <span class="vl-hud-metric">Modelo: <strong>gemini-2.5-flash</strong></span>
              <span class="vl-hud-metric">Tiempo: <strong>&lt; 2 seg</strong></span>
              <span class="vl-hud-metric">Consumo: <strong>Mínimo (~300 tokens)</strong></span>
            </div>
            <div class="vl-hud-body">
              <p class="vl-hud-lead">
                <strong>Propósito:</strong> Triage veloz, asignación de colección y metadatos cromáticos esenciales sin esperas.
              </p>
              <div class="vl-hud-list">
                <span>✓ Sujeto / obra identificada</span>
                <span>✓ Cultura y época estimada</span>
                <span>✓ Atmósfera (3 tonos dominantes)</span>
                <span>✓ Colección TGP sugerida</span>
              </div>
            </div>
          </div>
        {:else if modoHover === 'pro'}
          <div class="vl-hud-content">
            <div class="vl-hud-top">
              <span class="vl-hud-pill vl-hud-pill--pro">🧠 PRE-VUELO · ESPECIFICACIÓN PRO</span>
              <span class="vl-hud-metric">Modelo: <strong>gemini-3.1-pro</strong></span>
              <span class="vl-hud-metric">Tiempo: <strong>5 - 10 seg</strong></span>
              <span class="vl-hud-metric">Consumo: <strong>Moderado (~2,500 tokens)</strong></span>
            </div>
            <div class="vl-hud-body">
              <p class="vl-hud-lead">
                <strong>Propósito:</strong> Curaduría editorial profunda, análisis arqueosemiótico exhaustivo y redacción de ensayo histórico.
              </p>
              <div class="vl-hud-list">
                <span>✓ 1. Iconografía minuciosa y contexto</span>
                <span>✓ 2. Estratigrafía, materialidad y desgaste</span>
                <span>✓ 3. Hermenéutica y mitología comparada</span>
                <span>✓ 4. Ficha editorial (H1, Dek, Excerpt y Tags D1)</span>
              </div>
            </div>
          </div>
        {:else}
          <div class="vl-hud-idle">
            <span class="vl-hud-idle-icon">ℹ️</span>
            <span>
              Pasa el ratón sobre <strong>⚡ Informe Flash</strong> o <strong>🧠 Informe Pro</strong> para previsualizar modelo, tiempo de respuesta, consumo de tokens y estructura del informe antes de hacer clic.
            </span>
          </div>
        {/if}
      </div>

      <!-- ESTADO DE PROCESAMIENTO IA -->
      {#if estadoInforme === 'generando'}
        <div class="vl-processing vl-ai-processing">
          <div class="vl-spinner vl-spinner--blue"></div>
          <span>
            Analizando píxeles en Gemini Multimodal ({informeModoUsado === 'pro'
              ? 'gemini-3.1-pro · Redactando Dossier Erudito'
              : 'gemini-2.5-flash · Generando Síntesis Ágil'})…
          </span>
        </div>
      {/if}

      <!-- ERROR IA -->
      {#if informeError}
        <div class="vl-error">⚠ {informeError}</div>
      {/if}

      <!-- RESULTADO DEL INFORME IA -->
      {#if informeTexto && estadoInforme === 'completado'}
        <div class="vl-ai-report-card">
          <div class="vl-ai-report-header">
            <div class="vl-ai-report-badges">
              <span
                class="vl-badge-mode {informeModoUsado === 'pro'
                  ? 'vl-badge-mode--pro'
                  : 'vl-badge-mode--flash'}"
              >
                {informeModoUsado === 'pro' ? '🧠 Dossier Erudito Pro' : '⚡ Síntesis Flash'}
              </span>
              <span class="vl-ai-report-meta">Gemini Vision Multimodal · 1 Paso</span>
            </div>
            <div class="vl-ai-report-actions">
              <button
                type="button"
                class="vl-btn vl-btn--ghost vl-btn--sm"
                on:click={copiarInforme}
              >
                {copiadoInforme ? '✓ ¡Copiado!' : '📋 Copiar Markdown'}
              </button>
              <button
                type="button"
                class="vl-btn vl-btn--ghost vl-btn--sm"
                on:click={limpiarInforme}
                title="Cerrar informe"
              >
                ✕
              </button>
            </div>
          </div>
          <div class="vl-ai-report-body">
            <pre class="vl-markdown-view">{informeTexto}</pre>
          </div>
        </div>
      {/if}
    </section>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════
       PASO 3 · MOTORES DE TRANSFORMACIÓN VISUAL
  ════════════════════════════════════════════════════════════════════ -->
  {#if imagenBase && estado !== 'procesando'}
    <section class="vl-section">
      <span class="vl-step-label">3 · Motores de Transformación (Cloud Run)</span>
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

  <!-- Estado: Procesando ─────────────────────────────────────────────── -->
  {#if estado === 'procesando'}
    <div class="vl-processing">
      <div class="vl-spinner"></div>
      <span>Procesando transformación en Google Cloud Run…</span>
    </div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════
       PASO 3 · DISTRIBUCIÓN
  ════════════════════════════════════════════════════════════════════ -->
  {#if imagenProcesada && estado === 'completado'}
    <section class="vl-result-panel">

      <!-- Cabecera del resultado -->
      <div class="vl-result-header">
        <span class="vl-result-ready">
          <span class="vl-ready-dot"></span>
          Imagen Curada Lista
        </span>
        <span class="vl-result-format">Base64 PNG</span>
      </div>

      <!-- Imagen procesada -->
      <div class="vl-result-img-wrap">
        <img
          src={imagenProcesada}
          alt="Imagen procesada"
          class="vl-result-img"
        />
      </div>

      <!-- ── Distribución y almacenamiento ──────────────────────────── -->
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

        <!-- Botones de acción -->
        <div class="vl-actions-grid">
          <!-- R2 -->
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

          <!-- GitHub (stub) -->
          <button class="vl-btn vl-btn--purple" on:click={commitGitHub}>
            📦 Commit GitHub
          </button>

          <!-- Descarga local -->
          <button class="vl-btn vl-btn--gray" on:click={descargarLocal}>
            📥 Descargar Local
          </button>
        </div>

        <!-- Feedback R2: éxito -->
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

        <!-- Feedback R2: error -->
        {#if estadoR2 === 'error'}
          <div class="vl-error" style="margin-top:10px">
            {errorMsg || 'Error al subir a R2. Revisá la consola para más detalles.'}
          </div>
        {/if}
      </div>
    </section>
  {/if}

    <!-- Galería Wikimedia Commons Integrada Inline en el Scroll -->
    <WikimediaGalleryInbox bind:isOpen={isWikiInboxOpen} onSelect={handleWikiSelect} />

</div>

<style>
  /* ── Variables de Tema: Día (Gemini) vs Noche (Carbón Pixel) ──────────────── */
  .vl-root.theme-light {
    --vl-bg:            #ffffff;
    --vl-surface:       #f8f9fa;
    --vl-surface-card:  #ffffff;
    --vl-border:        #dadce0;
    --vl-border-subtle: #f1f3f4;
    --vl-text:          #202124;
    --vl-text-muted:    #5f6368;
    --vl-text-dim:      #80868b;
    --vl-accent-blue:   #1a73e8;
    --vl-accent-hover:  #1557b0;
    --vl-accent-green:  #137333;
    --vl-accent-amber:  #b06000;
    --vl-btn-ghost-bg:  #f1f3f4;
    --vl-btn-ghost-hov: #e8eaed;
    --vl-card-shadow:   0 1px 3px rgba(60,64,67,0.08);
  }

  .vl-root.theme-dark {
    --vl-bg:            #121314;
    --vl-surface:       #1e1f20;
    --vl-surface-card:  #1e1f20;
    --vl-border:        #3c4043;
    --vl-border-subtle: #282a2c;
    --vl-text:          #e8eaed;
    --vl-text-muted:    #9aa0a6;
    --vl-text-dim:      #80868b;
    --vl-accent-blue:   #8ab4f8;
    --vl-accent-hover:  #aecbfa;
    --vl-accent-green:  #81c995;
    --vl-accent-amber:  #fdd663;
    --vl-btn-ghost-bg:  #2d2e30;
    --vl-btn-ghost-hov: #3c4043;
    --vl-card-shadow:   0 1px 3px rgba(0,0,0,0.3);
  }

  .vl-root {
    background:    var(--vl-bg);
    color:         var(--vl-text);
    min-height:    100vh;
    padding:       24px 32px 48px;
    font-family:   system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition:    background 0.25s ease, color 0.25s ease;
    box-sizing:    border-box;
    width:         100%;
    max-width:     100%;
  }

  /* ── Header ──────────────────────────────────────────────────────────── */
  .vl-header {
    display:         flex;
    align-items:     flex-start;
    justify-content: space-between;
    border-bottom:   1px solid var(--vl-border);
    padding-bottom:  20px;
    margin-bottom:   28px;
    gap:             16px;
    flex-wrap:       wrap;
  }
  .vl-header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 780px;
  }
  .vl-kicker {
    font-size:      11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color:          var(--vl-accent-blue);
    font-weight:    700;
    font-family:    'IBM Plex Mono', monospace;
  }
  .vl-title {
    font-size:      26px;
    font-weight:    600;
    color:          var(--vl-text);
    letter-spacing: -0.01em;
    margin:         2px 0 4px 0;
  }
  .vl-brief {
    font-size:   13px;
    color:       var(--vl-text-muted);
    margin:      0;
    line-height: 1.5;
  }
  .vl-header-actions {
    display:     flex;
    align-items: center;
    gap:         10px;
    flex-wrap:   wrap;
  }
  .vl-badge {
    font-size:     11px;
    font-weight:   600;
    padding:       6px 14px;
    border-radius: 9999px;
    background:    var(--vl-surface);
    border:        1px solid var(--vl-border);
    color:         var(--vl-text-muted);
    white-space:   nowrap;
    font-family:   'IBM Plex Mono', monospace;
  }

  /* ── Secciones ───────────────────────────────────────────────────────── */
  .vl-section {
    border-bottom:  1px solid var(--vl-border-subtle);
    padding-bottom: 26px;
    margin-bottom:  26px;
    display:        flex;
    flex-direction: column;
    gap:            16px;
  }
  .vl-step-label {
    font-size:      11px;
    font-weight:    700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color:          var(--vl-text-muted);
    font-family:    'IBM Plex Mono', monospace;
  }

  /* ── Botones Material You (Píldoras) ─────────────────────────────────── */
  .vl-btn {
    display:        inline-flex;
    align-items:    center;
    justify-content: center;
    gap:            8px;
    padding:        10px 20px;
    border-radius:  9999px;
    font-size:      13px;
    font-weight:    600;
    cursor:         pointer;
    transition:     all 0.2s ease;
    border:         1px solid transparent;
    white-space:    nowrap;
    text-decoration: none;
    box-sizing:     border-box;
  }
  .vl-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .vl-btn-icon { color: var(--vl-accent-amber); font-weight: bold; }

  .vl-btn--primary {
    background: var(--vl-accent-blue);
    color:      #ffffff;
    border:     1px solid transparent;
    box-shadow: 0 1px 3px rgba(26,115,232,0.25);
  }
  .vl-btn--primary:hover:not(:disabled) {
    background: var(--vl-accent-hover);
  }
  .theme-dark .vl-btn--primary {
    color: #121314;
    background: var(--vl-accent-blue);
  }

  .vl-btn--green {
    background: var(--vl-surface);
    border:     1px solid var(--vl-border);
    color:      var(--vl-accent-green);
  }
  .vl-btn--green:hover:not(:disabled) {
    background: var(--vl-btn-ghost-hov);
  }

  .vl-btn--amber {
    background: var(--vl-surface);
    border:     1px solid var(--vl-border);
    color:      var(--vl-accent-amber);
  }
  .vl-btn--amber:hover:not(:disabled) {
    background: var(--vl-btn-ghost-hov);
  }

  .vl-btn--blue {
    background: var(--vl-accent-blue);
    color:      #ffffff;
  }
  .vl-btn--blue:hover:not(:disabled) {
    background: var(--vl-accent-hover);
  }
  .theme-dark .vl-btn--blue {
    color: #121314;
  }

  .vl-btn--purple {
    background: var(--vl-surface);
    border:     1px solid var(--vl-border);
    color:      var(--vl-text);
  }
  .vl-btn--purple:hover:not(:disabled) {
    background: var(--vl-btn-ghost-hov);
  }

  .vl-btn--gray {
    background: var(--vl-surface);
    border:     1px solid var(--vl-border);
    color:      var(--vl-text);
  }
  .vl-btn--gray:hover:not(:disabled) {
    background: var(--vl-btn-ghost-hov);
  }

  .vl-btn--ghost {
    background: var(--vl-btn-ghost-bg);
    border:     1px solid transparent;
    color:      var(--vl-text);
  }
  .vl-btn--ghost:hover {
    background: var(--vl-btn-ghost-hov);
  }

  .vl-theme-toggle {
    font-size:   12px;
    font-weight: 600;
  }

  /* ── Ingesta row ─────────────────────────────────────────────────────── */
  .vl-ingesta-row {
    display:     flex;
    flex-wrap:   wrap;
    align-items: center;
    gap:         12px;
  }
  .vl-file-chip {
    font-size:     12px;
    font-weight:   600;
    color:         var(--vl-accent-green);
    background:    var(--vl-surface);
    border:        1px solid var(--vl-border);
    padding:       6px 14px;
    border-radius: 9999px;
    font-family:   'IBM Plex Mono', monospace;
  }

  /* ── Preview del original (Cero scrims ni velos oscuros) ──────────────── */
  .vl-original-preview {
    display:       flex;
    align-items:   center;
    gap:           16px;
    background:    var(--vl-surface);
    border:        1px solid var(--vl-border);
    border-radius: 14px;
    padding:       12px 18px;
    max-width:     580px;
  }
  .vl-original-img {
    width:         64px;
    height:        64px;
    object-fit:    cover;
    border-radius: 10px;
    border:        1px solid var(--vl-border);
    flex-shrink:   0;
  }
  .vl-original-meta {
    display:        flex;
    flex-direction: column;
    gap:            4px;
  }
  .vl-original-name {
    font-size:     13px;
    font-weight:   600;
    color:         var(--vl-text);
    overflow:      hidden;
    text-overflow: ellipsis;
    white-space:   nowrap;
    max-width:     400px;
  }
  .vl-original-size {
    font-size:   11px;
    color:       var(--vl-text-muted);
    font-family: 'IBM Plex Mono', monospace;
  }

  /* ── Motores row ─────────────────────────────────────────────────────── */
  .vl-motores-row {
    display:   flex;
    flex-wrap: wrap;
    gap:       12px;
  }

  /* ── Procesando ──────────────────────────────────────────────────────── */
  .vl-processing {
    display:       flex;
    align-items:   center;
    gap:           12px;
    padding:       18px 22px;
    background:    var(--vl-surface);
    border:        1px solid var(--vl-border);
    border-radius: 14px;
    margin-bottom: 20px;
    color:         var(--vl-text);
    font-size:     13px;
    font-weight:   500;
  }

  /* ── Resultado / panel de distribución ───────────────────────────────── */
  .vl-result-panel {
    background:    var(--vl-surface);
    border:        1px solid var(--vl-border);
    border-radius: 16px;
    padding:       24px;
    display:       flex;
    flex-direction: column;
    gap:           18px;
    box-shadow:    var(--vl-card-shadow);
  }
  .vl-result-header {
    display:         flex;
    align-items:     center;
    justify-content: space-between;
  }
  .vl-result-ready {
    display:        flex;
    align-items:    center;
    gap:            8px;
    font-size:      12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color:          var(--vl-accent-green);
    font-weight:    700;
    font-family:    'IBM Plex Mono', monospace;
  }
  .vl-ready-dot {
    width:         8px;
    height:        8px;
    border-radius: 50%;
    background:    var(--vl-accent-green);
    flex-shrink:   0;
  }
  .vl-result-format {
    font-size:   11px;
    font-family: 'IBM Plex Mono', monospace;
    color:       var(--vl-text-muted);
  }
  .vl-result-img-wrap {
    background:    var(--vl-bg);
    border:        1px solid var(--vl-border);
    border-radius: 12px;
    padding:       16px;
    display:       flex;
    align-items:   center;
    justify-content: center;
  }
  .vl-result-img {
    max-height:    440px;
    max-width:     100%;
    object-fit:    contain;
    border-radius: 8px;
    border:        1px solid var(--vl-border-subtle);
  }

  /* ── Panel distribución ──────────────────────────────────────────────── */
  .vl-dist-panel {
    border-top:  1px solid var(--vl-border-subtle);
    padding-top: 18px;
    display:     flex;
    flex-direction: column;
    gap:         16px;
  }
  .vl-dist-row {
    display:         flex;
    flex-wrap:       wrap;
    align-items:     center;
    justify-content: space-between;
    gap:             12px;
  }
  .vl-dist-label {
    font-size:      11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color:          var(--vl-text-muted);
    font-weight:    700;
    font-family:    'IBM Plex Mono', monospace;
  }
  .vl-folder-row {
    display:     flex;
    align-items: center;
    gap:         8px;
  }
  .vl-folder-hint { font-size: 12px; color: var(--vl-text-muted); }
  .vl-select {
    background:    var(--vl-bg);
    border:        1px solid var(--vl-border);
    color:         var(--vl-text);
    font-family:   'IBM Plex Mono', monospace;
    font-size:     12px;
    padding:       6px 14px;
    border-radius: 8px;
    outline:       none;
    cursor:        pointer;
    transition:    border-color 0.2s;
  }
  .vl-select:focus { border-color: var(--vl-accent-blue); }

  /* ── Grid de acciones ────────────────────────────────────────────────── */
  .vl-actions-grid {
    display:               grid;
    grid-template-columns: repeat(3, 1fr);
    gap:                   12px;
  }
  @media (max-width: 600px) {
    .vl-actions-grid { grid-template-columns: 1fr; }
  }

  /* ── R2 éxito ────────────────────────────────────────────────────────── */
  .vl-r2-success {
    background:    var(--vl-surface);
    border:        1px solid var(--vl-border);
    border-radius: 12px;
    padding:       16px;
    display:       flex;
    flex-direction: column;
    gap:           10px;
  }
  .vl-r2-success-header {
    display:         flex;
    align-items:     center;
    justify-content: space-between;
  }
  .vl-r2-label {
    font-size:   12px;
    color:       var(--vl-accent-green);
    font-weight: 700;
    font-family: 'IBM Plex Mono', monospace;
  }
  .vl-copy-btn {
    font-family:   'IBM Plex Mono', monospace;
    font-size:     11px;
    font-weight:   600;
    background:    var(--vl-btn-ghost-bg);
    border:        1px solid var(--vl-border);
    border-radius: 9999px;
    color:         var(--vl-text);
    padding:       5px 12px;
    cursor:        pointer;
    transition:    background 0.2s;
  }
  .vl-copy-btn:hover { background: var(--vl-btn-ghost-hov); }
  .vl-r2-url-input {
    width:         100%;
    background:    var(--vl-bg);
    border:        1px solid var(--vl-border);
    border-radius: 8px;
    padding:       8px 14px;
    font-family:   'IBM Plex Mono', monospace;
    font-size:     12px;
    color:         var(--vl-text);
    outline:       none;
    box-sizing:    border-box;
  }

  /* ── Error global ────────────────────────────────────────────────────── */
  .vl-error {
    background:    #fef2f2;
    border:        1px solid #fecaca;
    border-radius: 12px;
    padding:       12px 18px;
    font-size:     13px;
    color:         #b91c1c;
    margin-bottom: 20px;
  }
  .theme-dark .vl-error {
    background: #3c1414;
    border-color: #5c1d1d;
    color: #fca5a5;
  }

  /* ── Spinners ────────────────────────────────────────────────────────── */
  .vl-spinner {
    display:       inline-block;
    width:         16px;
    height:        16px;
    border:        2px solid rgba(138,180,248,0.3);
    border-top-color: var(--vl-accent-blue);
    border-radius: 50%;
    animation:     vl-spin 0.75s linear infinite;
    flex-shrink:   0;
  }
  .vl-spinner--sm {
    width:  12px;
    height: 12px;
  }
  .vl-spinner--blue {
    border-color:     rgba(26,115,232,0.3);
    border-top-color: var(--vl-accent-blue);
  }
  @keyframes vl-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Módulo Informe IA (Flash vs Pro) ─────────────────────────────────── */
  .vl-ai-section {
    background: var(--vl-surface);
    border: 1px solid var(--vl-border);
    border-radius: 16px;
    padding: 20px 24px;
    box-shadow: var(--vl-card-shadow);
  }
  .vl-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .vl-badge--cyan {
    color: var(--vl-accent-blue);
    border-color: rgba(26,115,232,0.3);
    background: rgba(26,115,232,0.06);
  }
  .vl-ai-buttons-row {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .vl-btn--flash {
    background: #e8f0fe;
    color: #1a73e8;
    border-color: #d2e3fc;
  }
  .vl-btn--flash:hover {
    background: #d2e3fc;
    color: #174ea6;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26,115,232,0.15);
  }
  .theme-dark .vl-btn--flash {
    background: #1a2733;
    color: #8ab4f8;
    border-color: #2b3d52;
  }
  .theme-dark .vl-btn--flash:hover {
    background: #233446;
    color: #aecbfa;
  }
  .vl-btn--pro {
    background: #fef7e0;
    color: #b06000;
    border-color: #feefc3;
  }
  .vl-btn--pro:hover {
    background: #feefc3;
    color: #8a4800;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(176,96,0,0.18);
  }
  .theme-dark .vl-btn--pro {
    background: #2b2313;
    color: #fdd663;
    border-color: #44371e;
  }
  .theme-dark .vl-btn--pro:hover {
    background: #382c16;
    color: #ffe082;
  }
  .vl-btn-subtag {
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 9999px;
    background: rgba(0,0,0,0.06);
    margin-left: 4px;
  }
  .theme-dark .vl-btn-subtag {
    background: rgba(255,255,255,0.1);
  }
  .vl-btn--active {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  /* ── HUD Pre-Vuelo Interactivo ────────────────────────────────────────── */
  .vl-hud-preview {
    border-radius: 12px;
    padding: 14px 18px;
    font-size: 13px;
    transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid var(--vl-border);
    background: var(--vl-surface-card);
  }
  .vl-hud--idle {
    background: var(--vl-surface);
    border-color: var(--vl-border-subtle);
    color: var(--vl-text-muted);
  }
  .vl-hud-idle {
    display: flex;
    align-items: center;
    gap: 10px;
    line-height: 1.5;
  }
  .vl-hud-idle-icon {
    font-size: 16px;
    flex-shrink: 0;
  }
  .vl-hud--flash {
    background: #f8fbff;
    border-color: #8ab4f8;
    box-shadow: 0 4px 16px rgba(26,115,232,0.08);
  }
  .theme-dark .vl-hud--flash {
    background: #141c24;
    border-color: #2b486f;
  }
  .vl-hud--pro {
    background: #fffdf5;
    border-color: #fdd663;
    box-shadow: 0 4px 16px rgba(176,96,0,0.1);
  }
  .theme-dark .vl-hud--pro {
    background: #1f190e;
    border-color: #5c451a;
  }
  .vl-hud-top {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .vl-hud-pill {
    font-size: 11px;
    font-weight: 700;
    font-family: 'IBM Plex Mono', monospace;
    padding: 3px 10px;
    border-radius: 9999px;
    letter-spacing: 0.06em;
  }
  .vl-hud-pill--flash {
    background: #1a73e8;
    color: #ffffff;
  }
  .vl-hud-pill--pro {
    background: #b06000;
    color: #ffffff;
  }
  .vl-hud-metric {
    font-size: 12px;
    color: var(--vl-text);
    font-family: 'IBM Plex Mono', monospace;
  }
  .vl-hud-metric strong {
    color: var(--vl-text);
  }
  .vl-hud-lead {
    margin: 0 0 8px 0;
    color: var(--vl-text);
    line-height: 1.5;
    font-size: 12.5px;
  }
  .vl-hud-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 6px;
    font-size: 12px;
    color: var(--vl-text-muted);
    font-family: 'IBM Plex Mono', monospace;
  }

  /* ── Tarjeta de Informe Generado ──────────────────────────────────────── */
  .vl-ai-processing {
    margin-top: 10px;
  }
  .vl-ai-report-card {
    margin-top: 12px;
    border-radius: 14px;
    border: 1px solid var(--vl-border);
    background: var(--vl-bg);
    overflow: hidden;
  }
  .vl-ai-report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--vl-surface);
    border-bottom: 1px solid var(--vl-border-subtle);
  }
  .vl-ai-report-badges {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .vl-badge-mode {
    font-size: 11px;
    font-weight: 700;
    font-family: 'IBM Plex Mono', monospace;
    padding: 3px 10px;
    border-radius: 9999px;
  }
  .vl-badge-mode--flash {
    background: rgba(26,115,232,0.12);
    color: var(--vl-accent-blue);
  }
  .vl-badge-mode--pro {
    background: rgba(176,96,0,0.14);
    color: var(--vl-accent-amber);
  }
  .vl-ai-report-meta {
    font-size: 11px;
    color: var(--vl-text-dim);
    font-family: 'IBM Plex Mono', monospace;
  }
  .vl-ai-report-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .vl-btn--sm {
    padding: 6px 12px;
    font-size: 12px;
  }
  .vl-ai-report-body {
    padding: 16px 20px;
    max-height: 480px;
    overflow-y: auto;
  }
  .vl-markdown-view {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13.5px;
    line-height: 1.65;
    color: var(--vl-text);
  }
</style>
