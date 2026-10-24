# PLAN MAESTRO DE ARQUITECTURA Y DESPLIEGUE: SOMA v1.0 + ARGON (HYBRID CLOUD/DESK)

## 0. REGLAS DE ORO PARA EL AGENTE (CUMPLIMIENTO ESTRICTO)
1. **EJECUCIÓN POR TURNOS (STEP-BY-STEP):** Bajo ninguna circunstancia ejecutes dos fases en un mismo turno. Al terminar una fase, detente, muestra los archivos creados/modificados y espera la orden explícita del usuario.
2. **FRONTERA ESTRICTA DOCKER vs. DESKTOP:**
   - **EN CLOUD RUN (DOCKER):** Solo procesos livianos (`SOMA Wiki Engine`, maquetadores estructurales JSON/Markdown y generación de PDF mediante `pdfkit`).
   - **PROHIBICIÓN EN NUBE:** Queda terminantemente prohibido incluir `puppeteer`, `playwright`, `chromium`, `canvas` (nativo C++) o librerías pesadas de renderizado en las `dependencies` de producción que van al contenedor Docker.
   - **EN DESKTOP LOCAL:** Todo proceso pesado con `puppeteer` (renderizado HTML/CSS complejo de revista, capturas de alta densidad) vivirá en una carpeta aislada (`/src/desk-heavy/`) y se ejecutará únicamente en local.
3. **CERO DEPENDENCIAS INNECESARIAS EN SOMA:** El motor `SOMA WIKI ENGINE v1.0` utiliza `fetch` nativo de Node 20+. No agregues `axios` ni librerías adicionales para él.

---

## 1. ARQUITECTURA DE DIRECTORIOS OBJETIVO

Organiza el repositorio respetando esta separación física para no contaminar el contenedor de Cloud Run:

```text
/
├── src/
│   ├── core/
│   │   └── soma-engine.ts          # SOMA WIKI ENGINE v1.0 intacto (0 dependencias)
│   ├── cloud/                      # TODO LO QUE SUBE A CLOUD RUN
│   │   ├── server.ts               # Servidor HTTP liviano (Hono / Express / Fastify)
│   │   ├── routes/
│   │   │   ├── soma.route.ts       # Endpoint de curaduría visual y Top 3 Hero
│   │   │   └── argon-light.route.ts# Endpoint de maquetado simple + PDFKit
│   │   └── services/
│   │       ├── layout-simple.ts    # Maquetador ligero (JSON / Estructuras TGP)
│   │       └── pdfkit-builder.ts   # Generador PDF en stream con PDFKit (sin navegador)
│   └── desk-heavy/                 # EXCLUSIVO EJECUCIÓN LOCAL (NUNCA VA A DOCKER)
│       └── puppeteer-renderer.ts   # Maquetador pesado HTML/CSS -> PDF local
├── Dockerfile                      # Multistage ultraliviano (node:20-alpine)
├── .dockerignore                   # Excluye src/desk-heavy y node_modules
└── package.json
```
