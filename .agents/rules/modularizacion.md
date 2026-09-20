# PROTOCOLO DE MODULARIZACION TGP (tgp-mind)

## Principio Rector
Cada dominio funcional del backend (IA, Telegram, Zernio, GitHub, R2/Vision) debe vivir en
su propio modulo bajo `tgp-mind/src/`. El `index.ts` es exclusivamente el orquestador de rutas
Hono: inicializa modulos, declara endpoints, no contiene logica de negocio.

---

## Mapa de Modulos Actuales

| Modulo | Ruta | Exporta |
|--------|------|---------|
| IA / Gemini | `src/ia/gemini.ts` | `genai`, `googleAI`, `callGemini`, `crearModeloEnsayo`, `GEMINI_API_KEY`, `TGP_SYSTEM_PROMPT` |
| Telegram principal | `src/telegram/helpers.ts` | `initTelegramHelpers`, `SesionConfig`, `sesiones`, `pendingTextQueries`, `buildInlineKeyboard`, `sendTelegram`, `answerCallbackQuery`, `editMessageReplyMarkup`, `editMessageText` |
| Telegram social + Zernio | `src/telegram/social.ts` | `initSocialBot`, `SesionSocialConfig`, `sesionesSocial`, `buildSocialInlineKeyboard`, `sendTelegramSocial`, `publicarEnZernio` |
| Dev Bot | `src/devBot.ts` | `devBotApp` |

---

## Regla: Cuando Crear un Modulo Nuevo

Ante cualquier solicitud de nueva funcionalidad O refactorizacion de un bloque existente,
el agente DEBE aplicar el siguiente flujo:

### 1. Diagnosticar primero
- `[INTACTO]` — la logica ya existe en el modulo correcto. No tocar.
- `[PARCHE]` — existe pero necesita un cambio puntual. Modificar solo las lineas necesarias.
- `[NUEVO MODULO]` — la logica no esta modularizada o el nuevo dominio es suficientemente
  autonomo. Crear modulo nuevo.

### 2. Criterio para crear modulo nuevo
Crear `src/<dominio>/<nombre>.ts` si se cumplen DOS o mas de estas condiciones:
- El bloque tiene mas de ~40 lineas de logica propia
- Tiene tipos/interfaces propias
- Tiene estado interno (Maps, variables de modulo)
- Tiene dependencias distintas a las de otros bloques
- Se modifica de forma independiente a otros bloques

### 3. Patron de modulo estandar
```typescript
// src/<dominio>/<nombre>.ts
// Descripcion del modulo y lo que contiene.

// Config inyectada (nunca leer process.env directamente aqui)
let _CONFIG_VAR = '';
export function init<Nombre>(config: { ... }) { _CONFIG_VAR = config.var; }

// Tipos e interfaces propias
export interface MiTipo { ... }

// Estado interno
export const miMap = new Map<...>();

// Funciones exportadas
export async function miFuncion(...): Promise<...> { ... }
```

### 4. Patron de integracion en index.ts
```typescript
// Al inicio del archivo (imports)
import { initModulo, miFuncion } from './src/<dominio>/<nombre>.js';

// En el bloque de inicializacion (despues de declarar las constantes de entorno)
initModulo({ configVar: CONST_DE_ENTORNO });

// En las rutas Hono
app.post('/mi-ruta', async (c) => {
  const resultado = await miFuncion(...);
  return c.json({ resultado });
});
```

---

## Regla: Cuando NO Crear un Modulo

- No modularizar funciones de 1-5 lineas que solo se usan en un solo webhook.
- No modularizar helpers genericos de JS/TS sin logica de negocio (ej: `sleep`, `slugify`).
- No partir un modulo por el nombre del archivo si la logica esta cohesionada.

---

## Regla: Verificacion Obligatoria Post-Modularizacion

Despues de cada extraccion de modulo, el agente DEBE ejecutar:
```bash
npx tsc --noEmit
```
Y confirmar exit code 0 antes de declarar el trabajo terminado.

---

## Proximos Modulos Pendientes (backlog)
- `src/github/gitops.ts` — `publicarEntradaKeystaticGitHub`, `publicarEnGitHub`, `generarMarkdoc`, `generarSlug`
- `src/storage/r2.ts` — `subirBufferAR2`, `subirImagenAR2`, `subirBufferOsintAR2`, `procesarFotoTelegramAR2`
- `src/storage/d1.ts` — `guardarEnCloudflareD1`, `obtenerInformeD1`, `actualizarRegistroD1`, `asegurarTablaD1`
- `src/vision/wikimedia.ts` — `resolverEntidadCanonica`, `buscarPageImageWikipedia`, `buscarCommonsEstricto`, `procesarImagen`
- `src/telegram/miniapp.ts` — `verifyTelegramInitData`, `extractChatIdFromInitData`, `getBotApi`, ruta `/api/bot/generate`
