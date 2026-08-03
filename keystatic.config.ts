import { config, fields, collection } from '@keystatic/core';
import { 
  GeneradorTextoTGP, 
  MotorArteTGP, 
  ProbadorArteTGP, 
  componentBlocks 
} from './src/components';

export default config({
  storage: {
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
        
        volanta: fields.text({
          label: 'Volanta (Subtítulo o contexto de lectura)',
          description: 'Aparecerá en tipografía Mono por encima del título principal.',
        }),

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
          serialize: (v: any) => v || '',
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
          serialize: (v: any) => v || '',
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
          defaultValue: false 
        }),
        coverImage: fields.image({ 
          label: 'Imagen de Portada (Opcional)', 
          directory: 'src/assets/ensayos', 
          publicPath: '/src/assets/ensayos/' 
        }),
        videoBg: fields.text({ label: 'URL del Video Cinemagraph' }),
        spotifyLink: fields.url({ label: 'Link de Spotify Podcast (Opcional)' }),
        youtubeLink: fields.url({ label: 'Link de YouTube Podcast (Opcional)' }),
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
        
        constructorEstilo: {
          kind: 'form',
          label: 'Constructor y Prueba de Estilo (Nano Banana)',
          Input: ProbadorArteTGP,
          defaultValue: () => ({
            conceptoBase: '',
            sujetoIA: '',
            lineaEditorial: 'archivo-museo',
            usarManuales: false,
            overrideCamara: '',
            overrideIluminacion: '',
            overrideColor: '',
            imagenBase64: ''
          }),
          parse: (v: any) => v || {},
          serialize: (v: any) => v || {},
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => v || {},
          },
        } as any,
      },
    }),
  },
});