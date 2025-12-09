import type { NodeInterface, InferenceResponse } from "@/lib/nodeInterface";
import { IconDisplayNodeInterface } from "@/components/builder/nodes/IconDisplayNodeEditor";
import { ColorDisplayNodeInterface } from "@/components/builder/nodes/ColorDisplayNodeEditor";

/**
 * Registry of node interfaces by block type
 * Each node type implements NodeInterface with meta and parse methods
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeInterfaces: Record<string, NodeInterface<any, any>> = {
  icon_display: IconDisplayNodeInterface,
  color_display: ColorDisplayNodeInterface,
  // Add more node interfaces here as needed:
  // gauge_display: GaugeDisplayNodeInterface,
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
