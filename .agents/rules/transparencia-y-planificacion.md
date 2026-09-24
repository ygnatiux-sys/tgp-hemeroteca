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
