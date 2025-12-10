export interface ImageData {
  type: "base64";
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string; // base64 encoded image data without the data URL prefix
}

export interface InferenceParams {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
  tools?: unknown[];
  toolChoice?: "auto" | "any" | { type: "tool"; name: string };
  images?: ImageData[];
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
      toolChoice: params.toolChoice,
      images: params.images,
    }),
  });

  return response.json();
}

export interface StreamingInferenceParams {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
}

/**
 * Calls the /api/inference/stream endpoint with real-time streaming
 * @param params - Inference parameters
 * @param onChunk - Callback fired for each text chunk received
 * @param onDone - Callback fired when streaming completes
 * @param onError - Callback fired on error
 */
export async function runStreamingInference(
  params: StreamingInferenceParams,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch("/api/inference/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
        model: params.model,
        temperature: params.temperature,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      onError?.(errorData.error || "Request failed");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.("No response body");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              onChunk(data.text);
            } else if (data.done) {
              onDone();
              return;
            } else if (data.error) {
              onError?.(data.error);
              return;
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    onDone();
  } catch (error) {
    onError?.(error instanceof Error ? error.message : "Unknown error");
  }
}
