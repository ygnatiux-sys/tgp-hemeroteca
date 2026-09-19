<script lang="ts">
  import { onMount } from "svelte";

  type Red     = "facebook" | "instagram" | "tiktok";
  type Modelo  = "flash" | "pro";
  type Imagen  = "si" | "no";
  type Formato = "tgp" | "libre";
  type Estado  = "idle" | "loading" | "success" | "error";

  let tema: string   = "";
  let red: Red       = "facebook";
  let modelo: Modelo = "flash";
  let imagen: Imagen = "si";
  let formato: Formato = "tgp";
  let estado: Estado = "idle";
  let errorMsg = "";
  let isTelegramAvailable = false;

  const API_URL = import.meta.env.PUBLIC_TGP_MIND_URL || "https://tgp-mind-uc.a.run.app";

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    tema = params.get("tema") || "Sin tema definido";
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      isTelegramAvailable = true;
      tg.ready();
      tg.expand();
    }
  });

  async function handleGenerar() {
    if (estado === "loading") return;
    estado = "loading";
    errorMsg = "";
    const tg = (window as any).Telegram?.WebApp;
    const initData = tg?.initData || "";
    try {
      const res = await fetch(`${API_URL}/api/bot/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema, red, modelo, imagen, formato, initData }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      estado = "success";
      setTimeout(() => { if (tg) tg.close(); }, 1400);
    } catch (err: any) {
      estado = "error";
      errorMsg = err?.message || "Error al conectar con TGP Mind.";
    }
  }

  const RED_LABELS: Record<Red, string> = {
    facebook: "🔵 Facebook",
    instagram: "🟣 Instagram",
    tiktok: "⚫ TikTok",
  };
</script>

<div class="root">
  <header class="header">
    <span class="badge">TGP · Editorial Engine</span>
    <h1 class="title">Configurar Publicación</h1>
    <p class="tema-pill">
      <span class="tema-icon">✍️</span>
      <span class="tema-text">{tema}</span>
    </p>
  </header>

  <main class="body">
    <section class="section">
      <label class="section-label">Red Social</label>
      <div class="toggle-group">
        {#each (["facebook", "instagram", "tiktok"] as Red[]) as r}
          <button class="toggle {red === r ? 'active' : ''}" on:click={() => (red = r)}>
            {RED_LABELS[r]}
          </button>
        {/each}
      </div>
    </section>

    <section class="section">
      <label class="section-label">Motor IA</label>
      <div class="toggle-group">
        <button
          class="toggle model-toggle {modelo === 'flash' ? 'active flash-active' : ''}"
          on:click={() => (modelo = "flash")}
        >
          ⚡ Flash
          <span class="sublabel">Ágil · ~2s</span>
        </button>
        <button
          class="toggle model-toggle {modelo === 'pro' ? 'active pro-active' : ''}"
          on:click={() => (modelo = "pro")}
        >
          🧠 Pro
          <span class="sublabel">Profundo · ~8s</span>
        </button>
      </div>
    </section>

    <section class="section">
      <label class="section-label">Adjuntar imagen</label>
      <div class="toggle-group">
        <button class="toggle {imagen === 'si' ? 'active' : ''}" on:click={() => (imagen = "si")}>
          🖼️ Con imagen
        </button>
        <button class="toggle {imagen === 'no' ? 'active' : ''}" on:click={() => (imagen = "no")}>
          📝 Solo texto
        </button>
      </div>
    </section>

    <section class="section">
      <label class="section-label">Formato editorial</label>
      <div class="toggle-group">
        <button class="toggle {formato === 'tgp' ? 'active' : ''}" on:click={() => (formato = "tgp")}>
          🏛️ Modo TGP
        </button>
        <button class="toggle {formato === 'libre' ? 'active' : ''}" on:click={() => (formato = "libre")}>
          ✍️ Libre
        </button>
      </div>
    </section>

    <div class="summary">
      <span class="summary-chip">{RED_LABELS[red]}</span>
      <span class="summary-chip">{modelo === "flash" ? "⚡ Flash" : "🧠 Pro"}</span>
      <span class="summary-chip">{imagen === "si" ? "🖼️ Con imagen" : "📝 Texto"}</span>
      <span class="summary-chip">{formato === "tgp" ? "🏛️ Modo TGP" : "✍️ Libre"}</span>
    </div>
  </main>

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
      <p class="dev-notice">Modo dev — Telegram WebApp no detectado</p>
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
  }

  .root {
    display: flex; flex-direction: column;
    min-height: 100dvh; max-width: 480px; margin: 0 auto;
  }

  /* Header */
  .header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid #1e2837;
    background: linear-gradient(160deg, #0d1117 0%, #111827 100%);
  }
  .badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    letter-spacing: .12em; text-transform: uppercase;
    color: #58a6ff; background: rgba(88,166,255,.1);
    border: 1px solid rgba(88,166,255,.25); border-radius: 100px;
    padding: 3px 10px; margin-bottom: 8px;
  }
  .title { font-size: 22px; font-weight: 700; letter-spacing: -.3px; color: #f0f6fc; margin-bottom: 10px; }
  .tema-pill {
    display: flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,.04); border: 1px solid #2a3441;
    border-radius: 10px; padding: 8px 12px;
  }
  .tema-icon { font-size: 14px; flex-shrink: 0; }
  .tema-text {
    font-size: 13px; color: #8b949e; line-height: 1.4;
    overflow: hidden; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }

  /* Body */
  .body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 20px; }
  .section { display: flex; flex-direction: column; gap: 8px; }
  .section-label {
    font-size: 11px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: #58a6ff;
  }
  .toggle-group { display: flex; gap: 8px; flex-wrap: wrap; }
  .toggle {
    flex: 1; min-width: 90px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    padding: 10px 12px; background: #161b22; border: 1px solid #2a3441;
    border-radius: 10px; color: #8b949e; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all .15s ease; font-family: inherit;
  }
  .toggle:hover:not(:disabled) { background: #1e2837; border-color: #3d4f63; color: #c9d1d9; }
  .toggle.active { background: rgba(88,166,255,.12); border-color: #58a6ff; color: #58a6ff; font-weight: 600; }
  .model-toggle { padding: 12px 14px; }
  .sublabel { font-size: 10px; font-weight: 400; color: #6e7681; letter-spacing: .02em; }
  .toggle.flash-active .sublabel { color: rgba(88,166,255,.7); }
  .toggle.pro-active { background: rgba(163,113,247,.12); border-color: #a371f7; color: #a371f7; }
  .toggle.pro-active .sublabel { color: rgba(163,113,247,.7); }

  /* Summary */
  .summary {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: 12px; background: rgba(255,255,255,.02);
    border: 1px solid #1e2837; border-radius: 10px;
  }
  .summary-chip {
    font-size: 11px; font-weight: 500; color: #8b949e;
    background: #161b22; border: 1px solid #2a3441;
    border-radius: 100px; padding: 3px 10px;
  }

  /* Footer */
  .footer {
    padding: 16px 20px; border-top: 1px solid #1e2837;
    background: #0d1117; display: flex; flex-direction: column; gap: 10px;
  }
  .btn-generar {
    width: 100%; padding: 15px; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: all .2s ease;
    background: linear-gradient(135deg, #1f6feb, #388bfd);
    color: #fff; box-shadow: 0 4px 24px rgba(56,139,253,.3);
    letter-spacing: .01em;
  }
  .btn-generar:hover:not(:disabled) {
    background: linear-gradient(135deg, #388bfd, #58a6ff);
    box-shadow: 0 6px 28px rgba(88,166,255,.4); transform: translateY(-1px);
  }
  .btn-generar:active:not(:disabled) { transform: translateY(0); }
  .btn-generar:disabled { opacity: .7; cursor: not-allowed; transform: none; }
  .btn-generar.loading { background: linear-gradient(135deg, #1a3a5c, #1f6feb); box-shadow: none; }
  .btn-generar.success { background: linear-gradient(135deg, #166534, #16a34a); box-shadow: 0 4px 20px rgba(22,163,74,.3); }

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
