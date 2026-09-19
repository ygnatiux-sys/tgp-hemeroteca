<script lang="ts">
  import { onMount } from "svelte";

  // ── Tipos ──────────────────────────────────────────────────────────────
  type BotId    = "omni" | "social" | "assistant" | "liminal";
  type Red      = "facebook" | "instagram" | "tiktok";
  type Modelo   = "flash" | "pro";
  type Imagen   = "wikimedia" | "photos" | "no";
  type Formato  = "tgp" | "libre";
  type Estado   = "idle" | "loading" | "success" | "error";
  type PhotosState = "idle" | "loading" | "loaded" | "error";

  interface Photo { id: string; url: string; filename: string; }

  // ── Config por bot ──────────────────────────────────────────────────────
  interface BotConfig {
    label: string;
    icon: string;
    accent: string;
    accentBg: string;
    accentBorder: string;
    accentGlow: string;
    devBadge?: boolean;
    showRed: boolean;
    showModelo: boolean;
    showFormato: boolean;
    defaultRed: Red;
  }

  const BOT_CONFIGS: Record<BotId, BotConfig> = {
    omni: {
      label: "Omni Bot", icon: "🏛️",
      accent: "#388bfd", accentBg: "rgba(56,139,253,0.12)",
      accentBorder: "#388bfd", accentGlow: "rgba(56,139,253,0.35)",
      showRed: true, showModelo: true, showFormato: true, defaultRed: "facebook",
    },
    social: {
      label: "Bot Social", icon: "📡",
      accent: "#a371f7", accentBg: "rgba(163,113,247,0.12)",
      accentBorder: "#a371f7", accentGlow: "rgba(163,113,247,0.35)",
      showRed: true, showModelo: true, showFormato: true, defaultRed: "facebook",
    },
    assistant: {
      label: "TGP Cloud", icon: "⚗️",
      accent: "#d29922", accentBg: "rgba(210,153,34,0.12)",
      accentBorder: "#d29922", accentGlow: "rgba(210,153,34,0.35)",
      showRed: false, showModelo: true, showFormato: true, defaultRed: "facebook",
    },
    liminal: {
      label: "UXliminal", icon: "🧪",
      accent: "#39d353", accentBg: "rgba(57,211,83,0.12)",
      accentBorder: "#39d353", accentGlow: "rgba(57,211,83,0.35)",
      devBadge: true,
      showRed: true, showModelo: true, showFormato: true, defaultRed: "facebook",
    },
  };

  // ── Estado reactivo ─────────────────────────────────────────────────────
  let botId: BotId       = "omni";
  let tema: string       = "";
  let red: Red           = "facebook";
  let modelo: Modelo     = "flash";
  let imagen: Imagen     = "wikimedia";
  let formato: Formato   = "tgp";
  let estado: Estado     = "idle";
  let errorMsg           = "";
  let isTelegramAvailable = false;

  // Google Photos picker state
  let photosState: PhotosState = "idle";
  let photos: Photo[]          = [];
  let selectedPhoto: Photo | null = null;
  let showPhotosPicker         = false;

  const API_URL = import.meta.env.PUBLIC_TGP_MIND_URL || "https://tgp-mind-uc.a.run.app";

  $: cfg = BOT_CONFIGS[botId] || BOT_CONFIGS.omni;

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    tema  = params.get("tema") || "Sin tema definido";
    const rawBot = params.get("bot") || "omni";
    botId = (rawBot in BOT_CONFIGS ? rawBot : "omni") as BotId;
    red   = BOT_CONFIGS[botId].defaultRed;

    // Aplicar CSS vars dinámicas del bot
    document.documentElement.style.setProperty("--accent",        cfg.accent);
    document.documentElement.style.setProperty("--accent-bg",     cfg.accentBg);
    document.documentElement.style.setProperty("--accent-border", cfg.accentBorder);
    document.documentElement.style.setProperty("--accent-glow",   cfg.accentGlow);

    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      isTelegramAvailable = true;
      tg.ready();
      tg.expand();
    }
  });

  // ── Google Photos: cargar galería ───────────────────────────────────────
  async function loadPhotos() {
    if (photosState === "loading") return;
    photosState = "loading";
    showPhotosPicker = true;
    try {
      const res = await fetch(`${API_URL}/api/my-photos`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      photos = data.photos || [];
      photosState = "loaded";
    } catch (err: any) {
      photosState = "error";
    }
  }

  function selectPhoto(photo: Photo) {
    selectedPhoto = selectedPhoto?.id === photo.id ? null : photo;
  }

  // ── Generar ─────────────────────────────────────────────────────────────
  async function handleGenerar() {
    if (estado === "loading") return;
    estado   = "loading";
    errorMsg = "";
    const tg = (window as any).Telegram?.WebApp;
    const initData = tg?.initData || "";
    try {
      const res = await fetch(`${API_URL}/api/bot/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot: botId,
          tema, red, modelo, imagen, formato,
          photoUrl: selectedPhoto?.url || null,
          initData,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      estado = "success";
      setTimeout(() => { if (tg) tg.close(); }, 1400);
    } catch (err: any) {
      estado   = "error";
      errorMsg = err?.message || "Error al conectar con TGP Mind.";
    }
  }

  const RED_LABELS: Record<Red, string> = {
    facebook: "🔵 Facebook",
    instagram: "🟣 Instagram",
    tiktok: "⚫ TikTok",
  };
</script>

<!-- ─── Markup ─────────────────────────────────────────────────────────── -->
<div class="root">

  <!-- Header -->
  <header class="header">
    <div class="header-top">
      <span class="badge" style="background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent)">
        {cfg.icon} {cfg.label}
      </span>
      {#if cfg.devBadge}
        <span class="dev-badge">DEV</span>
      {/if}
    </div>
    <h1 class="title">Configurar Publicación</h1>
    <p class="tema-pill">
      <span>✍️</span>
      <span class="tema-text">{tema}</span>
    </p>
  </header>

  <!-- Body -->
  <main class="body">

    {#if cfg.showRed}
    <section class="section">
      <label class="section-label" style="color: var(--accent)">Red Social</label>
      <div class="toggle-group">
        {#each (["facebook", "instagram", "tiktok"] as Red[]) as r}
          <button class="toggle {red === r ? 'active' : ''}" on:click={() => (red = r)}>
            {RED_LABELS[r]}
          </button>
        {/each}
      </div>
    </section>
    {/if}

    {#if cfg.showModelo}
    <section class="section">
      <label class="section-label" style="color: var(--accent)">Motor IA</label>
      <div class="toggle-group">
        <button
          class="toggle model-toggle {modelo === 'flash' ? 'active' : ''}"
          on:click={() => (modelo = "flash")}
        >
          ⚡ Flash <span class="sublabel">Ágil · ~2s</span>
        </button>
        <button
          class="toggle model-toggle {modelo === 'pro' ? 'active pro-active' : ''}"
          on:click={() => (modelo = "pro")}
        >
          🧠 Pro <span class="sublabel">Profundo · ~8s</span>
        </button>
      </div>
    </section>
    {/if}

    <!-- Imagen: 3 opciones -->
    <section class="section">
      <label class="section-label" style="color: var(--accent)">Imagen</label>
      <div class="toggle-group">
        <button class="toggle {imagen === 'wikimedia' ? 'active' : ''}" on:click={() => { imagen = 'wikimedia'; showPhotosPicker = false; }}>
          🌐 Wikimedia
        </button>
        <button class="toggle {imagen === 'photos' ? 'active' : ''}" on:click={() => { imagen = 'photos'; loadPhotos(); }}>
          📷 Mis Fotos
        </button>
        <button class="toggle {imagen === 'no' ? 'active' : ''}" on:click={() => { imagen = 'no'; showPhotosPicker = false; }}>
          📝 Sin imagen
        </button>
      </div>
    </section>

    <!-- Google Photos Picker (se despliega al elegir "Mis Fotos") -->
    {#if showPhotosPicker}
    <div class="photos-panel">
      {#if photosState === "loading"}
        <div class="photos-loading">
          <span class="spinner"></span> Cargando galería…
        </div>
      {:else if photosState === "error"}
        <p class="photos-error">⚠️ No se pudo cargar Google Photos.<br/>Verifica GOOGLE_REFRESH_TOKEN en el servidor.</p>
      {:else if photosState === "loaded"}
        {#if photos.length === 0}
          <p class="photos-empty">Sin fotos recientes.</p>
        {:else}
          <p class="photos-hint">{selectedPhoto ? `✅ Seleccionada: ${selectedPhoto.filename}` : 'Toca para seleccionar una foto'}</p>
          <div class="photos-grid">
            {#each photos as photo}
              <button
                class="photo-thumb {selectedPhoto?.id === photo.id ? 'selected' : ''}"
                on:click={() => selectPhoto(photo)}
                title={photo.filename}
              >
                <img src={photo.url} alt={photo.filename} loading="lazy" />
                {#if selectedPhoto?.id === photo.id}
                  <span class="photo-check">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
    {/if}

    {#if cfg.showFormato}
    <section class="section">
      <label class="section-label" style="color: var(--accent)">Formato editorial</label>
      <div class="toggle-group">
        <button class="toggle {formato === 'tgp' ? 'active' : ''}" on:click={() => (formato = "tgp")}>
          🏛️ Modo TGP
        </button>
        <button class="toggle {formato === 'libre' ? 'active' : ''}" on:click={() => (formato = "libre")}>
          ✍️ Libre
        </button>
      </div>
    </section>
    {/if}

    <!-- Resumen -->
    <div class="summary">
      <span class="summary-chip" style="border-color: var(--accent-border); color: var(--accent)">{cfg.icon} {cfg.label}</span>
      {#if cfg.showRed}<span class="summary-chip">{RED_LABELS[red]}</span>{/if}
      <span class="summary-chip">{modelo === "flash" ? "⚡ Flash" : "🧠 Pro"}</span>
      <span class="summary-chip">{imagen === "wikimedia" ? "🌐 Wiki" : imagen === "photos" ? "📷 Foto" : "📝 Texto"}</span>
      <span class="summary-chip">{formato === "tgp" ? "🏛️ TGP" : "✍️ Libre"}</span>
    </div>

  </main>

  <!-- Footer / CTA -->
  <footer class="footer">
    {#if estado === "error"}
      <p class="error-msg">⚠️ {errorMsg}</p>
    {/if}

    <button
      id="btn-generar"
      class="btn-generar"
      class:loading={estado === "loading"}
      class:success={estado === "success"}
      on:click={handleGenerar}
      disabled={estado === "loading" || estado === "success"}
      style="--btn-color: var(--accent); --btn-glow: var(--accent-glow)"
    >
      {#if estado === "loading"}
        <span class="spinner"></span> Generando…
      {:else if estado === "success"}
        ✅ Enviado al chat
      {:else}
        🚀 Generar y Publicar
      {/if}
    </button>

    {#if !isTelegramAvailable}
      <p class="dev-notice">Dev — Telegram WebApp no detectado</p>
    {/if}
  </footer>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html, body) {
    height: 100%;
    background: #0d1117;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #e6edf3;
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
  }
  :global(:root) {
    --accent:        #388bfd;
    --accent-bg:     rgba(56,139,253,0.12);
    --accent-border: #388bfd;
    --accent-glow:   rgba(56,139,253,0.35);
  }

  .root {
    display: flex; flex-direction: column;
    min-height: 100dvh; max-width: 480px; margin: 0 auto;
  }

  /* ── Header ── */
  .header {
    padding: 18px 20px 14px;
    border-bottom: 1px solid #1e2837;
    background: linear-gradient(160deg, #0d1117 0%, #111827 100%);
  }
  .header-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    letter-spacing: .1em; text-transform: uppercase;
    border: 1px solid; border-radius: 100px; padding: 3px 10px;
  }
  .dev-badge {
    font-size: 9px; font-weight: 700; letter-spacing: .12em;
    color: #39d353; background: rgba(57,211,83,.12);
    border: 1px solid rgba(57,211,83,.35); border-radius: 100px; padding: 2px 7px;
  }
  .title { font-size: 21px; font-weight: 700; letter-spacing: -.3px; color: #f0f6fc; margin-bottom: 10px; }
  .tema-pill {
    display: flex; align-items: flex-start; gap: 8px;
    background: rgba(255,255,255,.03); border: 1px solid #2a3441;
    border-radius: 10px; padding: 8px 12px;
  }
  .tema-text {
    font-size: 13px; color: #8b949e; line-height: 1.4;
    overflow: hidden; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }

  /* ── Body ── */
  .body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 18px; }
  .section { display: flex; flex-direction: column; gap: 8px; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }

  .toggle-group { display: flex; gap: 7px; flex-wrap: wrap; }
  .toggle {
    flex: 1; min-width: 80px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    padding: 9px 10px; background: #161b22; border: 1px solid #2a3441;
    border-radius: 10px; color: #8b949e; font-size: 12.5px; font-weight: 500;
    cursor: pointer; transition: all .15s ease; font-family: inherit;
  }
  .toggle:hover:not(:disabled) { background: #1e2837; border-color: #3d4f63; color: #c9d1d9; }
  .toggle.active {
    background: var(--accent-bg);
    border-color: var(--accent-border);
    color: var(--accent);
    font-weight: 600;
  }
  .model-toggle { padding: 12px 12px; }
  .sublabel { font-size: 10px; font-weight: 400; color: #6e7681; }
  .toggle.pro-active { background: rgba(163,113,247,.12); border-color: #a371f7; color: #a371f7; }
  .toggle.pro-active .sublabel { color: rgba(163,113,247,.7); }

  /* ── Google Photos Panel ── */
  .photos-panel {
    border: 1px solid #2a3441; border-radius: 12px;
    background: rgba(255,255,255,.02); overflow: hidden;
  }
  .photos-loading, .photos-error, .photos-empty {
    padding: 20px; text-align: center; color: #8b949e; font-size: 13px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .photos-error { color: #f85149; font-size: 12px; line-height: 1.5; }
  .photos-hint { font-size: 11px; color: #8b949e; padding: 8px 12px 4px; font-weight: 500; }
  .photos-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px; padding: 4px 8px 8px;
  }
  .photo-thumb {
    position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden;
    cursor: pointer; border: 2px solid transparent; transition: all .15s ease;
    background: #161b22; padding: 0;
  }
  .photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-thumb.selected { border-color: var(--accent); }
  .photo-thumb.selected img { opacity: 0.85; }
  .photo-check {
    position: absolute; top: 4px; right: 4px;
    background: var(--accent); color: #fff;
    width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700;
  }

  /* ── Summary ── */
  .summary {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: 10px 12px; background: rgba(255,255,255,.02);
    border: 1px solid #1e2837; border-radius: 10px;
  }
  .summary-chip {
    font-size: 11px; font-weight: 500; color: #8b949e;
    background: #161b22; border: 1px solid #2a3441;
    border-radius: 100px; padding: 3px 10px;
  }

  /* ── Footer ── */
  .footer {
    padding: 14px 20px; border-top: 1px solid #1e2837;
    background: #0d1117; display: flex; flex-direction: column; gap: 10px;
  }
  .btn-generar {
    width: 100%; padding: 15px; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: all .2s ease;
    background: var(--btn-color, var(--accent));
    color: #fff;
    box-shadow: 0 4px 20px var(--btn-glow, var(--accent-glow));
  }
  .btn-generar:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }
  .btn-generar:active:not(:disabled) { transform: translateY(0); filter: brightness(1); }
  .btn-generar:disabled { opacity: .65; cursor: not-allowed; transform: none; filter: none; }
  .btn-generar.loading { filter: brightness(.7); box-shadow: none; }
  .btn-generar.success { background: #16a34a; box-shadow: 0 4px 20px rgba(22,163,74,.35); }

  .spinner {
    display: inline-block; width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
    border-radius: 50%; animation: spin .65s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-msg {
    font-size: 12px; color: #f85149;
    background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.2);
    border-radius: 8px; padding: 8px 12px; text-align: center;
  }
  .dev-notice { font-size: 11px; color: #4a5568; text-align: center; font-family: monospace; }
</style>
