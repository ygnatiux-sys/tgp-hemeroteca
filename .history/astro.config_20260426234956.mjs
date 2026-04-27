import { defineConfig } from 'astro/config';
import { tgpIntegrations, tgpViteConfig } from './src/config/integrations.js';

// https://astro.build/config
export default defineConfig({
  output: 'static', // Garantiza que Astro genere solo HTML/CSS/JS plano
  vite: tgpViteConfig,
  integrations: tgpIntegrations
});
