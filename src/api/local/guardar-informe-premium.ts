import fs from 'node:fs';
import path from 'node:path';

export async function handleGuardarInformePremium(body: any) {
  const {
    slug,
    title,
    content,
    excerpt,
    category,
    tags = [],
  } = body;

  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    return {
      status: 400,
      data: { error: 'Se requiere un slug válido para el informe premium.', skipped: true }
    };
  }

  const safeSlug = slug.replace(/[^a-z0-9\-_]/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const projectRoot = path.resolve(process.cwd());
  const entryDir = path.join(projectRoot, 'src', 'content', 'informes', safeSlug);

  if (!fs.existsSync(entryDir)) {
    fs.mkdirSync(entryDir, { recursive: true });
  }

  // Normalizar coleccion
  const validCols = ['liminal', 'heterodoxia', 'anomalias', 'apocrifa'];
  const colVal = category && validCols.includes(category.toLowerCase()) ? category.toLowerCase() : 'liminal';

  const mdocPath = path.join(entryDir, 'index.mdoc');

  // Construir frontmatter YAML
  const frontmatter = [
    '---',
    "generador: 'Gemini-3.1-Pro'",
    `titulo: ${JSON.stringify(title || safeSlug)}`,
    `volanta: ${JSON.stringify(excerpt || '')}`,
    `coleccion: ${colVal}`,
    'fuenteVisual: sintetica',
    `tags: ${JSON.stringify(Array.isArray(tags) ? tags : [])}`,
    '---',
    '',
    content || '',
  ].join('\n');

  fs.writeFileSync(mdocPath, frontmatter, 'utf-8');

  return {
    status: 200,
    data: {
      success: true,
      slug: safeSlug,
      message: `Informe premium "${title || safeSlug}" guardado con éxito.`,
    }
  };
}
