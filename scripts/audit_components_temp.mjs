import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

const componentsDir = './src/components';
const sourceFiles = project.addSourceFilesAtPaths(`${componentsDir}/**/*.tsx`);

const report = [];

report.push('# Auditoría Completa de Componentes TGP con TS-Morph');
report.push('Este reporte analiza el estado de todos los componentes en `src/components/`, buscando código roto, repetitivo o valioso pero desconectado.');

for (const sourceFile of sourceFiles) {
  const fileName = sourceFile.getBaseName();
  const filePath = sourceFile.getFilePath();
  
  const exports = sourceFile.getExportedDeclarations();
  const isExported = Array.from(exports.keys()).length > 0;
  
  // Find React components
  const functions = sourceFile.getFunctions();
  const arrowFunctions = sourceFile.getVariableDeclarations().filter(v => {
    const init = v.getInitializer();
    return init && (init.getKind() === SyntaxKind.ArrowFunction);
  });
  
  const componentNames = [];
  functions.forEach(f => {
    if (f.getName() && /^[A-Z]/.test(f.getName())) componentNames.push(f.getName());
  });
  arrowFunctions.forEach(f => {
    if (f.getName() && /^[A-Z]/.test(f.getName())) componentNames.push(f.getName());
  });

  // Check repetitive patterns
  const text = sourceFile.getFullText();
  const hasLocalStorage = text.includes('localStorage');
  const hasDOMHacks = text.includes('document.querySelector') || text.includes('injectIntoKeystaticDocumentEditor');
  const hasAPI = text.includes('fetch(') || text.includes('axios');
  
  // Check if used anywhere else in the project (basic heuristic: find references)
  let isIntegrated = false;
  if (isExported) {
     for (const [name, decls] of exports.entries()) {
        for (const decl of decls) {
           if (decl.findReferencesAsNodes().length > 0) {
              isIntegrated = true;
           }
        }
     }
  }

  // Compile specific file info
  report.push(`\n## 📄 [${fileName}](file:///${filePath.replace(/\\/g, '/')})`);
  report.push(`- **Exportaciones Principales:** ${componentNames.length > 0 ? componentNames.join(', ') : 'Ninguna (Posible código muerto/huérfano)'}`);
  report.push(`- **Integrado (Referenciado):** ${isIntegrated ? '✅ Sí' : '❌ No (Podría estar desconectado del routing / keystatic)'}`);
  
  const repetitive = [];
  if (hasLocalStorage) repetitive.push('Manejo de Backups locales');
  if (hasDOMHacks) repetitive.push('Hacks de DOM directos');
  if (hasAPI) repetitive.push('Llamadas a API directas (Core Logic)');
  
  if (repetitive.length > 0) {
     report.push(`- **Patrones Detectados:** ${repetitive.join(', ')}`);
  } else {
     report.push(`- **Patrones Detectados:** UI Pura`);
  }
}

fs.writeFileSync('ts_morph_audit_report.md', report.join('\n'), 'utf-8');
console.log('Audit complete. Wrote ts_morph_audit_report.md');
