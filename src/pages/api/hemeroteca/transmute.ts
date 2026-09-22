import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * /api/hemeroteca/transmute
 *
 * Recibe el payload de un VisionResult desde ScriptoriumCapture.svelte
 * y crea una entrada de Hemeroteca lista para Keystatic.
 *
 * En LOCAL (Node.js dev): escribe el archivo MDX directamente en disco.
 * En CLOUDFLARE (produccion): devuelve `productionMode: true` para que
 * el componente informe al usuario que debe guardar via Keystatic UI.
 */

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ status: 'API Transmute Activa', method: 'Requiere POST para publicar' }), {
    status: 200,
    headers,
  });

export const OPTIONS: APIRoute = async () =>
  new Response(null, {
    status: 204,
    headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { collection = 'ensayosCinematicos', pillLabel, prompt, response, imageName, imageSource, timestamp, r2Url, d1Id } = body as {
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
      return new Response(JSON.stringify({ success: false, error: 'response vacio' }), {
        status: 400,
        headers,
      });
    }

    const targetCollection = collection || 'ensayosCinematicos';
    const date = new Date(timestamp || Date.now());
    const dateStr = date.toISOString().slice(0, 10);
    const baseSlug = slugify(imageName.replace(/\.[^.]+$/, '') || pillLabel);
    const slug = `vision-${dateStr}-${baseSlug}`;

    // Modo Produccion (Cloudflare Workers): sin acceso a fs
    const isCloudflare =
      typeof process === 'undefined' ||
      process.env.CLOUDFLARE === '1' ||
      !process.versions?.node;

    if (isCloudflare) {
      return new Response(
        JSON.stringify({
          success: true,
          productionMode: true,
          slug,
          collection: targetCollection,
          message: `Contenido listo. Crea la entrada "${slug}" manualmente en Keystatic UI (${targetCollection}).`,
        }),
        { status: 200, headers }
      );
    }

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

    // Modo Local (Node.js)
    const path = await eval("import('path')") as typeof import('path');
    const fs = await eval("import('fs/promises')") as typeof import('fs/promises');

    const cwd = process.cwd();
    const entryDir = path.join(cwd, 'src', 'content', folderName, slug);
    await fs.mkdir(entryDir, { recursive: true });

    // 1. Crear Metadatos y Estructura de Archivos según la colección destino
    const commonTitle = `Captura ${pillLabel} — ${imageName || slug}`;
    
    if (targetCollection === 'informesPremium') {
      // Keystatic usa format: { contentField: 'contenido' } con path 'src/content/informes/*/'
      // Esto significa que genera un archivo index.mdoc con frontmatter (YAML)
      const yaml = `---
titulo: "${commonTitle.replace(/"/g, '\\"')}"
coleccion: liminal
fuenteVisual: wikimedia
volanta: "Captura ${pillLabel}"${r2Url ? `\nimagenDestacada: "${r2Url}"` : ''}
---

${response}`;
      await fs.writeFile(path.join(entryDir, 'index.mdoc'), yaml, 'utf-8');

    } else if (targetCollection === 'direccionDeArte') {
      // Keystatic usa format: { data: 'json' } con path 'src/content/estilos-visuales/*'
      // Esto significa un único archivo JSON, NO un directorio.
      // Borramos el dir que creamos y guardamos un .json
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
      // Colecciones estándar con format: { data: 'json' } y path '.../*/'
      // Requieren index.json y content.mdoc (porque tienen content: fields.document)
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

    return new Response(
      JSON.stringify({
        success: true,
        productionMode: false,
        slug,
        collection: targetCollection,
        entryDir,
        message: `Entrada "${slug}" creada en src/content/${folderName}/${slug}/ (index.json + content.mdoc).`,
      }),
      { status: 200, headers }
    );
  } catch (err: any) {
    console.error('[transmute] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? 'Error interno' }),
      { status: 500, headers }
    );
  }
};
