import fs from 'node:fs/promises';
import path from 'node:path';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

export async function handleTransmute(body: any) {
  const {
    collection = 'ensayosCinematicos',
    pillLabel,
    prompt,
    response,
    imageName,
    timestamp,
    r2Url,
  } = body as {
    collection?: string;
    pillLabel: string;
    prompt: string;
    response: string;
    imageName: string;
    imageSource: string;
    timestamp: string;
    r2Url?: string;
    d1Id?: string;
  };

  if (!response?.trim()) {
    return {
      status: 400,
      data: { success: false, error: 'response vacio' }
    };
  }

  const targetCollection = collection || 'ensayosCinematicos';
  const date = new Date(timestamp || Date.now());
  const dateStr = date.toISOString().slice(0, 10);
  const baseSlug = slugify(imageName.replace(/\.[^.]+$/, '') || pillLabel);
  const slug = `vision-${dateStr}-${baseSlug}`;

  // Mapeo a carpetas físicas reales del CMS
  const folderMap: Record<string, string> = {
    ensayos: 'ensayos',
    ensayosCinematicos: 'ensayos-cinematicos',
    arquetiposGlobales: 'arquetipos-globales',
    georreferencias: 'georreferencias',
    direccionDeArte: 'estilos-visuales',
    informesPremium: 'informes',
  };
  const folderName = folderMap[collection] || collection;

  const cwd = process.cwd();
  const entryDir = path.join(cwd, 'src', 'content', folderName, slug);
  await fs.mkdir(entryDir, { recursive: true });

  const commonTitle = `Captura ${pillLabel} — ${imageName || slug}`;

  if (targetCollection === 'informesPremium') {
    const yaml = `---
titulo: "${commonTitle.replace(/"/g, '\\"')}"
coleccion: liminal
fuenteVisual: wikimedia
volanta: "Captura ${pillLabel}"${r2Url ? `\nimagenDestacada: "${r2Url}"` : ''}
---

${response}`;
    await fs.writeFile(path.join(entryDir, 'index.mdoc'), yaml, 'utf-8');

  } else if (targetCollection === 'direccionDeArte') {
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    const jsonPath = path.join(cwd, 'src', 'content', folderName, `${slug}.json`);
    const metadata = {
      nombre: commonTitle,
      constructorEstilo: {
        conceptoBase: prompt,
        sujetoIA: pillLabel,
        lineaEditorial: 'archivo-museo',
        usarManuales: false,
        overrideCamara: '',
        overrideIluminacion: '',
        overrideColor: '',
        imagenBase64: r2Url || ''
      }
    };
    await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), 'utf-8');

  } else {
    let metadata: any = {};

    if (targetCollection === 'ensayosCinematicos') {
      metadata = {
        title: commonTitle,
        date: dateStr,
        generadorTexto: JSON.stringify({ text: response, image: r2Url || '' }),
        atmosfera: { discriminant: 'obsidiana' },
        excerpt: prompt,
        dek: `Captura multimodal (${pillLabel}): ${prompt.slice(0, 100)}...`,
      };
      if (r2Url) metadata.coverImage = r2Url;
    } else if (targetCollection === 'ensayos') {
      metadata = {
        title: commonTitle,
        date: dateStr,
        volanta: `Captura ${pillLabel}`,
        generador: 'Scriptorium Visor',
        generadorTexto: JSON.stringify({ text: response, image: r2Url || '' }),
        category: 'Historia',
        themeColor: 'british-green',
        sitioGeohistorico: '',
        publicarConImagen: !!r2Url,
        draft: false,
        isCinematic: false,
        excerpt: prompt,
        dek: `Captura multimodal (${pillLabel}): ${prompt.slice(0, 100)}...`,
      };
      if (r2Url) metadata.coverImage = r2Url;
    } else if (targetCollection === 'arquetiposGlobales') {
      metadata = {
        title: commonTitle,
        date: dateStr,
        volanta: `Captura ${pillLabel}`,
        generador: 'Scriptorium Visor',
        generadorTexto: JSON.stringify({ text: response, image: r2Url || '' }),
        category: 'Arquetipos Globales',
        themeColor: 'rust-orange',
        sitioGeohistorico: '',
        publicarConImagen: !!r2Url,
        draft: false,
        isCinematic: false,
        excerpt: prompt,
        dek: `Captura multimodal (${pillLabel}): ${prompt.slice(0, 100)}...`,
      };
      if (r2Url) metadata.coverImage = r2Url;
    } else if (targetCollection === 'georreferencias') {
      metadata = {
        title: commonTitle,
        date: dateStr,
        generadorGeoref: response,
        sitioGeohistorico: '',
        volantaHook: '',
        saberMasDato: '',
        category: 'Arqueosemiótica',
        publicarConImagen: !!r2Url,
        draft: false,
        excerpt: prompt,
        dek: `Captura multimodal (${pillLabel}): ${prompt.slice(0, 100)}...`,
      };
      if (r2Url) metadata.coverImage = r2Url;
    }

    await fs.writeFile(path.join(entryDir, 'index.json'), JSON.stringify(metadata, null, 2), 'utf-8');
    await fs.writeFile(path.join(entryDir, 'content.mdoc'), response, 'utf-8');
  }

  return {
    status: 200,
    data: {
      success: true,
      productionMode: false,
      slug,
      collection: targetCollection,
      entryDir,
      message: `Entrada "${slug}" creada en src/content/${folderName}/${slug}/ (index.json + content.mdoc).`
    }
  };
}
