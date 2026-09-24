# REGLA MANDATORIA DE TRANSPARENCIA, PLANIFICACIÓN Y CÓDIGO HEREDADO

> **ESTADO:** MANDATORIA / OBLIGATORIA  
> **APLICACIÓN:** Todo el repositorio (IA, Cloud Run, Telegram Bots, Svelte, Keystatic, Astro, APIs).

---

## 1. PRINCIPIO GENERAL: EXPLICAR ANTES DE TOCAR
El agente **NUNCA** debe realizar modificaciones en el código fuente, dependencias o configuración sin haber explicado previamente al usuario, en un **lenguaje simple, claro y accesible para un humano**, exactamente qué se propone hacer.

---

## 2. PLAN DETALLADO EN EL VISOR (ARTIFACT OBLIGATORIO)
Siempre que se plantee una solución, corrección o cambio:
1. Se debe generar o actualizar un plan detallado y visible en el **visor de artefactos (`implementation_plan.md`)**.
2. La explicación en el chat debe ser concisa y comprensible para no expertos, evitando tecnicismos innecesarios o jerga oscura.
3. **Se debe esperar la confirmación o aprobación explícita del usuario** antes de aplicar cambios estructurales o eliminar código.

---

## 3. PROTECCIÓN ESTRICTA DE CÓDIGO HEREDADO (LEGACY)
- Está **estrictamente prohibido tocar, modificar o eliminar código heredado** sin avisar de manera explícita y comprensible.
- Si el código heredado funciona o cumple una función de resguardo, debe respetarse su integridad.
- No se deben hacer "limpiezas silenciosas" ni refactorizaciones no solicitadas.

---

## 4. CONTRATO EXPLICITO: "¿QUÉ SACO Y QUÉ PONGO?"
En cualquier archivo que se proponga modificar, el agente debe detallar con total transparencia:
1. **QUÉ SE SACA / QUITA:**
   - Nombre de la función, bloque de código o variable.
   - Por qué se propone retirar o modificar.
   - Qué impacto o riesgo tiene retirarlo.
2. **QUÉ SE PONE / AGREGA:**
   - Qué nueva lógica, función o parámetro se introduce.
   - Para qué sirve y qué beneficio concreto aporta al usuario.

---

## 5. ÁREAS DE MÁXIMA CRITICIDAD (REQUERIMIENTO OBLIGATORIO DE AVISO)
Se debe extremar este protocolo cuando se involucre:
- **Motores y Modelos de IA:** Llamadas a Gemini, Google GenAI SDK, Structured Outputs, system prompts y selección de modelos.
- **Servicios de Cloud Run:** Configuración de despliegues (`deploy.ps1`, `deploy.sh`), variables de entorno, secretos y CPU/timeouts.
- **Bots de Telegram:** Webhooks de Telegram (`webhook.ts`, helpers, keyboards, callbacks inline).
- **Frontend Svelte:** Componentes de interfaz, estado reactivo e integración con Astro.
- **Gestor de Contenido Keystatic / Hemeroteca:** Esquemas de colecciones, commits en GitHub vía Octokit, resguardos documentales en Cloudflare D1 y almacenamiento en Cloudflare R2.
