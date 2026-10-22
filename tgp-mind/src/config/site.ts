// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo Canónico de Identidad y Aislamiento de Sitio (SITE_ID)
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config';

export type SiteId = 'hemeroteca' | 'alternative';

// 1. Identidad Maestra del Contenedor
const rawSiteId = (process.env.SITE_ID || 'hemeroteca').toLowerCase().trim();
export const SITE_ID: SiteId = rawSiteId === 'alternative' ? 'alternative' : 'hemeroteca';

export const IS_HEMEROTECA: boolean = SITE_ID === 'hemeroteca';
export const IS_ALTERNATIVE: boolean = SITE_ID === 'alternative';

// 2. Dominios Públicos Oficiales
export const SITE_DOMAIN: string = (
  process.env.SITE_DOMAIN ||
  (IS_ALTERNATIVE ? 'alternative.thegreatpuzzleproject.com' : 'thegreatpuzzleproject.com')
).replace(/^https?:\/\//, '').replace(/\/$/, '');

export const SITE_BASE_URL: string = `https://${SITE_DOMAIN}`;

// 3. Repositorios GitHub Oficiales
export const GITHUB_REPO: string = (
  process.env.GITHUB_REPO ||
  (IS_ALTERNATIVE ? 'ygnatiux-sys/tgp-webfinal2026' : 'ygnatiux-sys/tgp-hemeroteca')
).trim();

// 4. Token de GitHub con Fail-Fast (DevSecOps: Prohibido Fallback Cruzado)
function resolveGithubToken(): string {
  if (IS_ALTERNATIVE) {
    const token = (process.env.GITHUB_TOKEN_ALTERNATIVE || process.env.GITHUB_TOKEN || '').trim();
    if (!token && process.env.NODE_ENV === 'production') {
      throw new Error(
        `[DevSecOps Fail-Fast] SITE_ID="alternative" requiere GITHUB_TOKEN_ALTERNATIVE o GITHUB_TOKEN configurado. Prohibido usar credenciales de Hemeroteca.`
      );
    }
    return token;
  } else {
    const token = (process.env.GITHUB_TOKEN_HEMEROTECA || process.env.GITHUB_TOKEN || '').trim();
    if (!token && process.env.NODE_ENV === 'production') {
      throw new Error(
        `[DevSecOps Fail-Fast] SITE_ID="hemeroteca" requiere GITHUB_TOKEN_HEMEROTECA o GITHUB_TOKEN configurado.`
      );
    }
    return token;
  }
}

export const GITHUB_TOKEN: string = resolveGithubToken();

// 5. Partición Dinámica de Persistencia (Firestore & R2)
export const FIREBASE_COLLECTION_PREFIX: string = (
  process.env.FIREBASE_COLLECTION_PREFIX || (IS_ALTERNATIVE ? 'alt_' : 'hemer_')
).trim();

export const R2_PREFIX: string = (
  process.env.R2_PREFIX || (IS_ALTERNATIVE ? 'alternative/' : 'hemeroteca/')
).replace(/\/$/, '') + '/';

// 6. Base URL del Servicio (Elimina URL Muerta de Cloud Run)
export const PUBLIC_BASE_URL: string = (
  process.env.PUBLIC_BASE_URL ||
  process.env.SERVICE_URL ||
  process.env.TGP_MIND_URL ||
  (IS_ALTERNATIVE
    ? 'https://tgp-mind-alternative-uzhmxe53dq-uc.a.run.app'
    : 'https://tgp-mind-uzhmxe53dq-uc.a.run.app')
).replace(/\/$/, '');

// 7. Base de Datos Cloudflare D1 (Partición por SITE_ID)
export const CLOUDFLARE_D1_DATABASE_ID: string = (
  (IS_ALTERNATIVE
    ? (process.env.CLOUDFLARE_D1_DATABASE_ID_ALTERNATIVE || process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.D1_DATABASE_ID)
    : (process.env.CLOUDFLARE_D1_DATABASE_ID_HEMEROTECA || process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.D1_DATABASE_ID)) ||
  ''
).trim();

export const PANLINGUA_D1_ID: string = (
  (IS_ALTERNATIVE
    ? (process.env.PANLINGUA_D1_ID_ALTERNATIVE || process.env.PANLINGUA_D1_ID)
    : (process.env.PANLINGUA_D1_ID_HEMEROTECA || process.env.PANLINGUA_D1_ID)) ||
  'a4c11340-cec3-4273-b6d0-5691a100f09a'
).trim();

export const D1_NAMESPACE_PREFIX: string = `${SITE_ID}:`;
