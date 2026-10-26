/**
 * knowledgeGraph.ts
 * Motor ontológico TGP rescatado de L2-01-script.
 * Conecta con Google Knowledge Graph Search API y genera sentencias Cypher (Neo4j).
 */

export interface KGEntityResult {
  name: string;
  description: string;
  detailedDescription?: string;
  url?: string;
  type: string;
  labelTGP: 'Agent' | 'Concept' | 'Locus' | 'Event';
  cypher: string;
}

export async function extractEntityToCypher(
  query: string,
  apiKey: string
): Promise<KGEntityResult> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) {
    throw new Error(El término de búsqueda debe tener al menos 2 caracteres.);
  }

  const endpoint = https://kgsearch.googleapis.com/v1/entities:search?query=&key=&limit=1&indent=true;

  const res = await fetch(endpoint, {
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    throw new Error(Google KG API error: HTTP );
  }

  const data = await res.json() as any;
  const item = data.itemListElement?.[0]?.result;

  if (!item) {
    throw new Error(No se encontró la entidad '' en el Grafo universal de Google.);
  }

  const name = item.name || cleanQuery;
  const description = item.description || Sin descripción corta en Google;
  const types: string[] = item['@type'] || [];

  // Mapeo Ontológico a taxonomía TGP
  let labelTGP: 'Agent' | 'Concept' | 'Locus' | 'Event' = 'Concept';
  if (types.includes('Person') || types.includes('Organization')) {
    labelTGP = 'Agent';
  } else if (types.includes('Place') || types.includes('AdministrativeArea')) {
    labelTGP = 'Locus';
  } else if (types.includes('Event')) {
    labelTGP = 'Event';
  }

  const safeName = name.replace(/'/g, \\');
  const safeDesc = description.replace(/'/g, \\');
  const cypher = MERGE (n: { name: '' })\nON CREATE SET n.definicion = '', n.creadoEn = datetime()\nRETURN n;;

  return {
    name,
    description,
    detailedDescription: item.detailedDescription?.articleBody,
    url: item.detailedDescription?.url,
    type: types[0] || 'Thing',
    labelTGP,
    cypher
  };
}
