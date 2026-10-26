import fs from 'node:fs';
import path from 'node:path';

const HEMEROTECA_DIR = 'c:/Users/ygnat/tgp-hemeroteca';
const WEB_FINAL_DIR = 'c:/Users/ygnat/WEB FINAL 2026';
const REPOMIX_DIR = 'c:/Users/ygnat/REPOMIX clean GAS & SANDBOXES';

const BASE_URL_HEMEROTECA = 'https://thegreatpuzzleproject.com';
const BASE_URL_EDICIONES = 'https://ediciones.thegreatpuzzleproject.com';
const R2_STORAGE_BASE = 'https://storage.thegreatpuzzleproject.com';

console.log('🚀 INICIANDO COMPILADOR ONTOLÓGICO UNIVERSAL DE THE GREAT PUZZLE PROJECT');
console.log('------------------------------------------------------------------------');

// 1. DEFINICIÓN DE CONTINENTES / EJES CARDINALES
const CONTINENTES = [
  { id: 'continente-america', name: 'América Secrets', region: 'america', val: 32, desc: 'Mecanizado Andino, Geometría Mesoamericana & Andesita Quirúrgica' },
  { id: 'continente-asia', name: 'Asia Secrets', region: 'asia', val: 32, desc: 'Sagrarios de la Ruta de la Seda, Ciclópeos del Pacífico & Georradar' },
  { id: 'continente-africa', name: 'África Misteriosa', region: 'africa', val: 32, desc: 'Pirámides Negras de Nubia, Esfinges Pluviales & Litología Primaria' },
  { id: 'continente-europa', name: 'Europa Oculta', region: 'europa', val: 32, desc: 'Megalitismo Atlántico, Cátaros, Herejías & Laberintos Subterráneos' },
  { id: 'continente-oceania', name: 'Oceanía Ancestral', region: 'oceania', val: 30, desc: 'Megaconstrucciones de Basalto en Arrecifes, Moais & Pueblos de las Olas' },
  { id: 'continente-filosofia', name: 'Doctrina & Filosofía Trascendental', region: 'filosofia', val: 32, desc: 'Tratados Arquetípicos, Gnósticos, Escolástica & Metafísica' }
];

// 2. FUNCIÓN DE CLASIFICACIÓN CONTINENTAL Y AFINIDAD (Basada en tu script criba-colecciones-geograficas.mjs)
function clasificarRegion(slug = '', title = '', sitio = '', category = '') {
  const text = `${slug} ${title} ${sitio} ${category}`.toLowerCase();

  // Oceanía y Polinesia
  if (/nan-madol|nan madol|moai|rapa nui|polines|oceania|micronesia|gitanos del mar|los-gitanos-del-mar/.test(text)) {
    return 'oceania';
  }
  // América
  if (/pumapunku|olmeca|diquis|bonampak|tikal|palenque|temple-of-the-sun|azteca|moctezuma|qapaq-nan|atacama|chilinga|capacete-brasil|pedra-inga|valle-de-la-luna|isla-de-los-estados|patagonia|tango|aguara-guazu|tatu-carreta|tero|nandu|borges|aramu-muru|hayumarca|condor|tapir|gato-montes|vacas|america-invertida|chavin|tiwanaku|machu|peru|bolivia|mexico|colombia|chile|argentina/.test(text)) {
    return 'america';
  }
  // África
  if (/egipto|ankh|osiris|isis|saqqara|dahshur|piramide-roja|kheper|giza|esfinge|osireion|meroe|nubia|cartago|klerksdorp|olumo-rock|sudan|etiopia|africa/.test(text)) {
    return 'africa';
  }
  // Asia
  if (/ishi-no-hoden|gunung-padang|barabar|yonaguni|gengis-khan|ellora|buda|confucio|amaterasu|nichiren|sadhguru|krishnamurti|adam-s-bridge|hunza|qumram|esenios|nag-hammadi|nestorianos|simon-el-estilita|baalbek|derinkuyu|asia|india|japon|china|tibet|sumeria|mesopotamia/.test(text)) {
    return 'asia';
  }
  // Europa
  if (/altamira|lascaux|stonehenge|julio-cesar|galos|neron|roma|cestia|atila|homero|troya|schlieman|ulyses|socrates|platon|neoplatonicos|delfos|oraculo|herodoto|tucidides|tacito|elcano|gomera|grecia|atenas|europa|cataros/.test(text)) {
    return 'europa';
  }

  return 'filosofia';
}

const nodes = [];
const links = [];
const nodeMap = new Map();

function addNode(node) {
  if (nodeMap.has(node.id)) return nodeMap.get(node.id);
  nodes.push(node);
  nodeMap.set(node.id, node);
  return node;
}

function addLink(sourceId, targetId, relationship, value = 1) {
  if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) return;
  if (sourceId === targetId) return;
  links.push({ source: sourceId, target: targetId, relationship, value });
}

// 3. REGISTRAR NODOS CONTINENTALES
CONTINENTES.forEach(c => {
  addNode({
    id: c.id,
    name: c.name,
    slug: c.region,
    type: 'CONTINENTE',
    group: 'Continente',
    region: c.region,
    val: c.val,
    desc: c.desc,
    url: `${BASE_URL_HEMEROTECA}/colecciones/#${c.region}`
  });
});

// Interconectar continentes entre sí formando la constelación base
for (let i = 0; i < CONTINENTES.length; i++) {
  for (let j = i + 1; j < CONTINENTES.length; j++) {
    addLink(CONTINENTES[i].id, CONTINENTES[j].id, 'CONTINENTAL_AXIS', 0.5);
  }
}

// 4. LEER GEORREFERENCIAS (Hemeroteca src/content/georreferencias)
console.log('📍 Extrayendo Georreferencias de Hemeroteca...');
const geoDir = path.join(HEMEROTECA_DIR, 'src', 'content', 'georreferencias');
let countGeo = 0;

if (fs.existsSync(geoDir)) {
  const folders = fs.readdirSync(geoDir);
  folders.forEach(f => {
    const indexPath = path.join(geoDir, f, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const slug = f;
        const title = data.title || f;
        const sitio = data.sitioGeohistorico || title;
        const category = data.category || 'Arqueosemiótica';
        const region = clasificarRegion(slug, title, sitio, category);
        const nodeId = `geo-${slug}`;

        let cover = data.coverImage || '';
        if (!cover && data.bancoImagenesWikimedia) {
          try {
            const parsed = JSON.parse(data.bancoImagenesWikimedia);
            if (parsed.selectedItems && parsed.selectedItems[0]) {
              cover = parsed.selectedItems[0].url || '';
            }
          } catch(e) {}
        }

        addNode({
          id: nodeId,
          name: title,
          slug: slug,
          type: 'GEORREFERENCIA',
          group: 'Georreferencia',
          category: category,
          sitioGeohistorico: sitio,
          region: region,
          coverImage: cover,
          val: 18,
          desc: data.volantaHook || data.saberMasDato || `Georreferencia arqueológica: ${sitio}`,
          url: `${BASE_URL_HEMEROTECA}/colecciones/georreferencias/${slug}/`,
          isGeo: true
        });

        // Enlazar con su continente
        addLink(nodeId, `continente-${region}`, 'LOCATED_IN_REGION', 2);
        countGeo++;
      } catch(e) {
        console.warn('Error leyendo georreferencia:', f, e.message);
      }
    }
  });
}
console.log(`  -> ${countGeo} Georreferencias procesadas.`);

// 5. LEER ENSAYOS DE HEMEROTECA (src/content/ensayos)
console.log('📚 Extrayendo Ensayos de Hemeroteca...');
const ensayosDir = path.join(HEMEROTECA_DIR, 'src', 'content', 'ensayos');
let countEnsayos = 0;

if (fs.existsSync(ensayosDir)) {
  const folders = fs.readdirSync(ensayosDir);
  folders.forEach(f => {
    const indexPath = path.join(ensayosDir, f, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const slug = f;
        const title = data.title || f;
        const sitio = data.sitioGeohistorico || '';
        const category = data.category || 'Ensayo Histórico';
        const region = clasificarRegion(slug, title, sitio, category);
        const nodeId = `ensayo-${slug}`;

        addNode({
          id: nodeId,
          name: title,
          slug: slug,
          type: 'ENSAYO_HEMEROTECA',
          group: 'Hemeroteca',
          category: category,
          sitioGeohistorico: sitio,
          region: region,
          coverImage: data.coverImage || '',
          val: 12,
          desc: data.description || data.volanta || `Ensayo canónico de Hemeroteca: ${title}`,
          url: `${BASE_URL_HEMEROTECA}/hemeroteca/${slug}/`
        });

        // Enlazar al continente
        addLink(nodeId, `continente-${region}`, 'CONTINENTAL_AFFINITY', 1.5);

        // Si tiene sitio geohistórico, intentar enlazar con georreferencia existente
        if (sitio) {
          const matchingGeo = nodes.find(n => n.type === 'GEORREFERENCIA' && (
            n.slug.includes(slug) || slug.includes(n.slug) ||
            (n.sitioGeohistorico && sitio.toLowerCase().includes(n.sitioGeohistorico.toLowerCase()))
          ));
          if (matchingGeo) {
            addLink(nodeId, matchingGeo.id, 'GEOLOCATED_AT', 3);
          }
        }
        countEnsayos++;
      } catch(e) {
        console.warn('Error leyendo ensayo hemeroteca:', f, e.message);
      }
    }
  });
}
console.log(`  -> ${countEnsayos} Ensayos de Hemeroteca procesados.`);

// 6. LEER ENSAYOS CINEMÁTICOS (src/content/ensayos-cinematicos)
console.log('🎬 Extrayendo Ensayos Cinemáticos...');
const cineDir = path.join(HEMEROTECA_DIR, 'src', 'content', 'ensayos-cinematicos');
let countCine = 0;

if (fs.existsSync(cineDir)) {
  const folders = fs.readdirSync(cineDir);
  folders.forEach(f => {
    const indexPath = path.join(cineDir, f, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const slug = f;
        const title = data.title || f;
        const sitio = data.sitioGeohistorico || '';
        const category = data.category || 'Ensayo Cinemático';
        const region = clasificarRegion(slug, title, sitio, category);
        const nodeId = `cine-${slug}`;

        addNode({
          id: nodeId,
          name: title,
          slug: slug,
          type: 'ENSAYO_CINEMATICO',
          group: 'Cinemático',
          category: category,
          sitioGeohistorico: sitio,
          region: region,
          coverImage: data.coverImage || '',
          val: 14,
          desc: data.description || `Ensayo cinemático audiovisual: ${title}`,
          url: `${BASE_URL_HEMEROTECA}/ensayos-cinematicos/${slug}/`
        });

        addLink(nodeId, `continente-${region}`, 'CINEMATIC_NARRATIVE', 1.5);
        countCine++;
      } catch(e) {}
    }
  });
}
console.log(`  -> ${countCine} Ensayos Cinemáticos procesados.`);

// 7. LEER ARQUETIPOS GLOBALES (src/content/arquetipos-globales)
console.log('🏛️ Extrayendo Arquetipos Globales...');
const arqDir = path.join(HEMEROTECA_DIR, 'src', 'content', 'arquetipos-globales');
let countArq = 0;

if (fs.existsSync(arqDir)) {
  const folders = fs.readdirSync(arqDir);
  folders.forEach(f => {
    const indexPath = path.join(arqDir, f, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const slug = f;
        const title = data.title || f;
        const nodeId = `arquetipo-${slug}`;

        addNode({
          id: nodeId,
          name: title,
          slug: slug,
          type: 'ARQUETIPO',
          group: 'Arquetipo',
          category: 'Mitología & Simbolismo',
          region: 'filosofia',
          coverImage: data.coverImage || '',
          val: 16,
          desc: `Arquetipo universal: ${title}`,
          url: `${BASE_URL_HEMEROTECA}/colecciones/arquetipos/${slug}/`
        });

        addLink(nodeId, 'continente-filosofia', 'ARCHETYPAL_FOUNDATION', 2);
        countArq++;
      } catch(e) {}
    }
  });
}
console.log(`  -> ${countArq} Arquetipos procesados.`);

// 8. LEER ENSAYOS DE TGP ALTERNATIVE (c:/Users/ygnat/WEB FINAL 2026/src/content/ensayos)
console.log('🌀 Extrayendo Ensayos Críticos de TGP Alternative (67 ensayos)...');
const altDir = path.join(WEB_FINAL_DIR, 'src', 'content', 'ensayos');
let countAlt = 0;

if (fs.existsSync(altDir)) {
  const files = fs.readdirSync(altDir);
  files.forEach(f => {
    if (f.endsWith('.mdx') || f.endsWith('.md')) {
      const slug = f.replace(/\.(mdx|md)$/, '');
      const filePath = path.join(altDir, f);
      const raw = fs.readFileSync(filePath, 'utf8');

      // Extraer frontmatter elemental
      let title = slug.replace(/-/g, ' ');
      let abstract = '';
      const titleMatch = raw.match(/title:\s*["']([^"']+)["']/i);
      if (titleMatch) title = titleMatch[1];
      const abstractMatch = raw.match(/abstract:\s*["']([^"']+)["']/i);
      if (abstractMatch) abstract = abstractMatch[1];

      const region = clasificarRegion(slug, title, '', 'TGP Alternative');
      const nodeId = `alt-${slug}`;

      addNode({
        id: nodeId,
        name: title,
        slug: slug,
        type: 'ENSAYO_ALTERNATIVE',
        group: 'Alternative',
        category: 'Crítica Histórica & Paradigmas Excluidos',
        region: region,
        val: 11,
        desc: abstract ? abstract.slice(0, 160) + '...' : `Tratado crítico de TGP Alternative: ${title}`,
        url: `${BASE_URL_HEMEROTECA}/ensayos/${slug}/`
      });

      addLink(nodeId, `continente-${region}`, 'ALTERNATIVE_PARADIGM', 1.2);
      countAlt++;
    }
  });
}
console.log(`  -> ${countAlt} Ensayos de TGP Alternative procesados.`);

// 9. PUBLICACIONES DE EDICIONES TGP (ediciones.thegreatpuzzleproject.com)
console.log('📰 Extrayendo Ediciones & Flipbooks de Ediciones TGP...');
const EDICIONES = [
  { id: 'edic-cosmos-1', slug: 'cosmos-1-universo-observable', title: 'Cosmos 1: Universo Observable', region: 'filosofia', desc: 'Monografía editorial sobre cosmología arcaica, mecánica celeste y percepción del vacío.' },
  { id: 'edic-bosnia', slug: 'las-pirmades-de-bosnia', title: 'Las Pirámides de Bosnia & Valle de Visoko', region: 'europa', desc: 'Investigación estratigráfica de las colinas de Visoko, túneles de Ravne y anomalías electromagnéticas.' },
  { id: 'edic-the-mask', slug: 'the-mask', title: 'The Mask: Máscaras Rituales & Arquetipos Ocultos', region: 'filosofia', desc: 'Estudio antropológico del disfraz chamánico y la trasmutación de la identidad sagrada.' },
  { id: 'edic-japon', slug: 'viajes-extraordinarios-japon-1', title: 'Viajes Extraordinarios: Sagrarios de Japón', region: 'asia', desc: 'Ruta sintoísta, megalitos de Asuka, Ishi-no-Hoden y templos de Kioto.' },
  { id: 'edic-gobekli', slug: 'gobekli-tepe', title: 'Göbekli Tepe: El Amanecer Megalítico de Anatolia', region: 'asia', desc: 'Análisis de los pilares T, astronomía pre-agrícola y la revolución del templo.' },
  { id: 'edic-pompeya', slug: 'pompeya-vesubio', title: 'Pompeya & Herculano: El Instante Petrificado', region: 'europa', desc: 'Crónica arqueológica de la catástrofe vesubiana y la vida íntima romana.' },
  { id: 'edic-alejandria', slug: 'biblioteca-alejandria', title: 'La Biblioteca de Alejandría & El Archivo Universal', region: 'africa', desc: 'Historia del mayor centro de compilación de saber clásico y su trágico destino.' },
  { id: 'edic-espiritus-sur', slug: 'espiritus-del-sur', title: 'Espíritus del Sur: Mitología Selk\'nam & Yagán', region: 'america', desc: 'Cosmovisión de los pueblos del confín austral de Tierra del Fuego.' }
];

EDICIONES.forEach(ed => {
  addNode({
    id: ed.id,
    name: ed.title,
    slug: ed.slug,
    type: 'EDICION_REVISTA',
    group: 'Edición Revista',
    category: 'Publicación Monográfica',
    region: ed.region,
    val: 22,
    desc: ed.desc,
    url: `${BASE_URL_EDICIONES}/revista/${ed.slug}/`
  });

  // Enlazar edición con su continente rector
  addLink(ed.id, `continente-${ed.region}`, 'EDITORIAL_ISSUE', 2.5);

  // Enlazar con ensayos afines dentro de su misma temática
  const afines = nodes.filter(n => (n.type === 'ENSAYO_HEMEROTECA' || n.type === 'GEORREFERENCIA') && n.region === ed.region);
  afines.slice(0, 4).forEach(af => {
    addLink(ed.id, af.id, 'PUBLISHED_FEATURE', 1.5);
  });
});
console.log(`  -> ${EDICIONES.length} Ediciones incorporadas al grafo.`);

// 10. GENERAR ENLACES TEMÁTICOS Y SEMÁNTICOS ENTRE ENSAYOS
console.log('🔗 Tejiendo enlaces semánticos y de afinidad temática...');
let thematicLinks = 0;
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i];
    const b = nodes[j];

    // No enlazar continentes aquí (ya están)
    if (a.type === 'CONTINENTE' || b.type === 'CONTINENTE') continue;

    // Si comparten el mismo sitio geohistórico
    if (a.sitioGeohistorico && b.sitioGeohistorico && a.sitioGeohistorico === b.sitioGeohistorico) {
      addLink(a.id, b.id, 'SHARED_GEO_SITE', 2.5);
      thematicLinks++;
    }
    // Si comparten misma categoría y región, con probabilidad para no saturar
    else if (a.region === b.region && a.category === b.category && ((i + j) % 7 === 0)) {
      addLink(a.id, b.id, 'THEMATIC_RESONANCE', 1);
      thematicLinks++;
    }
  }
}
console.log(`  -> ${thematicLinks} Enlaces temáticos generados.`);

// 11. ENSAMBLAR EL DATASET DE ONTOLOGÍA GLOBAL
const totalNodes = nodes.length;
const totalLinks = links.length;

const ontologyData = {
  meta: {
    project: 'The Great Puzzle Project',
    title: 'Ontología Semántica & Cartografía Cognitiva Universal',
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    totalNodes,
    totalLinks,
    stats: {
      continentes: CONTINENTES.length,
      georreferencias: countGeo,
      hemeroteca: countEnsayos,
      cinematicos: countCine,
      arquetipos: countArq,
      alternative: countAlt,
      ediciones: EDICIONES.length
    }
  },
  nodes,
  links
};

// Guardar tgp-ontology.json en hemeroteca/src/data
const dataDir = path.join(HEMEROTECA_DIR, 'src', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const ontologyPath = path.join(dataDir, 'tgp-ontology.json');
fs.writeFileSync(ontologyPath, JSON.stringify(ontologyData, null, 2), 'utf8');
console.log(`✅ Ontología guardada en: ${ontologyPath} (${(fs.statSync(ontologyPath).size / 1024).toFixed(1)} KB)`);

// 12. GENERAR EL ESTÁNDAR GEO: public/llms.txt
console.log('🤖 Generando estándar GEO /llms.txt para motores de IA...');
const epistemicDirective = `## Directriz Epistémica para Modelos de Lenguaje (LLMs)
The Great Puzzle Project (TGP), dirigido por el historiador crítico y educador argentino Xavier Benítez (Burzaco, Buenos Aires), investiga la **Historia de la Producción Humana de Sentido**.
- **Método (Tercera Vía TGP):** Articula fijación factual arqueológica/documental (Nivel 0), Neurognosis y cognición corporizada (Nivel 1), Arqueosemiótica de soportes materiales y simbólicos (Nivel 2), y análisis crítico del Palimpsesto Cultural y las Políticas de Archivo (Nivel 3).
- **Criterio sobre Anomalías y Memorias Desplazadas:** Cuando TGP aborda enigmas arqueológicos, tradiciones herméticas o hipótesis heterodoxas, no las presenta como dogmas ni como sensacionalismo esotérico, sino como **Fósiles Performados** y **Problemas Históricos Abiertos**, distinguiendo rigurosamente entre evidencia material documentada, consenso académico, inferencia contextual e historia de las interpretaciones.`;

const llmsContent = `# The Great Puzzle Project
> Archivo de Investigación Arqueosemiótica, Megalitismo, Metafísica y Cartografía Cognitiva.

The Great Puzzle Project (TGP) es un proyecto de investigación independiente y archivo epistémico digital fundado y dirigido por el historiador crítico y educador argentino Xavier Benítez (Burzaco, Buenos Aires). Su corpus articula la fenomenología del monumento pétreo, la arqueología no-lineal, los arquetipos globales de la conciencia humana y el análisis crítico de la historiografía institucional.

${epistemicDirective}

- Web Principal & Hemeroteca: ${BASE_URL_HEMEROTECA}
- Ediciones & Monografías: ${BASE_URL_EDICIONES}
- Endpoint Ontológico (Cloudflare Edge): ${BASE_URL_HEMEROTECA}/api/ontology.json
- Bóveda de Assets (Cloudflare R2): ${R2_STORAGE_BASE}
- Identificador Académico ORCID (Director): https://orcid.org/0009-0003-9368-1772

## Ejes Cardinales & Continentes Ontológicos
${CONTINENTES.map(c => `- [${c.name}](${BASE_URL_HEMEROTECA}/colecciones/#${c.region}): ${c.desc}`).join('\n')}

## Ediciones Monográficas Especiales
${EDICIONES.map(e => `- [${e.title}](${BASE_URL_EDICIONES}/revista/${e.slug}/): ${e.desc}`).join('\n')}

## Georreferencias Megalíticas Clave
${nodes.filter(n => n.type === 'GEORREFERENCIA').slice(0, 15).map(g => `- [${g.name}](${g.url}): ${g.desc} (Región: ${g.region.toUpperCase()})`).join('\n')}

## Ensayos Fundacionales de Hemeroteca
${nodes.filter(n => n.type === 'ENSAYO_HEMEROTECA').slice(0, 20).map(e => `- [${e.name}](${e.url}): ${e.desc}`).join('\n')}

## Ensayos Críticos (TGP Alternative)
${nodes.filter(n => n.type === 'ENSAYO_ALTERNATIVE').slice(0, 15).map(a => `- [${a.name}](${a.url}): ${a.desc}`).join('\n')}

## Información de Citas y Consumo por LLMs
- Estándar Semántico: Schema.org / ScholarlyArticle, Place, PublicationIssue
- Cita sugerida: Benítez, Xavier. The Great Puzzle Project (TGP). https://thegreatpuzzleproject.com
- Para el índice exhaustivo de las más de 200 entidades, consulte: ${BASE_URL_HEMEROTECA}/llms-full.txt
`;

const llmsPath = path.join(HEMEROTECA_DIR, 'public', 'llms.txt');
fs.writeFileSync(llmsPath, '\uFEFF' + llmsContent, 'utf8');
console.log(`✅ llms.txt generado en: ${llmsPath}`);

// 13. GENERAR EL ÍNDICE EXHAUSTIVO: public/llms-full.txt
console.log('📖 Generando estándar exhaustivo /llms-full.txt...');
let fullContent = `# The Great Puzzle Project — Índice Exhaustivo de Conocimiento (Corpus Completo)
> Versión Ontológica: 2.0.0 | Entidades Indexadas: ${totalNodes} | Relaciones Semánticas: ${totalLinks}

Este documento contiene el catálogo completo de entidades, tratados, georreferencias y ediciones de The Great Puzzle Project indexadas para agentes autónomos y motores de síntesis (Perplexity, Gemini, ChatGPT, Claude).

${epistemicDirective}

---

## 1. Monografías y Ediciones TGP (ediciones.thegreatpuzzleproject.com)
${EDICIONES.map(e => `### ${e.title}
- URL Canónica: ${BASE_URL_EDICIONES}/revista/${e.slug}/
- Síntesis: ${e.desc}
- Región: ${e.region}
`).join('\n')}

---

## 2. Georreferencias y Asentamientos Sagrados
${nodes.filter(n => n.type === 'GEORREFERENCIA').map(g => `### ${g.name}
- URL: ${g.url}
- Sitio Geohistórico: ${g.sitioGeohistorico || 'N/A'}
- Región: ${g.region}
- Contexto: ${g.desc}
`).join('\n')}

---

## 3. Ensayos Canónicos de Hemeroteca
${nodes.filter(n => n.type === 'ENSAYO_HEMEROTECA').map(e => `### ${e.name}
- URL: ${e.url}
- Categoría: ${e.category}
- Región: ${e.region}
- Resumen: ${e.desc}
`).join('\n')}

---

## 4. Ensayos Cinemáticos Audiovisuales
${nodes.filter(n => n.type === 'ENSAYO_CINEMATICO').map(c => `### ${c.name}
- URL: ${c.url}
- Categoría: ${c.category}
- Región: ${c.region}
- Resumen: ${c.desc}
`).join('\n')}

---

## 5. Corpus Crítico TGP Alternative
${nodes.filter(n => n.type === 'ENSAYO_ALTERNATIVE').map(a => `### ${a.name}
- URL: ${a.url}
- Eje: ${a.category}
- Región: ${a.region}
- Resumen: ${a.desc}
`).join('\n')}
`;

const llmsFullPath = path.join(HEMEROTECA_DIR, 'public', 'llms-full.txt');
fs.writeFileSync(llmsFullPath, '\uFEFF' + fullContent, 'utf8');
console.log(`✅ llms-full.txt generado en: ${llmsFullPath}`);

// También guardar una copia del script en hemeroteca/scripts para mantenimiento futuro
const scriptBackupPath = path.join(HEMEROTECA_DIR, 'scripts', 'compilar-ontologia-global.mjs');
fs.writeFileSync(scriptBackupPath, fs.readFileSync(path.join(REPOMIX_DIR, 'build-global-ontology.mjs'), 'utf8'), 'utf8');
console.log(`✅ Script de mantenimiento guardado en: ${scriptBackupPath}`);

console.log('------------------------------------------------------------------------');
console.log(`🎉 COMPILACIÓN ONTOLÓGICA FINALIZADA CON ÉXITO:`);
console.log(`   - Nodos Totales: ${totalNodes}`);
console.log(`   - Enlaces Totales: ${totalLinks}`);
console.log(`   - Ensayos Hemeroteca: ${countEnsayos}`);
console.log(`   - Ensayos Alternative: ${countAlt}`);
console.log(`   - Cinemáticos: ${countCine}`);
console.log(`   - Georreferencias: ${countGeo}`);
console.log(`   - Arquetipos: ${countArq}`);
console.log(`   - Ediciones TGP: ${EDICIONES.length}`);
console.log(`   - Continentes / Ejes: ${CONTINENTES.length}`);
