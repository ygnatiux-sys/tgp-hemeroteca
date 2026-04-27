import 'dotenv/config';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    const imageModels = data.models.filter(m => m.name.toLowerCase().includes('image') || m.name.toLowerCase().includes('imagen'));
    console.log(JSON.stringify(imageModels, null, 2));
  } catch (err) {
    console.error(err);
  }
}

listModels();
