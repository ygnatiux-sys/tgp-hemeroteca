// Importación directa de portadas de assets locales en alta resolución
import imgPumapunku from '../assets/alternativa/pumapunku.jpg';
import imgOlmeca from '../assets/alternativa/olmeca.jpg';
import imgMoai from '../assets/alternativa/moai.jpg';
import imgDiquis from '../assets/alternativa/esfera-diquis.jpg';
import imgBaalbek from '../assets/alternativa/baalbek.jpg';
import imgEsfinge from '../assets/alternativa/esfinge-erosion.jpg';
import imgOsireion from '../assets/alternativa/osireion.jpg';
import imgGunungPadang from '../assets/alternativa/gunung-padang.jpg';
import imgNanMadol from '../assets/alternativa/nan-madol.jpg';
import imgBarabar from '../assets/alternativa/barabar.jpg';
import imgDerinkuyu from '../assets/alternativa/derinkuyu.jpg';

export interface CustomCollectionItem {
  slug: string;
  href: string;
  img: string;
  entry: {
    title: string;
    category: string;
    coverImage: string;
    excerpt: string;
    dek?: string;
    date: string;
    themeColor: string;
    sitio?: string;
    [key: string]: unknown;
  };
}

export interface CustomCollectionGroup {
  catKey: string;
  catLabel: string;
  href: string;
  entorno: string;
  essays: CustomCollectionItem[];
}

export const customCollections: CustomCollectionGroup[] = [
  {
    catKey: 'america-secrets',
    catLabel: 'América Secrets',
    href: '/colecciones/america-secrets/',
    entorno: 'Tiwanaku · Mesoamérica · Rapa Nui · Diquís',
    essays: [
      {
        slug: 'pumapunku',
        href: '/colecciones/america-secrets/pumapunku/',
        img: imgPumapunku.src,
        entry: {
          title: 'Pumapunku · Encastres de Precisión Lítica',
          category: 'América Secrets',
          coverImage: imgPumapunku.src,
          excerpt: 'Muros ciclópeos y bloques de andesita con desbaste y acoples de tolerancia cero en el altiplano andino.',
          dek: 'Muros ciclópeos y bloques de andesita con desbaste y acoples de tolerancia cero.',
          date: '2026-04-01T00:00:00.000Z',
          themeColor: 'andesita',
          sitio: 'Pumapunku, Tiwanaku, Bolivia',
        },
      },
      {
        slug: 'olmeca',
        href: '/colecciones/america-secrets/olmeca/',
        img: imgOlmeca.src,
        entry: {
          title: 'Cabezas Olmecas · Monolitos en Basalto',
          category: 'América Secrets',
          coverImage: imgOlmeca.src,
          excerpt: 'Monolitos volcánicos colosales transportados sin rueda a través de pantanos mesoamericanos.',
          dek: 'Monolitos volcánicos de 20 toneladas transportados sin rueda.',
          date: '2026-03-25T00:00:00.000Z',
          themeColor: 'obsidiana',
          sitio: 'La Venta y San Lorenzo, México',
        },
      },
      {
        slug: 'moai',
        href: '/colecciones/america-secrets/moai/',
        img: imgMoai.src,
        entry: {
          title: 'Moais de Rapa Nui · Gigantes de Toba Volcánica',
          category: 'América Secrets',
          coverImage: imgMoai.src,
          excerpt: 'Estatuas monumentales de Rano Raraku y la ingeniería megalítica del Pacífico sur.',
          dek: 'Estatuas colosales de Rano Raraku y la ingeniería megalítica.',
          date: '2026-03-20T00:00:00.000Z',
          themeColor: 'volcanico',
          sitio: 'Rano Raraku, Isla de Pascua',
        },
      },
      {
        slug: 'diquis',
        href: '/colecciones/america-secrets/diquis/',
        img: imgDiquis.src,
        entry: {
          title: 'Esferas del Diquís · Geometría Lítica Perfecta',
          category: 'América Secrets',
          coverImage: imgDiquis.src,
          excerpt: 'Petroesferas precolombinas pulidas con curvatura esférica de extrema precisión matemática.',
          dek: 'Petroesferas precolombinas pulidas con curvatura esférica de extrema precisión.',
          date: '2026-03-15T00:00:00.000Z',
          themeColor: 'diquis',
          sitio: 'Delta del Diquís, Costa Rica',
        },
      },
      {
        slug: 'gobekli-tepe',
        href: '/colecciones/america-secrets/gobekli-tepe/',
        img: imgBaalbek.src,
        entry: {
          title: 'Göbekli Tepe · Pilares en T del Neolítico',
          category: 'América Secrets',
          coverImage: imgBaalbek.src,
          excerpt: 'Santuarios megalíticos circulares datados hace más de 11.000 años en Anatolia.',
          dek: 'Santuarios megalíticos circulares de más de 11.000 años.',
          date: '2026-03-10T00:00:00.000Z',
          themeColor: 'anatolico',
          sitio: 'Sanliurfa, Anatolia',
        },
      },
    ],
  },
  {
    catKey: 'misterios-del-africa',
    catLabel: 'Misterios del África',
    href: '/colecciones/misterios-del-africa/',
    entorno: 'Meseta de Giza · Abidos · Alto Egipto',
    essays: [
      {
        slug: 'giza-cicatriz-del-agua',
        href: '/colecciones/misterios-del-africa/giza/',
        img: imgEsfinge.src,
        entry: {
          title: 'La Cicatriz del Agua · Erosión Pluvial en Giza',
          category: 'Misterios del África',
          coverImage: imgEsfinge.src,
          excerpt: 'Estratos ondulados y desgaste pluvial masivo en el recinto de la Esfinge previo a la desecación del Sáhara.',
          dek: 'Estratos ondulados y desgaste pluvial masivo en el recinto de la Esfinge.',
          date: '2026-03-28T00:00:00.000Z',
          themeColor: 'sahara',
          sitio: 'Recinto de la Esfinge, Giza, Egipto',
        },
      },
      {
        slug: 'osireion-abidos',
        href: '/colecciones/misterios-del-africa/osireion/',
        img: imgOsireion.src,
        entry: {
          title: 'El Osireion de Abidos · Granito Megalítico',
          category: 'Misterios del África',
          coverImage: imgOsireion.src,
          excerpt: 'Pilares monolíticos de 100 toneladas bajo el nivel freático y arquitectura anepigráfica desnuda.',
          dek: 'Pilares monolíticos de 100 toneladas sumergidos bajo el nivel freático.',
          date: '2026-03-22T00:00:00.000Z',
          themeColor: 'abidos',
          sitio: 'Complejo de Seti I, Abidos, Egipto',
        },
      },
    ],
  },
  {
    catKey: 'asia-secrets',
    catLabel: 'Asia Secrets',
    href: '/colecciones/asia-secrets/',
    entorno: 'Java · Micronesia · Colinas de Barabar',
    essays: [
      {
        slug: 'gunung-padang',
        href: '/test-gunung-padang',
        img: imgGunungPadang.src,
        entry: {
          title: 'Gunung Padang · Pirámide Oculta de Java',
          category: 'Asia Secrets',
          coverImage: imgGunungPadang.src,
          excerpt: 'Estructura escalonada de basalto columnar con anomalías detectadas por georradar bajo el estrato del Holoceno.',
          dek: 'Estructura escalonada de basalto columnar y anomalías por georradar.',
          date: '2026-03-30T00:00:00.000Z',
          themeColor: 'basalto',
          sitio: 'Karyamukti, Cianjur, Java Occidental',
        },
      },
      {
        slug: 'nan-madol',
        href: '/test-nan-madol',
        img: imgNanMadol.src,
        entry: {
          title: 'Nan Madol · La Ciudadela Flotante de Micronesia',
          category: 'Asia Secrets',
          coverImage: imgNanMadol.src,
          excerpt: 'Arquitectura ciclópea en basalto columnar levantada sobre arrecifes de coral en el Pacífico.',
          dek: 'Arquitectura ciclópea en basalto columnar sobre arrecifes.',
          date: '2026-03-18T00:00:00.000Z',
          themeColor: 'maritimo',
          sitio: 'Pohnpei, Estados Federados de Micronesia',
        },
      },
      {
        slug: 'barabar-asia',
        href: '/test-barabar',
        img: imgBarabar.src,
        entry: {
          title: 'Cuevas de Barabar · Cámaras de Resonancia Sonora',
          category: 'Asia Secrets',
          coverImage: imgBarabar.src,
          excerpt: 'Bóvedas de granito talladas con pulido especular perfecto e ingeniería acústica milenaria en Bihar.',
          dek: 'Bóvedas de granito con pulido especular y acústica sagrada.',
          date: '2026-03-12T00:00:00.000Z',
          themeColor: 'resonancia',
          sitio: 'Distrito de Jehanabad, Bihar, India',
        },
      },
    ],
  },
  {
    catKey: 'enigmas-subterraneos',
    catLabel: 'Alternative · Enigmas Subterráneos',
    href: '/colecciones/enigmas-subterraneos/',
    entorno: 'Capadocia · Valle de Beqaa · Hipogeos de la India',
    essays: [
      {
        slug: 'derinkuyu',
        href: '/colecciones/enigmas-subterraneos/derinkuyu/',
        img: imgDerinkuyu.src,
        entry: {
          title: 'Derinkuyu · La Metrópolis Hipogea de Capadocia',
          category: 'Alternative · Enigmas Subterráneos',
          coverImage: imgDerinkuyu.src,
          excerpt: 'Megaciudad subterránea de 18 niveles descendentes en toba volcánica para 20.000 personas en aislamiento hermético.',
          dek: 'Megaciudad subterránea de 18 niveles en toba volcánica.',
          date: '2026-03-24T00:00:00.000Z',
          themeColor: 'hipogeo',
          sitio: 'Derinkuyu, Nevsehir, Capadocia, Turquía',
        },
      },
      {
        slug: 'barabar-subterraneo',
        href: '/colecciones/enigmas-subterraneos/barabar/',
        img: imgBarabar.src,
        entry: {
          title: 'Cuevas de Barabar · Acústica Sagrada & Espejo Granítico',
          category: 'Alternative · Enigmas Subterráneos',
          coverImage: imgBarabar.src,
          excerpt: 'Cámaras hipogeas excavadas en la roca viva con superficies pulidas como cristal.',
          dek: 'Cámaras hipogeas excavadas en la roca viva con pulido vítreo.',
          date: '2026-03-16T00:00:00.000Z',
          themeColor: 'ambar',
          sitio: 'Cuevas de Barabar, Bihar, India',
        },
      },
      {
        slug: 'baalbek',
        href: '/test-baalbek',
        img: imgBaalbek.src,
        entry: {
          title: 'Baalbek · Monolitos Titánicos del Líbano',
          category: 'Alternative · Enigmas Subterráneos',
          coverImage: imgBaalbek.src,
          excerpt: 'Bloques de piedra de más de 800 toneladas tallados y ensamblados en el Trilitón.',
          dek: 'Bloques colosales de más de 800 toneladas en el Trilitón.',
          date: '2026-03-08T00:00:00.000Z',
          themeColor: 'titanio',
          sitio: 'Heliópolis, Valle de Beqaa, Líbano',
        },
      },
    ],
  },
];
