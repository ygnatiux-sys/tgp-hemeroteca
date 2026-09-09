/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_IA_WEBHOOK_URL: string;   // TGP App — Cloud Run (imagen sintética / VEO3)
  readonly PUBLIC_VAULT_WEBHOOK_URL: string; // TGP Vault — Cloud Run (ingesta de documentos)
  readonly PUBLIC_TGP_MIND_URL: string;      // TGP Mind — Cloud Run (motor cognitivo Gemini)
  readonly PUBLIC_GOOGLE_PICKER_API_KEY: string;
  readonly PUBLIC_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'cloudflare:workers' {
  export const env: Record<string, any>;
}
