// ─────────────────────────────────────────────────────────────────────────────
// TGP MIND — Módulo Servicios: Publicación GitOps + Keystatic
// Extraído de index.ts. Contiene:
//   - generarSlug                    — slug limpio para URLs
//   - generarMarkdoc                 — construye el .mdoc para Keystatic
//   - publicarEntradaKeystaticGitHub — commit atómico (index.json + content.mdoc) en Keystatic
//   - publicarEnGitHub               — commit legacy para repositorios alternative
//
// Tipo de colección: 'ensayos-cinematicos' | 'ensayos' | 'georreferencias'
// ─────────────────────────────────────────────────────────────────────────────

import { Octokit } from '@octokit/rest';

// ── Init ─────────────────────────────────────────────────────────────────────
let _GITHUB_BRANCH = 'main';

export interface PublicacionInitConfig {
  githubBranch?: string;
}

export function initPublicacion(cfg: PublicacionInitConfig = {}) {
  _GITHUB_BRANCH = cfg.githubBranch || process.env.GITHUB_BRANCH || 'main';
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type ColeccionKeystatic = 'ensayos-cinematicos' | 'ensayos' | 'georreferencias';

// ── Utilidades ────────────────────────────────────────────────────────────────

export function generarSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generarMarkdoc(ensayo: {
  titulo: string;
  secciones: Array<{ busqueda_wikimedia?: string; imagen_url?: string; parrafo: string }>;
}): { slug: string; contenidoMdoc: string } {
  const slug       = generarSlug(ensayo.titulo || 'ensayo-cinematico');
  const fechaHoy   = new Date().toISOString().split('T')[0];
  const coverImage = ensayo.secciones?.[0]?.imagen_url?.startsWith('http') ? ensayo.secciones[0].imagen_url : '';
  const primerParrafo = ensayo.secciones?.[0]?.parrafo || '';
  const excerpt    = primerParrafo
    ? primerParrafo.slice(0, 180) + '...'
    : '';

  let mdoc = `---
title: "${ensayo.titulo.replace(/"/g, '\\"')}"
date: "${fechaHoy}"
atmosfera: "obsidiana"
coverImage: "${coverImage}"
excerpt: "${excerpt.replace(/"/g, '\\"')}"
generador: "TGP Mind (Gemini + R2 + GitOps)"
---

`;

  if (Array.isArray(ensayo.secciones)) {
    ensayo.secciones.forEach((seccion, idx) => {
      if (seccion.imagen_url && seccion.imagen_url.startsWith('http')) {
        mdoc += `![${ensayo.titulo} -- Sección ${idx + 1}](${seccion.imagen_url})\n\n`;
      }
      if (seccion.parrafo) mdoc += `${seccion.parrafo.trim()}\n\n`;
    });
  }

  return { slug, contenidoMdoc: mdoc.trim() + '\n' };
}

// ── Publicación Atómica en GitHub (Keystatic) ─────────────────────────────────

export async function publicarEntradaKeystaticGitHub({
  coleccion = 'ensayos-cinematicos',
  slug,
  indexJson,
  contentMdoc,
  token,
  repoFull,
  mensajeCommit,
}: {
  coleccion?: ColeccionKeystatic;
  slug: string;
  indexJson: Record<string, any>;
  contentMdoc: string;
  token: string;
  repoFull: string;
  mensajeCommit?: string;
}): Promise<string> {
  const octokitDynamic = new Octokit({ auth: token });
  const parts  = repoFull.includes('/') ? repoFull.split('/') : ['ygnatiux-sys', repoFull];
  const owner  = parts[0] || 'ygnatiux-sys';
  const repo   = parts[1];
  const branch = _GITHUB_BRANCH;

  // 1. Obtener SHA del commit actual en la rama
  const refRes         = await octokitDynamic.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const latestCommitSha = refRes.data.object.sha;
  const latestCommit   = await octokitDynamic.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  const baseTreeSha    = latestCommit.data.tree.sha;

  // 2. Ruta exacta según el sistema de colecciones Keystatic
  const basePath = `src/content/${coleccion}/${slug}`;

  // 3. Crear árbol atómico con index.json y content.mdoc
  const treeEntries = [
    {
      path:    `${basePath}/index.json`,
      mode:    '100644' as const,
      type:    'blob' as const,
      content: JSON.stringify(indexJson, null, 2),
    },
    {
      path:    `${basePath}/content.mdoc`,
      mode:    '100644' as const,
      type:    'blob' as const,
      content: contentMdoc,
    },
  ];

  const newTree = await octokitDynamic.git.createTree({
    owner, repo,
    base_tree: baseTreeSha,
    tree: treeEntries,
  });

  // 4. Crear commit
  const commitMsg = mensajeCommit || `TGP Mind: Entrada Keystatic [${coleccion}] -- ${slug}`;
  const newCommit = await octokitDynamic.git.createCommit({
    owner, repo,
    message: commitMsg,
    tree:    newTree.data.sha,
    parents: [latestCommitSha],
  });

  // 5. Actualizar la rama principal
  await octokitDynamic.git.updateRef({
    owner, repo,
    ref: `heads/${branch}`,
    sha: newCommit.data.sha,
  });

  const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommit.data.sha}`;
  console.log(`[GitHub Keystatic Commit] ${basePath} publicado exitosamente: ${commitUrl}`);
  return commitUrl;
}

// ── Compatibilidad retroactiva (repositorios Alternative legacy) ──────────────

export async function publicarEnGitHub(
  slug: string,
  contenidoMdoc: string,
  token: string,
  repoFull: string
): Promise<string> {
  const octokitDynamic = new Octokit({ auth: token });
  const parts  = repoFull.includes('/') ? repoFull.split('/') : ['ygnatiux-sys', repoFull];
  const owner  = parts[0] || 'ygnatiux-sys';
  const repo   = parts[1];
  const branch = _GITHUB_BRANCH;
  const path   = `src/content/ensayosCinematicos/${slug}.mdoc`;

  let sha: string | undefined;
  try {
    const existing = await octokitDynamic.repos.getContent({ owner, repo, path, ref: branch });
    if ('sha' in existing.data) sha = existing.data.sha;
  } catch (err: any) {
    if (err.status !== 404) console.warn(`[GitHub] Consulta (${path}): ${err.message}`);
  }

  const contentBase64 = Buffer.from(contenidoMdoc, 'utf-8').toString('base64');
  const commitRes = await octokitDynamic.repos.createOrUpdateFileContents({
    owner, repo, path,
    message: `TGP Mind: Ensayo cinematico -- ${slug}`,
    content: contentBase64,
    branch,
    sha,
  });

  console.log(`[GitHub Commit Legacy] ${path} -> commit ${commitRes.data.commit?.sha}`);
  return commitRes.data.content?.html_url || `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
}
