/**
 * scripts/generar-post.js
 *
 * TGP Hemeroteca — CLI Cognitivo de Generación de Ensayos
 * SDK: @google/genai (moderno)
 * Modelo texto: gemini-3.1-pro
 * Modelo imagen: imagen-3.0-generate-001
 *
 * Uso: node scripts/generar-post.js
 */

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

// ─── SLUGIFY CON SOPORTE UNICODE / TILDES ─────────────────────────────────────
// "Chichén Itzá" → "chichen-itza"
const slugify = (text) =>
  text
    .toString()
    .normalize('NFD')                         // Descompone diacríticos (á → a + ́)
    .replace(/[\u0300-\u036f]/g, '')          // Elimina los diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')            // Solo letras, números, espacios y guiones
    .replace(/\s+/g, '-')                     // Espacios → guiones
    .replace(/-+/g, '-')                      // Guiones múltiples → uno
    .replace(/^-+|-+$/g, '');                 // Sin guiones al inicio/fin

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const rl = createInterface({ input, output });

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  TGP Hemeroteca — Motor Cognitivo (gemini-3.1-pro)  ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    // ── Paso 1: Input interactivo ──────────────────────────────────────────
    const titulo = (await rl.question('  📝 Título o tema del ensayo: ')).trim();
    if (!titulo) throw new Error('El título no puede estar vacío.');

    const categoriaInput = (await rl.question('  🗂  Categoría (ej. Historia, Arqueología) [Ensayo]: ')).trim();
    const categoria = categoriaInput || 'Ensayo';

    const respuestaImagen = await rl.question('  🎨 ¿Generar imagen de portada? (s/n) [n]: ');
    rl.close();

    const generarImagen = respuestaImagen.toLowerCase() === 's';

    // ── Paso 2: Validar API Key ────────────────────────────────────────────
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error('GEMINI_API_KEY no encontrada en .env');
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // ── Paso 3: Generar texto con gemini-2.0-flash ─────────────────────────
    console.log('\n  🧠 Generando ensayo con gemini-3.1-pro...');

    const textResult = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: titulo,
      config: {
        systemInstruction:
          'Eres el motor cognitivo TGP y socio analítico de Xavier Benítez. ' +
          'Tu función es redactar textos orientados al análisis cultural, histórico y filosófico ' +
          'bajo el formato de ensayo argentino contemporáneo. ' +
          'Tono: Dark Academia accesible — preciso, sobrio, agudo. Sin tono casual. ' +
          'Estructura: Apertura con tensión, desarrollo que articule historia/filosofía/simbolismo, ' +
          'y cierre reflexivo universal. Ve directo al núcleo. ' +
          'Usa Markdown para párrafos y encabezados (##, ###). No uses H1.',
      },
    });

    const textoEnsayo = textResult.text;
    if (!textoEnsayo || textoEnsayo.length < 100) {
      throw new Error('El texto generado está vacío o es demasiado corto.');
    }

    // ── Paso 4: Preparar rutas ─────────────────────────────────────────────
    const slug = slugify(titulo);
    if (!slug) throw new Error(`No se pudo generar un slug válido para: "${titulo}"`);

    const folderPath = path.join(process.cwd(), 'src/content/ensayos', slug);
    const assetsPath = path.join(process.cwd(), 'src/assets/ensayos', slug);

    if (fs.existsSync(folderPath)) {
      throw new Error(`Ya existe un post con el slug "${slug}". Elige un título diferente.`);
    }

    // ── Paso 5: Generar imagen (opcional) ────────────────────────────────
    let coverImage = null;

    if (generarImagen) {
      console.log('  🖼  Generando portada con imagen-3.0-generate-001...');
      try {
        const imagePrompt =
          `Cinematic, dark academia editorial photography. Concept: ${titulo}. ` +
          `Category: ${categoria}. Moody atmosphere, archival textures, deep shadows, ` +
          `historical symbolism. No text, no people, no fantasy elements. ` +
          `Restrained color palette, fine grain, high detail.`;

        const imageResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: [{ prompt: imagePrompt }],
              parameters: { sampleCount: 1, aspectRatio: '16:9' },
            }),
          }
        );

        const imageData = await imageResponse.json();

        if (imageData?.predictions?.[0]?.bytesBase64Encoded) {
          const buffer = Buffer.from(imageData.predictions[0].bytesBase64Encoded, 'base64');
          const fileName = 'coverImage.jpg';

          if (!fs.existsSync(assetsPath)) fs.mkdirSync(assetsPath, { recursive: true });
          fs.writeFileSync(path.join(assetsPath, fileName), buffer);

          coverImage = `/src/assets/ensayos/${slug}/${fileName}`;
          console.log(`  ✅ Portada guardada: ${coverImage}`);
        } else {
          console.warn('  ⚠️  La API de imagen no devolvió datos. Continuando sin portada.');
          if (imageData?.error) {
            console.warn('     Error API:', imageData.error.message || JSON.stringify(imageData.error));
          }
        }
      } catch (imgErr) {
        console.warn('  ⚠️  Error generando imagen:', imgErr.message);
      }
    }

    // ── Paso 6: Construir excerpt desde el texto ───────────────────────────
    // Tomar el primer párrafo de texto plano (sin # ni **)
    const excerptRaw = textoEnsayo
      .split('\n')
      .map(l => l.trim())
      .find(l => l.length > 40 && !l.startsWith('#') && !l.startsWith('*') && !l.startsWith('-'));
    const excerpt = excerptRaw
      ? excerptRaw.replace(/\*\*/g, '').substring(0, 200) + (excerptRaw.length > 200 ? '...' : '')
      : '';

    // ── Paso 7: Escribir archivos atómicamente ────────────────────────────
    console.log('  💾 Escribiendo archivos...');
    fs.mkdirSync(folderPath, { recursive: true });

    // index.json — metadatos (lo que lee Astro Content Layer y Keystatic)
    const metadata = {
      title: titulo,
      volanta: '',
      date: new Date().toISOString().split('T')[0],
      category: categoria,
      themeColor: 'british-green',
      draft: true,                              // Siempre empieza como borrador
      coverImage: coverImage,
      videoBg: null,
      excerpt,
      generador: 'gemini-3.1-pro-preview',
      generadorTexto: textoEnsayo,             // El texto completo en el campo tipado
      generadorImagen: '',
      notasInvestigador: '',
      spotifyLink: null,
      youtubeLink: null,
    };

    fs.writeFileSync(
      path.join(folderPath, 'index.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    // content.mdoc — contenido Markdoc (lo lee Keystatic en su editor)
    fs.writeFileSync(
      path.join(folderPath, 'content.mdoc'),
      textoEnsayo,
      'utf-8'
    );

    // ── Paso 8: Reporte final ─────────────────────────────────────────────
    console.log('\n  ╔═══════════════════════════════════════════╗');
    console.log('  ║           ✅ ENSAYO CREADO                ║');
    console.log('  ╠═══════════════════════════════════════════╣');
    console.log(`  ║  Título:   ${titulo.substring(0, 33).padEnd(33)} ║`);
    console.log(`  ║  Slug:     ${slug.substring(0, 33).padEnd(33)} ║`);
    console.log(`  ║  Categoría: ${categoria.substring(0, 32).padEnd(32)} ║`);
    console.log(`  ║  Portada:  ${(coverImage ? '✓ Generada' : '✗ Sin portada').padEnd(33)} ║`);
    console.log(`  ║  Estado:   BORRADOR (draft: true)          ║`);
    console.log('  ╠═══════════════════════════════════════════╣');
    console.log(`  ║  Ruta: src/content/ensayos/${slug.substring(0, 15)}  ║`);
    console.log('  ╠═══════════════════════════════════════════╣');
    console.log('  ║  ⚠️  Para publicar: abre Keystatic y       ║');
    console.log('  ║     desmarca "Borrador" en este ensayo.    ║');
    console.log('  ╚═══════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n  ❌ ERROR:', error.message || error);
    console.log('');
    process.exit(1);
  }
}

main();
