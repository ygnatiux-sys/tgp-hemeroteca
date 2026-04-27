import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    // CORRECCIÓN VITAL: Forzamos 'local' absoluto.
    // Al ser un sitio puramente estático, Keystatic no debe intentar 
    // buscar conexiones a GitHub en el entorno de producción de Cloudflare.
    kind: 'local',
  },
  collections: {
    ensayos: collection({
      label: 'Ensayos',
      slugField: 'title',
      path: 'src/content/ensayos/*/',
      format: { data: 'json' },
      schema: {
        title: fields.slug({ name: { label: 'Título' } }),
        date: fields.date({ label: 'Fecha' }),
        category: fields.text({ label: 'Categoría (ej. Arqueosemiótica)' }),
        themeColor: fields.select({
          label: 'Theme Color',
          options: [
            { label: 'British Green', value: 'british-green' },
            { label: 'Bordeaux', value: 'bordeaux' },
            { label: 'Old Navy', value: 'old-navy' },
            { label: 'Bus Red', value: 'bus-red' },
            { label: 'Vintage Yellow', value: 'vintage-yellow' },
            { label: 'Rust Orange', value: 'rust-orange' },
          ],
          defaultValue: 'british-green',
        }),
        coverImage: fields.image({ 
          label: 'Imagen de Portada', 
          directory: 'src/assets/ensayos', 
          publicPath: '/src/assets/ensayos/' 
        }),
        videoBg: fields.text({ label: 'URL del Video Cinemagraph' }),
        excerpt: fields.text({ label: 'Excerpt (Sinopsis)', multiline: true }),
        content: fields.document({
          label: 'Contenido',
          formatting: true,
          dividers: true,
          links: true,
          images: {
            directory: 'src/assets/ensayos',
            publicPath: '/src/assets/ensayos/'
          },
        }),
      },
    }),
  },
});