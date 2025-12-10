export interface InferenceRequest {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
}

export interface InferenceResponse {
  response: string;
  error?: string;
}

export interface PipelineState {
  systemPrompt: string;
  model: string;
  temperature: number;
  userMessage: string;
  response: string;
  loading: boolean;
  error: string | null;
}

export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "claude-haiku-3-20240307", name: "Claude Haiku 3" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];
