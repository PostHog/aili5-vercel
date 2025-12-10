import type {
  PipelineNodeConfig,
  GenieOutput,
  URLContextItem,
} from "@/types/pipeline";
import type { NodeRuntimeState } from "@/lib/nodeInterface";
import type { OutputData } from "@/store/pipelineStore";
import { gatherPrecedingContext } from "@/lib/blockParsers";

export interface PromptBuilderOptions {
  additionalPrompt?: string;
}

/**
 * All state needed to build context for nodes
 */
export interface PipelineContext {
  nodes: PipelineNodeConfig[]; // outputs are now nested in nodes
  genieConversations: Record<string, GenieOutput>;
  urlContexts: Record<string, URLContextItem>;
  userInputs: Record<string, string>;
}

/**
 * Create a node state accessor from pipeline context
 * This returns the runtime state for any node
 */
export function createNodeStateAccessor(context: PipelineContext): (nodeId: string) => NodeRuntimeState {
  return (nodeId: string): NodeRuntimeState => {
    const node = context.nodes.find((n) => n.id === nodeId);
    return {
      output: node?.output ?? undefined,
      conversation: context.genieConversations[nodeId] ?? undefined,
      urlContext: context.urlContexts[nodeId] ?? undefined,
      userInput: context.userInputs[nodeId] ?? undefined,
    };
  };
}

/**
 * Build system prompt from base prompt and preceding nodes
 * Uses the unified context system - each node type defines its own context contribution
 * 
 * @param basePrompt - The base system prompt
 * @param precedingNodes - Nodes before the target inference/genie node
 * @param context - Pipeline context containing all node states
 * @param options - Additional options like extra prompts
 */
export function buildSystemPrompt(
  basePrompt: string,
  precedingNodes: PipelineNodeConfig[],
  context: PipelineContext,
  options: PromptBuilderOptions = {}
): string {
  const { additionalPrompt } = options;

  let systemPrompt = basePrompt;

  // Add additional prompt if provided (e.g., genie identity prompt)
  if (additionalPrompt) {
    if (systemPrompt) {
      systemPrompt += "\n\n";
    }
    systemPrompt += additionalPrompt;
  }

  // Gather context from all preceding nodes using the unified system
  const nodeStateAccessor = createNodeStateAccessor(context);
  const precedingContext = gatherPrecedingContext(precedingNodes, nodeStateAccessor);
  
  if (precedingContext) {
    systemPrompt += precedingContext;
  }

  return systemPrompt;
}

/**
 * Build system prompt from nodes up to a specific index
 * Convenience wrapper for common use case
 */
export function buildSystemPromptFromPrecedingNodes(
  basePrompt: string,
  nodes: PipelineNodeConfig[],
  nodeIndex: number,
  context: PipelineContext,
  options: PromptBuilderOptions = {}
): string {
  const precedingNodes = nodes.slice(0, nodeIndex);
  return buildSystemPrompt(basePrompt, precedingNodes, context, options);
}
