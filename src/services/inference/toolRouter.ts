import type { TextOutput, IconOutput, ColorOutput, GaugeOutput, EmojiOutput, PixelArtOutput } from "@/types/pipeline";
import type { PipelineNodeConfig } from "@/types/pipeline";
import type { InferenceResponse } from "@/lib/nodeInterface";
import { parseBlockOutput } from "@/lib/blockParsers";

// Output types union
export type OutputData = TextOutput | IconOutput | ColorOutput | GaugeOutput | EmojiOutput | PixelArtOutput | null;

interface ToolCall {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

/**
 * Routes tool calls from inference response to their target output nodes
 * Uses each node's parse method to properly format the output sequentially
 */
export function routeToolCalls(
  toolCalls: ToolCall[],
  nodeIdByToolName: Record<string, string>,
  nodes: PipelineNodeConfig[],
  inferenceResponse: InferenceResponse
): Record<string, OutputData> {
  const outputs: Record<string, OutputData> = {};

  for (const toolCall of toolCalls) {
    const targetNodeId = nodeIdByToolName[toolCall.toolName];
    if (!targetNodeId) continue;

    // Find the target node to get its type
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) continue;

    // Use the node's parse method to properly format the output
    // This ensures outputs are processed sequentially and correctly formatted
    const parsedOutput = parseBlockOutput(targetNode.type, inferenceResponse, targetNodeId);
    if (parsedOutput) {
      outputs[targetNodeId] = parsedOutput as OutputData;
    }
  }

  return outputs;
}
