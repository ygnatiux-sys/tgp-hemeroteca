import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";

// Función para crear slugs compatibles con URLs y Keystatic
const slugify = (text) => text.toString().toLowerCase().trim()
  .replace(/\s+/g, '-')
  .replace(/[^\w-]+/g, '')
  .replace(/--+/g, '-');

async function main() {
  const rl = createInterface({ input, output });

  console.log('\n🚀 TGP Hemeroteca - Generador de Posts (Motor Cognitivo)\n');

  try {
    // Paso 1: Interactividad en terminal
    const titulo = await rl.question('¿Cuál es el tema o título del ensayo? ');
    const respuestaImagen = await rl.question('¿Deseas generar una imagen de portada con IA? (s/n) ');
    
    // Cerramos el readline antes de iniciar procesos pesados o de red
    rl.close();

    const generarIA = respuestaImagen.toLowerCase() === 's';
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      throw new Error('La variable GEMINI_API_KEY no se encontró en el archivo .env');
    }

    // Paso 2: Conexión con Gemini
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      systemInstruction: 'Eres el motor cognitivo TGP y socio analítico de Xavier Benítez. Tu función es redactar textos orientados al análisis cultural, histórico y filosófico bajo el formato de ensayo argentino contemporáneo. Tono: Dark Academia accesible — preciso, sobrio, agudo. Sin tono casual. Estructura: Apertura con tensión, desarrollo que articule historia/filosofía/simbolismo, y cierre reflexivo universal. Ve directo al núcleo.'
    });

    console.log('\n🧠 Gemini redactando ensayo...');
    const result = await model.generateContent(titulo);
    const content = result.response.text();

    let imagePath = null;
    const slug = slugify(titulo);
    const folderPath = path.join(process.cwd(), 'src/content/ensayos', slug);
    const assetsPath = path.join(process.cwd(), 'src/assets/ensayos');

    // Paso 3: Generación de Imagen (opcional)
    if (generarIA) {
      console.log('🎨 Generando arte conceptual (Imagen 3)...');
      try {
        const imagePrompt = `A high-end, conceptual Dark Academia style visual representation of: ${titulo}. Cinematic lighting, moody atmosphere, archival texture, deep shadows, intellectual and historical symbolism.`;
        
        const imageResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: imagePrompt }],
            parameters: { sampleCount: 1 }
          })
        });

        const imageData = await imageResponse.json();
        
        if (imageData.predictions && imageData.predictions[0].bytesBase64Encoded) {
          const buffer = Buffer.from(imageData.predictions[0].bytesBase64Encoded, 'base64');
          const fileName = `${slug}.jpg`;
          const fullImagePath = path.join(assetsPath, fileName);
          
          if (!fs.existsSync(assetsPath)) fs.mkdirSync(assetsPath, { recursive: true });
          fs.writeFileSync(fullImagePath, buffer);
          
          imagePath = `/src/assets/ensayos/${fileName}`;
          console.log(`✅ Imagen guardada: ${imagePath}`);
        }
      } catch (imgErr) {
        console.warn('⚠️ Error al generar imagen, continuando solo con texto:', imgErr.message);
      }
    }

    // Paso 4: Guardado en formato Keystatic (JSON + Markdoc)
    console.log('💾 Persistiendo archivos en el sistema...');
    
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const metadata = {
      title: titulo,
      date: new Date().toISOString().split('T')[0],
      category: "Ensayo IA",
      themeColor: "british-green",
      draft: true,
      coverImage: imagePath,
      videoBg: null,
      excerpt: content.split('\n')[0].substring(0, 150) + "..."
    };

    // Archivo de metadata
    fs.writeFileSync(path.join(folderPath, 'index.json'), JSON.stringify(metadata, null, 2));
    
    // Archivo de contenido (Keystatic Markdoc)
    fs.writeFileSync(path.join(folderPath, 'content.mdoc'), content);

    console.log('\n-----------------------------------------');
    console.log('🎉 ¡PROCESO COMPLETADO!');
    console.log(` - Título: ${titulo}`);
    console.log(` - Slug: ${slug}`);
    console.log(` - Ruta: src/content/ensayos/${slug}`);
    console.log('-----------------------------------------\n');

  } catch (error) {
    console.error('\n❌ ERROR EN EL PROCESO:');
    console.error(error.message || error);
    console.log('-----------------------------------------\n');
  }
}

main();
