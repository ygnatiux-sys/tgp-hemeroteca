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
  'object-contain', 'w-100', 'h-100'
];
// RegEx to remove these exact classes safely (with spaces around)
const classRegex = new RegExp(`(?:^|\\s)(${CLASSES_TO_REMOVE.join('|')})(?=\\s|$)`, 'g');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // We are looking for <Image ... /> or <img ... />
  // We want to replace class="..." or class={...} or className="..." inside these tags.
  
  // Custom manual replacements for safety:
  // Instead of full regex, we do a targeted replace for "w-full h-full object-cover" 
  // on images.
  
  let hasChanges = false;

  // Replace static class="... w-full h-full object-cover ..."
  content = content.replace(/(<(?:img|Image)[^>]*?)(class(?:Name)?=")([^"]*)(")/g, (match, prefix, classAttr, classes, suffix) => {
    let newClasses = classes.replace(classRegex, '').replace(/\s+/g, ' ').trim();
    if (classes !== newClasses) {
      hasChanges = true;
      // If it's a static src, we can't easily guess the image here unless we parse it.
      // But we just clean the classes. We rely on CSS to do nothing or img-nativa
      return `${prefix}${classAttr}${newClasses} img-nativa${suffix}`;
    }
    return match;
  });

  // Replace dynamic class={`...`} or class={...}
  // This is harder with regex. Let's just remove w-full h-full object-cover globally 
  // from any class string that is inside an <img or <Image.
  // Actually, wait, replacing just "w-full h-full object-cover" string in the whole file if it's near an img.
  
  // Since we already manually updated CinematicCollectionHero...
  if (file.includes('CinematicCollectionHero')) continue; // skip

  // To be completely safe and avoid breaking layout, we just replace `w-full h-full object-cover` with `img-nativa` in simple strings, and we leave the complex logic to the user if they want dynamic classes, or we just remove them.
  // The user requested: "Limítate ESTRICTAMENTE a limpiar y reemplazar las clases que fuerzan dimensiones, proporciones o recortes".
  
  let oldContent = content;
  content = content.replace(/(<(?:img|Image)[^>]*?)(class(?:Name)?=\{`)(.*?)(`\})/gs, (match, prefix, classAttr, classes, suffix) => {
    let newClasses = classes.replace(classRegex, '').replace(/\s+/g, ' ').trim();
    if (classes !== newClasses) {
      hasChanges = true;
      return `${prefix}${classAttr}${newClasses} \${resolveMultivisionClass(img)}${suffix}`;
    }
    return match;
  });

  if (hasChanges) {
    if (!content.includes('resolveMultivisionClass')) {
       // add import
       if (content.includes('---')) {
          content = content.replace(/---/, '---\nimport { resolveMultivisionClass } from "../lib/multivision";');
       }
    }
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log('Updated', file);
  }
}

console.log(`Modified ${modifiedCount} files.`);
