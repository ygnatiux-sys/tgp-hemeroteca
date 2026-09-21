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

