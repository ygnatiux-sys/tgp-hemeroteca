# ==========================================
# MANDATORY SECURITY RULE — PRE-COMMIT PROTOCOL
# ==========================================

## OBLIGATORIO ANTES DE CUALQUIER git add / git commit / git push

El agente DEBE ejecutar los siguientes pasos en orden ANTES de cualquier operación Git.
Si algún paso falla o detecta secretos, la operación Git debe ABORTARSE completamente.

### PASO 1 — Estado del repositorio
Ejecutar siempre:
```
git status -uall
```
Revisar TODOS los archivos sin rastrear (untracked). Si alguno parece contener
credenciales o datos sensibles, DETENER y analizar antes de continuar.

### PASO 2 — Revisar el diff completo
Ejecutar siempre:
```
git diff
git diff --staged
```
Leer el output completo. Si hay archivos nuevos, leerlos con view_file.
NUNCA commitear archivos que no hayan sido revisados manualmente.

### PASO 3 — Escaneo de secretos (MANDATORY GREP)
Antes de `git add`, escanear los archivos modificados/nuevos buscando cualquiera
de los siguientes patrones. Si alguno aparece en texto real (no en `.env.example`),
ABORTAR y mover el valor a `.env`:

| Patrón          | Tipo de secreto            |
|-----------------|----------------------------|
| `cfut_`         | Cloudflare API Token       |
| `sk-`           | OpenAI / OpenRouter key    |
| `bot[0-9]+:`    | Telegram Bot Token         |
| `[0-9]{9,10}:[A-Za-z0-9_-]{35}` | Telegram Bot Token |
| `AIza[0-9A-Za-z_-]{35}` | Google API Key      |
| `ghp_` / `ghs_` | GitHub PAT / Server token  |
| `eyJ`           | JWT token (posible secreto)|
| `R2_SECRET`     | Cloudflare R2 Secret Key   |
| `REFRESH_TOKEN` | OAuth Refresh Token        |

Comando de escaneo rápido a ejecutar sobre archivos modificados:
```powershell
git diff --name-only | ForEach-Object { git grep -I -E "(cfut_|sk-|bot[0-9]+:|AIza|ghp_|ghs_|eyJ)" $_ }
```

### PASO 4 — ABORT o PROCEED
- **Si se detecta un secreto real**: ABORTAR git add/commit. Mover el valor a `.env`
  o `.env.local` del subproyecto correspondiente. Confirmar con el usuario antes de reintentar.
- **Si todo está limpio**: Proceder con `git add` seguido de `git commit`.

### REGLA ADICIONAL — NUNCA en código fuente
PROHIBIDO hardcodear como fallback en código TypeScript/JavaScript:
- Tokens de Telegram (patrón `\d+:[A-Za-z0-9_-]{35}`)
- API Keys de cualquier proveedor
- Credenciales de acceso (user:pass, Bearer xyz, etc.)

Si se necesita un valor por defecto, usar siempre `''` (string vacío) como fallback
y lanzar un error descriptivo si la variable de entorno no está definida.

### REGLA ADICIONAL — Husky como red de seguridad
El repositorio tiene Husky + Secretlint configurado en `.husky/pre-commit`.
Secretlint escaneará automáticamente todos los archivos antes de cada commit.
Si Secretlint falla, el commit será bloqueado automáticamente por Git.
Esto es una red de seguridad adicional, NO un sustituto de los pasos manuales anteriores.
