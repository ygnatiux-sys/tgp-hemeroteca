import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testImageGen() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ role: 'user', parts: [{ text: 'Generate a high quality 16:9 cinematic image of a sunset over Mars.' }] }]
    });
    
    console.log('Response type:', typeof response);
    console.log('Response keys:', Object.keys(response));
    
    // Check if there are candidates with parts that are images
    if (response.candidates) {
      for (const candidate of response.candidates) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            console.log('Found inlineData with mimeType:', part.inlineData.mimeType);
            console.log('Base64 sample:', part.inlineData.data.substring(0, 50));
          } else if (part.fileData) {
            console.log('Found fileData:', part.fileData);
          } else {
            console.log('Found part text:', part.text);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error with generateContent:', err.message);
  }
}

testImageGen();
