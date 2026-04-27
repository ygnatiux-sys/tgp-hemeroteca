import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY no encontrada.');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-3.1-flash-image-preview';

const stylesDir = 'src/content/estilos-visuales';
const essaysDir = 'src/content/ensayos';
const assetsDir = 'src/assets/ensayos';

const tasks = [
  { slug: 'la-caida-de-cartago', title: 'LA CAIDA DE CARTAGO', style: 'editorial' },
  { slug: 'julio-cesar-y-los-galos-2', title: 'julio cesar y los galos 2', style: 'cine' },
  { slug: 'neron-y-roma', title: 'neron y roma', style: 'concepto' }
];

async function generateImage(task) {
  console.log(`Generando imagen para: ${task.title} con estilo: ${task.style}`);
  
  const stylePath = path.join(stylesDir, `${task.style}.json`);
  if (!fs.existsSync(stylePath)) {
    throw new Error(`Estilo no encontrado: ${task.style}`);
  }
  
  const styleConfig = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
  
  // Ensamblaje según Micro-Dirección TGP
  let prompt = `${styleConfig.formatoCamara} Subject: ${task.title}. ${styleConfig.iluminacion} ${styleConfig.colorTextura} ${styleConfig.descripcionEstetica}`;
  
  // Instrucción 16:9 solicitada
  prompt += " --ar 16:9, panoramic wide shot, landscape orientation";

  try {
    const response = await genAI.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'image/jpeg',
        aspectRatio: '16:9'
      }
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
    
    if (imagePart?.inlineData?.data) {
      const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
      
      const targetDir = path.join(assetsDir, task.slug);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      
      const fileName = 'coverImage.jpg';
      const filePath = path.join(targetDir, fileName);
      fs.writeFileSync(filePath, buffer);
      
      console.log(`✅ Imagen guardada en: ${filePath}`);
      
      // Actualizar JSON del ensayo
      const essayPath = path.join(essaysDir, task.slug, 'index.json');
      const essayData = JSON.parse(fs.readFileSync(essayPath, 'utf8'));
      essayData.coverImage = `/${assetsDir}/${task.slug}/${fileName}`;
      fs.writeFileSync(essayPath, JSON.stringify(essayData, null, 2));
      
      console.log(`✅ Registro actualizado en: ${essayPath}`);
      return true;
    } else {
      console.error(`❌ Error: No se generaron bytes para ${task.slug}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Error generando ${task.slug}:`, err.message);
    return false;
  }
}

async function run() {
  for (const task of tasks) {
    await generateImage(task);
  }
  console.log('--- PROCESO FINALIZADO ---');
}

run();
