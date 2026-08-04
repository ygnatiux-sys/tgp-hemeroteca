import { config, fields, collection } from '@keystatic/core';
import { 
  GeneradorTextoTGP, 
  MotorArteTGP, 
  ProbadorArteTGP, 
  BuscadorWikimediaTGP,
  SelectorCategoriaTGP,
  GeneradorGeorreferenciaTGP,
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
        
        // FASE 1: Motor de Pensamiento (Texto + Portada Unificada)
        generadorTexto: {
          kind: 'form',
          label: '1. Motor de Pensamiento & Arte Unificado TGP',
          Input: GeneradorTextoTGP,
          defaultValue: () => '',
          parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || '') }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          },
        } as any,

        // FASE 2: Buscador y Selector de Imágenes Wikimedia Commons TGP
        bancoImagenesWikimedia: {
          kind: 'form',
          label: '2. Buscador & Galería de Archivo Wikimedia Commons',
          Input: BuscadorWikimediaTGP,
          defaultValue: () => '',
          parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || '') }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          },
        } as any,

        // FASE 3: Motor de Materialización Manual (Arte)
        generadorImagen: {
          kind: 'form',
          label: '3. Motor de Arte Nano Banana (Laboratorio Manual)',
          Input: MotorArteTGP,
          defaultValue: () => '',
          parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || '') }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          },
        } as any,

        date: fields.date({ label: 'Fecha' }),
        
        category: {
          kind: 'form',
          label: 'Categoría / Campo Disciplinar TGP',
          Input: SelectorCategoriaTGP,
          defaultValue: () => 'Historia',
          parse: (v: any) => (typeof v === 'string' ? v : (v?.value || 'Historia')),
          serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || 'Historia') }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => (typeof v === 'string' ? v : (v?.value || 'Historia')),
          },
        } as any,

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
        sitioGeohistorico: fields.text({
          label: 'Lugar Geohistórico / Sitio Arqueohistórico',
          description: 'Ej: Aramu Muru (Perú), Tikal (Guatemala), Bonampak (México), Cartago (Túnez)',
        }),
        publicarConImagen: fields.checkbox({
          label: 'Publicar con Imagen de Portada (Toggle)',
          description: 'Marca este casillero para publicar con imagen. Desmárcalo para publicar en modo puramente textual.',
          defaultValue: true
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
        excerpt: fields.text({ label: 'Excerpt (Sinopsis / Cita Filosofica 2-4 Renglones)', multiline: true }),
        content: fields.document({
          label: 'Contenido',
          formatting: true,
          dividers: true,
          links: true,
          images: {
            directory: 'src/assets/ensayos',
            publicPath: '/src/assets/ensayos/'
          },
          tables: true,
          componentBlocks
        }),
      },
    }),

    // Colección secundaria: Laboratorio de Dirección de Arte en Keystatic
    direccionArte: collection({
      label: 'Dirección de Arte (IA)',
      slugField: 'nombre',
      path: 'src/content/estilos-visuales/*',
      format: { data: 'json' },
      schema: {
        nombre: fields.slug({ name: { label: 'Identificador del Estilo' } }),
        constructorEstilo: {
          kind: 'form',
          label: 'Laboratorio de Estilos e Imágenes TGP',
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
          parse: (v: any) => (v && typeof v === 'object' ? v : {}),
          serialize: (v: any) => ({ value: v && typeof v === 'object' ? v : {} }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => (v && typeof v === 'object' ? v : {}),
          },
        } as any,
      }
    }),

    // Colección terciaria: Georreferencias Arqueosemióticas (Aislada e Independiente)
    georreferencias: collection({
      label: 'Georreferencias Arqueosemióticas',
      slugField: 'title',
      path: 'src/content/georreferencias/*/',
      format: { data: 'json' },
      schema: {
        title: fields.slug({ name: { label: 'Nombre del Sitio / Lugar' } }),

        // MÓDULO IA DEDICADO: Motor de Georreferencias Arqueosemióticas
        generadorGeoref: {
          kind: 'form',
          label: '🌐 Motor de Georreferencias Arqueosemióticas (Gemini 3.1 Pro)',
          Input: GeneradorGeorreferenciaTGP,
          defaultValue: () => '',
          parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || '') }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          },
        } as any,

        // BUSCADOR & GALERÍA DE ARCHIVOS WIKIMEDIA COMMONS
        bancoImagenesWikimedia: {
          kind: 'form',
          label: '📷 Buscador & Galería de Archivo Wikimedia Commons',
          Input: BuscadorWikimediaTGP,
          defaultValue: () => '',
          parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || '') }),
          validate: (v: any) => v,
          reader: {
            parse: (v: any) => (typeof v === 'string' ? v : (v?.value || '')),
          },
        } as any,

        sitioGeohistorico: fields.text({
          label: 'Ubicación Geohistórica (País / Región / Coordenadas)',
          description: 'Ej: Aramu Muru (Puno, Perú), Tikal (Guatemala), Bonampak (México)',
        }),

        volantaHook: fields.text({
          label: 'Volanta / H2 Hook (2 Renglones)',
          description: 'Copete conceptual que sirve como gancho para el informe geohistórico.',
          multiline: true
        }),

        saberMasDato: fields.text({
          label: 'Saber Más (Dato Local No Divulgado)',
          description: 'Dato o micro-narrativa etnográfica no divulgada masivamente.',
          multiline: true
        }),

        date: fields.date({ label: 'Fecha' }),
        
        category: fields.text({
          label: 'Categoría Disciplinar',
          defaultValue: 'Arqueosemiótica'
        }),

        publicarConImagen: fields.checkbox({
          label: 'Publicar con Imagen de Portada (Toggle)',
          description: 'Marca este casillero para publicar con imagen. Desmárcalo para publicación pura texto.',
          defaultValue: true
        }),

        draft: fields.checkbox({ 
          label: 'Borrador', 
          description: 'Si está marcado, no se publicará en producción',
          defaultValue: false 
        }),

        coverImage: fields.image({ 
          label: 'Imagen del Sitio (Opcional)', 
          directory: 'src/assets/georreferencias', 
          publicPath: '/src/assets/georreferencias/' 
        }),

        excerpt: fields.text({ label: 'Sinopsis / Excerpt', multiline: true }),

        content: fields.document({
          label: 'Informe Geohistórico Multidimensional',
          formatting: true,
          dividers: true,
          links: true,
          tables: true,
          componentBlocks
        }),
      }
    }),
  },
});