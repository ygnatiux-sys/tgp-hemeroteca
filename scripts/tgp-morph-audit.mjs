/**
 * ============================================================================
 * TGP SCRIPTORIUM: MOTOR DE RECONOCIMIENTO Y CUARENTENA AST (ts-morph)
 * ============================================================================
 * 
 * Rol: Ingeniero de Software AST & Automatización.
 * Propósito: Auditar colecciones de Keystatic, esquemas de campos y comandos
 *            de IA Gemini en React/TSX sin destruir el historial ni borrar código.
 * 
 * Fases:
 *   1. DIAGNÓSTICO: Recorre el AST, detecta colecciones, campos y comandos de IA,
 *      calcula duplicados y emite un reporte en 'tgp_audit_log.json'.
 *   2. CUARENTENA: Mediante envoltorio en comentarios /* [TGP-CUARENTENA] ... *\/
 *      o renombrado defensivo con prefijo '_legacy_'. PROHIBIDO el uso de .remove().
 * 
 * Requisitos:
 *   npm install -D ts-morph
 * 
 * Uso:
 *   node scripts/tgp-morph-audit.mjs                    (Diagnóstico por defecto)
 *   node scripts/tgp-morph-audit.mjs --mode=quarantine  (Ejecuta cuarentena según configuración)
 */

import { Project, SyntaxKind, Node } from 'ts-morph';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// CONFIGURACIÓN MODULAR DE OBJETIVOS Y CUARENTENA
// ============================================================================

/**
 * Patrones de archivos a incluir en el escaneo AST
 */
const TARGET_GLOBS = [
  path.join(ROOT_DIR, 'keystatic.config.ts'),
  path.join(ROOT_DIR, 'src/keystatic/**/*.ts'),
  path.join(ROOT_DIR, 'src/keystatic/**/*.tsx'),
  path.join(ROOT_DIR, 'src/components/**/*.tsx'),
  path.join(ROOT_DIR, 'src/pages/api/**/*.ts'),
  path.join(ROOT_DIR, 'src/services/**/*.ts')
];

/**
 * LISTA DE CUARENTENA MANUAL (Fase 2)
 * Una vez analices 'tgp_audit_log.json', define aquí los identificadores
 * exactos o patrones que deseas poner en cuarentena.
 */
const QUARANTINE_CONFIG = {
  // Nombres de propiedades de esquemas de Keystatic o campos a aislar
  propertyNames: [
    // Ejemplos configurables:
    // 'generadorTexto',
    // 'probadorArte',
  ],

  // Nombres de funciones o comandos de IA que se repiten
  functionNames: [
    // Ejemplos:
    // 'generarContenidoGeminiViejo',
  ],

  // Estrategia preferida: 'COMMENT' (comentario de bloque) o 'RENAME' (prefijo _legacy_)
  strategy: 'COMMENT' // 'COMMENT' | 'RENAME'
};

// ============================================================================
// ESTRUCTURA DE DATOS PARA EL REPORTE
// ============================================================================

const auditReport = {
  timestamp: new Date().toISOString(),
  totalFilesAudited: 0,
  keystatic: {
    collections: [],
    fieldsDetected: {},
    duplicatedFields: []
  },
  geminiCommands: {
    invocations: [],
    modelsReferenced: {},
    apiEndpoints: []
  },
  quarantineActionsTaken: []
};

// ============================================================================
// INICIALIZACIÓN DEL PROYECTO TS-MORPH
// ============================================================================

console.log('⚡ [TGP AST ENGINE] Inicializando ts-morph...');

const project = new Project({
  tsConfigFilePath: fs.existsSync(path.join(ROOT_DIR, 'tsconfig.json'))
    ? path.join(ROOT_DIR, 'tsconfig.json')
    : undefined,
  skipAddingFilesFromTsConfig: true
});

// Agregar los archivos objetivo al proyecto AST
TARGET_GLOBS.forEach(pattern => {
  project.addSourceFilesAtPaths(pattern);
});

const sourceFiles = project.getSourceFiles();
auditReport.totalFilesAudited = sourceFiles.length;
console.log(`📂 [TGP AST ENGINE] Se cargaron ${sourceFiles.length} archivos para análisis AST.`);

// ============================================================================
// FASE 1: DIAGNÓSTICO (ANÁLISIS AST)
// ============================================================================

function runDiagnostic() {
  console.log('🔍 [Fase Diagnóstico] Analizando estructuras de Keystatic y llamadas Gemini...');

  for (const sourceFile of sourceFiles) {
    const filePath = path.relative(ROOT_DIR, sourceFile.getFilePath());

    // 1. Detección de Colecciones y Esquemas de Keystatic
    sourceFile.forEachDescendant(node => {
      // Detección: collection({ ... })
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();
        if (expression.getText() === 'collection') {
          const args = node.getArguments();
          if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
            analyzeKeystaticCollection(args[0], filePath, node);
          }
        }
      }

      // Detección de Llamadas y Comandos Gemini AI
      if (Node.isCallExpression(node)) {
        analyzeGeminiCalls(node, filePath);
      }

      // Detección de Instanciación de GoogleGenAI
      if (Node.isNewExpression(node)) {
        if (node.getExpression().getText().includes('GoogleGenAI')) {
          auditReport.geminiCommands.invocations.push({
            type: 'GoogleGenAI_Client_Instance',
            file: filePath,
            line: node.getStartLineNumber(),
            codeSnippet: node.getText()
          });
        }
      }

      // Detección de modelos de Gemini como literales de string (ej. 'gemini-3.1-pro-preview')
      if (Node.isStringLiteral(node)) {
        const text = node.getLiteralValue();
        if (text.startsWith('gemini-') || text.includes('gemini')) {
          auditReport.geminiCommands.modelsReferenced[text] = (auditReport.geminiCommands.modelsReferenced[text] || 0) + 1;
        }
      }
    });
  }

  // Calcular duplicados en campos de Keystatic
  for (const [fieldName, data] of Object.entries(auditReport.keystatic.fieldsDetected)) {
    if (data.occurrences > 1) {
      auditReport.keystatic.duplicatedFields.push({
        fieldName,
        occurrences: data.occurrences,
        locations: data.locations
      });
    }
  }

  // Guardar log
  const logPath = path.join(ROOT_DIR, 'tgp_audit_log.json');
  fs.writeFileSync(logPath, JSON.stringify(auditReport, null, 2), 'utf-8');
  console.log(`✅ [Fase Diagnóstico] Reporte de auditoría generado en: ${path.relative(ROOT_DIR, logPath)}`);
}

/**
 * Analiza un objeto de configuración de Keystatic collection
 */
function analyzeKeystaticCollection(collectionObj, filePath, callNode) {
  const labelProp = collectionObj.getProperty('label');
  const pathProp = collectionObj.getProperty('path');
  const schemaProp = collectionObj.getProperty('schema');

  const collectionInfo = {
    file: filePath,
    line: callNode.getStartLineNumber(),
    label: labelProp && Node.isPropertyAssignment(labelProp) ? labelProp.getInitializer()?.getText() : 'Sin etiqueta',
    storagePath: pathProp && Node.isPropertyAssignment(pathProp) ? pathProp.getInitializer()?.getText() : 'N/A',
    fields: []
  };

  if (schemaProp && Node.isPropertyAssignment(schemaProp)) {
    const schemaInit = schemaProp.getInitializer();
    if (schemaInit && Node.isObjectLiteralExpression(schemaInit)) {
      for (const prop of schemaInit.getProperties()) {
        if (Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)) {
          const fieldName = prop.getName();
          const fieldLine = prop.getStartLineNumber();
          const fieldSnippet = prop.getText().split('\n')[0]; // Primera línea representativa

          collectionInfo.fields.push(fieldName);

          // Registrar en el catálogo global de campos
          if (!auditReport.keystatic.fieldsDetected[fieldName]) {
            auditReport.keystatic.fieldsDetected[fieldName] = {
              occurrences: 0,
              locations: []
            };
          }

          auditReport.keystatic.fieldsDetected[fieldName].occurrences += 1;
          auditReport.keystatic.fieldsDetected[fieldName].locations.push({
            file: filePath,
            line: fieldLine,
            snippet: fieldSnippet
          });
        }
      }
    }
  }

  auditReport.keystatic.collections.push(collectionInfo);
}

/**
 * Analiza invocaciones a funciones de Gemini y endpoints asociados
 */
function analyzeGeminiCalls(callNode, filePath) {
  const callText = callNode.getExpression().getText();

  const isGeminiMethod = 
    callText.includes('generateContent') || 
    callText.includes('generateImage') || 
    callText.includes('GoogleGenAI') ||
    callText.includes('generateImageWithGemini');

  if (isGeminiMethod) {
    auditReport.geminiCommands.invocations.push({
      type: 'Method_Call',
      expression: callText,
      file: filePath,
      line: callNode.getStartLineNumber(),
      codeSnippet: callNode.getText().length > 150 
        ? callNode.getText().slice(0, 150) + '...' 
        : callNode.getText()
    });
  }

  // Detección de fetch a endpoints internos de generación
  if (callText === 'fetch') {
    const firstArg = callNode.getArguments()[0];
    if (firstArg && Node.isStringLiteral(firstArg)) {
      const url = firstArg.getLiteralValue();
      if (url.includes('/api/generar-') || url.includes('/api/agente-')) {
        auditReport.geminiCommands.apiEndpoints.push({
          url,
          file: filePath,
          line: callNode.getStartLineNumber()
        });
      }
    }
  }
}

// ============================================================================
// FASE 2: CUARENTENA NO DESTRUCTIVA
// ============================================================================

/**
 * Aplica cuarentena a un nodo sin invocar NUNCA .remove()
 * 
 * Regla de Oro:
 * - Estrategia 'COMMENT': Envuelve el nodo en bloque /* [TGP-CUARENTENA] ... *\/
 * - Estrategia 'RENAME': Renombra a _legacy_<nombre> si comentar rompería el AST sintáctico
 */
function quarantineNode(node, targetName, strategy = 'COMMENT') {
  const file = node.getSourceFile();
  const filePath = path.relative(ROOT_DIR, file.getFilePath());
  const line = node.getStartLineNumber();

  if (strategy === 'COMMENT') {
    const originalText = node.getText();
    const commentedText = `/* [TGP-CUARENTENA: ${targetName}]\n${originalText}\n*/`;

    // Reemplazo atómico sin desarticular la jerarquía del AST
    node.replaceWithText(commentedText);

    auditReport.quarantineActionsTaken.push({
      action: 'WRAPPED_IN_COMMENT',
      target: targetName,
      file: filePath,
      line
    });

    console.log(`🛡️  [CUARENTENA: COMENTADO] Nodo '${targetName}' en ${filePath}:${line}`);
  } else if (strategy === 'RENAME') {
    const legacyName = `_legacy_${targetName}`;

    if (Node.isPropertyAssignment(node) || Node.isMethodDeclaration(node) || Node.isFunctionDeclaration(node)) {
      node.getNameNode().replaceWithText(legacyName);

      auditReport.quarantineActionsTaken.push({
        action: 'RENAMED_TO_LEGACY',
        oldName: targetName,
        newName: legacyName,
        file: filePath,
        line
      });

      console.log(`🏷️  [CUARENTENA: RENOMBRADO] '${targetName}' -> '${legacyName}' en ${filePath}:${line}`);
    } else {
      // Fallback a comentario si no es renombrable de forma trivial
      quarantineNode(node, targetName, 'COMMENT');
    }
  }
}

/**
 * Ejecutor de la Fase de Cuarentena
 */
function runQuarantine() {
  const { propertyNames, functionNames, strategy } = QUARANTINE_CONFIG;

  const totalTargets = propertyNames.length + functionNames.length;
  if (totalTargets === 0) {
    console.log('ℹ️  [Fase Cuarentena] No hay objetivos configurados en QUARANTINE_CONFIG.');
    console.log('   Revisa \'tgp_audit_log.json\' y define los nombres en QUARANTINE_CONFIG para actuar.');
    return;
  }

  console.log(`☣️  [Fase Cuarentena] Iniciando aislamiento no destructivo para ${totalTargets} patrones...`);

  for (const sourceFile of sourceFiles) {
    sourceFile.forEachDescendant(node => {
      // 1. Cuarentena sobre propiedades de objeto o campos de Keystatic
      if (Node.isPropertyAssignment(node)) {
        const propName = node.getName();
        if (propertyNames.includes(propName)) {
          quarantineNode(node, propName, strategy);
        }
      }

      // 2. Cuarentena sobre declaraciones de función
      if (Node.isFunctionDeclaration(node)) {
        const fnName = node.getName();
        if (fnName && functionNames.includes(fnName)) {
          quarantineNode(node, fnName, strategy);
        }
      }
    });
  }

  // Guardar cambios en disco de manera segura
  project.saveSync();
  console.log('✨ [Fase Cuarentena] Cambios persistidos en el disco sin pérdidas ni eliminaciones.');
}

// ============================================================================
// PUNTO DE ENTRADA CLI
// ============================================================================

const args = process.argv.slice(2);
const isQuarantineMode = args.includes('--mode=quarantine');

// Ejecución
runDiagnostic();

if (isQuarantineMode) {
  runQuarantine();
} else {
  console.log('\n💡 Tip: Para activar la cuarentena sobre nodos problemáticos una vez configurados:');
  console.log('   node scripts/tgp-morph-audit.mjs --mode=quarantine\n');
}
