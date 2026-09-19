const fs = require('fs');
const path = require('path');
const ts2gasModule = require('ts2gas');
const ts2gas = ts2gasModule.default || ts2gasModule;

const files = ['Config', 'Gemini', 'Telegram', 'Code'];

console.log('Compilando archivos TypeScript a formato Apps Script...');

files.forEach((file) => {
  const tsPath = path.join(__dirname, `${file}.ts`);
  const jsPath = path.join(__dirname, `${file}.js`);

  if (fs.existsSync(tsPath)) {
    const tsCode = fs.readFileSync(tsPath, 'utf8');
    const gsCode = ts2gas(tsCode);
    fs.writeFileSync(jsPath, gsCode, 'utf8');
    console.log(`✓ ${file}.ts -> ${file}.js`);
  }
});

console.log('Compilación completada.');
