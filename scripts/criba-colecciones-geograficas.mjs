import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');

// Colecciones a rastrear
const collectionsToScan = ['ensayos', 'georreferencias', 'ensayos-cinematicos', 'notas'];

const REGIONES = {
  asia: {
    nombre: 'Asia Secrets',
    subtitulo: 'Sagrarios de la Ruta de la Seda, Ciclópeos del Pacífico & Georradar',
    posts: []
  },
  america: {
    nombre: 'América Secrets',
    subtitulo: 'Mecanizado Andino, Geometría Mesoamericana & Andesita Quirúrgica',
    posts: []
  },
  africa: {
    nombre: 'África Misteriosa',
    subtitulo: 'Pirámides Negras de Nubia, Esfinges Pluviales & Litología Primaria',
    posts: []
  },
  europa: {
    nombre: 'Europa Oculta & Catacumbas',
    subtitulo: 'Megalitismo Atlántico, Cátaros, Herejías & Laberintos Subterráneos',
    posts: []
  },
  oceania: {
    nombre: 'Oceanía & Polinesia Ancestral',
    subtitulo: 'Megaconstrucciones de Basalto en Arrecifes, Moais & Pueblos de las Olas',
    posts: []
  },
  filosofia: {
    nombre: 'Doctrina & Filosofía Trascendental',
    subtitulo: 'Tratados Arquetípicos, Gnósticos, Escolástica & Metafísica',
    posts: []
  }
};

// Diccionario de afinidad geográfica por palabras clave
function clasificarPost(slug, title, sitio, category) {
  const text = `${slug} ${title} ${sitio} ${category}`.toLowerCase();

  // Oceanía y Polinesia Ancestral
  if (
    text.includes('nan-madol') ||
    text.includes('nan madol') ||
    text.includes('moai') ||
    text.includes('rapa nui') ||
    text.includes('polines') ||
    text.includes('oceania') ||
    text.includes('micronesia') ||
    text.includes('gitanos del mar') ||
    text.includes('los-gitanos-del-mar')
  ) {
    return 'oceania';
  }

  // América
  if (
    text.includes('pumapunku') ||
    text.includes('olmeca') ||
    text.includes('diquis') ||
    text.includes('bonampak') ||
    text.includes('tikal') ||
    text.includes('palenque') ||
    text.includes('temple-of-the-sun') ||
    text.includes('azteca') ||
    text.includes('moctezuma') ||
    text.includes('qapaq-nan') ||
    text.includes('atacama') ||
    text.includes('chilinga') ||
    text.includes('capacete-brasil') ||
    text.includes('pedra-inga') ||
    text.includes('valle-de-la-luna') ||
    text.includes('isla-de-los-estados') ||
    text.includes('patagonia') ||
    text.includes('tango') ||
    text.includes('aguara-guazu') ||
    text.includes('tatu-carreta') ||
    text.includes('tero') ||
    text.includes('nandu') ||
    text.includes('borges') ||
    text.includes('aramu-muru') ||
    text.includes('hayumarca') ||
    text.includes('condor andino') ||
    text.includes('el-condor-andino') ||
    text.includes('tapir') ||
    text.includes('gato-montes') ||
    text.includes('vacas') ||
    text.includes('america-invertida')
  ) {
    return 'america';
  }

  // África
  if (
    text.includes('egipto') ||
    text.includes('ankh') ||
    text.includes('osiris') ||
    text.includes('isis') ||
    text.includes('saqqara') ||
    text.includes('dahshur') ||
    text.includes('piramide-roja') ||
    text.includes('kheper') ||
    text.includes('giza') ||
    text.includes('esfinge') ||
    text.includes('osireion') ||
    text.includes('meroe') ||
    text.includes('nubia') ||
    text.includes('cartago') ||
    text.includes('klerksdorp') ||
    text.includes('olumo-rock')
  ) {
    return 'africa';
  }

  // Asia
  if (
    text.includes('ishi-no-hoden') ||
    text.includes('gunung-padang') ||
    text.includes('barabar') ||
    text.includes('yonaguni') ||
    text.includes('gengis-khan') ||
    text.includes('ellora') ||
    text.includes('buda') ||
    text.includes('confucio') ||
    text.includes('amaterasu') ||
    text.includes('nichiren') ||
    text.includes('sadhguru') ||
    text.includes('krishnamurti') ||
    text.includes('adam-s-bridge') ||
    text.includes('hunza') ||
    text.includes('qumram') ||
    text.includes('esenios') ||
    text.includes('nag-hammadi') ||
    text.includes('nestorianos') ||
    text.includes('simon-el-estilita') ||
    text.includes('baalbek') ||
    text.includes('derinkuyu')
  ) {
    return 'asia';
  }

  // Europa
  if (
    text.includes('altamira') ||
    text.includes('lascaux') ||
    text.includes('stonehenge') ||
    text.includes('julio-cesar') ||
    text.includes('galos') ||
    text.includes('neron') ||
    text.includes('roma') ||
    text.includes('cestia') ||
    text.includes('atila') ||
    text.includes('homero') ||
    text.includes('troya') ||
    text.includes('schlieman') ||
    text.includes('ulyses') ||
    text.includes('socrates') ||
    text.includes('platon') ||
    text.includes('neoplatonicos') ||
    text.includes('san-agustin') ||
    text.includes('carpocracianos') ||
    text.includes('cataros') ||
    text.includes('albigenses') ||
    text.includes('montsegur') ||
    text.includes('escolastica') ||
    text.includes('argonautas') ||
    text.includes('cnosos') ||
    text.includes('delfos') ||
    text.includes('tacito') ||
    text.includes('tucidides') ||
    text.includes('caligula') ||
    text.includes('espartaco') ||
    text.includes('elcano') ||
    text.includes('herodoto') ||
    text.includes('alejandro-magno') ||
    text.includes('1984')
  ) {
    return 'europa';
  }

  return 'filosofia';
}

// Escanear colecciones
collectionsToScan.forEach(colName => {
  const dirPath = path.join(CONTENT_DIR, colName);
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath);
  entries.forEach(slug => {
    const jsonPath = path.join(dirPath, slug, 'index.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const title = data.title || slug;
        const sitio = data.sitioGeohistorico || '';
        const cat = data.category || '';
        const cover = data.coverImage || '';
        
        const regionKey = clasificarPost(slug, title, sitio, cat);
        REGIONES[regionKey].posts.push({
          coleccionOrigen: colName,
          slug,
          title,
          sitio,
          cat,
          hasCover: Boolean(cover)
        });
      } catch (e) {}
    }
  });
});

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  TGP CRIBA GEOGRÁFICA: PROPUESTA DE COLECCIONES CONTINENTALES        ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

for (const [key, reg] of Object.entries(REGIONES)) {
  console.log(`\n======================================================================`);
  console.log(`🌐 [${key.toUpperCase()}] ${reg.nombre.toUpperCase()}`);
  console.log(`   "${reg.subtitulo}"`);
  console.log(`   Total Hitos / Ensayos: ${reg.posts.length}`);
  console.log(`----------------------------------------------------------------------`);
  reg.posts.forEach((p, idx) => {
    console.log(`  ${idx + 1}. [${p.coleccionOrigen}] ${p.title} (${p.slug})`);
  });
}
