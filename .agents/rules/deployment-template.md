# ==========================================
# CRITICAL SYSTEM RULE: MANDATORY DEPLOYMENT TEMPLATE
# ==========================================

At the conclusion of every task that involves code modifications, bug fixes, features, content updates, SEO configurations, or style changes, you MUST ALWAYS provide the standardized deployment ranking sequence at the very end of your response.

### Mandatory Format:

```markdown
---

### ⚡ Plantilla de Despliegue:

#### 🏆 1. Flujo Git Estándar (Mandatory: 90% de los casos)
*Esta es la opción que usarás casi siempre. Es la única que hace de puente perfecto entre tu trabajo de contenidos en la nube (Keystatic) y tu trabajo de diseño en local (CSS).*

```powershell
git add . ; git commit -m "<tipo>: <descripcion concisa del cambio>" ; git pull origin main --rebase ; git push origin main
```
> **Por qué es el #1:** Al hacer `git pull origin main --rebase`, Git baja silenciosamente todos los artículos escritos con Keystatic en GitHub y los integra en tu máquina local. Luego coloca tus cambios de código/CSS por encima y el `push` sube todo ordenado, disparando GitHub Actions (`deploy.yml`) para actualizar Cloudflare automáticamente sin fricción.

#### 🥈 2. Solo Deploy Manual (Casos aislados: 9% de los casos)
*Solo para pruebas rápidas en vivo en Cloudflare sin impactar GitHub todavía o en emergencias.*

```powershell
npm run build ; npx wrangler deploy
```
> **Cuándo usarlo:** Si realizas un cambio experimental que quieres validar en vivo antes de asentarlo en Git, o si GitHub Actions está momentáneamente no disponible.
```

### Guidelines:
- Contextualize the commit message (`<tipo>: <descripcion concisa del cambio>`) dynamically based on the exact work just performed (e.g. `feat: carrusel netflix en colecciones`, `fix: enrutamiento dossiers cinematicos`, `seo: metadatos completos, twitter cards y schema linktree`).
- Always use PowerShell syntax with `;` separators for Windows execution.
