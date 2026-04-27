import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testModel() {
  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hola' }] }]
    });
    console.log('Success with gemini-1.5-flash:', response.text());
  } catch (err) {
    console.error('Error with gemini-1.5-flash:', err.message);
  }
}

testModel();
