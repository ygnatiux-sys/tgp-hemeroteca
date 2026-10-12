import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = new URL(request.url);
    const targetSlug = url.searchParams.get('slug');
    const targetCollection = url.searchParams.get('collection') || 'ensayos-cinematicos';
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    const rootDir = process.cwd();
    const contentDir = path.join(rootDir, 'src', 'content', targetCollection);
    const curadorDir = path.join(rootDir, '.curador');
    const draftFile = path.join(curadorDir, 'draft_candidates.json');

    // 1. Escanear posts para conocer el estado de sus portadas
    const allPosts: Array<{
      slug: string;
      title: string;
      hasHero: boolean;
      coverImage?: string;
      excerpt?: string;
    }> = [];

    if (fs.existsSync(contentDir)) {
      const slugs = fs.readdirSync(contentDir);
      for (const slug of slugs) {
        const postDir = path.join(contentDir, slug);
        if (!fs.statSync(postDir).isDirectory()) continue;

        const jsonPath = path.join(postDir, 'index.json');
        let title = slug;
        let coverImage = '';
        let excerpt = '';

        if (fs.existsSync(jsonPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            title = data.title || title;
            coverImage = data.coverImage || '';
            excerpt = data.excerpt || '';
          } catch {}
        }

        const hasHero = Boolean(coverImage && coverImage.trim() !== '');
        allPosts.push({ slug, title, hasHero, coverImage, excerpt });
      }
    }

    // 2. Leer borrador de candidatos existente si existe
    let draftData: any = null;
    if (fs.existsSync(draftFile)) {
      try {
        draftData = JSON.parse(fs.readFileSync(draftFile, 'utf8'));
      } catch {}
    }

    // 2.1 Búsqueda manual por texto libre (independiente de Keystatic)
    const customQuery = url.searchParams.get('query')?.trim();
    if (customQuery) {
      const pseudoSlug = customQuery
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'busqueda-manual';

      const { extraerCandidatosDraft } = await import('../../../../scripts/lib/wikimedia-engine.mjs');
      const liveResult = await extraerCandidatosDraft(customQuery, '', 10);
      const candidates = liveResult.candidates || [];

      return new Response(JSON.stringify({
        success: true,
        isManualQuery: true,
        query: customQuery,
        slug: pseudoSlug,
        title: customQuery,
        hasHero: false,
        coverImage: '',
        candidates,
        allPosts,
      }), { status: 200, headers });
    }

    // 3. Si se solicita un slug en particular
    if (targetSlug) {
      const postMatch = allPosts.find(p => p.slug === targetSlug);
      const postTitle = postMatch ? postMatch.title : targetSlug;
      const postExcerpt = postMatch?.excerpt || '';

      // Verificar si ya está en draftData
      let existingCandidates = draftData?.posts?.find((p: any) => p.slug === targetSlug)?.candidates;


      if (!existingCandidates || forceRefresh) {
        // Ejecutar extracción dinámica en vivo
        const { extraerCandidatosDraft } = await import('../../../../scripts/lib/wikimedia-engine.mjs');
        const liveResult = await extraerCandidatosDraft(postTitle, postExcerpt, 10);
        existingCandidates = liveResult.candidates || [];

        // Actualizar draft_candidates.json
        fs.mkdirSync(curadorDir, { recursive: true });
        const currentPosts = draftData?.posts ? draftData.posts.filter((p: any) => p.slug !== targetSlug) : [];
        currentPosts.push({
          slug: targetSlug,
          title: postTitle,
          collection: targetCollection,
          total: existingCandidates.length,
          candidates: existingCandidates,
        });

        draftData = {
          generatedAt: new Date().toISOString(),
          posts: currentPosts,
        };
        fs.writeFileSync(draftFile, JSON.stringify(draftData, null, 2), 'utf8');
      }

      return new Response(JSON.stringify({
        success: true,
        slug: targetSlug,
        title: postTitle,
        hasHero: postMatch?.hasHero ?? false,
        coverImage: postMatch?.coverImage ?? '',
        candidates: existingCandidates || [],
        allPosts,
      }), { status: 200, headers });
    }

    // 4. Si no se solicitó slug específico, devolver inventario y el primer post sin hero
    const sinHero = allPosts.filter(p => !p.hasHero);
    const defaultSlug = sinHero.length > 0 ? sinHero[0].slug : (allPosts[0]?.slug || null);
    let defaultCandidates: any[] = [];

    if (defaultSlug && draftData?.posts) {
      const match = draftData.posts.find((p: any) => p.slug === defaultSlug);
      if (match) defaultCandidates = match.candidates;
    }

    return new Response(JSON.stringify({
      success: true,
      defaultSlug,
      postsSinHeroCount: sinHero.length,
      allPosts,
      draftPosts: draftData?.posts || [],
      defaultCandidates,
    }), { status: 200, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Error al obtener candidatos de curaduría.',
    }), { status: 500, headers });
  }
};
