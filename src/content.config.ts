import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
console.log("[CONFIG] Cargando configuración de contenido...");

const ensayos = defineCollection({
  // Astro 6 Content Layer: carga los metadatos JSON de cada post
  loader: glob({ 
    pattern: "**/index.json", 
    base: "src/content/ensayos" 
  }),
  schema: ({ image }) => z.object({
    title: z.string().optional().catch("Sin Título"),
    volanta: z.string().optional().nullable().catch(null),
    draft: z.boolean().default(false),
    date: z.string().optional().nullable().catch(null),
    category: z.string().optional().nullable().catch("Ensayo"),
    themeColor: z.string().optional().nullable().default('british-green'),
    coverImage: image().optional().nullable().catch(null),
    videoBg: z.string().optional().nullable().catch(null),
    excerpt: z.string().optional().nullable().catch("Sin descripción disponible."),
    sitioGeohistorico: z.string().optional().nullable().catch(null),
    publicarConImagen: z.boolean().default(true),
    generador: z.string().optional().default(''),
    generadorTexto: z.string().optional().nullable().catch(null),
    generadorImagen: z.string().optional().nullable().catch(null),
    notasInvestigador: z.string().optional().nullable().catch(null),
    spotifyLink: z.string().optional().nullable().catch(null),
    youtubeLink: z.string().optional().nullable().catch(null),
  })
});

const ensayosContent = defineCollection({
  // Cargamos los archivos .mdoc como colección de contenido nativa de Markdoc
  loader: glob({ 
    pattern: "**/content.mdoc", 
    base: "src/content/ensayos" 
  }),
});

const direccionArte = defineCollection({
  loader: glob({ 
    pattern: "**/index.json", 
    base: "src/content/estilos-visuales" 
  }),
  schema: z.object({
    nombre: z.string().optional().catch(""),
    constructorEstilo: z.object({
      conceptoBase: z.string().optional().nullable().default(""),
      sujetoIA: z.string().optional().nullable().default(""),
      lineaEditorial: z.string().optional().nullable().default("archivo-museo"),
      usarManuales: z.boolean().optional().default(false),
      overrideCamara: z.string().optional().nullable().catch(""),
      overrideIluminacion: z.string().optional().nullable().catch(""),
      overrideColor: z.string().optional().nullable().catch(""),
      imagenBase64: z.string().optional().nullable().catch(""),
      // Retrocompatibilidad con campos legacy
      camara: z.string().optional().nullable().catch(""),
      iluminacion: z.string().optional().nullable().catch(""),
      color: z.string().optional().nullable().catch(""),
      estetica: z.string().optional().nullable().catch(""),
    }).optional().catch({
      conceptoBase: "",
      sujetoIA: "",
      lineaEditorial: "archivo-museo",
      usarManuales: false,
      overrideCamara: "",
      overrideIluminacion: "",
      overrideColor: "",
      imagenBase64: ""
    })
  })
});

const georreferencias = defineCollection({
  loader: glob({ 
    pattern: "**/index.json", 
    base: "src/content/georreferencias" 
  }),
  schema: ({ image }) => z.object({
    title: z.string().optional().catch("Sin Título"),
    sitioGeohistorico: z.string().optional().nullable().catch(null),
    volantaHook: z.string().optional().nullable().catch(null),
    saberMasDato: z.string().optional().nullable().catch(null),
    draft: z.boolean().default(false),
    date: z.string().optional().nullable().catch(null),
    category: z.string().optional().nullable().default("Arqueosemiótica"),
    publicarConImagen: z.boolean().default(true),
    coverImage: image().optional().nullable().catch(null),
    bancoImagenesWikimedia: z.string().optional().nullable().catch(null),
    excerpt: z.string().optional().nullable().catch("Sin descripción disponible."),
    generadorGeoref: z.string().optional().nullable().catch(null),
  })
});

const georreferenciasContent = defineCollection({
  loader: glob({ 
    pattern: "**/content.mdoc", 
    base: "src/content/georreferencias" 
  }),
});

const arquetiposGlobales = defineCollection({
  loader: glob({ 
    pattern: "**/index.json", 
    base: "src/content/arquetipos-globales" 
  }),
  schema: ({ image }) => z.object({
    title: z.string().optional().catch("Sin Título"),
    volanta: z.string().optional().nullable().catch(null),
    draft: z.boolean().default(false),
    date: z.string().optional().nullable().catch(null),
    category: z.string().optional().nullable().catch("Arquetipos Globales"),
    themeColor: z.string().optional().nullable().default('rust-orange'),
    coverImage: image().optional().nullable().catch(null),
    videoBg: z.string().optional().nullable().catch(null),
    excerpt: z.string().optional().nullable().catch("Sin descripción disponible."),
    sitioGeohistorico: z.string().optional().nullable().catch(null),
    publicarConImagen: z.boolean().default(true),
    generador: z.string().optional().default(''),
    generadorTexto: z.string().optional().nullable().catch(null),
    bancoImagenesWikimedia: z.string().optional().nullable().catch(null),
    generadorImagen: z.string().optional().nullable().catch(null),
    notasInvestigador: z.string().optional().nullable().catch(null),
    spotifyLink: z.string().optional().nullable().catch(null),
    youtubeLink: z.string().optional().nullable().catch(null),
  })
});

const arquetiposGlobalesContent = defineCollection({
  loader: glob({ 
    pattern: "**/content.mdoc", 
    base: "src/content/arquetipos-globales" 
  }),
});

const ensayosCinematicos = defineCollection({
  loader: glob({ 
    pattern: "**/index.json", 
    base: "src/content/ensayos-cinematicos" 
  }),
  schema: ({ image }) => z.object({
    title: z.string().optional().catch("Sin Título"),
    atmosfera: z.any().optional().default('obsidiana'),
    coverImage: image().optional().nullable().catch(null),
    gallery: z.array(image()).optional().default([]),
    generadorTexto: z.string().optional().nullable().catch(null),
  })
});

const ensayosCinematicosContent = defineCollection({
  loader: glob({ 
    pattern: "**/content.mdoc", 
    base: "src/content/ensayos-cinematicos" 
  }),
});

export const collections = {
  ensayos,
  ensayosContent,
  direccionArte,
  georreferencias,
  georreferenciasContent,
  arquetiposGlobales,
  arquetiposGlobalesContent,
  ensayosCinematicos,
  ensayosCinematicosContent,
};
