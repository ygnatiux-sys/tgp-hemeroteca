import fs from 'node:fs';
import { removeBackground } from '@imgly/background-removal-node';

console.log('Testing @imgly/background-removal-node...');
try {
  const samplePath = 'src/assets/arquetipos-globales/pazuzu/coverImage.jpg';
  console.log('Reading sample:', samplePath);
  const buf = fs.readFileSync(samplePath);
  console.log('Creating blob...');
  const inputBlob = new Blob([buf], { type: 'image/jpeg' });
  console.log('Calling removeBackground...');
  const blob = await removeBackground(inputBlob);
  console.log('Blob received, size:', blob.size, 'type:', blob.type);
  const arrayBuffer = await blob.arrayBuffer();
  fs.mkdirSync('public/busts', { recursive: true });
  fs.writeFileSync('public/busts/busto-pazuzu.png', Buffer.from(arrayBuffer));
  console.log('Success! Saved public/busts/busto-pazuzu.png');
} catch (e) {
  console.error('Test error:', e);
}
