import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const COMPONENTS_DIR = path.join(SRC, 'components');
const ARCHIVE_DIR = path.join(ROOT, '.archive_legacy');

const args = process.argv.slice(2);
const isArchive = args.includes('--archive');
const isDelete = args.includes('--delete');

function getAllFiles(dir, extensions = ['.astro', '.tsx', '.ts', '.svelte', '.jsx', '.js', '.mjs']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, extensions));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

// Comprueba si un componente está referenciado en el contenido de código (ignorando comentarios)
function isComponentReferencedIn(compNameNoExt, compFullName, content) {
  // Limpiar comentarios de bloque y línea
  const cleanCode = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  if (cleanCode.includes(compFullName)) return true;
  const idRegex = new RegExp(`\\b${compNameNoExt}\\b`);
  return idRegex.test(cleanCode);
}

async function audit() {
  console.log('🔍 Iniciando auditoría de componentes históricos y huérfanos en TGP...');

  const allComponents = fs.readdirSync(COMPONENTS_DIR)
    .filter(f => !fs.statSync(path.join(COMPONENTS_DIR, f)).isDirectory());

  // Buscar en todos los archivos de src y configs raíz
  const rootConfigs = [
    path.join(ROOT, 'markdoc.config.mjs'),
    path.join(ROOT, 'astro.config.mjs'),
    path.join(ROOT, 'keystatic.config.ts')
  ].filter(f => fs.existsSync(f));

  const candidateFiles = [
    ...rootConfigs,
    ...getAllFiles(path.join(SRC, 'pages')),
    ...getAllFiles(path.join(SRC, 'layouts')),
    ...getAllFiles(path.join(SRC, 'content'))
  ].filter(f => fs.existsSync(f));

  // Cargar contenidos de todos los archivos consumidores (páginas, layouts, configs, contenido)
  const candidateContents = candidateFiles.map(filePath => fs.readFileSync(filePath, 'utf-8'));
  const activeComponents = new Set();

  // 1. Detectar qué componentes son usados directamente por páginas/layouts/configs
  for (const comp of allComponents) {
    if (comp === 'index.ts') continue;
    const compNameNoExt = path.basename(comp, path.extname(comp));
    for (const content of candidateContents) {
      if (isComponentReferencedIn(compNameNoExt, comp, content)) {
        activeComponents.add(comp);
        break;
      }
    }
  }

  // 2. Propagación transitiva: si un componente activo referencia a otro componente, activarlo también
  let changed = true;
  while (changed) {
    changed = false;
    for (const activeComp of Array.from(activeComponents)) {
      const activeContent = fs.readFileSync(path.join(COMPONENTS_DIR, activeComp), 'utf-8');
      for (const comp of allComponents) {
        if (comp === 'index.ts' || activeComponents.has(comp)) continue;
        const compNameNoExt = path.basename(comp, path.extname(comp));
        if (isComponentReferencedIn(compNameNoExt, comp, activeContent)) {
          activeComponents.add(comp);
          changed = true;
        }
      }
    }
  }

  // 3. Determinar huérfanos
  const orphans = [];
  let totalOrphanBytes = 0;

  for (const comp of allComponents) {
    const compNameNoExt = path.basename(comp, path.extname(comp));
    // Ignorar index o iconos si aplica
    if (comp === 'index.ts') continue;

    if (!activeComponents.has(comp)) {
      const fullPath = path.join(COMPONENTS_DIR, comp);
      const stat = fs.statSync(fullPath);
      totalOrphanBytes += stat.size;
      orphans.push({
        name: comp,
        path: fullPath,
        size: stat.size,
        ext: path.extname(comp),
        approxTokens: Math.round(stat.size / 3.5)
      });
    }
  }

  console.log('\n======================================================');
  console.log(`📊 RESULTADO DE LA AUDITORÍA (${orphans.length} componentes huérfanos detectados):`);
  console.log('======================================================');

  if (orphans.length === 0) {
    console.log('✅ No se encontraron componentes huérfanos. Todo está limpio y en uso.');
    return;
  }

  orphans.forEach((o, i) => {
    const sizeKb = (o.size / 1024).toFixed(1);
    console.log(`${i + 1}. [HUÉRFANO] ${o.name.padEnd(30)} | ${sizeKb} KB | ~${o.approxTokens} tokens ahorrados`);
  });

  const totalKb = (totalOrphanBytes / 1024).toFixed(1);
  const totalTokens = Math.round(totalOrphanBytes / 3.5);
  console.log('------------------------------------------------------');
  console.log(`💾 Espacio total inactivo: ${totalKb} KB`);
  console.log(`⚡ Ahorro estimado de contexto para LLMs: ~${totalTokens.toLocaleString()} tokens por lectura.`);
  console.log('======================================================\n');

  if (isArchive) {
    if (!fs.existsSync(ARCHIVE_DIR)) {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }
    console.log(`📦 Moviendo componentes huérfanos a ${ARCHIVE_DIR}...`);
    for (const o of orphans) {
      const dest = path.join(ARCHIVE_DIR, o.name);
      fs.renameSync(o.path, dest);
      console.log(`  ↪ Movido: ${o.name} -> .archive_legacy/${o.name}`);
    }
    console.log('✨ Sanitización completada con éxito. Archivos archivados fuera de src/.');
  } else if (isDelete) {
    console.log(`🗑️ Eliminando componentes huérfanos...`);
    for (const o of orphans) {
      fs.unlinkSync(o.path);
      console.log(`  ✖ Eliminado: ${o.name}`);
    }
    console.log('✨ Sanitización completada con éxito. Archivos eliminados.');
  } else {
    console.log('ℹ️  Modo vista previa (Dry-Run).');
    console.log('   Para archivar fuera de src/: node scripts/audit-orphans.mjs --archive');
    console.log('   Para eliminar permanentemente: node scripts/audit-orphans.mjs --delete');
  }
}

audit().catch(console.error);
