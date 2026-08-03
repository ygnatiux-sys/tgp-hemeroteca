# AUDIT_KEYSTATIC.md — TGP Hemeroteca

> Auditoría técnica completa del sistema de publicación Keystatic + Astro Content Layer.  
> Fecha: 2026-08-02 · Versión del sistema: Astro 6 + Keystatic 0.5.50 + @google/genai 1.50.1

---

## Causa Raíz del Fallo de Ruteo

El sistema tenía **5 bugs concretos** que impedían que los posts aparecieran en los listados:

### Bug 1 (CRÍTICO): Filtros hardcoded en `content-filter.ts`
El archivo `src/lib/content-filter.ts` contenía una lista negra (`PLACEHOLDER_SLUGS`) y un filtro de prefijo (`slug.startsWith('test-')`) que bloqueaban posts **reales** publicados:
- `the-mask`, `the-yellow-kid`, `the-atacama-mummy`, `moai-test`, `fragmento-test-z` — bloqueados por nombre
- Todos los slugs con prefijo `test-` — bloqueados por convención de nomenclatura

**Resultado:** 20+ posts existentes en disco nunca llegaban a `getPublishableEssays()`.

### Bug 2 (CRÍTICO): Posts sin campo `draft` explícito en modo producción
Posts creados desde Keystatic antes del fix no tenían `draft: false` explícito. El schema Zod hacía `z.boolean().default(false)`, que correctamente los marcaba como publicados. Sin embargo, el bug #1 los bloqueaba antes de llegar al filtro de draft.

### Bug 3 (ALTO): Campo `volanta` ausente en `content.config.ts`
El campo `volanta` estaba definido en `keystatic.config.ts` pero **no** en el schema Zod de `content.config.ts`. Esto causaba que el campo se ignorara silenciosamente en la renderización.

### Bug 4 (ALTO): CLI `generar-post.js` con SDK y modelos obsoletos
El script usaba `@google/generative-ai` (SDK legacy) y el modelo `gemini-1.5-pro`. Además:
- Slugify sin soporte Unicode (`"Chichén Itzá"` → `"chichn-itz"`)
- No guardaba el texto generado en `generadorTexto` del JSON (solo en `content.mdoc`)
- Sin excerpt calculado automáticamente

### Bug 5 (MEDIO): `excerpt` de firstLine del mdoc no normalizado
Posts del CLI tenían `excerpt` calculado como `content.split('\n')[0].substring(0, 150)`, lo que incluía markup Markdown crudo (`**Texto**`) en las tarjetas de listado.

---

## Solución Arquitectónica: División Dual Mantenida

**Decisión: Mantener la estructura `index.json + content.mdoc` por directorio.**

### Justificación
- Los 42 posts existentes usan esta estructura → migrar sería destructivo
- Keystatic escribe en este formato nativamente y su UI depende de él
- Astro Content Layer maneja dos colecciones cruzadas (`ensayos` + `ensayosContent`) correctamente
- El `getEntry("ensayosContent", slug + "/content")` en `[slug].astro` resuelve correctamente porque el Astro glob `**/content.mdoc` genera IDs del tipo `gengis-khan/content`

### Flujo Correcto Verificado
```
src/content/ensayos/
  [slug]/
    index.json        ← Colección "ensayos" (metadatos + datos de IA)
    content.mdoc      ← Colección "ensayosContent" (cuerpo del ensayo)

Astro Content Layer:
  getCollection("ensayos")          → item.id = "gengis-khan/index"
  item.id.replace(/\/index$/, "")   → slug = "gengis-khan"
  
  getEntry("ensayosContent", slug + "/content")
    → ID buscado = "gengis-khan/content"
    → Resuelto desde: src/content/ensayos/gengis-khan/content.mdoc ✓

getStaticPaths → params.slug = "gengis-khan"
Ruta generada  → /hemeroteca/gengis-khan ✓
```

---

## Archivos Modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `src/lib/content-filter.ts` | MODIFICADO | Eliminados `PLACEHOLDER_SLUGS` y filtro `test-`. Control 100% por `draft:true` |
| `src/content.config.ts` | MODIFICADO | Agregado campo `volanta` y `notasInvestigador` al schema Zod |
| `scripts/generar-post.js` | MODIFICADO | SDK → `@google/genai`, modelo → `gemini-2.0-flash`, Unicode slug, campos correctos |
| `scripts/audit-content.mjs` | NUEVO | Script de auditoría completa del directorio de contenido |
| `src/content/ensayos/prueba-ruteo-keystatic/index.json` | NUEVO | Post fixture de verificación (`draft: false`) |
| `src/content/ensayos/prueba-ruteo-keystatic/content.mdoc` | NUEVO | Contenido Markdoc del fixture |
| `package.json` | MODIFICADO | Agregados scripts `npm run generar` y `npm run audit` |

---

## Instrucciones Actualizadas para Publicar Ensayos

### Método A: Desde Keystatic (UI)
1. `npm run dev`
2. Ir a `http://localhost:4321/keystatic`
3. Crear nuevo ensayo en **Ensayos**
4. Completar: Título, Fecha, Categoría, Excerpt, Contenido
5. **Asegurarse de que "Borrador" esté DESMARCADO** para publicar
6. Guardar → los archivos se escriben en `src/content/ensayos/[slug]/`

### Método B: Desde el CLI de Gemini
```powershell
npm run generar
```
- Pide título y categoría
- Genera el ensayo con `gemini-2.0-flash`
- Genera la portada con `imagen-3.0-generate-001` (opcional)
- **Crea el post como BORRADOR** (`draft: true`)
- Para publicarlo: abre Keystatic → desmarca "Borrador" → guarda

### Auditoría del sistema
```powershell
npm run audit
```
- Valida todos los posts en `src/content/ensayos/`
- Reporta errores críticos, advertencias y estado de borrador
- Exit 0 = sistema limpio

### Reglas del Sistema
| Condición | Resultado en PRODUCCIÓN | Resultado en DEV |
|---|---|---|
| `draft: true` | ❌ Oculto | ✅ Visible |
| `draft: false` | ✅ Visible | ✅ Visible |
| Sin campo `draft` (Zod default: `false`) | ✅ Visible | ✅ Visible |

---

## Cómo Verificar que Todo Funciona

```powershell
# 1. Auditar el contenido
npm run audit

# 2. Levantar el servidor de desarrollo
npm run dev

# 3. Verificar que aparece el fixture de prueba
# → http://localhost:4321/archivo (debe aparecer "Prueba de Ruteo Keystatic")
# → http://localhost:4321/hemeroteca/prueba-ruteo-keystatic (debe renderizar Markdoc)

# 4. Build de producción
npm run build
# → Debe completar sin errores
# → El fixture NO debe aparecer si se marca draft:true
```

Una vez verificado, el post `prueba-ruteo-keystatic` puede eliminarse desde Keystatic o marcarse como `draft: true`.
