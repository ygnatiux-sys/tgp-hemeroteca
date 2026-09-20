import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), 'tgp-mind', '.env') });

const idsToRescue = [
  "70d1f6e9-1f73-42d3-ae77-10eb383146d2", // Montségur
  "0ac47cf1-8772-492e-9939-13d732ad1090", // Los Albigenses
  "52db6f3f-6b28-400d-9974-afa3e246aab5"  // Los Cátaros
];

function generarSlug(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function rescuePosts() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !dbId || !apiToken) {
    console.error("Missing Cloudflare config");
    process.exit(1);
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;

  for (const id of idsToRescue) {
    console.log(`Rescuing ${id}...`);
    const body = JSON.stringify({ sql: `SELECT id, tema, texto_generado, imagen_r2_url FROM resguardo_documental WHERE id = '${id}'` });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body
    });

    const data = await res.json();
    if (!data.success || !data.result[0].results.length) {
      console.error(`Failed to fetch ${id}`);
      continue;
    }

    const row = data.result[0].results[0];
    const titulo = row.tema || 'ensayo-rescatado';
    const textOriginal = row.texto_generado || '';
    const coverImage = row.imagen_r2_url || '';
    
    const slug = generarSlug(titulo);
    const date = new Date().toISOString().split('T')[0];
    
    // Extract a 180 chars excerpt
    let excerpt = textOriginal.replace(/!\[.*?\]\(.*?\)/g, '').trim().substring(0, 180) + '...';
    
    // Create dir
    const dirPath = path.join(process.cwd(), 'src', 'content', 'ensayos-cinematicos', slug);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Prepare index.json
    const generadorTextoObj = {
      text: textOriginal,
      image: coverImage
    };

    const indexJson = {
      title: titulo,
      generadorTexto: JSON.stringify(generadorTextoObj),
      atmosfera: { discriminant: "obsidiana" },
      gallery: [],
      dek: excerpt,
      coverImage: coverImage,
      date: date,
      excerpt: excerpt
    };

    fs.writeFileSync(path.join(dirPath, 'index.json'), JSON.stringify(indexJson, null, 2), 'utf-8');

    // Prepare content.mdoc (Frontmatter + Markdown body)
    // Wait, the new content.mdoc doesn't have frontmatter inside itself if index.json is present, Keystatic parses index.json for frontmatter fields!
    // But let's check what Los Argonautas has in its content.mdoc just in case.
    fs.writeFileSync(path.join(dirPath, 'content.mdoc'), textOriginal, 'utf-8');

    console.log(`Saved: ${slug}`);
  }
}

rescuePosts().catch(console.error);
