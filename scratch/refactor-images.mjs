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
let modifiedFiles = 0;

const CLASSES_TO_REMOVE = [
  'w-full', 'h-full', 'object-cover', 'h-64', 'h-40', 'h-auto', 'aspect-video',
  'object-contain'
];
const REPLACE_REGEX = new RegExp(`\\b(${CLASSES_TO_REMOVE.join('|')})\\b\\s*`, 'g');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // We are looking for <Image ... /> or <img ... />
  // We need to carefully add import if we modify.
  // We should apply {resolveMultivisionClass(src)} to class.

  let hasChanges = false;
  
  // Custom replacements for known files. Since regex parsing of AST is error-prone,
  // we can do basic regex for class="..." and class:list={...} inside <img or <Image tags
  
  content = content.replace(/(<(?:img|Image)[^>]*?)(class=")([^"]*)(")/gs, (match, prefix, classStart, classes, suffix) => {
    // If it's an Image with a static src or a dynamic src
    // Actually, finding the src is harder. 
    // It's much safer to replace specific files manually or use a slightly smarter approach.
    return match; 
  });

}
console.log(`Modified ${modifiedFiles} files.`);
