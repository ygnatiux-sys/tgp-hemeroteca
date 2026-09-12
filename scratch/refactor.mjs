import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve('src');
const exts = ['.astro', '.tsx'];

function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (exts.includes(path.extname(full))) {
      results.push(full);
    }
  }
  return results;
}

const files = walkDir(SRC_DIR);
let modifiedCount = 0;

const CLASSES_TO_REMOVE = [
  'w-full', 'h-full', 'object-cover', 'h-64', 'h-40', 'h-auto', 'aspect-video',
  'object-contain', 'h-svh', 'min-h-screen'
];
// Only match these classes exactly as words
const classRegexStr = CLASSES_TO_REMOVE.map(c => `\\b${c}\\b`).join('|');
const classRegex = new RegExp(`(?:\\s+|^)(${classRegexStr})(?=\\s|$)`, 'g');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  let hasChanges = false;
  
  // Custom manual replacements for known patterns to be safe.
  
  // 1. src/pages/index.astro line 413
  // <img src={sanitizeImageUrl(img)} alt={label} loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-70 group-hover:opacity-90" />
  // into <img src={sanitizeImageUrl(img)} alt={label} loading="lazy" decoding="async" class={`transition-transform duration-700 group-hover:scale-105 opacity-70 group-hover:opacity-90 ${resolveMultivisionClass(img)}`} />
  if (file.endsWith('index.astro') && content.includes('class="w-full h-full object-cover transition-transform')) {
      content = content.replace(
        /class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-70 group-hover:opacity-90"/g,
        'class={`transition-transform duration-700 group-hover:scale-105 opacity-70 group-hover:opacity-90 ${resolveMultivisionClass(img)}`}'
      );
      if (!content.includes('resolveMultivisionClass')) {
        content = content.replace(/---/, '---\nimport { resolveMultivisionClass } from "../lib/multivision";');
      }
      hasChanges = true;
  }
  
  // We can do an AST or regex approach for all. 
  // Let's just do a blanket regex: replace <Image ... class="..." />
  // This is too dangerous to do blindly.
}

console.log(`Updated files.`);
