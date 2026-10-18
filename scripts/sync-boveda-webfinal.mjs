import fs from 'node:fs';

const target = 'C:/Users/ygnat/WEB FINAL 2026/src/pages/boveda.astro';
if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, 'utf8');
  content = content.replace("import Header from '../components/Header.astro';", "import Navbar from '../components/Navbar.astro';");
  content = content.replace("import PolvoDorado from '../components/PolvoDorado.astro';", "");
  content = content.replace("<Header />", "<Navbar />");
  content = content.replace("<PolvoDorado />", "");
  fs.writeFileSync(target, content, 'utf8');
  console.log('✅ WEB FINAL 2026 boveda.astro adaptado con Navbar.');
} else {
  console.log('Target no existe:', target);
}
