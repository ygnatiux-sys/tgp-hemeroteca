import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const prerender = false;

export const GET: APIRoute = async () => {
  const stylesDir = path.join(process.cwd(), 'src/content/estilos-visuales');
  const headers = { 'Content-Type': 'application/json' };

  try {
    if (!fs.existsSync(stylesDir)) {
      return new Response(JSON.stringify([]), { status: 200, headers });
    }

    const folders = fs.readdirSync(stylesDir);
    const styles = folders.map(folder => {
      const configPath = path.join(stylesDir, folder, 'index.json');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const data = JSON.parse(content);
        return {
          id: folder,
          nombre: data.nombre || folder
        };
      }
      return null;
    }).filter(Boolean);

    return new Response(JSON.stringify(styles), { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};
