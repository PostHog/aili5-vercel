import type { NodeInterface, InferenceResponse, NodeRuntimeState } from "@/lib/nodeInterface";
import type { PipelineNodeConfig, TextInputConfig, URLLoaderConfig, PaintConfig, GenieConfig, GenieOutput, URLContextItem, TextOutput } from "@/types/pipeline";
import { IconDisplayNodeInterface } from "@/components/builder/nodes/IconDisplayNodeEditor";
import { ColorDisplayNodeInterface } from "@/components/builder/nodes/ColorDisplayNodeEditor";
import { EmojiDisplayNodeInterface } from "@/components/builder/nodes/EmojiDisplayNodeEditor";
import { PixelArtDisplayNodeInterface } from "@/components/builder/nodes/PixelArtDisplayNodeEditor";
import { PaintNodeInterface } from "@/components/builder/nodes/PaintNodeEditor";
import { GenieNodeInterface } from "@/components/builder/nodes/GenieNodeEditor";

/**
 * Built-in node interfaces for core node types
 * These provide context() methods for nodes that don't have visual editors
 */

// Text Input node - provides user input as context
const TextInputNodeInterface: NodeInterface<TextInputConfig, never> = {
  meta: () => "",
  parse: () => undefined,
  context: (config, _blockId, state) => {
    if (!state.userInput?.trim()) return null;
    return `\n\n### ${config.label || "Text Input"}\n${state.userInput.trim()}`;
  },
};

// URL Loader node - provides fetched content as context
const URLLoaderNodeInterface: NodeInterface<URLLoaderConfig, never> = {
  meta: () => "",
  parse: () => undefined,
  context: (config, _blockId, state) => {
    const ctx = state.urlContext as URLContextItem | undefined;
    if (!ctx?.content || ctx.error) return null;
    const label = config.label || ctx.url || "URL Content";
    return `\n\n### ${label}\nSource: ${ctx.url}\n\n${ctx.content}`;
  },
};

// Inference node - provides its output as context
const InferenceNodeInterface: NodeInterface<unknown, never> = {
  meta: () => "",
  parse: () => undefined,
  context: (_config, _blockId, state) => {
    const output = state.output as TextOutput | undefined;
    if (!output?.content?.trim()) return null;
    return `\n\n### Previous Response\n${output.content.trim()}`;
  },
};

/**
 * Registry of node interfaces by block type
 * Each node type implements NodeInterface with meta, parse, and optionally context methods
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeInterfaces: Record<string, NodeInterface<any, any>> = {
  text_input: TextInputNodeInterface,
  url_loader: URLLoaderNodeInterface,
  paint: PaintNodeInterface,
  inference: InferenceNodeInterface,
  icon_display: IconDisplayNodeInterface,
  color_display: ColorDisplayNodeInterface,
  emoji_display: EmojiDisplayNodeInterface,
  pixel_art_display: PixelArtDisplayNodeInterface,
  genie: GenieNodeInterface,
};

/**
 * Generate block metadata for a specific node type
 * This is added to the system prompt to inform the LLM about available outputs
 */
export function generateBlockMetadata<TConfig = unknown>(
  blockType: string,
  config: TConfig,
  blockId: string
): string {
  const nodeInterface = nodeInterfaces[blockType];
  if (!nodeInterface) {
    return "";
  }
  return nodeInterface.meta(config as unknown, blockId);
}

/**
 * Parse output for a specific block type from inference response
 */
export function parseBlockOutput<T = unknown>(
  blockType: string,
  response: InferenceResponse,
  blockId: string
): T | undefined {
  const nodeInterface = nodeInterfaces[blockType];
  if (!nodeInterface) {
    return undefined;
  }
  return nodeInterface.parse(response, blockId) as T | undefined;
}

/**
 * Get all registered block types
 */
export function getRegisteredBlockTypes(): string[] {
  return Object.keys(nodeInterfaces);
}

/**
 * Check if a block type has a registered interface
 */
export function hasNodeInterface(blockType: string): boolean {
  return blockType in nodeInterfaces;
}

/**
 * Generate context string for a specific node
 * This returns what the node contributes to downstream nodes' context
 */
export function generateNodeContext(
  blockType: string,
  config: unknown,
  blockId: string,
  state: NodeRuntimeState
): string {
  const nodeInterface = nodeInterfaces[blockType];
  if (!nodeInterface?.context) {
    return "";
  }
  return nodeInterface.context(config, blockId, state) || "";
}

/**
 * State accessor function type - used to get runtime state for a node
 */
export type NodeStateAccessor = (nodeId: string) => NodeRuntimeState;

/**
 * Gather all context from preceding nodes
 * This is the unified context builder that any node can use
 * @param precedingNodes - Nodes before the target node
 * @param getNodeState - Function to get runtime state for each node
 * @returns Combined context string from all preceding nodes
 */
export function gatherPrecedingContext(
  precedingNodes: PipelineNodeConfig[],
  getNodeState: NodeStateAccessor
): string {
  let context = "";

  for (const node of precedingNodes) {
    const state = getNodeState(node.id);
    
    // Get metadata (tool descriptions, etc.)
    const metadata = generateBlockMetadata(node.type, node.config, node.id);
    if (metadata) {
      context += metadata;
    }

    // Get context (actual content/output from the node)
    const nodeContext = generateNodeContext(node.type, node.config, node.id, state);
    if (nodeContext) {
      context += nodeContext;
    }
  }

  return context;
}
