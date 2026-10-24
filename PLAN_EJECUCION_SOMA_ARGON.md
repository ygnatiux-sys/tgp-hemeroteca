# PLAN MAESTRO DE ARQUITECTURA Y DESPLIEGUE: SOMA v1.2 + ARGON (HYBRID CLOUD/DESK)

## 0. REGLAS DE ORO PARA EL AGENTE (CUMPLIMIENTO ESTRICTO)
1. **EJECUCIÓN POR TURNOS (STEP-BY-STEP):** Bajo ninguna circunstancia ejecutes dos fases en un mismo turno. Al terminar una fase, detente, muestra los archivos creados/modificados y espera la orden explícita del usuario.
2. **FRONTERA ESTRICTA DOCKER vs. DESKTOP:**
   - **EN CLOUD RUN (DOCKER):** Solo procesos livianos (`SOMA Wiki Engine v1.2`, `wiki-smart-curator.ts`, maquetadores estructurales JSON y generación de PDF mediante `pdfkit` + `sharp`).
   - **PROHIBICIÓN EN NUBE:** Queda terminantemente prohibido incluir `puppeteer`, `playwright`, `chromium`, `canvas` (nativo C++) o librerías pesadas de renderizado en las `dependencies` de producción que van al contenedor Docker.
   - **EN DESKTOP LOCAL:** Todo proceso pesado con `puppeteer` (renderizado HTML/CSS complejo de revista, capturas de alta densidad) vivirá en una carpeta aislada (`/src/desk-heavy/`) y se ejecutará únicamente en local (Acer Swift).
3. **CERO DEPENDENCIAS INNECESARIAS:** Motores basados en `fetch` nativo de Node 22+.
4. **BASE DOCKER NATIVA (NODE:22-SLIM):** Prohibido Alpine con `sharp` (evitar fallos con `musl`). Usar obligatoriamente `node:22-slim` sobre Debian `glibc`.
5. **PARÁMETROS CLOUD RUN:** Despliegue con `--memory 1Gi` (margen seguro para sharp + PDFKit), `--min-instances 0`, `--max-instances 2`, `--concurrency 4`, `--timeout 300s` sin tocar variables de entorno de otros bots.

---

## 1. ARQUITECTURA DE DIRECTORIOS OBJETIVO

```text
/
├── src/
│   ├── core/
│   │   └── soma-engine.ts          # SOMA WIKI ENGINE v1.2 Golden (Blindado anti-TIFFs)
│   ├── lib/
│   │   └── curator/
│   │       └── wiki-smart-curator.ts # Curador IA híbrido (Flash + Pro, selector editorialModel)
│   ├── cloud/                      # TODO LO QUE SUBE A CLOUD RUN
│   │   ├── server.ts               # Servidor HTTP liviano (Hono / Express / Node)
│   │   ├── routes/
│   │   │   ├── soma.route.ts       # Endpoint de curaduría visual y Top 3 Hero
│   │   │   └── argon-light.route.ts# Endpoint de maquetado simple + PDFKit (Auth x-tgp-secret)
│   │   └── services/
│   │       ├── layout-simple.ts    # Maquetador ligero (JSON / Estructuras TGP 4 Actos)
│   │       └── pdfkit-builder.ts   # Generador PDF en stream con PDFKit + sharp (crema cálido)
│   └── desk-heavy/                 # EXCLUSIVO EJECUCIÓN LOCAL (NUNCA VA A DOCKER)
│       └── puppeteer-renderer.ts   # Maquetador pesado HTML/CSS -> PDF local
├── Dockerfile                      # Multistage con node:22-slim (Debian glibc)
├── .dockerignore                   # Excluye src/desk-heavy, node_modules, dist, *.pdf
└── package.json
```

---

## 2. ESTADO DE EJECUCIÓN POR FASES
- [x] **FASE 1:** Ingesta de SOMA Engine y endpoint de curaduría (`src/core/soma-engine.ts`, `src/cloud/routes/soma.route.ts`).
- [x] **FASE 1.5:** Módulo independiente de curaduría inteligente (`src/lib/curator/wiki-smart-curator.ts`).
- [x] **FASE 2:** Motor de maquetación PDFKit editorial (`layout-simple.ts`, `pdfkit-builder.ts`, test Uxmal exitoso en 139.8 MB RSS).
- [ ] **FASE 3 (EN CURSO):** Endpoints Cloud/Astro con validación `x-tgp-secret` y esqueleto local `src/desk-heavy/puppeteer-renderer.ts`.
- [ ] **FASE 4:** Dockerfile multistage `node:22-slim` + `.dockerignore`.
- [ ] **FASE 5:** Despliegue en Cloud Run (`--memory 1Gi`, `--timeout 300s`).
