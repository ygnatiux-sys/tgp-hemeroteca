import { config, fields, collection } from '@keystatic/core';
import { GeneradorTextoTGP } from './src/components/GeneradorTextoTGP';
import { MotorArteTGP } from './src/components/MotorArteTGP';

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
        
        // FASE 1: Motor de Pensamiento (Texto)
        generadorTexto: fields.text({ 
          label: '1. Motor de Pensamiento TGP', 
          multiline: true,
          Input: GeneradorTextoTGP
        } as any),

        // FASE 2: Motor de Materialización (Arte)
        generadorImagen: fields.text({
          label: '2. Motor de Arte Nano Banana',
          multiline: true,
          Input: MotorArteTGP
        } as any),
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
        draft: fields.checkbox({ 
          label: 'Borrador', 
          description: 'Si está marcado, no se publicará en producción',
          defaultValue: true 
        }),
        coverImage: fields.image({ 
          label: 'Imagen de Portada (Opcional)', 
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
    direccionArte: collection({
      label: 'Dirección de Arte (IA)',
      slugField: 'nombre',
      path: 'src/content/estilos-visuales/*',
      format: { data: 'json' },
      schema: {
        nombre: fields.slug({ name: { label: 'Nombre del Estilo (Slug)' } }),
        formatoCamara: fields.text({ label: 'Cámara y Óptica', multiline: true }),
        iluminacion: fields.text({ label: 'Esquema de Iluminación', multiline: true }),
        colorTextura: fields.text({ label: 'Etalonaje y Color', multiline: true }),
        descripcionEstetica: fields.text({ label: 'Instrucción Estética', multiline: true }),
      },
    }),
  },
});