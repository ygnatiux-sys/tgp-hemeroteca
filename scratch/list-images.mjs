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

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Add import if missing and we are about to add the function
  let needsImport = false;
  
  // This is a naive regex approach. We look for <img or <Image tags
  // We need to be careful. Let's do it file by file for the most important ones manually if this is too complex.
  // Actually, I can just use `replace_file_content` for the most important ones and maybe ignore some legacy _papers if not used.
  
  // Let's print out all files that contain <img or <Image
  const hasImg = content.includes('<img');
  const hasImage = content.includes('<Image');
  if (hasImg || hasImage) {
      console.log(file);
  }
}
