export interface InferenceParams {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
  tools?: unknown[];
}

export interface InferenceResult {
  response?: string;
  toolCalls?: Array<{ toolName: string; toolId: string; input: Record<string, unknown> }>;
  error?: string;
}

/**
 * Calls the /api/inference endpoint
 */
export async function runInference(params: InferenceParams): Promise<InferenceResult> {
  const response = await fetch("/api/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      model: params.model,
      temperature: params.temperature,
      tools: params.tools,
    }),
  });

  return response.json();
}
