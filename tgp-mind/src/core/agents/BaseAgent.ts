import { GoogleGenAI, Type } from '@google/genai';
import type { AgentResponse, TgpTool, AgentStatus } from './types.js';

export abstract class BaseAgent {
  protected ai: GoogleGenAI;
  protected tools: TgpTool[] = [];
  protected modelName: string = 'gemini-3.8-flash';  // Default: Flash rápido y analítico
  protected temperature: number = 0.7;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Se requiere GEMINI_API_KEY para instanciar el Agente.');
    this.ai = new GoogleGenAI({ apiKey });
  }

  public registerTool(tool: TgpTool) {
    this.tools.push(tool);
  }

  protected getFunctionDeclarations() {
    return this.tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
  }

  /**
   * Método principal para ejecutar el agente.
   * Si el modelo solicita usar un tool, devuelve REQUIRES_ACTION.
   */
  public async execute(userMessage: string, systemInstruction: string, history: any[] = []): Promise<AgentResponse> {
    try {
      const functionDeclarations = this.getFunctionDeclarations();
      
      const config: any = {
        temperature: this.temperature,
        systemInstruction,
      };

      if (functionDeclarations.length > 0) {
        config.tools = [{ functionDeclarations }];
      }

      // Convertir history al formato esperado por el SDK y agregar el nuevo mensaje
      const contents = [
        ...history,
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents,
        config
      });

      // Revisar si el modelo pidió llamar a una función (Function Calling)
      const functionCall = response.functionCalls?.[0];
      if (functionCall) {
        return {
          status: 'REQUIRES_ACTION',
          toolCall: {
            name: functionCall.name ?? '',
            args: (functionCall.args ?? {}) as Record<string, any>,
          }
        };
      }

      // Si no hay tool call, es una respuesta normal de texto
      const content = response.text?.trim() || '';
      return {
        status: 'COMPLETED',
        content
      };
    } catch (err: any) {
      console.error(`[BaseAgent] Error:`, err);
      return {
        status: 'ERROR',
        error: err.message
      };
    }
  }

  /**
   * Continúa la ejecución luego de que el humano (HITL) aprobó y resolvió un Tool.
   */
  public async resume(toolName: string, toolResult: any, userMessage: string, systemInstruction: string, history: any[]): Promise<AgentResponse> {
    // Agregamos la respuesta de la función al historial
    const updatedHistory = [
      ...history,
      {
        role: 'user', // En el SDK de Gemini, la respuesta de la función suele ir como 'user' part o en un formato específico.
        parts: [
          {
            functionResponse: {
              name: toolName,
              response: { result: toolResult }
            }
          }
        ]
      }
    ];

    // Volvemos a ejecutar con el historial actualizado
    return this.execute(userMessage, systemInstruction, updatedHistory);
  }
}

