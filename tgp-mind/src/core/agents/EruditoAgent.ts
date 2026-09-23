import { BaseAgent } from './BaseAgent.js';
import { wikimediaTool } from '../tools/wikimediaTool.js';
import { nanoBananaTool } from '../tools/nanoBananaTool.js';
import {
  ERUDITO_DIVULGATIVO_PROMPT,
  AGENTE_ERUDITO_ACADEMICO_PROMPT,
} from '../../config/geminiPrompts.js';

export class EruditoAgent extends BaseAgent {
  constructor(apiKey: string) {
    super(apiKey);
    
    // Inyectamos las herramientas que puede "pedir prestadas"
    this.registerTool(wikimediaTool);
    this.registerTool(nanoBananaTool);
  }

  /**
   * Genera un ensayo erudito y puede requerir HITL si pide imágenes.
   */
  public async generateEssay(tema: string, textoActual: string = '', modo: 'divulgativo' | 'academico' = 'divulgativo', history: any[] = []) {
    let systemInstruction = '';
    let userMessage = '';

    if (modo === 'academico') {
      this.temperature = 0.20;
      systemInstruction = AGENTE_ERUDITO_ACADEMICO_PROMPT;
      userMessage = `Formatea el siguiente texto con estándar tipográfico impecable para TGP Hemeroteca. Corrige la redacción si detectas prosa mecánica o genérica. Devuelve únicamente el Markdown final:\n\n${textoActual}`;
    } else {
      this.temperature = 0.62;
      systemInstruction = ERUDITO_DIVULGATIVO_PROMPT;
      
      const temaLimpio = tema.trim()
        ? `"${tema}"`
        : (textoActual.trim() ? `el tema central de este texto:\n\n${textoActual.slice(0, 600)}` : 'el arquetipo o tema detectado en el contexto actual');
        
      userMessage = `Redacta un ensayo magistral de historia cultural y pensamiento simbólico sobre ${temaLimpio}. 
Si el texto carece de portadas o imágenes geográficas/históricas, ERES LIBRE de pedir una búsqueda en Wikimedia o generar una portada fotográfica si consideras que añadirá valor visual al ensayo.
Aplica todas las reglas de estructura, tono divulgativo-erudito y formato Markdown estricto definidas en tu identidad. El ensayo debe tener entre 900 y 2.000 palabras.`;
    }

    return this.execute(userMessage, systemInstruction, history);
  }
}

