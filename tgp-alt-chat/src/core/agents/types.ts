export type AgentStatus = 'COMPLETED' | 'REQUIRES_ACTION' | 'ERROR';

export interface ToolCall {
  name: string;
  args: Record<string, any>;
  id?: string;
}

export interface AgentResponse {
  status: AgentStatus;
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

export interface TgpTool {
  name: string;
  description: string;
  parameters: any; // JSON Schema for Gemini Function Declaration
  execute: (args: Record<string, any>) => Promise<any>;
}
