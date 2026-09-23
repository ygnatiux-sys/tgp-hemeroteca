import { config, fields, collection } from '@keystatic/core';
import { 
  GeneradorTextoTGP, 
  GeneradorArquetiposTGP,
  MotorArteTGP, 
  ProbadorArteTGP, 
  BuscadorWikimediaTGP,
  SelectorCategoriaTGP,
  GeneradorGeorreferenciaTGP,
  AgenteEruditoTGP,
  GeneradorInformePremium,
  componentBlocks 
} from './src/components';
import { geminiCinematicField } from './src/keystatic/geminiCinematic';

// ─── HELPER: Abstracción de Motores de IA TGP ─────────────────────────────────
// Centraliza el boilerplate de Parse/Serialize/Validate para los campos Custom
function createTgpEngineField(label: string, InputComponent: any, defaultValue: any = '') {
  return {
    kind: 'form' as const,
    label,
    Input: InputComponent,
    defaultValue: () => defaultValue,
    parse: (v: any) => (typeof v === 'string' ? v : (v?.value || defaultValue)),
    serialize: (v: any) => ({ value: typeof v === 'string' ? v : (v?.value || defaultValue) }),
    validate: (v: any) => v,
    reader: { parse: (v: any) => (typeof v === 'string' ? v : (v?.value || defaultValue)) },
  } as any;
}

// ─── VARIABLES GLOBALES COMPARTIDAS ───────────────────────────────────────────

const agenteEruditoField = createTgpEngineField('✦ Agente Erudito Académico TGP', AgenteEruditoTGP);
const bancoImagenesWikimediaField = createTgpEngineField('2. Buscador & Galería de Archivo Wikimedia Commons', BuscadorWikimediaTGP);
const generadorImagenField = createTgpEngineField('3. Motor de Arte Nano Banana (Laboratorio Manual)', MotorArteTGP);

const draftField = fields.checkbox({ 
  label: 'Borrador', 
  description: 'Si está marcado, no se publicará en producción',
  defaultValue: false 
});

const publicarConImagenField = fields.checkbox({
  label: 'Publicar con Imagen de Portada (Toggle)',
  description: 'Marca este casillero para publicar con imagen. Desmárcalo para publicar en modo puramente textual.',
  defaultValue: true
});

const isCinematicField = fields.checkbox({
  label: 'Renderizar como Dossier Cinemático',
  description: 'Transforma el texto y la galería de imágenes de este post en una experiencia inmersiva GSAP a pantalla completa.',
  defaultValue: false
});

const dateField = fields.date({ label: 'Fecha' });

const notasInvestigadorField = fields.text({
  label: 'Notas del Investigador',
  description: 'Espacio privado para ideas y borradores antes de la publicación final.',
  multiline: true
});

const volantaField = fields.text({
  label: 'Volanta (Subtítulo o contexto de lectura)',
  description: 'Aparecerá en tipografía Mono por encima del título principal.',
});

const excerptField = fields.text({ label: 'Excerpt (Sinopsis / Cita Filosofica 2-4 Renglones)', multiline: true });

const dekField = fields.text({
  label: 'Bajada / Excerpt (Dek)',
  multiline: true,
  description: 'Síntesis editorial de 1 a 2 líneas (70-110 caracteres) para la tarjeta de portada.'
});

const videoBgField = fields.text({ label: 'URL del Video Cinemagraph' });
const spotifyLinkField = fields.url({ label: 'Link de Spotify Podcast (Opcional)' });
const youtubeLinkField = fields.url({ label: 'Link de YouTube Podcast (Opcional)' });

// ─── FACTORÍAS PARA CAMPOS CON DIRECTORIO VARIABLE ────────────────────────────

function createCoverImage(directory: string, label: string = 'Imagen de Portada (Opcional)') {
  return fields.image({ 
    label, 
    directory: `src/assets/${directory}`, 
    publicPath: `/src/assets/${directory}/` 
  });
}

function createGallery(directory: string, cinematicLabel: string = 'Galería de Imágenes Cinemáticas (Opcional)') {
  return fields.array(fields.image({
    label: 'Imagen de Galería',
    directory: `src/assets/${directory}`,
    publicPath: `/src/assets/${directory}/`
  }), {
    label: cinematicLabel,
    itemLabel: () => 'Imagen'
  });
}

function createContentDocument(directory: string, label: string = 'Contenido') {
  return fields.document({
    label: label,
    formatting: true,
    dividers: true,
    links: true,
    images: {
      directory: `src/assets/${directory}`,
      publicPath: `/src/assets/${directory}/`
    },
    tables: true,
    componentBlocks
  });
}

function createThemeColorField(defaultValue: 'british-green' | 'bordeaux' | 'old-navy' | 'bus-red' | 'vintage-yellow' | 'rust-orange') {
  return fields.select({
    label: 'Theme Color',
    options: [
      { label: 'British Green', value: 'british-green' },
      { label: 'Bordeaux', value: 'bordeaux' },
      { label: 'Old Navy', value: 'old-navy' },
      { label: 'Bus Red', value: 'bus-red' },
      { label: 'Vintage Yellow', value: 'vintage-yellow' },
      { label: 'Rust Orange', value: 'rust-orange' },
    ],
    defaultValue,
  });
}

function createCategoryField(defaultValue: string) {
  return createTgpEngineField('Categoría / Campo Disciplinar TGP', SelectorCategoriaTGP, defaultValue);
}

// ─── INICIO DE CONFIGURACIÓN ──────────────────────────────────────────────────

// Detecta de forma nativa en Astro si estás en modo local o en producción
const isLocal = import.meta.env.DEV;

export default config({
  storage: isLocal 
    ? { kind: 'local' } // Si estás en tu PC, guarda en el disco duro sin pedir contraseñas.
    : { kind: 'github', repo: 'ygnatiux-sys/tgp-hemeroteca' }, // Si estás en la nube, usa GitHub.
    
  collections: {
    ensayos: collection({
      label: 'Ensayos',
      slugField: 'title',
      path: 'src/content/ensayos/*/',
      format: { data: 'json' },
      schema: {
        title: fields.slug({ name: { label: 'Título' } }),
        volanta: volantaField,
        generador: fields.text({ 
          label: 'Motor de Generación', 
          description: 'Identificador del motor de IA utilizado para este post.'
        }),
        notasInvestigador: notasInvestigadorField,
        
        // FASE 1, 2 y 3: Motores
        generadorTexto: createTgpEngineField('1. Motor de Pensamiento & Arte Unificado TGP', GeneradorTextoTGP),
        agenteErudito: agenteEruditoField,
        bancoImagenesWikimedia: bancoImagenesWikimediaField,
        generadorImagen: generadorImagenField,

        date: dateField,
        category: createCategoryField('Historia'),
        themeColor: createThemeColorField('british-green'),
        
        sitioGeohistorico: fields.text({
          label: 'Lugar Geohistórico / Sitio Arqueohistórico',
          description: 'Ej: Aramu Muru (Perú), Tikal (Guatemala), Bonampak (México), Cartago (Túnez)',
        }),
        
        publicarConImagen: publicarConImagenField,
        draft: draftField,
        coverImage: createCoverImage('ensayos'),
        isCinematic: isCinematicField,
        gallery: createGallery('ensayos'),
        videoBg: videoBgField,
        spotifyLink: spotifyLinkField,
        youtubeLink: youtubeLinkField,
        excerpt: excerptField,
        dek: dekField,
        content: createContentDocument('ensayos')
      },
    }),

    arquetiposGlobales: collection({
      label: 'Arquetipos Globales',
      slugField: 'title',
      path: 'src/content/arquetipos-globales/*/',
      format: { data: 'json' },
      schema: {
        title: fields.slug({ name: { label: 'Título del Arquetipo' } }),
        volanta: volantaField,
        generador: fields.text({ 
          label: 'Motor de Generación', 
          description: 'Identificador del motor de IA utilizado para este post.'
        }),
        notasInvestigador: notasInvestigadorField,
        
        // FASE 1, 2 y 3: Motores
        generadorTexto: createTgpEngineField('1. Motor de Arquetipos Globales TGP (Informe & Contenido)', GeneradorArquetiposTGP),
        agenteErudito: agenteEruditoField,
        bancoImagenesWikimedia: bancoImagenesWikimediaField,
        generadorImagen: generadorImagenField,

        date: dateField,
        category: createCategoryField('Arquetipos Globales'),
        themeColor: createThemeColorField('rust-orange'),
        
        sitioGeohistorico: fields.text({
          label: 'Lugar Geohistórico / Origen Mitológico',
          description: 'Ej: Eleusis (Grecia), Alejandría (Egipto), Babilonia (Mesopotamia)',
        }),
        
        publicarConImagen: publicarConImagenField,
        draft: draftField,
        coverImage: createCoverImage('arquetipos-globales'),
        isCinematic: isCinematicField,
        gallery: createGallery('arquetipos-globales'),
        videoBg: videoBgField,
        spotifyLink: spotifyLinkField,
        youtubeLink: youtubeLinkField,
        excerpt: excerptField,
        dek: dekField,
        content: createContentDocument('arquetipos-globales')
      },
    }),

    direccionArte: collection({
      label: 'Dirección de Arte (IA)',
      slugField: 'nombre',
      path: 'src/content/estilos-visuales/*',
      format: { data: 'json' },
      schema: {
        nombre: fields.slug({ name: { label: 'Identificador del Estilo' } }),
        constructorEstilo: createTgpEngineField('Laboratorio de Estilos e Imágenes TGP', ProbadorArteTGP, {
          conceptoBase: '',
          sujetoIA: '',
          lineaEditorial: 'archivo-museo',
          usarManuales: false,
          overrideCamara: '',
          overrideIluminacion: '',
          overrideColor: '',
          imagenBase64: ''
        }),
      }
    }),

    georreferencias: collection({
      label: 'Georreferencias Arqueosemióticas',
      slugField: 'title',
      path: 'src/content/georreferencias/*/',
      format: { data: 'json' },
      schema: {
        title: fields.slug({ name: { label: 'Nombre del Sitio / Lugar' } }),
        
        // MÓDULOS IA
        generadorGeoref: createTgpEngineField('🌐 Motor de Georreferencias Arqueosemióticas (Gemini 3.1 Pro)', GeneradorGeorreferenciaTGP),
        agenteErudito: agenteEruditoField,
        bancoImagenesWikimedia: createTgpEngineField('📷 Buscador & Galería de Archivo Wikimedia Commons', BuscadorWikimediaTGP),
        generadorImagen: createTgpEngineField('🎨 Motor de Arte Nano Banana (Laboratorio Manual)', MotorArteTGP),

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

        date: dateField,
        category: fields.text({ label: 'Categoría Disciplinar', defaultValue: 'Arqueosemiótica' }),
        publicarConImagen: publicarConImagenField,
        draft: draftField,
        coverImage: createCoverImage('georreferencias', 'Imagen del Sitio (Opcional)'),
        excerpt: fields.text({ label: 'Sinopsis / Excerpt', multiline: true }),
        dek: dekField,
        content: createContentDocument('georreferencias', 'Informe Geohistórico Multidimensional')
      }
    }),

    ensayosCinematicos: collection({
      label: 'Ensayos Cinemáticos (GSAP)',
      slugField: 'title',
      path: 'src/content/ensayos-cinematicos/*/',
      format: { data: 'json' },
      schema: {
        title: fields.slug({ name: { label: 'Título' } }),
        generadorTexto: geminiCinematicField as any,
        agenteErudito: agenteEruditoField,

        atmosfera: fields.conditional(
          fields.select({
            label: 'Atmósfera',
            options: [
              { label: 'Canon Default', value: 'obsidiana' },
              { label: 'Documental', value: 'deriva' },
              { label: 'Cognitivo', value: 'umbral' },
              { label: 'Personalizado', value: 'custom' },
            ],
            defaultValue: 'obsidiana',
          }),
          {
            obsidiana: fields.empty(),
            deriva: fields.empty(),
            umbral: fields.empty(),
            custom: fields.object({
              header: fields.select({ label: 'Header', options: [{ label: 'Minimalista', value: 'minimalista' }, { label: 'Cinemático Clásico', value: 'clasico' }, { label: 'Editorial Flotante', value: 'flotante' }], defaultValue: 'clasico' }),
              body: fields.select({ label: 'Body', options: [{ label: 'Lectura Profunda (Serif)', value: 'serif' }, { label: 'Manifiesto (Sans)', value: 'sans' }, { label: 'Técnico (Mono)', value: 'mono' }], defaultValue: 'serif' }),
              imagen: fields.select({ label: 'Imagen', options: [{ label: 'Vertical Fade (Eje Y)', value: 'fade-y' }, { label: 'Paralaje Lateral (Eje X)', value: 'paralaje-x' }, { label: 'Zoom Profundo (Eje Z)', value: 'zoom-z' }], defaultValue: 'fade-y' }),
              footer: fields.select({ label: 'Footer', options: [{ label: 'Completo con Metadatos', value: 'completo' }, { label: 'Minimalista Sutil', value: 'minimal' }, { label: 'Retorno Rápido', value: 'retorno' }], defaultValue: 'completo' }),
            }),
          }
        ),

        coverImage: createCoverImage('ensayos-cinematicos'),
        gallery: createGallery('ensayos-cinematicos', 'Galería de Imágenes Cinemáticas (GSAP)'),
        excerpt: fields.text({ label: 'Excerpt / Sinopsis (Opcional)', multiline: true }),
        dek: dekField,
        date: fields.date({ label: 'Fecha de Publicación', defaultValue: { kind: 'today' } }),
        content: createContentDocument('ensayos-cinematicos')
      },
    }),

    informesPremium: collection({
      label: '🧪 Informes Premium',
      slugField: 'titulo',
      path: 'src/content/informes/*/',
      format: { contentField: 'contenido' },
      schema: {
        generador: createTgpEngineField('⚡ Generador de Informe Premium', GeneradorInformePremium),
        titulo: fields.slug({ name: { label: 'Título del Informe' } }),
        volanta: fields.text({ label: 'Volanta / Excerpt', description: 'Aparecerá en tipografía Mono por encima del título principal.', multiline: true }),
        
        coleccion: fields.select({
          label: 'Colección Temática',
          options: [{ label: 'Liminal', value: 'liminal' }, { label: 'Heterodoxia', value: 'heterodoxia' }, { label: 'Anomalías', value: 'anomalias' }, { label: 'Apócrifa', value: 'apocrifa' }],
          defaultValue: 'liminal',
        }),

        fuenteVisual: fields.select({
          label: 'Motor Gráfico',
          options: [{ label: 'Histórica (Wikimedia Commons)', value: 'wikimedia' }, { label: 'Sintética (VEO3 / Imagen 3)', value: 'sintetica' }],
          defaultValue: 'wikimedia',
        }),

        directrices: fields.text({
          label: 'Directrices Temáticas',
          description: 'Instrucciones adicionales para el motor cognitivo. Ej: "Enfocarse en la dimensión simbólica y la memoria colectiva."',
          multiline: true,
        }),

        tags: fields.multiselect({
          label: 'Tags',
          options: [
            { label: 'Liminal', value: 'liminal' }, { label: 'Heterodoxia', value: 'heterodoxia' }, { label: 'Anomalías', value: 'anomalias' },
            { label: 'Apócrifa', value: 'apocrifa' }, { label: 'Arqueosemiótica', value: 'arqueosemiotica' }, { label: 'Historia Profunda', value: 'historia-profunda' },
            { label: 'Simbología', value: 'simbologia' }, { label: 'Gnosis', value: 'gnosis' },
          ],
        }),

        imagenDestacada: fields.text({
          label: 'URL de Imagen en R2 (Generada Automáticamente)',
          description: 'El orquestador llenará este campo tras procesar y subir la imagen en WebP a Cloudflare R2. No editar manualmente.',
          validation: { isRequired: false },
        }),

        contenido: fields.markdoc({
          label: 'Cuerpo del Ensayo',
          extension: 'mdoc',
        }),
      },
    }),
  },
});