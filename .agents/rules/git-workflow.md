---
description: Recordatorio para sugerir commits y pull --rebase al finalizar tareas.
---

# Flujo de Trabajo con Git y Despliegues

Cuando finalices una tarea que involucre cambios en el código, creación de nuevos componentes o cualquier acción que requiera ser desplegada en producción, **siempre debes sugerir al usuario** lo siguiente:

1. Realizar el commit correspondiente de sus cambios locales (ej. `git add .` seguido de `git commit -m "..."`).
2. Si existe la posibilidad de que el repositorio remoto (Cloudflare/GitHub) haya sido modificado externamente (por ejemplo, mediante la creación de contenido en Keystatic Cloud), sugiere ejecutar un `git pull --rebase` antes del `git push` para evitar conflictos de "non-fast-forward" y asegurar una correcta sincronización.
3. Recordar subir los archivos estáticos o imágenes necesarias (ej. `npm run upload:assets`) si se generaron en local y deben enviarse a R2.

Este recordatorio garantiza que el trabajo local no se pierda por fusiones (merges) incompletas y que el despliegue automático procese la última versión íntegra del repositorio.
