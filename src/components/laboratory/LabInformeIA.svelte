<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // LabInformeIA.svelte
  // Subcomponente: Diagnóstico & Análisis Visual (Gemini Multimodal Directo)
  // ─────────────────────────────────────────────────────────────────────────────

  export let imagenBase: File | null = null;
  export let informeTexto: string | null = null;
  export let informeModoUsado: 'flash' | 'pro' | null = null;
  export let estadoInforme: 'idle' | 'generando' | 'completado' | 'error' = 'idle';
  export let informeError: string | null = null;

  let modoHover: 'flash' | 'pro' | null = null;
  let copiadoInforme = false;

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
</script>

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

    <!-- TARJETA HUD PRE-VUELO -->
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
