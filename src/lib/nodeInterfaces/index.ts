import type { NodeType } from "@/types/pipeline";
import type { SelfInferencingNodeBehavior } from "./types";
import { genieBehavior } from "./genieBehavior";

/**
 * Registry of all self-inferencing node behaviors
 *
 * To add a new self-inferencing node type:
 * 1. Create a new behavior file (e.g., criticBehavior.ts)
 * 2. Import and add it to this registry
 */
export const selfInferencingBehaviors: Partial<Record<NodeType, SelfInferencingNodeBehavior>> = {
  genie: genieBehavior,
  // Future self-inferencing nodes:
  // critic: criticBehavior,
  // planner: plannerBehavior,
  // researcher: researcherBehavior,
};

/**
 * Check if a node type is a self-inferencing node
 */
export function isSelfInferencingNodeType(type: NodeType): boolean {
  return type in selfInferencingBehaviors;
}

/**
 * Get the behavior for a self-inferencing node type
 */
export function getSelfInferencingBehavior(
  type: NodeType
): SelfInferencingNodeBehavior | undefined {
  return selfInferencingBehaviors[type];
}

// Re-export types and behaviors
export { genieBehavior } from "./genieBehavior";
export type {
  SelfInferencingNodeConfig,
  ConversationState,
  SelfInferencingNodeBehavior,
} from "./types";
