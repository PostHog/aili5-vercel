import type {
  PipelineNodeConfig,
  GenieOutput,
  URLContextItem,
  TextInputConfig,
  GenieConfig,
} from "@/types/pipeline";
import { generateBlockMetadata } from "@/lib/blockParsers";

export interface PromptBuilderOptions {
  additionalPrompt?: string;
  includeGenieConversations?: boolean;
}

/**
 * Format genie conversation as context string
 */
export function formatGenieContext(
  genieName: string,
  backstory: string,
  messages: GenieOutput["messages"]
): string {
  let context = `\n\nGenie Context (name: ${genieName}):\n[Backstory: ${backstory}]\n\nConversation:\n`;
  for (const msg of messages) {
    if (msg.role === "user") {
      context += `User: ${msg.content}\n`;
    } else {
      context += `${genieName}: ${msg.content}\n`;
    }
  }
  return context;
}

/**
 * Gather URL context items from preceding nodes
 */
export function gatherURLContext(
  precedingNodes: PipelineNodeConfig[],
  urlContexts: Record<string, URLContextItem>
): URLContextItem[] {
  return precedingNodes
    .filter((node) => node.type === "url_loader")
    .map((node) => urlContexts[node.id])
    .filter((ctx): ctx is URLContextItem => ctx?.content !== undefined && !ctx.error);
}

/**
 * Gather text input content from preceding nodes
 */
export function gatherTextInputs(
  precedingNodes: PipelineNodeConfig[],
  userInputs: Record<string, string>
): Array<{ label: string; content: string }> {
  return precedingNodes
    .filter((node) => node.type === "text_input")
    .map((node) => {
      const content = userInputs[node.id];
      if (!content?.trim()) return null;
      const config = node.config as TextInputConfig;
      return { label: config.label || "Text", content: content.trim() };
    })
    .filter((item): item is { label: string; content: string } => item !== null);
}

/**
 * Build system prompt from base prompt and preceding nodes
 */
export function buildSystemPrompt(
  basePrompt: string,
  precedingNodes: PipelineNodeConfig[],
  genieConversations: Record<string, GenieOutput>,
  urlContexts: Record<string, URLContextItem>,
  userInputs: Record<string, string>,
  options: PromptBuilderOptions = {}
): string {
  const { additionalPrompt, includeGenieConversations = true } = options;

  let systemPrompt = basePrompt;

  // Add additional prompt if provided
  if (additionalPrompt) {
    if (systemPrompt) {
      systemPrompt += "\n\n";
    }
    systemPrompt += additionalPrompt;
  }

  // Add context from preceding nodes
  if (includeGenieConversations) {
    for (const node of precedingNodes) {
      if (node.type === "genie") {
        const genieConfig = node.config as GenieConfig;
        const conversation = genieConversations[node.id];
        if (conversation && conversation.messages.length > 0) {
          const genieContext = formatGenieContext(
            genieConfig.name,
            genieConfig.backstory,
            conversation.messages
          );
          systemPrompt += genieContext;
        }
      } else {
        // Add block metadata for other node types
        const metadata = generateBlockMetadata(node.type, node.config, node.id);
        if (metadata) {
          systemPrompt += metadata;
        }
      }
    }
  }

  // Append URL context
  const urlItems = gatherURLContext(precedingNodes, urlContexts);
  if (urlItems.length > 0) {
    systemPrompt += "\n\n## Reference Content\n";
    systemPrompt += "The following content has been loaded for context:\n\n";
    for (const item of urlItems) {
      const label = item.label || item.url;
      systemPrompt += `### ${label}\n`;
      systemPrompt += `Source: ${item.url}\n\n`;
      systemPrompt += item.content;
      systemPrompt += "\n\n---\n\n";
    }
  }

  // Append text inputs
  const textItems = gatherTextInputs(precedingNodes, userInputs);
  if (textItems.length > 0) {
    systemPrompt += "\n\n## Additional Context\n";
    systemPrompt += "The following text has been provided for context:\n\n";
    for (const item of textItems) {
      systemPrompt += `### ${item.label}\n`;
      systemPrompt += item.content;
      systemPrompt += "\n\n---\n\n";
    }
  }

  return systemPrompt;
}

/**
 * Build system prompt from preceding nodes up to a specific index
 * This is a convenience wrapper that slices nodes and calls buildSystemPrompt
 */
export function buildSystemPromptFromPrecedingNodes(
  basePrompt: string,
  nodes: PipelineNodeConfig[],
  nodeIndex: number,
  genieConversations: Record<string, GenieOutput>,
  urlContexts: Record<string, URLContextItem>,
  userInputs: Record<string, string>,
  options: PromptBuilderOptions = {}
): string {
  const precedingNodes = nodes.slice(0, nodeIndex);
  return buildSystemPrompt(
    basePrompt,
    precedingNodes,
    genieConversations,
    urlContexts,
    userInputs,
    options
  );
}
