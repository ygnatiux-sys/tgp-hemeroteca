// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Servicio GitOps con Tipado Estricto para Keystatic
// ─────────────────────────────────────────────────────────────────────────────
import { Octokit } from '@octokit/rest';
import { generarSlug } from '../servicios/publicacion.js';

export type KeystaticThemeColor =
  | 'british-green'
  | 'bordeaux'
  | 'old-navy'
  | 'bus-red'
  | 'vintage-yellow'
  | 'rust-orange';

export type KeystaticColeccion = 'ensayos' | 'ensayos-cinematicos' | 'ensayosCinematicos';

export interface KeystaticFrontmatter {
  title: string;
  volanta?: string;
  generador?: string;
  notasInvestigador?: string;
  generadorTexto?: string;
  agenteErudito?: string;
  bancoImagenesWikimedia?: string;
  generadorImagen?: string;
  date: string; // Formato YYYY-MM-DD obligatorio
  category: string;
  themeColor: KeystaticThemeColor;
  sitioGeohistorico?: string;
  publicarConImagen: boolean;
  draft: boolean; // Borrador obligatorio (true)
  coverImage?: string | null;
  isCinematic?: boolean;
  gallery?: string[];
  videoBg?: string;
  spotifyLink?: string | null;
  youtubeLink?: string | null;
  excerpt: string;
  dek?: string;
}

export interface KeystaticCommitResult {
  success: boolean;
  slug: string;
  commitSha: string;
  commitUrl: string;
  keystaticUrl: string;
  repo: string;
  branch: string;
}

/**
 * Sanitiza el contenido Markdown para asegurar 100% compatibilidad con el parser Markdoc (.mdoc) de Keystatic.
 * Elimina etiquetas HTML comunes no soportadas o mal formadas.
 */
export function sanitizarMarkdownParaMarkdoc(content: string): string {
  if (!content) return '';
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(div|span|p|section|article|header|footer|style|script)\b[^>]*>/gi, '')
    .trim() + '\n';
}

/**
 * Genera y sube atómicamente un borrador (draft: true) a Keystatic vía GitHub API.
 */
export async function crearBorradorKeystatic(params: {
  titulo: string;
  contenido: string;
  categoria?: string;
  coverImage?: string | null;
  excerpt?: string;
  volanta?: string;
  dek?: string;
  sitioGeohistorico?: string;
  themeColor?: KeystaticThemeColor;
  fecha?: string;
  coleccion?: KeystaticColeccion;
  token?: string;
  repoFull?: string;
}): Promise<KeystaticCommitResult> {
  const {
    titulo,
    contenido,
    categoria = 'Arqueosemiótica',
    coverImage = null,
    excerpt = '',
    coleccion = 'ensayos',
  } = params;

  const slug = generarSlug(titulo);
  
  // Validación estricta de fecha YYYY-MM-DD
  const hoyISO = new Date().toISOString().split('T')[0];
  const dateValida = params.fecha && /^\d{4}-\d{2}-\d{2}$/.test(params.fecha)
    ? params.fecha
    : hoyISO;

  const token = params.token || process.env.GITHUB_TOKEN_HEMEROTECA || process.env.GITHUB_TOKEN || '';
  const repoFull = params.repoFull || process.env.GITHUB_REPO_HEMEROTECA || 'ygnatiux-sys/tgp-hemeroteca';
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token) {
    throw new Error('Falta el token de GitHub (GITHUB_TOKEN_HEMEROTECA) para publicar en Keystatic.');
  }

  const parts = repoFull.includes('/') ? repoFull.split('/') : ['ygnatiux-sys', repoFull];
  const owner = parts[0] || 'ygnatiux-sys';
  const repo = parts[1];

  const isCinematic = coleccion === 'ensayos-cinematicos' || coleccion === 'ensayosCinematicos';
  const folderColeccion = isCinematic ? 'ensayos-cinematicos' : 'ensayos';
  const cmsCollectionKey = isCinematic ? 'ensayosCinematicos' : 'ensayos';

  const frontmatter: KeystaticFrontmatter = {
    title: titulo,
    volanta: params.volanta || '',
    draft: true, // Borrador obligatorio en CMS
    date: dateValida,
    category: categoria,
    themeColor: params.themeColor || 'british-green',
    publicarConImagen: !!coverImage,
    isCinematic,
    excerpt: excerpt || (contenido.slice(0, 180).replace(/\n/g, ' ') + '...'),
    dek: params.dek || '',
    sitioGeohistorico: params.sitioGeohistorico || '',
    generador: 'TGP Mind (Peloteo Dialéctico + GitOps)',
    generadorTexto: 'Gemini 2.5 Flash / Pro',
    agenteErudito: '',
    bancoImagenesWikimedia: '',
    generadorImagen: '',
    notasInvestigador: 'Borrador generado desde panel de mando contextual en Telegram.',
  };

  if (coverImage) {
    frontmatter.coverImage = coverImage;
  }

  const indexJsonContent = JSON.stringify(frontmatter, null, 2);
  const contentMdoc = sanitizarMarkdownParaMarkdoc(contenido);

  const octokit = new Octokit({ auth: token });

  // 1. Obtener SHA del commit actual en la rama
  const refRes = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const parentCommitSha = refRes.data.object.sha;

  // 2. Crear los dos blobs: index.json y content.mdoc
  const [blobJson, blobMdoc] = await Promise.all([
    octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(indexJsonContent, 'utf-8').toString('base64'),
      encoding: 'base64',
    }),
    octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(contentMdoc, 'utf-8').toString('base64'),
      encoding: 'base64',
    }),
  ]);

  // 3. Crear árbol Git atómico
  const basePath = `src/content/${folderColeccion}/${slug}`;
  const treeRes = await octokit.git.createTree({
    owner,
    repo,
    base_tree: parentCommitSha,
    tree: [
      {
        path: `${basePath}/index.json`,
        mode: '100644',
        type: 'blob',
        sha: blobJson.data.sha,
      },
      {
        path: `${basePath}/content.mdoc`,
        mode: '100644',
        type: 'blob',
        sha: blobMdoc.data.sha,
      },
    ],
  });

  // 4. Crear commit
  const commitRes = await octokit.git.createCommit({
    owner,
    repo,
    message: `TGP Draft: [${folderColeccion}] "${titulo}" (Keystatic GitOps)`,
    tree: treeRes.data.sha,
    parents: [parentCommitSha],
  });

  // 5. Actualizar la rama
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commitRes.data.sha,
  });

  const commitSha = commitRes.data.sha;
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${commitSha}`;
  const keystaticUrl = `https://thegreatpuzzleproject.com/keystatic#/collection/${cmsCollectionKey}/item/${slug}`;

  console.log(`[Keystatic GitOps] ✅ Borrador creado: ${slug} (${commitSha.slice(0, 7)})`);

  return {
    success: true,
    slug,
    commitSha,
    commitUrl,
    keystaticUrl,
    repo: `${owner}/${repo}`,
    branch,
  };
}
