// Simple test for parseLLMText utility (JS version to avoid ts-node)
import { parseLLMText } from '../src/lib/parseLLMText.js';

const sample = `## Título de ejemplo
Este es un párrafo con una **palabraClave** y una "cita importante".
Otro párrafo sin formato.`;

const result = parseLLMText(sample);
console.log('---- Parsed HTML ----');
console.log(result);
