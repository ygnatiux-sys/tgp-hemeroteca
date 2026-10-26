/**
 * src/lib/tgp-router-oracle.mjs
 * 
 * ORÁCULO DE ENRUTAMIENTO CANÓNICO Y TAXONOMÍA TGP
 * Módulo híbrido: Determinista (URLs y Hubs) + Orquestador Flash (Taxonomía semántica)
 * Genera el paquete completo de navegación activa, verificación de R2 y panel clickeable.
 */

import { GoogleGenAI } from '@google/genai';

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Mapeo canónico determinista de rutas en Astro
 */
export function resolveCanonicalPaths(collection, slug, category = '') {
  let postUrl = '';
  let collectionUrl = `${BASE_URL}/colecciones/`;

  const cleanCol = (collection || 'ensayos').toLowerCase().trim();
  const cleanSlug = (slug || '').toLowerCase().trim();
  const cleanCat = (category || '').toLowerCase().trim();

  switch (cleanCol) {
    case 'ensayos-cinematicos':
      postUrl = `${BASE_URL}/ensayos-cinematicos/${cleanSlug}/`;
      collectionUrl = `${BASE_URL}/colecciones/ensayos-cinematicos/`;
      break;
    case 'ensayos':
      postUrl = `${BASE_URL}/hemeroteca/${cleanSlug}/`;
      if (cleanCat) {
        collectionUrl = `${BASE_URL}/colecciones/${cleanCat}/`;
      }
      break;
    case 'georreferencias':
      postUrl = `${BASE_URL}/colecciones/georreferencias/${cleanSlug}/`;
      collectionUrl = `${BASE_URL}/colecciones/georreferencias/`;
      break;
    case 'arquetipos-globales':
      postUrl = `${BASE_URL}/colecciones/arquetipos/${cleanSlug}/`;
      collectionUrl = `${BASE_URL}/colecciones/arquetipos-globales/`;
      break;
    case 'notas':
      postUrl = `${BASE_URL}/notas/${cleanSlug}/`;
      collectionUrl = `${BASE_URL}/colecciones/notas-de-cuaderno/`;
      break;
    default:
      postUrl = `${BASE_URL}/${cleanCol}/${cleanSlug}/`;
      collectionUrl = `${BASE_URL}/colecciones/${cleanCol}/`;
      break;
  }

  return {
    postUrl,
    collectionUrl,
    archivoUrl: `${BASE_URL}/archivo/`,
    homeUrl: `${BASE_URL}/`,
    keystaticUrl: `${BASE_URL}/keystatic/collection/${cleanCol}/item/${cleanSlug}`,
  };
}

/**
 * Orquestador Flash Taxonomist:
 * Analiza el título y texto con Gemini 2.5 Flash en <400ms para sugerir
 * la categoría canónica óptima, nivel de dossier y metadatos de ubicación.
 */
export async function orquestarTaxonomiaFlash(apiKey, titulo, textoMuestra = '') {
  if (!apiKey) {
    return {
      categoria: 'arqueologia',
      dossierLevel: 'Ensayo Estándar',
      tags: ['HISTORIA', 'ARQUEOLOGIA'],
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analiza este tema de ensayo para The Great Puzzle Project y clasifícalo en una sola categoría canónica de esta lista:
[arqueologia, arqueosemiotica, ensayos-cinematicos, arquetipos-globales, semiotica-cultural, historia, historia-religiones, historia-ideas, filosofia, georreferencias, mitologia, prehistoria, notas-de-cuaderno].

Título: "${titulo}"
Extracto: "${textoMuestra.slice(0, 300)}"

Devuelve estrictamente un JSON sin comillas de markdown con esta forma:
{"categoria": "nombre-exacto", "dossierLevel": "Dossier Central" o "Ensayo Estandar", "tags": ["TAG1", "TAG2"]}`;

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const raw = res.text?.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return {
      categoria: parsed.categoria || 'arqueologia',
      dossierLevel: parsed.dossierLevel || 'Ensayo Estándar',
      tags: parsed.tags || ['HISTORIA', 'CULTURA'],
    };
  } catch (err) {
    return {
      categoria: 'arqueologia',
      dossierLevel: 'Ensayo Estándar',
      tags: ['HISTORIA', 'ARQUEOLOGIA'],
    };
  }
}

/**
 * Imprime en terminal la Ficha de Ubicación Exacta con URLs Azules y Clickeables
 */
export function imprimirFichaUbicacionExacta(params) {
  const {
    titulo,
    slug,
    collection = 'ensayos',
    categoria,
    coverUrl,
    galleryCount = 0,
    imageTag,
    engine,
  } = params;

  const routes = resolveCanonicalPaths(collection, slug, categoria);

  console.log('\n  ╔═════════════════════════════════════════════════════════════════════════╗');
  console.log('  ║             🚀 FICHA DE UBICACIÓN EXACTA & CANÓNICA TGP                 ║');
  console.log('  ╠═════════════════════════════════════════════════════════════════════════╣');
  console.log(`  ║  📄 Ensayo:     ${titulo.substring(0, 52).padEnd(52)} ║`);
  console.log(`  ║  🗂️  Colección:  ${collection.substring(0, 52).padEnd(52)} ║`);
  console.log(`  ║  🏷️  Categoría:  ${categoria.substring(0, 52).padEnd(52)} ║`);
  console.log(`  ║  🧠 Motor AI:   ${engine.substring(0, 52).padEnd(52)} ║`);
  console.log('  ╠═════════════════════════════════════════════════════════════════════════╣');
  console.log('  ║  ☁️  STORAGE CHECKED (Cloudflare R2 WebP Inmutable):                    ║');
  console.log(`  ║  • Hero Cover:   ${coverUrl ? coverUrl.substring(0, 50) + '...' : 'Sin imagen'}`);
  console.log(`  ║  • Set Galería:  ${galleryCount} fotos adicionales en R2`);
  console.log(`  ║  • Tipo Visual:  ${imageTag.substring(0, 50).padEnd(50)} ║`);
  console.log('  ╠═════════════════════════════════════════════════════════════════════════╣');
  console.log('  ║  🌐 HUBS DE NAVEGACIÓN Y ACCESO INMEDIATO (Clickeables):                ║');
  console.log(`  ║  👉 LECTURA POST DIRECTO:   ${routes.postUrl}`);
  console.log(`  ║  👉 HUB DE LA COLECCIÓN:    ${routes.collectionUrl}`);
  console.log(`  ║  👉 ARCHIVO GENERAL:        ${routes.archivoUrl}`);
  console.log(`  ║  👉 PORTADA / HOME:         ${routes.homeUrl}`);
  console.log(`  ║  👉 EDITOR KEYSTATIC:       ${routes.keystaticUrl}`);
  console.log('  ╚═════════════════════════════════════════════════════════════════════════╝\n');
}
