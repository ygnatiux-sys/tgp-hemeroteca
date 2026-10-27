import type { APIRoute } from 'astro';
import tgpHemerotecaGraph from '../data/tgp-ontology.json';

export const prerender = false;

export const GET: APIRoute = async () => {
  // Transformar la ontología TGP a formato Schema.org @graph (Knowledge Graph estándar para IAs)
  const schemaNodes = (tgpHemerotecaGraph.nodes || []).map((node: any) => {
    let schemaType = 'Thing';
    if (node.type === 'DIRECTOR_AUTOR' || node.group === 'Autor') schemaType = 'Person';
    else if (node.type === 'EPISTEME_CORE' || node.group === 'Episteme') schemaType = 'ResearchProject';
    else if (node.type === 'HEMEROTECA_ENSAYO' || node.type === 'CINEMATIC_ESSAY') schemaType = 'ScholarlyArticle';
    else if (node.type === 'GEORREFERENCIA' || node.group === 'Georreferencia') schemaType = 'Place';
    else if (node.type?.startsWith('TOOL_')) schemaType = 'DefinedTerm';

    return {
      '@type': schemaType,
      '@id': node.url || `https://thegreatpuzzleproject.com/grafo#${node.id}`,
      'name': node.name,
      'description': node.desc,
      'category': node.group,
      'url': node.url || undefined,
      'additionalType': node.type
    };
  });

  const knowledgeGraphResponse = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://thegreatpuzzleproject.com/#website',
        'name': 'The Great Puzzle Project',
        'url': 'https://thegreatpuzzleproject.com',
        'description': 'Plataforma de investigación, archivo epistémico y ontología semántica dirigida por Xavier Benítez.',
        'author': {
          '@type': 'Person',
          '@id': 'https://thegreatpuzzleproject.com/#xavier-benitez',
          'name': 'Xavier Benítez',
          'url': 'https://orcid.org/0009-0003-9368-1772'
        }
      },
      ...schemaNodes
    ],
    'tgpOntologyMeta': tgpHemerotecaGraph.meta,
    'rawGraph': {
      'totalNodes': tgpHemerotecaGraph.nodes?.length || 0,
      'totalLinks': tgpHemerotecaGraph.links?.length || 0,
      'nodes': tgpHemerotecaGraph.nodes,
      'links': tgpHemerotecaGraph.links
    }
  };

  return new Response(JSON.stringify(knowledgeGraphResponse, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/ld+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
