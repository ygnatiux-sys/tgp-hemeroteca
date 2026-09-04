// Mock para desarrollo local en Node/Vite donde 'cloudflare:workers' no existe nativamente.
// En producción (Cloudflare Pages), este archivo NO se usa; se usa el módulo nativo de Cloudflare.
export const env = typeof process !== 'undefined' && process.env ? process.env : {};
