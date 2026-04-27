import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Hola');
    const response = await result.response;
    console.log('Success with @google/generative-ai:', response.text());
  } catch (err) {
    console.error('Error with @google/generative-ai:', err.message);
  }
}

testModel();
