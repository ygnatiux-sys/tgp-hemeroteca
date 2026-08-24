# ==========================================
# CRITICAL SYSTEM RULE: MANDATORY DEPLOYMENT TEMPLATE
# ==========================================

At the conclusion of every task that involves code modifications, bug fixes, features, content updates, SEO configurations, or style changes, you MUST ALWAYS provide the standardized 3-option PowerShell deployment sequence at the very end of your response.

### Mandatory Format:

```markdown
---

### ⚡ Plantilla de Despliegue:

#### 1️⃣ Flujo Todo-en-Uno (Build + Deploy a Cloudflare + Git Push):
```powershell
npm run build; npx wrangler deploy; git add .; git commit -m "<tipo>: <descripcion concisa del cambio>"; git push origin main
```

#### 2️⃣ Solo Despliegue a Producción (Cloudflare Workers):
```powershell
npm run build; npx wrangler deploy
```

#### 3️⃣ Solo Respaldo a GitHub:
```powershell
git add .; git commit -m "<tipo>: <descripcion concisa del cambio>"; git push origin main
```
```

### Guidelines:
- Contextualize the commit message (`<tipo>: <descripcion concisa del cambio>`) dynamically based on the exact work just performed (e.g. `feat: carrusel netflix en colecciones`, `fix: enrutamiento dossiers cinematicos`, `seo: metadatos completos, twitter cards y schema linktree`).
- Always use PowerShell syntax with `;` separators for Windows execution.
