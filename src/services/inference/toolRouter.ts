import type { TextOutput, IconOutput, ColorOutput, GaugeOutput } from "@/types/pipeline";

// Output types union
export type OutputData = TextOutput | IconOutput | ColorOutput | GaugeOutput | null;

interface ToolCall {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

/**
 * Routes tool calls from inference response to their target output nodes
 */
export function routeToolCalls(
  toolCalls: ToolCall[],
  nodeIdByToolName: Record<string, string>
): Record<string, OutputData> {
  const outputs: Record<string, OutputData> = {};

  for (const toolCall of toolCalls) {
    const targetNodeId = nodeIdByToolName[toolCall.toolName];
    if (targetNodeId) {
      outputs[targetNodeId] = toolCall.input as unknown as OutputData;
    }
  }

  return outputs;
}
