# BLUEPRINT_ISOLATION.md
## Migración: Single Docker Image → Servicios Aislados en Cloud Run
### The Great Puzzle Project · Arquitectura TGP-Mind Core
**Fecha de auditoría:** 2026-10-22 | **Auditor:** Antigravity (Arquitecto Cloud Senior / DevSecOps)
**Estado:** FASE 3.5 COMPLETADA — Despliegue Dual Aislado, Webhooks Telegram y Endpoints de Google Chat / Dialogflow CX Certificados en Producción.

---

## PARTE 1 — ESTADO ACTUAL DETECTADO

### 1.1 Repositorios y Proyectos GCP involucrados

| Repo / Carpeta | GCP Project | Propósito actual |
|---|---|---|
| `tgp-mind/` | `tgp-mind` | Dispatcher central multi-rol (Telegram + Chat + Cognitive + Twilio) |
| `tgp-alt-telegram/` | `tgp-paralelo-alternativo` | Fork de tgp-mind, rol = `telegram` exclusivo (@tgpAlternative_bot) |
| `tgp-alt-chat/` | `tgp-paralelo-alternativo` | Fork de tgp-mind, rol = `chat` exclusivo |
| `./` (Astro hemeroteca) | Cloudflare Pages | Web Astro + Keystatic → thegreatpuzzleproject.com |
| Web Alternative (repo separado) | Cloudflare Pages | Web Astro → alternative.thegreatpuzzleproject.com |

---

### 1.2 Servicios activos en Cloud Run (solo lectura — sin secretos expuestos)

#### Proyecto `tgp-mind` — us-central1

| Servicio | URL (sufijo hash) | Scaling | Timeout | Secrets SM |
|---|---|---|---|---|
| tgp-mind | tgp-mind-uzhmxe53dq-uc.a.run.app | min=0 max=5 / 1CPU / 512Mi | 120s | GEMINI_API_KEY via SM |
| tgp-mind-alternative | tgp-mind-alternative-uzhmxe53dq-uc.a.run.app | min=0 max=5 / 1CPU / 512Mi | 300s | GEMINI_API_KEY, GITHUB_TOKEN, TGP_RUN_SECRET via SM |
| tgp-mind-webhook | tgp-mind-webhook-uzhmxe53dq-uc.a.run.app | min=0 max=20 / 2CPU / 1Gi | 300s | AGENT_ID, PROJECT_ID, TWILIO_* via SM (solo SM) |
| tgp-app | tgp-app-uzhmxe53dq-uc.a.run.app | — | — | — |
| remotion-engine | remotion-engine-uzhmxe53dq-uc.a.run.app | — | — | Referenciado en código (comentado) |
| tgp-neo-grafo | tgp-neo-grafo-uzhmxe53dq-uc.a.run.app | — | — | Tool activa en tgp-alt-telegram |
| tgp-opengraph | tgp-opengraph-uzhmxe53dq-uc.a.run.app | — | — | — |
| tgp-picker-api | tgp-picker-api-uzhmxe53dq-uc.a.run.app | — | — | — |
| tgp-scriptorium-faas | tgp-scriptorium-faas-uzhmxe53dq-uc.a.run.app | — | — | — |
| tgp-vault-run | tgp-vault-run-uzhmxe53dq-uc.a.run.app | — | — | — |
| tgp-veo | tgp-veo-uzhmxe53dq-uc.a.run.app | — | — | — |

#### Proyecto `tgp-paralelo-alternativo` — us-central1

| Servicio | URL (sufijo hash) | Scaling | Timeout | Secrets SM |
|---|---|---|---|---|
| tgp-alt-telegram | tgp-alt-telegram-plwe4utu4q-uc.a.run.app | min=0 max=3 / 1CPU / 512Mi | 300s | NINGUNO — todo plain text |
| tgp-alt-chat | tgp-alt-chat-plwe4utu4q-uc.a.run.app | min=0 max=3 / 1CPU / 512Mi | 300s | NINGUNO — todo plain text |

> **HALLAZGO CRITICO DE SEGURIDAD:** `tgp-alt-telegram` y `tgp-alt-chat` inyectan GEMINI_API_KEY, TGP_MIND_API_KEY, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY como variables planas (visibles en logs). En tgp-mind principal ya estan en Secret Manager. ACCION BLOQUEANTE antes de Fase 2.

---

### 1.3 Acoplamiento duro detectado (Hardcoding)

#### URLs de Cloud Run hardcodeadas en código fuente

| Archivo | Línea | Valor hardcodeado | Criticidad |
|---|---|---|---|
| tgp-mind/src/routes/telegram.routes.ts | 101 | https://tgp-mind-713934653057.us-central1.run.app | CRITICA — base URL para setWebhook de 5 bots. URL MUERTA (hash activo: uzhmxe53dq) |
| src/pages/tgp-app.astro | 88 | https://tgp-mind-713934653057.us-central1.run.app | MEDIA — href visual |
| src/lib/google-picker.ts | 45 | https://tgp-mind-713934653057.us-central1.run.app | MEDIA — fallback URL de API |
| tgp-mind/src/routes/twilio.routes.ts | 75,81 | alternative.thegreatpuzzleproject.com/... | ALTA — URL de destino para posts desde Twilio |

#### Repos GitHub hardcodeados como fallback (8 archivos)

| Archivo | Valor default hardcodeado |
|---|---|
| src/telegram/handlers/callback.handler.ts (×2) | ygnatiux-sys/tgp-hemeroteca y ygnatiux-sys/tgp-webfinal2026 |
| src/telegram/handlers/command.handler.ts | ygnatiux-sys/tgp-hemeroteca |
| src/servicios/publicacion.ts | ygnatiux-sys/tgp-hemeroteca |
| src/services/github-keystatic.service.ts | ygnatiux-sys/tgp-hemeroteca |
| src/ia/compagnon-genkit.ts | ambos repos según destino |
| src/chat/tool-registry.ts | ambos repos según contexto |
| src/chat/cards-v2-builder.ts | tgp-webfinal2026 / tgp-hemeroteca |
| src/ia/tools/tool-generar-ensayo.ts | ygnatiux-sys/tgp-hemeroteca |

#### Constantes hardcodeadas en código

| Constante | Valor | Archivo |
|---|---|---|
| XAVIER_CHAT_ID | 7886507052 | src/config/env.ts:19 |
| DIALOGFLOW_AGENT_ID | 7cf1a08f-1b45-48f4-be5f-155eb3ee2848 | src/config/env.ts:24 |
| CHAT_SPACE_TECNICO | spaces/AAQAkHxZYn0 | src/config/env.ts:43 |
| PANLINGUA_DB_ID | a4c11340-cec3-4273-b6d0-5691a100f09a | src/ia/tools/tool-panlingua.ts:13 |
| ProjectId Firestore | 'tgp-mind' | companion-memory.ts:51, master-auth.ts:37,85 |

#### Colecciones Firestore con nombre fijo (sin prefijo de silo)

| Colección | Módulo |
|---|---|
| tgp_companion_sessions | companion-memory.ts — sesiones de todos los bots mezcladas |
| tgp_foundational_memory | companion-memory.ts — memoria fundacional compartida |
| tgp_dossiers_alternative | archive-rag.service.ts — nombre fijo pese a ser del silo alternative |
| tgp_config/authorized_users | master-auth.ts — lista blanca global |

#### Lógica de branching entre silos embebida en 8 archivos

Patrón repetido en 8 archivos:

    destino === 'alternative'
      ? process.env.GITHUB_REPO || 'ygnatiux-sys/tgp-webfinal2026'
      : process.env.GITHUB_REPO_HEMEROTECA || 'ygnatiux-sys/tgp-hemeroteca'

Con la imagen única + SITE_ID, este patrón desaparece del código por completo.

---

### 1.4 Estado del Dockerfile y duplicación de código

Dockerfile IDENTICO en tgp-mind/, tgp-alt-telegram/ y tgp-alt-chat/:
- Multi-stage build node:22-alpine builder → runtime
- ENV PORT=8080 en imagen (colisión con fallback '3001' en tgp-mind/env.ts, corregida en forks)
- SERVICE_ROLE ya existe como mecanismo de branching en index.ts — es el embrión del futuro SITE_ID

Cuantificación de la duplicación:
- 105 líneas de diferencia vs 3865 líneas de código compartido = 97% de código duplicado

Únicas diferencias reales:
1. env.ts: tokens Telegram colapsados a 1 bot en las forks
2. compagnon-genkit.ts: set de herramientas del rol `assistant` ampliado en forks
3. Routes: las forks solo montan el subset de rutas que les corresponde

---

### 1.5 Acoplamiento Keystatic / Astro

- astro.config.mjs: site: 'https://thegreatpuzzleproject.com' — solo hemeroteca
- PUBLIC_TGP_MIND_URL en .env apunta a tgp-mind (hemeroteca) — no existe equivalente para alternative
- El repo tgp-webfinal2026 (web Alternative) no está en este workspace → desconocido hasta Fase 3

---

## PARTE 2 — ARQUITECTURA OBJETIVO

### 2.1 Principio rector: Una imagen, dos contextos

    Artifact Registry: tgp-mind / tgp-mind-core
    Imagen única: sha256:XXXXXXXX
                         |
              ┌──────────┴────────────┐
              ▼                       ▼
    tgp-mind-hemeroteca     tgp-mind-alternative
    (Cloud Run)              (Cloud Run)
    SITE_ID=hemeroteca       SITE_ID=alternative
    TELEGRAM_TOKEN=OMNI      TELEGRAM_TOKEN=ALT
    GITHUB_REPO=tgp-         GITHUB_REPO=tgp-
      hemeroteca               webfinal2026
    FIREBASE_PREFIX=hemer_   FIREBASE_PREFIX=alt_
    R2_PREFIX=hemeroteca/    R2_PREFIX=alternative/
              |                       |
              ▼                       ▼
    GitHub: tgp-hemeroteca    GitHub: tgp-webfinal2026
    CF Pages: thegreatpuz...  CF Pages: alternative.thegreat...

### 2.2 Variable maestra de identidad: SITE_ID

| Variable | Hemeroteca | Alternative |
|---|---|---|
| SITE_ID | hemeroteca | alternative |
| TELEGRAM_TOKEN | Token @Analista_IMG_bot | Token @tgpAlternative_bot |
| TELEGRAM_BOT_NAME | Analista_IMG_bot | tgpAlternative_bot |
| GITHUB_REPO | ygnatiux-sys/tgp-hemeroteca | ygnatiux-sys/tgp-webfinal2026 |
| GITHUB_TOKEN | PAT/App hemeroteca | PAT/App alternative |
| KEYSTATIC_GITHUB_CLIENT_ID | OAuth App hemeroteca | OAuth App alternative |
| FIREBASE_COLLECTION_PREFIX | hemer_ | alt_ |
| R2_PREFIX | hemeroteca/ | alternative/ |
| SERVICE_URL | URL Cloud Run propia | URL Cloud Run propia |
| SITE_DOMAIN | thegreatpuzzleproject.com | alternative.thegreatpuzzleproject.com |

---

## PARTE 3 — PLAN DE EJECUCIÓN (3+1 FASES)

---

### FASE 1: Desacoplamiento del Código (Config Agnóstica por SITE_ID)

Objetivo: Eliminar toda la lógica `destino === 'alternative'` del código. Cero forks, cero copias.

#### 1.1 Nuevo módulo tgp-mind/src/config/site.ts (archivo NUEVO — no toca nada existente)

    // src/config/site.ts
    import 'dotenv/config';
    export const SITE_ID = (process.env.SITE_ID || 'hemeroteca').toLowerCase();
    export const IS_HEMEROTECA = SITE_ID === 'hemeroteca';
    export const IS_ALTERNATIVE = SITE_ID === 'alternative';
    export const SITE_DOMAIN = process.env.SITE_DOMAIN
      || (IS_ALTERNATIVE ? 'alternative.thegreatpuzzleproject.com' : 'thegreatpuzzleproject.com');
    export const GITHUB_REPO = process.env.GITHUB_REPO
      || (IS_ALTERNATIVE ? 'ygnatiux-sys/tgp-webfinal2026' : 'ygnatiux-sys/tgp-hemeroteca');
    export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    export const FIREBASE_COLLECTION_PREFIX = process.env.FIREBASE_COLLECTION_PREFIX
      || (IS_ALTERNATIVE ? 'alt_' : 'hemer_');
    export const R2_PREFIX = process.env.R2_PREFIX
      || (IS_ALTERNATIVE ? 'alternative/' : 'hemeroteca/');
    export const SERVICE_URL = process.env.SERVICE_URL || '';

#### 1.2 Parche en src/routes/telegram.routes.ts línea 101
- SACA: const baseUrl = 'https://tgp-mind-713934653057.us-central1.run.app';
- PONE: const baseUrl = process.env.SERVICE_URL || '';

#### 1.3 Parche en los 8 archivos con lógica ternaria de silo
- SACA: Toda expresión process.env.GITHUB_REPO_HEMEROTECA || 'ygnatiux-sys/...' y su ternaria
- PONE: import { GITHUB_REPO, GITHUB_TOKEN } from '../config/site.js';
- Archivos: servicios/publicacion.ts, services/github-keystatic.service.ts, ia/compagnon-genkit.ts,
  chat/tool-registry.ts, chat/cards-v2-builder.ts, telegram/handlers/callback.handler.ts,
  telegram/handlers/command.handler.ts, ia/tools/tool-generar-ensayo.ts

#### 1.4 Nuevo endpoint /health en index.ts

    app.get('/health', (c) => c.json({
      status: 'ok',
      site_id: SITE_ID,
      role: ROLE,
      service_url: SERVICE_URL,
      github_repo: GITHUB_REPO,
      ts: new Date().toISOString(),
      uptime: process.uptime(),
    }));

Online Check Fase 1:
    GET /health → { "site_id": "hemeroteca", "github_repo": "ygnatiux-sys/tgp-hemeroteca" }
    GET /health → { "site_id": "alternative", "github_repo": "ygnatiux-sys/tgp-webfinal2026" }

---

### FASE 2: Imagen Única y Deploy Dual Aislado en Cloud Run

Objetivo: Un solo docker build, dos gcloud run deploy con variables distintas.

#### 2.1 tgp-mind/env.hemeroteca.yaml (variables no secretas)

    SITE_ID: "hemeroteca"
    SERVICE_ROLE: "all"
    SITE_DOMAIN: "thegreatpuzzleproject.com"
    GITHUB_REPO: "ygnatiux-sys/tgp-hemeroteca"
    GITHUB_BRANCH: "main"
    FIREBASE_COLLECTION_PREFIX: "hemer_"
    R2_PREFIX: "hemeroteca/"
    R2_BUCKET_NAME: "tgp-storage"
    R2_PUBLIC_DOMAIN: "https://storage.thegreatpuzzleproject.com"
    TELEGRAM_BOT_NAME: "Analista_IMG_bot"
    MINI_APP_URL: "https://thegreatpuzzleproject.com/bot-selector"
    DIALOGFLOW_PROJECT_ID: "tgp-mind"
    DIALOGFLOW_LOCATION: "us-central1"

#### 2.2 tgp-mind/env.alternative.yaml (variables no secretas)

    SITE_ID: "alternative"
    SERVICE_ROLE: "all"
    SITE_DOMAIN: "alternative.thegreatpuzzleproject.com"
    GITHUB_REPO: "ygnatiux-sys/tgp-webfinal2026"
    GITHUB_BRANCH: "main"
    FIREBASE_COLLECTION_PREFIX: "alt_"
    R2_PREFIX: "alternative/"
    R2_BUCKET_NAME: "tgp-storage"
    R2_PUBLIC_DOMAIN: "https://storage.thegreatpuzzleproject.com"
    TELEGRAM_BOT_NAME: "tgpAlternative_bot"
    MINI_APP_URL: "https://alternative.thegreatpuzzleproject.com/bot-selector"
    DIALOGFLOW_PROJECT_ID: "tgp-mind"
    DIALOGFLOW_LOCATION: "us-central1"

#### 2.3 cloudbuild.yaml — Build único, deploy dual

    steps:
      - name: gcr.io/cloud-builders/docker
        args: [build, -t, us-central1-docker.pkg.dev/tgp-mind/tgp-mind-core/tgp-mind-core:$COMMIT_SHA, ./tgp-mind]
      - name: gcr.io/cloud-builders/docker
        args: [push, us-central1-docker.pkg.dev/tgp-mind/tgp-mind-core/tgp-mind-core:$COMMIT_SHA]
      - name: gcr.io/google.com/cloudsdktool/cloud-sdk
        entrypoint: gcloud
        args: [run, deploy, tgp-mind-hemeroteca,
               --image, us-central1-docker.pkg.dev/tgp-mind/tgp-mind-core/tgp-mind-core:$COMMIT_SHA,
               --env-vars-file, tgp-mind/env.hemeroteca.yaml,
               --region, us-central1, --project, tgp-mind]
      - name: gcr.io/google.com/cloudsdktool/cloud-sdk
        entrypoint: gcloud
        args: [run, deploy, tgp-mind-alternative,
               --image, us-central1-docker.pkg.dev/tgp-mind/tgp-mind-core/tgp-mind-core:$COMMIT_SHA,
               --env-vars-file, tgp-mind/env.alternative.yaml,
               --region, us-central1, --project, tgp-mind]

#### 2.4 Migración urgente a Secret Manager (ambos servicios)

| Secreto | Estado actual | Acción |
|---|---|---|
| GEMINI_API_KEY | SM en tgp-mind, PLAIN en tgp-alt-* | Migrar tgp-alt-* a SM — URGENTE |
| TELEGRAM_TOKEN | plain en todos | Migrar a SM |
| GITHUB_TOKEN | SM en tgp-mind-alternative, plain en tgp-alt-chat | Unificar en SM |
| TGP_MIND_API_KEY / TGP_MASTER_KEY | plain en tgp-alt-* | Migrar a SM |
| R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY | plain en tgp-alt-* | Migrar a SM |

Online Check Fase 2:
    curl https://tgp-mind-hemeroteca-xxx.run.app/health | jq .site_id   # "hemeroteca"
    curl https://tgp-mind-alternative-xxx.run.app/health | jq .site_id  # "alternative"
    curl https://api.telegram.org/bot$OMNI_TOKEN/getWebhookInfo | jq .url
    # "https://tgp-mind-hemeroteca-xxx.run.app/telegram-webhook"

---

### FASE 3: Aislamiento de Webhooks Telegram, Google Chat y Separación de Credenciales

**Estado:** EJECUTADO Y CERTIFICADO ONLINE (22 de Octubre de 2026)

#### 3.1 Aislamiento de Webhooks Telegram (100% Certificado)

Se configuraron las puertas de enlace dedicadas mediante `setWebhook` y se certificó con `getWebhookInfo` (0 updates pendientes, 0 errores):

| Bot | Handle | Servicio Cloud Run Destino | URL Activa del Webhook | Estado Telegram |
|---|---|---|---|---|
| **Alternative** | `@tgpAlternative_bot` | `tgp-mind-alternative` | `https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/api/telegram/alternative/webhook` | `Webhook was set` (OK) |
| **Omni Bot** | `@Analista_IMG_bot` | `tgp-mind` (Hemeroteca) | `https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/omni/webhook` | `Webhook is already set` (OK) |
| **TGP Redes** | `@TGP_redsocial_bot` | `tgp-mind` (Hemeroteca) | `https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/redes/webhook` | `Webhook is already set` (OK) |
| **Xavier Assistant** | `@tgp_cloud_bot` | `tgp-mind` (Hemeroteca) | `https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/assistant/webhook` | `Webhook is already set` (OK) |
| **TGP Liminal** | `@UXliminal_bot` | `tgp-mind` (Hemeroteca) | `https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/liminal/webhook` | `Webhook is already set` (OK) |
| **Agente Erudito** | `@AgenteEruditoBot` | `tgp-mind` (Hemeroteca) | `https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/erudito/webhook` | `Webhook is already set` (OK) |

#### 3.1.B Enrutamiento Google Chat y Dialogflow CX (100% Certificado)

- **Google Chat @TGP-Alternative:** Endpoint conectado a `https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/api/chat/webhook`.
  *Diagnóstico resuelto:* El servicio antiguo `tgp-alt-chat` arrojaba `401 Unauthorized` por exigencia de token en headers; el nuevo Cloud Run `tgp-mind-alternative` cuenta con bypass de autenticación para Google Workspace y responde `200 OK` con Cards V2 interactivas.
- **Dialogflow CX (Mesa de Redacción):** Endpoints `/api/cx/submit-draft`, `/cx-tool-wikimedia` y `/cx-tool-panlingua` operativos.
- **DECISIÓN OPERATIVA MANDATORIA:** El servicio `tgp-alt-chat` en `tgp-paralelo-alternativo` permanece **INTACTO Y OPERATIVO** como resguardo de estabilidad operativa. No se descomisiona.

#### 3.2 Separación de OAuth Apps de Keystatic por Web

Objetivo: Un OAuth App → una web Astro (Cero permisos cruzados entre repositorios y cero errores `redirect_uri_mismatch`).

1. **Hemeroteca (`ygnatiux-sys/tgp-hemeroteca`):**
   - GitHub OAuth App: `TGP Hemeroteca CMS`
   - Homepage URL: `https://thegreatpuzzleproject.com`
   - Authorization callback URL: `https://thegreatpuzzleproject.com/api/keystatic/github/oauth/callback`
   - Variables Cloudflare Pages: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`.

2. **Alternative (`ygnatiux-sys/tgp-webfinal2026`):**
   - GitHub OAuth App: `TGP Alternative CMS`
   - Homepage URL: `https://alternative.thegreatpuzzleproject.com`
   - Authorization callback URL: `https://alternative.thegreatpuzzleproject.com/api/keystatic/github/oauth/callback`
   - Variables Cloudflare Pages: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`.
   - *Ajuste en `keystatic.config.tsx` de Alternative:* Configurar el modo GitHub condicional (`storage: isLocal ? { kind: 'local' } : { kind: 'github', repo: 'ygnatiux-sys/tgp-webfinal2026' }`).

#### 3.3 Colecciones Firestore por prefijo de SITE_ID (100% Operativo)

- Hemeroteca: Prefijo `hemer_` (`hemer_companion_sessions`, `hemer_dossiers`).
- Alternative: Prefijo `alt_` (`alt_companion_sessions`, `alt_dossiers`).
- Storage R2: `hemeroteca/` vs `alternative/`.
- Cloudflare D1: Prefijo de clave `hemeroteca:` vs `alternative:`.

---

### FASE 4: Orquestación con Google Cloud Workflows (Pipeline Manager)

Propósito: Cloud Workflows NO maneja respuestas síncronas de chat (latencia inaceptable).
Rol exclusivo: Manager de Pipelines Pesados con esperas largas, reintentos por paso
y reporte final al bot.

Casos de uso:
- Generación de ensayo completo (AI → R2 → commit → notificación): 60-180s
- Procesamiento batch de imágenes
- Auditoría de salud programada de ambos servicios
- Flujos de publicación con garantía de exactly-once (sin commits duplicados)

#### 4.1 tgp-mind/workflow-manager.yaml

    # Deploy:
    #   gcloud workflows deploy tgp-mind-workflow-manager \
    #     --source=tgp-mind/workflow-manager.yaml \
    #     --location=us-central1 --project=tgp-mind

    main:
      params: [args]
      steps:

        - validate_args:
            steps:
              - check_url:
                  switch:
                    - condition: ${not("target_service_url" in args)}
                      raise: "Falta parametro target_service_url"

        - health_check:
            try:
              steps:
                - call_health:
                    call: http.get
                    args:
                      url: ${args.target_service_url + "/health"}
                      timeout: 30
                    result: health_response
                - check_healthy:
                    switch:
                      - condition: ${health_response.code != 200}
                        raise: ${"Servicio no saludable: " + string(health_response.code)}
            retry:
              predicate: ${default_retry_predicate}
              max_retries: 5
              backoff:
                initial_delay: 2
                max_delay: 30
                multiplier: 2

        - generate_content:
            try:
              call: http.post
              args:
                url: ${args.target_service_url + "/tasks/generate"}
                auth:
                  type: OIDC
                body: ${args.payload}
                timeout: 120
              result: generate_result
            retry:
              predicate: ${default_retry_predicate}
              max_retries: 3
              backoff:
                initial_delay: 5
                max_delay: 60
                multiplier: 2

        - upload_to_r2:
            try:
              call: http.post
              args:
                url: ${args.target_service_url + "/tasks/storage-r2"}
                auth:
                  type: OIDC
                body:
                  content: ${generate_result.body.content}
                  slug: ${generate_result.body.slug}
                  site_id: ${health_response.body.site_id}
                timeout: 60
              result: r2_result
            retry:
              predicate: ${default_retry_predicate}
              max_retries: 3
              backoff:
                initial_delay: 3
                max_delay: 30
                multiplier: 2

        - commit_to_keystatic:
            try:
              call: http.post
              args:
                url: ${args.target_service_url + "/tasks/commit-keystatic"}
                auth:
                  type: OIDC
                body:
                  content: ${generate_result.body.content}
                  images: ${r2_result.body.urls}
                  slug: ${generate_result.body.slug}
                timeout: 60
              result: commit_result
            retry:
              predicate: ${default_retry_predicate}
              max_retries: 3
              backoff:
                initial_delay: 5
                max_delay: 60
                multiplier: 2

        - send_report:
            call: http.post
            args:
              url: ${args.target_service_url + "/tasks/notify-bot"}
              auth:
                type: OIDC
              body:
                chat_id: ${args.payload.chatId}
                status: "success"
                commit_url: ${commit_result.body.commitUrl}
                post_url: ${commit_result.body.postUrl}
                slug: ${generate_result.body.slug}
              timeout: 30
            result: notify_result

        - return_result:
            return:
              status: "completed"
              site_id: ${health_response.body.site_id}
              slug: ${generate_result.body.slug}
              commit_url: ${commit_result.body.commitUrl}
              post_url: ${commit_result.body.postUrl}

    default_retry_predicate:
      params: [e]
      steps:
        - check_retryable:
            switch:
              - condition: ${e.code == 429 or e.code == 503 or e.code == 502}
                return: true
            return: false

#### 4.2 Endpoints /tasks/* que el contenedor debe exponer

| Endpoint | Método | Descripción | Idempotencia |
|---|---|---|---|
| /health | GET | Salud + SITE_ID | N/A |
| /tasks/generate | POST | Genera contenido con IA | Por slug en Firestore |
| /tasks/storage-r2 | POST | Sube imágenes a R2 | Por hash de contenido |
| /tasks/commit-keystatic | POST | Commit a GitHub vía Keystatic | Por SHA de commit en Firestore |
| /tasks/notify-bot | POST | Mensaje final al bot Telegram | No crítica |

REGLA DE IDEMPOTENCIA OBLIGATORIA: Cada endpoint /tasks/* verifica en Firestore si ya procesó
ese slug. Si existe, retorna el resultado anterior sin re-ejecutar.

#### 4.3 Service Account dedicada para Workflows (OIDC)

    gcloud iam service-accounts create tgp-workflows-runner \
      --project=tgp-mind --display-name="TGP Workflows Runner"

    gcloud run services add-iam-policy-binding tgp-mind-hemeroteca \
      --member="serviceAccount:tgp-workflows-runner@tgp-mind.iam.gserviceaccount.com" \
      --role="roles/run.invoker" --region=us-central1

    gcloud run services add-iam-policy-binding tgp-mind-alternative \
      --member="serviceAccount:tgp-workflows-runner@tgp-mind.iam.gserviceaccount.com" \
      --role="roles/run.invoker" --region=us-central1

Online Check Fase 4:
    gcloud workflows run tgp-mind-workflow-manager \
      --data='{"target_service_url":"https://tgp-mind-hemeroteca-xxx.run.app","task":"health_only","payload":{"chatId":0}}' \
      --location=us-central1
    # → status: "completed", site_id: "hemeroteca"

---

## PARTE 4 — VARIABLES CRÍTICAS ANTES DE INICIAR FASE 1

| Variable | Existe hoy | Acción requerida |
|---|---|---|
| SITE_ID | NO | CREAR — define toda la identidad del contenedor |
| SERVICE_URL | NO | CREAR — reemplaza URL hardcodeada en telegram.routes.ts:101 |
| FIREBASE_COLLECTION_PREFIX | NO | DEFINIR antes de Fase 1 — evita mezcla de sesiones |
| R2_PREFIX | NO | DEFINIR — evita colisión de paths en R2 |
| TELEGRAM_TOKEN (hemeroteca) | SI como OMNI_TOKEN plain | Normalizar en env.hemeroteca.yaml |
| TELEGRAM_TOKEN (alternative) | SI como TELEGRAM_BOT_TOKEN plain | Mantener, migrar a SM |
| GITHUB_REPO (hemeroteca) | SI en plain | Verificar valor, mover a env.hemeroteca.yaml |
| GITHUB_REPO (alternative) | SI en plain | Verificar valor, mover a env.alternative.yaml |
| GITHUB_TOKEN (hemeroteca) | SI en SM (tgp-mind-alternative) | Crear SM en nuevo servicio |
| GITHUB_TOKEN (alternative) | SI como GITHUB_TOKEN_ALTERNATIVE plain | MIGRAR A SM URGENTE |
| GEMINI_API_KEY en SM | SI solo en tgp-mind | REPLICAR SM a tgp-alt-* — BLOQUEANTE |
| KEYSTATIC_GITHUB_CLIENT_ID (alt) | DESCONOCIDO | Auditar repo tgp-webfinal2026 en Fase 3 |
| KEYSTATIC_SECRET (alt) | DESCONOCIDO | Crear nueva OAuth App en GitHub para Fase 3 |

### Deuda técnica a resolver antes o durante Fase 1

1. [CRITICA] URL legacy muerta en telegram.routes.ts:101 → reemplazar con SERVICE_URL
2. [CRITICA] GEMINI_API_KEY + R2 keys en plain en tgp-alt-telegram y tgp-alt-chat → Secret Manager
3. [ALTA]    XAVIER_CHAT_ID hardcodeado → migrar a env var ADMIN_CHAT_ID
4. [ALTA]    DIALOGFLOW_AGENT_ID hardcodeado → mover a Secret Manager
5. [MEDIA]   PANLINGUA_DB_ID hardcodeado → verificar env var en producción

---

## RESUMEN DE RIESGOS

| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Cold start rompe webhook durante deploy | MEDIA | ALTA | --min-instances=1 en ventana de migración |
| Dos bots responden al mismo mensaje en transición | BAJA | ALTA | Apagar webhook viejo antes de activar nuevo |
| Colisión de colecciones Firestore entre silos | BAJA | MEDIA | Prefijo antes de apagar servicio unificado |
| Commit duplicado si Workflows reintenta | MEDIA | ALTA | Idempotencia por slug en Firestore |
| R2 path collision durante migración | BAJA | BAJA | R2_PREFIX lo aísla desde Fase 2 |

---

---

## PARTE 5 — REGISTRO DE EJECUCIÓN Y CERTIFICACIÓN TÉCNICA (FASES 1 A 3.5)

### 5.1 Fase 1: Desacoplamiento Local y Fail-Fast (`tgp-mind`)
- **Implementación:** Creado `src/config/site.ts` con tipado estricto `SITE_ID: 'hemeroteca' | 'alternative'`.
- **Candado D1 (Panlingua):** `D1_NAMESPACE_PREFIX = `${SITE_ID}:`` con prefijo dinámico y fallback retrocompatible en `src/storage/d1.ts`.
- **Aislamiento Storage & BD:** Prefijos dinámicos en Firestore (`hemer_` / `alt_`) y R2 (`hemeroteca/` / `alternative/`).
- **Cards V2 & Genkit:** Absorbidas 105 líneas divergentes; incorporada acción interactiva `publish_draft_now`.
- **Verificación:** TypeScript 0 errores (`npm run build`). Endpoint `/health` expone estado, `siteId`, prefixes y namespaces.

### 5.2 Fase 2: Imagen Canónica y Despliegue Dual en Cloud Run
- **Build Canónico:** Cloud Build `us-central1-docker.pkg.dev/tgp-mind/cloud-run-source-deploy/tgp-mind-core:latest` (`sha256:14b704badb694f3da85ee8c04964d3863db80fcbae3a48f0e58d79fae8ae4a1b`).
- **Seguridad DevSecOps:** 100% secretos en Secret Manager (`--set-secrets` / `--update-secrets`). Cero credenciales en texto plano (`env.*.yaml` en `.gitignore`).
- **Servicios Activos:**
  - **Hemeroteca:** [https://tgp-mind-uzhmxe53dq-uc.a.run.app/health](https://tgp-mind-uzhmxe53dq-uc.a.run.app/health) (Revisión: `tgp-mind-00162-xf2`, `siteId: "hemeroteca"`).
  - **Alternative:** [https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/health](https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/health) (Revisión: `tgp-mind-alternative-00015-cww`, `siteId: "alternative"`).

### 5.3 Fase 3: Aislamiento y Certificación de Webhooks Telegram
Todos los bots han sido re-apuntados y certificados en vivo con `getWebhookInfo` (0 updates pendientes, 0 errores):
1. **@tgpAlternative_bot:** [Webhook Alternative](https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/api/telegram/alternative/webhook)
2. **@Analista_IMG_bot (Omni):** [Webhook Omni Hemeroteca](https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/omni/webhook)
3. **@TGP_redsocial_bot (Redes):** [Webhook Redes Hemeroteca](https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/redes/webhook)
4. **@tgp_cloud_bot (Assistant):** [Webhook Assistant Hemeroteca](https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/assistant/webhook)
5. **@UXliminal_bot (Liminal):** [Webhook Liminal Hemeroteca](https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/liminal/webhook)
6. **@AgenteEruditoBot (Erudito):** [Webhook Erudito Hemeroteca](https://tgp-mind-uzhmxe53dq-uc.a.run.app/api/telegram/erudito/webhook)

### 5.4 Fase 3.5: Enrutamiento de Google Chat y Dialogflow CX
- **Google Chat Webhook (@TGP-Alternative):** Enrutado a [https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/api/chat/webhook](https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/api/chat/webhook) con exención de autenticación 401 en `master-auth.ts`. Probado y validado en vivo en Google Workspace con respuestas interactivas.
- **Dialogflow CX:** Mapeados endpoints de redacción (`/api/cx/submit-draft`), Wikimedia (`/cx-tool-wikimedia`) y Panlingua D1 (`/cx-tool-panlingua`).
- **Protección de Código Heredado:** Los servicios `tgp-alt-chat` y `tgp-alt-telegram` en `tgp-paralelo-alternativo` se mantienen intactos y operativos por resguardo operativo.

### 5.5 Fase 3.8: Blindaje DevSecOps Final y Corrección de Imágenes Sintéticas
- **Resolución de Placeholder en Alternative:**
  - Se corrigió `src/pages/ensayos/[slug].astro` en `tgp-webfinal2026`: ahora `explicitCovers` captura `data.coverImage`, `data.heroUrl` y `data.gallery`, eliminando el salto falso al placeholder `1792044290145-53f05a9f.webp`.
  - Se actualizó el backend (`tool-registry.ts`) para incluir explícitamente `gallery: [coverImage]` y `heroUrl: coverImage` en `index.json` y el frontmatter.
  - Se parametrizó `siloPrefix` en R2 (`r2.ts`, `nanoBananaTool.ts`, `compagnon-genkit.ts`) para asegurar que el almacenamiento respete estrictamente `alternative/` vs `hemeroteca/`.
- **Tolerancia de Intents en Panlingua (`tool-panlingua.ts`):**
  - Soporte nativo para intents `'search'`, `'etymology'` y captura de concepto desde `(args as any).query`.
- **Blindaje Secret Manager (0% Secretos en Texto Plano):**
  - Creados y sincronizados 6 secretos en Secret Manager (`TGP_MASTER_KEY`, `VAULT_PIN`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `ZERNIO_API_KEY`, `PUBLIC_GOOGLE_PICKER_API_KEY`).
  - Variables de entorno en Cloud Run (`tgp-mind` y `tgp-mind-alternative`) depuradas: 100% de secretos mapeados desde Secret Manager (`valueFrom.secretKeyRef`).
  - Servicios activos y certificados en vivo:
    - **Hemeroteca:** [https://tgp-mind-uzhmxe53dq-uc.a.run.app/health](https://tgp-mind-uzhmxe53dq-uc.a.run.app/health) (Revisión: `tgp-mind-00165-56c`).
    - **Alternative:** [https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/health](https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app/health) (Revisión: `tgp-mind-alternative-00018-hnr`).