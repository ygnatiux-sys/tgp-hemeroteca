import fs from 'fs';
import path from 'path';

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.astro', '.history'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const rootDir = process.cwd();
const allFiles = getAllFiles(rootDir);
const fileMap = new Map();
allFiles.forEach(f => {
  fileMap.set(f.toLowerCase().replace(/\\/g, '/'), f.replace(/\\/g, '/'));
});

let mismatches = [];

const importRegex = /(?:import|from|require|entrypoint:)\s*\(?['"`]([^'"`]+)['"`]/g;

for (const file of allFiles) {
  if (!/\.(astro|ts|tsx|js|jsx|mjs|json|css)$/.test(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const dir = path.dirname(file);
      const resolvedBase = path.resolve(dir, importPath).replace(/\\/g, '/');
      
      const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.astro', '.mjs', '.json', '.css', '/index.ts', '/index.js', '/index.tsx', '/index.astro'];
      for (const ext of exts) {
        const full = resolvedBase + ext;
        const lower = full.toLowerCase();
        if (fileMap.has(lower)) {
          const actual = fileMap.get(lower);
          if (actual !== full) {
            mismatches.push({
              file: path.relative(rootDir, file).replace(/\\/g, '/'),
              importPath,
              expected: path.relative(rootDir, actual).replace(/\\/g, '/'),
              used: path.relative(rootDir, full).replace(/\\/g, '/')
            });
          }
          break;
        }
      }
    }
  }
}

console.log('=== CASE SENSITIVITY CHECK ===');
console.log('Mismatches found:', mismatches.length);
mismatches.forEach(m => console.log(JSON.stringify(m, null, 2)));
