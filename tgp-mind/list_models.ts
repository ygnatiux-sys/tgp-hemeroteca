import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const response = await genai.models.list();
    for await (const model of response) {
      console.log(model.name);
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
