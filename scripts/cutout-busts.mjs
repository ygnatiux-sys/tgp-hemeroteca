/**
 * scripts/cutout-busts.mjs
 * Recorta automáticamente fondos de bustos y esculturas históricas usando
 * @imgly/background-removal-node (ONNX local) y los guarda con transparencia en public/busts/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { removeBackground } from '@imgly/background-removal-node';

const BUSTS_DIR = path.resolve('public/busts');

if (!fs.existsSync(BUSTS_DIR)) {
  fs.mkdirSync(BUSTS_DIR, { recursive: true });
}

const targets = [
  {
    id: 'busto-venus',
    name: 'Venus (Townley Venus / British Museum)',
    src: fs.existsSync(path.resolve('src/assets/arquetipos-globales/venus/coverImage.jpg'))
      ? path.resolve('src/assets/arquetipos-globales/venus/coverImage.jpg')
      : 'https://storage.thegreatpuzzleproject.com/British_Museum_Townley_Venus_01.jpg',
    out: path.join(BUSTS_DIR, 'busto-venus.png'),
    mimeType: 'image/jpeg',
  },
  {
    id: 'busto-olmeca',
    name: 'Cabeza Colosal Olmeca',
    src: path.resolve('src/assets/alternativa/olmeca.jpg'),
    out: path.join(BUSTS_DIR, 'busto-olmeca.png'),
    mimeType: 'image/jpeg',
  },
  {
    id: 'busto-pazuzu',
    name: 'Pazuzu (Bronce Asirio)',
    src: path.resolve('src/assets/arquetipos-globales/pazuzu/coverImage.jpg'),
    out: path.join(BUSTS_DIR, 'busto-pazuzu.png'),
    mimeType: 'image/jpeg',
  },
];

console.log('🏛️  [CUTOUT-BUSTS] Iniciando procesamiento de siluetas históricas...');

for (const target of targets) {
  console.log(`\n✂️  Procesando: ${target.name}...`);
  try {
    let inputSource;
    if (typeof target.src === 'string' && target.src.startsWith('http')) {
      const resp = await fetch(target.src);
      if (!resp.ok) throw new Error(`HTTP error ${resp.status} al descargar ${target.src}`);
      inputSource = Buffer.from(await resp.arrayBuffer());
    } else {
      if (!fs.existsSync(target.src)) {
        throw new Error(`Archivo local no encontrado: ${target.src}`);
      }
      inputSource = fs.readFileSync(target.src);
    }

    const inputBlob = new Blob([inputSource], { type: target.mimeType });
    const blob = await removeBackground(inputBlob);
    const arrayBuffer = await blob.arrayBuffer();

    fs.writeFileSync(target.out, Buffer.from(arrayBuffer));
    const stats = fs.statSync(target.out);
    console.log(`✅  Guardado con éxito: ${target.out} (${Math.round(stats.size / 1024)} KB)`);
  } catch (err) {
    console.error(`❌  Error procesando ${target.name}:`, err.message);
  }
}

console.log('\n🏛️  [CUTOUT-BUSTS] Finalizado. Todos los bustos listos en public/busts/.');
