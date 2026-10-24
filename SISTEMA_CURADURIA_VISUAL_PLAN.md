# PLAN MAESTRO: SISTEMA DEFINITIVO DE CURADURÍA VISUAL Y EXHIBICIÓN TGP
> **Contexto:** Astro 7.4 + Google Cloud Run + Wikimedia Commons + Gemini Flash
> **Objetivo:** Motor de pre-fetch de alta fidelidad, Hero cinemático 21:9 adaptativo en GSAP y Lightbox para desarrolladores con exportación en 2 vías (WebP + PDF).

---

## 📌 Checklist de Tareas

- [x] **1. Motor Pre-Fetch (`src/lib/wikiCuratorEngine.ts`)**
  - [x] Integrar `PROMPT_AGENTE_DOCUMENTALISTA` con Gemini Flash (`temperature: 0.2`) para traducir consultas en español a términos canónicos en inglés de Wikimedia Commons.
  - [x] Implementar consulta a Commons con `gsrlimit=40` y operadores CirrusSearch: `filetype:bitmap fileres:>1000 -intitle:map -intitle:svg -intitle:diagram`.
  - [x] Configurar `iiurlwidth=1600` y sanitización estricta de `extmetadata` (HTML strip, artista, créditos).
  - [x] Calcular ratio matemático `aspectRatio = width / height` y clasificaciones (`isLandscape`, `is16x9Plus`, `isUltrawide`).
  - [x] Clasificar licencias con flag `isCC0OrPublicDomain` y tipado semántico (`cc0`, `pd`, `cc-by`, `cc-by-sa`).
  - [x] Calcular estimación de ahorro de peso (`Raw MB -> WebP MB`).

- [x] **2. Componente Hero Cinemático (`src/components/WikiCinematicHero.astro`)**
  - [x] Formato Cinemax Max (`21:9` / `h-[88vh]` con barras anamórficas letterbox).
  - [x] Lógica GSAP adaptativa según cantidad de imágenes:
    - [x] $\le 4$ fotos: Contemplativo (`exposure: 5.5s`, `fade: 1.2s`, `ease: "sine.inOut"`, `scale: 1.06`).
    - [x] 5 a 8 fotos: Medio (`exposure: 3.6s`, `fade: 0.6s`, `scale: 1.075`).
    - [x] $> 8$ fotos (hasta 12): Rítmico (`exposure: 2.4s`, `fade: 0.35s`, `ease: "power3.inOut"`, `scale: 1.09`).
  - [x] Listener reactivo global `window.addEventListener('tgp:preview-batch', ...)` para actualizar el Hero en vivo sin recargar la página.

- [x] **3. Componente Developer Lightbox (`src/components/WikiDeveloperLightbox.astro`)**
  - [x] Barra de operaciones: Búsqueda (`New Search` / `Clean`), píldoras de filtro (`Todas`, `Solo CC0/PD`, `Solo 16:9+`) y botones de selección (`All`, `Top 12`, `Deselect`).
  - [x] Grilla viewport de 12 tarjetas en vista (4 columnas × 3 filas) dentro de contenedor `max-h-[720px] overflow-y-auto` con scrollbar estilizada.
  - [x] En cada tarjeta: Checkbox de selección, lupa para Modal HD y Pill Badge de licencia con código semántico de color.
  - [x] Lightbox Modal de alta resolución con metadatos completos y link a Commons.
  - [x] Contador en vivo de ahorro de peso (`Raw MB -> WebP MB`).
  - [x] Botón para copiar Frontmatter JSON/MDX al portapapeles.
  - [x] Botón "Probar en Hero" que dispara el evento global `tgp:preview-batch`.

- [x] **4. Botonera de Exportación Cloud Run (`src/pages/api/cloudrun-export.ts` y `/api/cloudrun-magazine-export`)**
  - [x] Drawer / Menú desplegable de exportación en el Lightbox.
  - [x] **Acción A (`zip-desktop-dual`)**: Conversión a `.webp` (calidad 82, max 1920px) + generación de `catalogo-referencia.pdf` con Veto Estético TGP -> descarga de archivo `.zip`.
  - [x] **Acción B (`drive-magazine-folder`)**: Envío del lote con `manifest.json` hacia Google Drive (`Asset Magazine Folder`).

- [x] **5. Página de Pruebas y Laboratorio Editorial (`src/pages/test-revista-curador.astro`)**
  - [x] Integrar `WikiCinematicHero` y `WikiDeveloperLightbox` comunicados en tiempo real.
  - [x] Endpoint reactivo `src/pages/api/wiki-curator-search.ts` para búsquedas en caliente.
  - [x] Pruebas y validación en vivo.

---
*(Nota: Este archivo fue creado para control y cotejo granular durante el desarrollo. Al finalizar el trabajo completo y ser aprobado por el usuario, se eliminará conforme al protocolo).*
