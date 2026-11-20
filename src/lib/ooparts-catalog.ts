import type { ImageMetadata } from 'astro';

import imgKlerksdorp from '../assets/fx-samples/esferas-klerksdorp.jpg';
import imgAnticitera from '../assets/fx-samples/mecanismo-anticitera.jpg';
import imgMartillo from '../assets/fx-samples/martillo-londres.jpg';
import imgCalaveras from '../assets/fx-samples/craneo-calaveras.jpg';
import imgBagdad from '../assets/fx-samples/bateria-bagdad.jpg';
import imgEolitos from '../assets/fx-samples/eolitos-tajo.jpg';
import imgDelhi from '../assets/fx-samples/pilar-delhi.jpg';
import imgPiriReis from '../assets/fx-samples/mapa-piri-reis.jpg';

export type OopartFxKey =
  | 'barabar'
  | 'pumapunku'
  | 'tectonic'
  | 'abyss'
  | 'pluvial'
  | 'stratigraphic'
  | 'blade'
  | 'diagonal';

export interface OopartItem {
  slug: string;
  fxKey: OopartFxKey;
  fxLabel: string;
  title: string;
  heroWord: string;
  subtitleWord?: string;
  subtitle: string;
  location: string;
  monogram?: string;
  teaserTitle?: string;
  image: ImageMetadata;
  date: string;
  excerpt: string;
  paragraphs: string[];
  href: string;
}

export const OOPART_ITEMS: OopartItem[] = [
  {
    slug: 'esferas-de-klerksdorp',
    fxKey: 'barabar',
    fxLabel: '1. Resonancia & Espejo',
    title: 'Esferas de Klerksdorp',
    heroWord: 'KLERKSDORP',
    subtitle: 'Concreciones precámbricas y simetría mineral bajo sospecha',
    location: 'Transvaal Occidental, Sudáfrica · Estratos de Pirofilita',
    image: imgKlerksdorp,
    date: '2026-11-20T00:00:00.000Z',
    excerpt: 'Nódulos metálicos y esferoides de pirofilita con surcos ecuatoriales hallados en estratos de 2.800 millones de años.',
    paragraphs: [
      'A lo largo del siglo XX, mineros de la región de Ottosdal extrajeron centenares de nódulos metálicos y esferoides de hematita y pirita incrustados en sedimentos de pirofilita precámbrica. Varios ejemplares exhiben surcos ecuatoriales paralelos de notable regularidad geométrica.',
      'Mientras Michael Cremo y Richard Thompson las catalogaron en Forbidden Archeology como vestigios de manufactura anómala en estratos de 2.800 millones de años, la petrología moderna (Paul V. Heinrich) demostró que se trata de concreciones minerales diagenéticas formadas por cristalización radial. La tensión entre la perfección aparente del contorno y la física mineral explica por qué este motivo exige el efecto de refracción espejo.',
    ],
    href: '/colecciones/ooparts/esferas-de-klerksdorp/',
  },
  {
    slug: 'mecanismo-de-anticitera',
    fxKey: 'pumapunku',
    fxLabel: '2. Corte Láser CNC',
    title: 'Mecanismo de Anticitera',
    heroWord: 'ANTICITERA',
    subtitleWord: 'CÁLCULO HELENÍSTICO',
    subtitle: 'Tren de engranajes diferenciales en bronce sumergido',
    location: 'Naufragio de Anticitera, Grecia · c. 150–100 a.C.',
    image: imgAnticitera,
    date: '2026-11-20T00:00:00.000Z',
    excerpt: 'Más de treinta engranajes de bronce con dientes triangulares tallados a mano que reescribieron la mecánica helenística.',
    paragraphs: [
      'Rescatado en 1901 de un pecio romano frente a la isla de Anticitera, este bloque calcificado de bronce contenía más de treinta engranajes de dientes triangulares tallados a mano con tolerancias submilimétricas. Su existencia obligó a reescribir la historia de la mecánica helenística.',
      'Lejos de requerir tecnología perdida mística, el dispositivo confirma que la escuela de Arquímedes e Hiparco dominaba el cálculo epicicloidal para predecir eclipses y ciclos olímpicos. Su silueta técnica encaja de manera natural con la telemetría y el barrido láser de precisión.',
    ],
    href: '/colecciones/ooparts/mecanismo-de-anticitera/',
  },
  {
    slug: 'martillo-de-londres',
    fxKey: 'tectonic',
    fxLabel: '3. Fractura Tectónica',
    title: 'Martillo de Londres (Texas)',
    heroWord: 'LONDRES',
    subtitle: 'Un martillo de hierro encapsulado en caliza cretácica',
    location: 'London, Condado de Kimble, Texas · 1936',
    image: imgMartillo,
    date: '2026-11-20T00:00:00.000Z',
    excerpt: 'Herramienta de hierro con mango mineralizado hallada en una concreción calcárea junto al arroyo Red Creek.',
    paragraphs: [
      'Hallado por Max y Emma Hahn junto al arroyo Red Creek en 1936, este martillo de hierro con mango de madera parcialmente carbonizado apareció encapsulado dentro de una concreción de caliza cretácica. La pieza se volvió un emblema recurrente en la literatura sobre artefactos fuera de lugar.',
      'El análisis geológico de Glen Kuban aclaró el enigma sin negar el dato material: los minerales disueltos de la formación Edwards pueden cementar sedimentos alrededor de una herramienta caída del siglo XIX en cuestión de décadas, sin que la edad de la roca madre se transfiera automáticamente al objeto intruso.',
    ],
    href: '/colecciones/ooparts/martillo-de-londres/',
  },
  {
    slug: 'table-mountain-calaveras',
    fxKey: 'abyss',
    fxLabel: '4. Paralaje de Abismo Z',
    title: 'Table Mountain y el Cráneo de Calaveras',
    heroWord: 'CALAVERAS',
    subtitle: 'Gravas auríferas de Table Mountain y el archivo minero del XIX',
    location: 'Condado de Calaveras, California · 1866',
    image: imgCalaveras,
    date: '2026-11-20T00:00:00.000Z',
    excerpt: 'Los expedientes de Josiah D. Whitney bajo las coladas de basalto terciarias rescatados por Michael Cremo.',
    paragraphs: [
      'Durante la fiebre del oro californiana, las galerías excavadas bajo las coladas de basalto de Table Mountain arrojaron morteros líticos y un cráneo humano reportado a 40 metros de profundidad por el geólogo estatal Josiah Dwight Whitney. Cremo rescató estos expedientes como pieza central de sus Tablas de Evidencia.',
      'Las pruebas posteriores de flúor, nitrógeno y datación radiocarbónica revelaron que el cráneo era reciente (aproximadamente mil años) y había ingresado por intrusión minera o sepultura secundaria en las gravas auríferas. La perspectiva de caída hacia el túnel evoca esa ambigüedad subterránea del archivo minero decimonónico.',
    ],
    href: '/colecciones/ooparts/table-mountain-calaveras/',
  },
  {
    slug: 'bateria-de-bagdad',
    fxKey: 'pluvial',
    fxLabel: '5. Erosión Pluvial',
    title: 'Batería de Bagdad',
    heroWord: 'BAGDAD',
    subtitle: 'Terracota, betún y cobre en la frontera de la electroquímica antigua',
    location: 'Khujut Rabu, Irak · Período Parto / Sasánida',
    image: imgBagdad,
    date: '2026-11-20T00:00:00.000Z',
    excerpt: 'Vasija parta con cilindro de cobre y varilla de hierro sellada en betún capaz de generar tensión galvánica.',
    paragraphs: [
      'Descubierta en 1936 cerca de Bagdad y estudiada por Wilhelm König, esta vasija de terracota de catorce centímetros guarda un cilindro de cobre sellado con betún y atravesado por una varilla de hierro corroída. Al llenarla con un electrolito ácido suave, el conjunto genera alrededor de 0,8 a 1,5 voltios.',
      'Aunque la hipótesis de una pila galvánica para galvanoplastia compite con explicaciones más sobrias —como recipientes rituales para guardar rollos de papiro mágicos—, la corrosión del metal y la pátina húmeda encuentran en la cascada pluvial su contrapunto visual exacto.',
    ],
    href: '/colecciones/ooparts/bateria-de-bagdad/',
  },
  {
    slug: 'eolitos-valle-del-tajo',
    fxKey: 'stratigraphic',
    fxLabel: '6. Excavación 5 Estratos',
    title: 'Eolitos de Kent y del Valle del Tajo',
    heroWord: 'EOLITOS',
    subtitle: 'Las lascas terciarias de Kent y el Valle del Tajo en el debate de Cremo',
    location: 'Meseta de Kent (Inglaterra) & Ota (Portugal) · 1860–1910',
    image: imgEolitos,
    date: '2026-11-20T00:00:00.000Z',
    excerpt: 'Miles de pedernales atribuidos al Terciario por Harrison, Moir y Carlos Ribeiro frente a la tafonomía moderna.',
    paragraphs: [
      'A fines del siglo XIX, investigadores como Benjamin Harrison, J. Reid Moir y el geólogo portugués Carlos Ribeiro reunieron miles de pedernales fracturados en estratos del Plioceno y Mioceno, sosteniendo que habían sido tallados por homínidos terciarios mucho antes del Pleistoceno.',
      'Décadas después, la tafonomía experimental demostró que la presión glacial, el golpeteo fluvial y los movimientos de suelo producen lascas idénticas a los llamados eolitos. La lectura horizontal de cinco capas estratigráficas traduce visualmente ese debate sobre quién talla la piedra: la mano o el estrato.',
    ],
    href: '/colecciones/ooparts/eolitos-valle-del-tajo/',
  },
  {
    slug: 'pilar-de-hierro-de-delhi',
    fxKey: 'blade',
    fxLabel: '7. The Blade Wipe',
    title: 'Pilar de Hierro de Delhi',
    heroWord: 'PILAR DE DELHI',
    subtitle: 'Dieciséis siglos de monzones sobre hierro forjado incorrupto',
    location: 'Complejo Qutb, Nueva Delhi · Siglo IV d.C.',
    monogram: 'Φ',
    teaserTitle: 'Forja Incorrupta',
    image: imgDelhi,
    date: '2026-11-20T00:00:00.000Z',
    excerpt: 'Monolito metalúrgico de seis toneladas protegido por una película cristalina pasivante de fósforo y misawita.',
    paragraphs: [
      'Erigido durante el reinado de Chandragupta II, este monolito metálico de 7,2 metros y más de seis toneladas de hierro forjado ha resistido dieciséis siglos de monzones sin sufrir corrosión estructural. Su superficie oscura parece desafiar la oxidación común.',
      'La metalurgia contemporánea identificó la causa material: un alto contenido de fósforo en la forja artesanal indujo la formación de una película pasivante cristalina de misawita y fosfatos férricos que sella el núcleo. El corte diagonal del filo luminoso subraya esa frontera exacta entre atmósfera hostil y metal incorrupto.',
    ],
    href: '/colecciones/ooparts/pilar-de-hierro-de-delhi/',
  },
  {
    slug: 'mapa-de-piri-reis',
    fxKey: 'diagonal',
    fxLabel: '8. Diagonal Canvas Scale',
    title: 'Mapa de Piri Reis (1513)',
    heroWord: 'PIRI REIS',
    subtitle: 'Cartografía otomana de 1513 y el contorno austral del globo',
    location: 'Palacio de Topkapi, Estambul · 1513',
    teaserTitle: 'Portulano de 1513',
    image: imgPiriReis,
    date: '2026-11-20T00:00:00.000Z',
    excerpt: 'Carta portulana sobre piel de gacela en el cruce entre Terra Australis teórica y el mito cartográfico moderno.',
    paragraphs: [
      'Trazado en piel de gacela por el almirante otomano Ahmed Muhiddin Piri a partir de una veintena de cartas portuguesas, árabes y colombianas, este fragmento portulano muestra la costa sudamericana con un trazado continuo que luego se curva hacia el este austral.',
      'Mientras Charles Hapgood interpretó esa curva inferior como la Antártida libre de hielos copiada de una civilización desaparecida, la cartografía histórica mostró que los navegantes del siglo XVI prolongaban Sudamérica hacia una Terra Australis teórica para cuadrar el globo. La apertura de ojo diagonal refleja ese salto entre la carta cerrada y el mundo abierto.',
    ],
    href: '/colecciones/ooparts/mapa-de-piri-reis/',
  },
];
