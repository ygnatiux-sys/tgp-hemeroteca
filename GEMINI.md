# REGLA MANDATORIA: TRANSPARENCIA, PLANIFICACIÓN Y CÓDIGO HEREDADO

Antes de realizar CUALQUIER cambio o ejecución en el repositorio, el agente DEBE cumplir obligatoriamente con este protocolo:

1. **Explicación Previa en Modo Humano Simple:**  
   NUNCA aplicar cambios sin antes explicar claramente, en lenguaje simple y sin jerga oscura, qué se va a hacer.

2. **Plan Detallado en el Visor:**  
   Siempre presentar el plan detallado y estructurado en el visor de artefactos (`implementation_plan.md`) para revisión antes de actuar.

3. **Protección Estricta de Código Heredado (Legacy):**  
   PROHIBIDO tocar, modificar o eliminar código heredado sin avisar previamente y de manera comprensible. Si algo ya funciona, se respeta. Cero limpiezas silenciosas.

4. **Contrato Explícito: "¿Qué Saco y Qué Pongo?":**  
   En cada propuesta de cambio, se debe listar explícitamente:
   - **Qué se saca / elimina:** función, archivo o bloque específico, y por qué.
   - **Qué se pone / agrega:** función o lógica nueva, y qué beneficio concreto aporta.
   Especialmente crítico en funciones de **IA (Gemini / modelos / tokens)**, **Cloud Run (despliegues y env)**, **Telegram Webhooks**, **Svelte** y **Keystatic**.


# PROTOCOLO DE EFICIENCIA COGNITIVA (AHORRO DE TOKENS)

Antes de ejecutar cualquier tarea de generación o refactorización de código, el agente DEBE cumplir estrictamente los siguientes pasos:

1. **Auditoría Previa:** Revisa el árbol de archivos y el historial para verificar si el componente o la lógica solicitada ya existe o fue generada previamente.
2. **Diagnóstico Explícito:** Si el componente ya existe, antes de generar código nuevo, debes responder brevemente con uno de estos tres estados:
   - `[ESTADO: INTACTO]` "La lógica ya existe y cumple el objetivo. No requiere cambios."
   - `[ESTADO: PARCHE]` "El archivo existe. Solo hace falta una modificación puntual (ej. cambiar estilos o arreglar un bug). Procederé con una cirugía mínima."
   - `[ESTADO: REESCRITURA]` "El archivo existe, pero los nuevos requisitos exigen cambiar la arquitectura. Sugiero una reescritura."
3. **Cirugía Mínima (Diffs):** Si la tarea requiere modificar algo existente (como cambiar de tema oscuro a claro), NUNCA reescribas el archivo completo. Modifica estrictamente las líneas necesarias para cumplir el objetivo y preservar el resto del código para minimizar el consumo de tokens.

4. **Presentación de URLs de Prueba (Interactivas y Clickeables):**
   - NUNCA mostrar URLs de prueba como bloques de código o texto plano para copiar y pegar.
   - SIEMPRE formatear como hipervínculos Markdown directos y activos: `[Texto Descriptivo](https://url-de-prueba)`.
   - Incluir diagnósticos en vivo (ej. `getWebhookInfo` de Telegram) y separar entornos local vs. producción.


# PROTECCION DE TOKENS EN DESPLIEGUES Y .ENV
NUNCA modifiques, elimines, renombres ni sobreescribas las variables de entorno de los tokens de Telegram (OMNI_TOKEN, ASSISTANT_TOKEN, REDES_TOKEN) en los archivos .env, .env.example, o scripts de despliegue sin la autorización EXPLICITA del usuario. Si vas a generar o sugerir la creación de un nuevo .env, DEBES asegurarte de incluir las variables de entorno de autenticación ya existentes para no romper la conexión con las APIs de Telegram en producción (Cloud Run).
