/**
 * State available for a node when generating context
 * This is passed to the context() method so nodes can access their runtime state
 */
export interface NodeRuntimeState {
  output?: unknown;           // The node's output (e.g., TextOutput for inference, IconOutput for icon_display)
  conversation?: unknown;     // For genie nodes - their conversation history
  urlContext?: unknown;       // For URL loader nodes - fetched content
  userInput?: string;         // For text input nodes - user's input
}

/**
 * Base interface for all pipeline nodes
 * Each node type implements this interface to provide:
 * - meta: Generates block metadata string to add to system prompt (describes capabilities/tools)
 * - parse: Parses inference response to extract node-specific output
 * - context: (optional) Generates context string from this node's state for downstream nodes
 */
export interface NodeInterface<TConfig, TOutput> {
  /**
   * Generate block metadata string to append to system prompt
   * This describes the node's capabilities/tools to the LLM
   * @param config - Node configuration
   * @param blockId - Generated block ID (e.g., "icon-1")
   * @returns Metadata string to add to system prompt, or empty string if none
   */
  meta: (config: TConfig, blockId: string) => string;

  /**
   * Parse inference response to extract node-specific output
   * @param response - Full inference response including text and tool calls
   * @param blockId - Block ID for this node
   * @returns Parsed output data, or undefined if not found
   */
  parse: (response: InferenceResponse, blockId: string) => TOutput | undefined;

  /**
   * Generate context string that this node contributes to downstream nodes
   * This is called for each preceding node when building context for inference
   * @param config - Node configuration
   * @param blockId - Block ID for this node
   * @param state - Runtime state of the node (output, conversation, etc.)
   * @returns Context string to include, or null/empty if none
   */
  context?: (config: TConfig, blockId: string, state: NodeRuntimeState) => string | null;
}

/**
 * Tool call result from inference
 */
export interface ToolCall {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

/**
 * Inference response structure
 */
export interface InferenceResponse {
  response: string;
  toolCalls: ToolCall[];
  error?: string;
}
