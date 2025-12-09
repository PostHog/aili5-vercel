/**
 * Self-Inferencing Node Types
 *
 * A self-inferencing node is any node that:
 * 1. Has its own conversation state (messages history)
 * 2. Can trigger inference independently of the main pipeline
 * 3. Builds its own context from preceding nodes
 * 4. May update its own config based on external inference results
 *
 * Examples: Genie, Critic, Planner, Researcher
 */

export interface SelfInferencingNodeConfig {
  /** Identity name for the node */
  name: string;
  /** System prompt / backstory for the node */
  systemPrompt: string;
  /** Model to use for inference */
  model: string;
  /** Temperature setting */
  temperature: number;
  /** Whether to auto-respond when config is updated externally */
  autoRespondOnUpdate?: boolean;
  /** Whether to include other self-inferencing node conversations */
  includeOtherConversations?: boolean;
}

export interface ConversationState {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface SelfInferencingNodeBehavior {
  /**
   * Build the identity prompt for this node type
   */
  buildIdentityPrompt: (
    config: SelfInferencingNodeConfig,
    conversation: ConversationState
  ) => string;

  /**
   * Format this node's context for inclusion in other nodes' prompts
   */
  formatContextForOthers: (
    config: SelfInferencingNodeConfig,
    conversation: ConversationState
  ) => string;

  /**
   * Handle external updates to this node (e.g., backstory changes from main inference)
   * Returns partial config to merge with existing config
   */
  onExternalUpdate?: (
    config: SelfInferencingNodeConfig,
    update: unknown
  ) => Partial<SelfInferencingNodeConfig>;

  /**
   * Get the initial prompt to trigger when the node is first saved/initialized
   */
  getInitializationPrompt?: (config: SelfInferencingNodeConfig) => string;
}
