import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
console.log("[CONFIG] Cargando configuración de contenido...");

const ensayos = defineCollection({
  // Astro 6 Loader: Parche de emergencia para permitir borradores incompletos
  loader: glob({ 
    pattern: "**/index.json", 
    base: "src/content/ensayos" 
  }),
  schema: z.object({
    title: z.string().optional().catch("Sin Título"),
    date: z.string().optional().nullable().catch(null),
    category: z.string().optional().nullable().catch("Ensayo"),
    themeColor: z.string().optional().nullable().default('british-green'),
    coverImage: z.string().optional().nullable().catch(null),
    videoBg: z.string().optional().nullable().catch(null),
    excerpt: z.string().optional().nullable().catch("Sin descripción disponible."),
  })
});

export const collections = {
  ensayos,
};
