# PROTOCOLO DE EFICIENCIA COGNITIVA (AHORRO DE TOKENS)

Antes de ejecutar cualquier tarea de generaci贸n o refactorizaci贸n de c贸digo, el agente DEBE cumplir estrictamente los siguientes pasos:

1. **Auditor铆a Previa:** Revisa el 谩rbol de archivos y el historial para verificar si el componente o la l贸gica solicitada ya existe o fue generada previamente.
2. **Diagn贸stico Expl铆cito:** Si el componente ya existe, antes de generar c贸digo nuevo, debes responder brevemente con uno de estos tres estados:
   - `[ESTADO: INTACTO]` "La l贸gica ya existe y cumple el objetivo. No requiere cambios."
   - `[ESTADO: PARCHE]` "El archivo existe. Solo hace falta una modificaci贸n puntual (ej. cambiar estilos o arreglar un bug). Proceder茅 con una cirug铆a m铆nima."
   - `[ESTADO: REESCRITURA]` "El archivo existe, pero los nuevos requisitos exigen cambiar la arquitectura. Sugiero una reescritura."
3. **Cirug铆a M铆nima (Diffs):** Si la tarea requiere modificar algo existente (como cambiar de tema oscuro a claro), NUNCA reescribas el archivo completo. Modifica estrictamente las l铆neas necesarias para cumplir el objetivo y preservar el resto del c贸digo para minimizar el consumo de tokens.

4. **Presentaci贸n de URLs de Prueba (Interactivas y Clickeables):**
   - NUNCA mostrar URLs de prueba como bloques de c贸digo o texto plano para copiar y pegar.
   - SIEMPRE formatear como hiperv铆nculos Markdown directos y activos: `[Texto Descriptivo](https://url-de-prueba)`.
   - Incluir diagn贸sticos en vivo (ej. `getWebhookInfo` de Telegram) y separar entornos local vs. producci贸n.


# PROTECCI覰 DE TOKENS EN DESPLIEGUES Y .ENV
NUNCA modifiques, elimines, renombres ni sobreescribas las variables de entorno de los tokens de Telegram (OMNI_TOKEN, ASSISTANT_TOKEN, REDES_TOKEN) en los archivos .env, .env.example, o scripts de despliegue sin la autorizaci髇 EXPL虲ITA del usuario. Si vas a generar o sugerir la creaci髇 de un nuevo .env, DEBES asegurarte de incluir las variables de entorno de autenticaci髇 ya existentes para no romper la conexi髇 con las APIs de Telegram en producci髇 (Cloud Run).
