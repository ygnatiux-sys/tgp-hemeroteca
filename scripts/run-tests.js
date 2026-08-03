const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runTest(title, category, image) {
  console.log(`\n--- INICIANDO PRUEBA: ${title} ---`);
  const input = `${title}\n${category}\n${image}\n`;
  
  const result = spawnSync('node', ['scripts/generar-post.js'], {
    input,
    encoding: 'utf-8',
  });
  
  console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);

  // Now find the generated directory and set draft: false
  // title -> slugify
  const slugify = (text) =>
    text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  
  const slug = slugify(title);
  const indexPath = path.join(process.cwd(), 'src/content/ensayos', slug, 'index.json');
  
  if (fs.existsSync(indexPath)) {
    const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    data.draft = false; // Set to false so it shows up in the start page
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ ${slug} marcado como draft: false para aparecer en el inicio.`);
  } else {
    console.log(`❌ No se encontró el index.json en ${indexPath}`);
  }
}

runTest('El Simbolismo del Laberinto en Borges', 'Literatura', 's');
runTest('La Estetica del Silencio en el Cine', 'Cine', 's');
