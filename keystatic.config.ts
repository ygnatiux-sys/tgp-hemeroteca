import { config, fields, collection } from '@keystatic/core';
import { GeneradorTextoTGP } from './src/components/GeneradorTextoTGP';
import { MotorArteTGP } from './src/components/MotorArteTGP';
import { componentBlocks } from './src/components/component-blocks';

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
        
        generador: fields.text({ 
          label: 'Motor de Generación', 
          description: 'Identificador del motor de IA utilizado para este post.'
        }),

        notasInvestigador: fields.text({
          label: 'Notas del Investigador',
          description: 'Espacio privado para ideas y borradores antes de la publicación final.',
          multiline: true
        }),
        
        // FASE 1: Motor de Pensamiento (Texto)
        generadorTexto: {
          kind: 'form',
          label: '1. Motor de Pensamiento TGP',
          Input: GeneradorTextoTGP,
          defaultValue: () => '',
          parse: (v: any) => v || '',
          serialize: (v: any) => ({ value: v }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => v || '',
          },
        } as any,

        // FASE 2: Motor de Materialización (Arte)
        generadorImagen: {
          kind: 'form',
          label: '2. Motor de Arte Nano Banana',
          Input: MotorArteTGP,
          defaultValue: () => '',
          parse: (v: any) => v || '',
          serialize: (v: any) => ({ value: v }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => v || '',
          },
        } as any,
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
          componentBlocks,
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