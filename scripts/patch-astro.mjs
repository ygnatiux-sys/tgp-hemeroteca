import fs from 'node:fs';
import path from 'node:path';

const targetFile = path.resolve('node_modules/astro/dist/core/app/entrypoints/index.js');

try {
  if (fs.existsSync(targetFile)) {
    let content = fs.readFileSync(targetFile, 'utf8');
    if (!content.includes('beginContentEntryCollection')) {
      const patch = `
const beginContentEntryCollection = () => {};
const beginImageCollection = () => {};
const endContentEntryCollection = () => [];
const endImageCollection = () => [];

export {
  beginContentEntryCollection,
  beginImageCollection,
  endContentEntryCollection,
  endImageCollection,
`;
      content = content.replace('export {', patch);
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log('✅ [patch-astro] Stubs de compatibilidad inyectados en astro/app.');
    } else {
      console.log('ℹ️ [patch-astro] astro/app ya cuenta con los stubs de compatibilidad.');
    }
  }
} catch (err) {
  console.warn('⚠️ [patch-astro] Omitiendo parche opcional:', err.message);
}
