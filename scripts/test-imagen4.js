import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testImagen4() {
  try {
    const response = await ai.models.predict({
      model: 'imagen-4.0-fast-generate-001',
      instances: [{ prompt: 'A high quality 16:9 cinematic image of a sunset over Mars.' }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '16:9'
      }
    });
    
    console.log('Response:', JSON.stringify(response, null, 2));
  } catch (err) {
    console.error('Error with Imagen 4:', err.message);
  }
}

testImagen4();
