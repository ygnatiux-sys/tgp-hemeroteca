# Blueprint Desk-First: Cerebro Editorial TGP (`tgp-editorial-core/`)

> **Estado:** Fase Desk-First Local (Noviembre 2026) · **Cero deploy en la nube** · **Imprenta y SOMA v1.2 intactos**

---

## 1. Arquitectura en 3 Capas Locales

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 2 · MESA DE LUZ HITL (tgp-app / TGP Scriptorium)                      │
│ Astro + Islas Svelte en local (3001 / 4321 / 5173) y /tgp-app/             │
│ Consume por HTTP puro → POST http://127.0.0.1:8000/api/v1/curate           │
│ Botones dedicados por modo + selección humana de láminas aprobadas         │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │ JSON (HTTP / CORS)
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 1 · CEREBRO API LOCAL (tgp-editorial-core/ · Python 3.12 + FastAPI)   │
│ Puerto local: http://127.0.0.1:8000                                        │
│                                                                            │
│  1. Capa 0 (app/translator.py):                                            │
│     • google-genai async contra Vertex AI (project=tgp-mind, us-central1)  │
│     • ADC local (gcloud auth application-default login), cero API keys     │
│     • Modelo por defecto: gemini-2.5-flash (env TGP_CAPA0_MODEL + fallback)│
│     • Sin Grounding · Structured Output JSON + caché TTL en memoria        │
│                                                                            │
│  2. Motor de Archivos (app/search_archives.py) + Filtro (app/licensing.py):│
│     • Wikimedia Commons (CirrusSearch gsrlimit=40, iiurlwidth=1440)        │
│     • Wellcome Collection API v2 pública (IIIF normalizado a /full/1600,/) │
│     • Filtro comercial ESTRICTO: solo PD / PDM / CC0 / CC BY simple        │
│       (rechazo explícito de CC BY-SA, SA, NC, ND, GFDL, InC, NonFree)     │
│     • Protecciones portadas de SOMA v1.2: whitelist MIME anti-TIFF/OOM,    │
│       sanitización HTML, exclusión svg/flag/logo/locator, dedupe, score,   │
│       warnings forenses, backoff ante 429/5xx y semáforo de concurrencia   │
│     • 5 modos: magazines | ebooks_thesis | hero | remotion | medieval      │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │ 13 campos estándar + attribution_text
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 3 · IMPRENTA LOCAL / CLOUD RUN JOB (tgp-editorial-ebooks-job)         │
│ Repo hermano: C:\Users\ygnat\TGP alternative Ebook Run machine             │
│ Typst (A4/A5) + Pandoc EPUB3 · config/issue_XX_autor.json → r2://tgp-storage│
│ (Velikovsky #01 validado; próximo Cremo #02)                               │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Regla de Gobernanza frente a SOMA v1.2 (Legado)

- **Motor rector actual:** A partir de noviembre 2026, **`tgp-editorial-core/` es la fuente canónica de curaduría documental** para revistas, ebooks comerciales, cabeceras Hero y secuencias Remotion.
- **Legado preservado sin borrar:** `src/core/soma-engine.ts` (SOMA v1.2) y `src/lib/curator/wiki-smart-curator.ts` se conservan **intactos** en TypeScript como legado operativo para las rutas existentes del sitio mientras dure la transición Desk-First.
- **Portado de defensas probadas:** Las protecciones críticas de SOMA v1.2 (exclusión absoluta de `image/tiff` para evitar OOM, exclusión de banderas/logos/escudos/SVG, desduplicación por URL y registro de `warnings`) han sido portadas directamente a Python dentro de `tgp-editorial-core/app/`.
- **Resolución de solapamientos:** Ante cualquier discrepancia futura entre una consulta de SOMA y `tgp-editorial-core/`, **manda `tgp-editorial-core/`**.

---

## 3. Hoja de Ruta hacia Cloud Run (tras validar 10 ediciones en escritorio)

Cuando hayamos validado **10 ediciones completas** en escritorio local sin fricciones:

1. **Servicio Cloud Run propio e independiente (`tgp-editorial-core`):**
   - **No embutir Python dentro de `soma-argon-light`:** `soma-argon-light` (`src/cloud/server.ts`) es un servidor liviano en Node 22 (`node:22-slim`) con regla arquitectónica estricta de mantener la imagen mínima. Meter Python/FastAPI dentro rompería esa frontera.
   - En su lugar, `tgp-editorial-core/` se empaqueta en su propio `Dockerfile` sobre `python:3.12-slim` y se despliega como servicio independiente en Cloud Run (`--min-instances=0`, región `us-central1`, identidad IAM con permiso de Vertex AI sobre `tgp-mind`).
   - `soma-argon-light`, `tgp-app`, los bots de Telegram y los de Google Chat (`@asessor`, `@tgp-alternative`) lo consumirán por HTTP sin reescribir la lógica de búsqueda ni de licencias.
2. **Convivencia TGP Alternative (Svelte) vs. TGP Hemeroteca (Astro / Node):**
   - No existe conflicto de runtime porque `tgp-editorial-core/` expone HTTP + JSON puro; Svelte e islas cliente viven en el navegador y Astro/Hono en Node.
   - **Controles listos desde hoy en el código:**
     - `CORS_ORIGINS` configurable por variable de entorno (en local ya incluye `4321`, `3000`, `3001` y `5173` para `localhost` y `127.0.0.1`).
     - Cabecera opcional `X-TGP-Site` para trazar si la petición proviene de `tgp-alternative` o `tgp-hemeroteca` sin mezclar líneas editoriales.
     - Autenticación por cabecera `x-tgp-secret`: apagada en local (`TGP_REQUIRE_SECRET=0`) y activable con `TGP_REQUIRE_SECRET=1` + `TGP_SHARED_SECRET` al publicar en Cloud Run.

---

## 4. Salvaguardas Operativas y Legales

1. **Aislamiento de credenciales Vertex AI / ADC:**
   - El `.env` de la raíz del repositorio puede definir `GOOGLE_APPLICATION_CREDENTIALS` para los bots de `tgp-mind`. `tgp-editorial-core/` lee **únicamente su propio `.env`** (si existe), permitiendo aprovechar en local tu sesión `gcloud auth application-default login` del proyecto `tgp-mind` (`us-central1`), y en Cloud Run tomar la Service Account del servicio sin cambios de código.
   - `GET /health` reporta en vivo `auth_mode`, `adc_principal`, `vertex_ready` y `capa0_model`.
2. **Filtro comercial estricto (`app/licensing.py`):**
   - Acepta exclusivamente: `Public domain` (`PD`, `PD-*`, `PDM`), `CC0` (`CC0 1.0`, `CC-0`) y `CC BY` (atribución simple).
   - Rechaza de forma explícita: cualquier variante `SA` (`CC BY-SA`, `ShareAlike`), `NC`, `ND`, `GFDL`, `In copyright` (`InC`), `Fair Use`, `NonFree=true` o `Restrictions` restrictivas, tanto en `extmetadata` de Wikimedia como en `license.id` de Wellcome Collection.
   - Devuelve `attribution_text` ya formateado para colofón de Typst/Pandoc.
   - *Nota editorial para la imprenta:* El filtro protege las **láminas visuales**. Los textos biográficos o cronológicos que resuman artículos de Wikipedia (`CC BY-SA`) deben redactarse como síntesis original propia (con revisión jurídica antes de la venta comercial) para no arrastrar la cláusula ShareAlike al libro.
3. **Honestidad material en Capa 0 (`editorial_line="alternative"`):**
   - Cuando la consulta parte de un término mítico o polémico en español (p. ej. *"pirámide de la Antártida"*), Capa 0 traduce hacia el referente geológico, arqueológico o museístico verificable en inglés (*Ellsworth Mountains*, *Heritage Range*, *Vinson Massif*) y deja asentada la realidad física de las fotografías devueltas en `context_note`.
