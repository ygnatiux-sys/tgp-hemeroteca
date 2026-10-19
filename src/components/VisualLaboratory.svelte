<script lang="ts">
  // ─────────────────────────────────────────────────────────────────────────────
  // VisualLaboratory.svelte (Orquestador Central)
  // ADN: TGP · Infraestructura Visual · Ingesta, Cloud Run & Cloudflare R2
  // ─────────────────────────────────────────────────────────────────────────────
  import { onMount } from 'svelte';
  import '../styles/visual-laboratory.css';
  import LabCanvasMonumental from './laboratory/LabCanvasMonumental.svelte';
  import LabInformeIA from './laboratory/LabInformeIA.svelte';
  import LabEditorialLauncher from './laboratory/LabEditorialLauncher.svelte';
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

  // ── Estado reactivo compartido ────────────────────────────────────────────
  let imagenBase:       File | null   = null;
  let imagenProcesada:  string | null = null;
  let estado:           'esperando' | 'procesando' | 'completado' = 'esperando';
  let estadoR2:         'idle' | 'subiendo' | 'exito' | 'error'  = 'idle';
  let r2Url:            string | null = null;
  let r2Folder          = 'laboratorio-visual';
  let errorMsg:         string | null = null;
  let isWikiInboxOpen   = false;

  // ── Estado Informe IA (Gemini Vision) ─────────────────────────────────────
  let estadoInforme:    'idle' | 'generando' | 'completado' | 'error' = 'idle';
  let informeTexto:     string | null = null;
  let informeModoUsado: 'flash' | 'pro' | null = null;
  let informeError:     string | null = null;

  function handleFileSelect(file: File) {
    imagenBase      = file;
    imagenProcesada = null;
    r2Url           = null;
    estadoR2        = 'idle';
    errorMsg        = null;
    informeTexto    = null;
    estadoInforme   = 'idle';
    informeModoUsado = null;
    informeError    = null;
  }
</script>

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

  <!-- ── PASO 1: Ingesta & Canvas Monumental ───────────────────────────── -->
  <LabCanvasMonumental
    bind:imagenBase
    bind:imagenProcesada
    bind:isWikiInboxOpen
    onFileSelect={handleFileSelect}
    onError={(err) => (errorMsg = err)}
  />

  <!-- ── PASO 2: Diagnóstico & Análisis con IA (Gemini Vision) ─────────── -->
  <LabInformeIA
    {imagenBase}
    bind:informeTexto
    bind:informeModoUsado
    bind:estadoInforme
    bind:informeError
  />

  <!-- ── PASO 3, 4 & 5: Selector de Destino, Motores Cloud Run & R2 ────── -->
  <LabEditorialLauncher
    {imagenBase}
    bind:imagenProcesada
    {informeTexto}
    {informeModoUsado}
    bind:r2Url
    bind:estadoR2
    bind:estado
    bind:errorMsg
    bind:r2Folder
  />

  <!-- ── Modal Wikimedia Commons Integrado ─────────────────────────────── -->
  <WikimediaGalleryInbox
    bind:isOpen={isWikiInboxOpen}
    onSelect={handleFileSelect}
  />

</div>
