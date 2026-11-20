# PROTOCOLO EDITORIAL PERMANENTE · THE GREAT PUZZLE PROJECT (`EDITORIAL_WORKFLOW.md`)

Este archivo define el flujo operativo obligatorio para cualquier agente que trabaje en `tgp-hemeroteca` cada vez que el usuario solicite crear o producir un **libro, cuaderno, dossier o revista nueva**.

---

## 0. Pre-Vuelo Automático Obligatorio (Sin Pedir Comandos al Usuario)

Antes de responder con propuestas o iniciar la curaduría, el agente DEBE verificar en segundo plano si los dos servicios locales del taller están activos:

1. **Cerebro Curatorial (`tgp-editorial-core` en `http://127.0.0.1:8000/health`):**
   - Si no responde `200 OK`, el agente DEBE levantarlo automáticamente desde su terminal como proceso daemon en segundo plano (accesible desde el navegador del usuario):
     ```powershell
     cd C:\Users\ygnat\tgp-hemeroteca\tgp-editorial-core ; .\.venv\Scripts\Activate.ps1 ; uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
     ```
2. **Taller Web & Mesa de Luz (`Astro` en `http://localhost:4321/`):**
   - Si no responde, el agente DEBE levantarlo automáticamente desde su terminal como proceso daemon en segundo plano:
     ```powershell
     cd C:\Users\ygnat\tgp-hemeroteca ; npm run start
     ```

**Regla estricta:** Jamás le pidas al usuario que copie y pegue estos comandos en su consola si el agente puede iniciarlos directamente. Confirmá ambos endpoints online (`Core 8000: Online` y `:4321` activo) y entregá enlaces Markdown clickeables.

---

## Flujo de Producción en 4 Pasos (Con Freno Humano Obligatorio · HITL)

Está **prohibido** saltar etapas sin confirmación explícita del usuario. Entre cada paso existe una compuerta humana obligatoria:

### Paso 1 · Propuesta de Índice y Estructura `[FRENO HITL #1]`
- Definir número de edición (`issue_XX`), slug de R2 (ej. `002-cremo`), línea editorial (`alternative` u `official`), enfoque temático y tabla de capítulos/láminas sugeridas.
- **Detenerse y esperar la aprobación o ajustes del usuario** antes de pasar al Paso 2.

### Paso 2 · Curaduría Visual Semántica y Exportación a R2 `[FRENO HITL #2]`
- Entregar al usuario las **consultas exactas** para lanzar en `/curador-revista` (por ejemplo: `http://localhost:4321/curador-revista?q=...&line=alternative&mode=ebooks_thesis&issue=002-cremo`).
- Todas las búsquedas DEBEN ejecutarse a través de `tgp-editorial-core` (`POST http://127.0.0.1:8000/api/v1/curate`) con Capa 0 Gemini Flash (Vertex ADC) y **filtro comercial estricto**:
  - **Permitido únicamente:** `Public Domain` (`PD` / `PDM`), `CC0` y `CC BY`.
  - **Bloqueado siempre:** `CC BY-SA`, `NC`, `ND`, `GFDL` y material con restricciones de copyright.
- **Detenerse y esperar** a que el usuario seleccione manualmente las láminas en la Mesa de Luz, ingrese el slug de edición (`#wb-issue-slug`) y pulse el botón verde `#wb-btn-copy-press` (*"📋 Subir WebP a R2 y Copiar JSON Imprenta"*), confirmando la subida a `r2://tgp-storage/ediciones/<issueSlug>/plate_NN.webp` y entregando el JSON con URLs permanentes y `attribution_text` legal intacto.

### Paso 3 · Redacción del Manuscrito con Contexto Continuo `[FRENO HITL #3]`
- Redactar el manuscrito completo manteniendo continuidad argumental de principio a fin (siguiendo la matriz estilística de `GEMINI.md`, sin muletillas ni relleno retórico), en archivo `.md` o `config/issue_XX.json`.
- Insertar exclusivamente las URLs permanentes de `https://storage.thegreatpuzzleproject.com/...` aprobadas en el Paso 2 junto con su pie de figura y atribución legal (`attribution_text`).
- **Detenerse y esperar la lectura y aprobación del usuario** sobre el manuscrito antes de compilar.

### Paso 4 · Compilación Final (PDF / EPUB) y Publicación en `tgp-storage` `[CIERRE HITL #4]`
- Una vez aprobado el manuscrito:
  - Compilar el **PDF** (A4/A5 vía Typst o dossier rápido vía `/api/argon/light-pdf`) y el **EPUB3** (Pandoc) según corresponda a la edición.
  - Subir los binarios compilados (`.pdf`, `.epub`, portada `.webp`) a Cloudflare R2 (`r2://tgp-storage`, `tgp-pdf` o `tgp-epub`) sin almacenar archivos binarios pesados en el repositorio Git.
  - Registrar únicamente una ficha liviana (~1 KB, Zero-Bloat) en la colección `ediciones` (`src/content.config.ts`) con `title`, `subtitle`, `issueNumber`, `editorialLine`, `coverUrl`, `pdfA4Url`, `pdfA5Url`, `epubUrl`, `pages` y `publishedAt` para su exhibición inmediata en `/imprenta`.
