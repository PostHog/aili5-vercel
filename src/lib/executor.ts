import Anthropic from "@anthropic-ai/sdk";
import type { Tool, MessageParam, ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import type {
  Pipeline,
  PipelineNodeConfig,
  PipelineContext,
  PipelineMessage,
  ToolCallResult,
  OutputType,
  OutputDataByType,
  InferenceConfig,
  SystemPromptConfig,
  UserInputConfig,
} from "@/types/pipeline";
import { getToolForNode, parseToolName, isOutputNode } from "./tools";

// ─────────────────────────────────────────────────────────────────
// Pipeline Executor
// ─────────────────────────────────────────────────────────────────

export interface ExecutorConfig {
  posthogApiKey: string;
  posthogProjectId: string;
  posthogApiUrl?: string;
}

/**
 * Execute a pipeline with the given user inputs
 */
export async function executePipeline(
  pipeline: Pipeline,
  userInputs: Record<string, string>,
  config: ExecutorConfig
): Promise<PipelineContext> {
  let context: PipelineContext = {
    messages: [],
    latestOutputs: [],
    urlContext: [],
    metadata: {
      pipelineId: pipeline.id,
      startedAt: Date.now(),
    },
  };

  for (let i = 0; i < pipeline.nodes.length; i++) {
    const node = pipeline.nodes[i];
    context = await processNode(node, context, userInputs, pipeline, i, config);
  }

  return context;
}

/**
 * Process a single node and return updated context
 */
async function processNode(
  node: PipelineNodeConfig,
  context: PipelineContext,
  userInputs: Record<string, string>,
  pipeline: Pipeline,
  nodeIndex: number,
  config: ExecutorConfig
): Promise<PipelineContext> {
  switch (node.type) {
    case "system_prompt":
      return processSystemPrompt(node.config as SystemPromptConfig, context);

    case "user_input":
      return processUserInput(node.config as UserInputConfig, context, userInputs[node.id] ?? "");

    case "inference":
      return processInference(
        node.config as InferenceConfig,
        context,
        pipeline,
        nodeIndex,
        config
      );

    // Output nodes don't modify context - they're rendered by the UI
    case "text_display":
    case "color_display":
    case "icon_display":
    case "gauge_display":
    case "pixel_art_display":
    case "webhook_trigger":
    case "survey":
      return context;

    default:
      console.warn(`Unknown node type: ${node.type}`);
      return context;
  }
}

// ─────────────────────────────────────────────────────────────────
// Node Processors
// ─────────────────────────────────────────────────────────────────

function processSystemPrompt(
  config: SystemPromptConfig,
  context: PipelineContext
): PipelineContext {
  return {
    ...context,
    messages: [
      { role: "system", content: config.prompt },
      ...context.messages.filter((m) => m.role !== "system"), // Replace any existing system message
    ],
  };
}

function processUserInput(
  config: UserInputConfig,
  context: PipelineContext,
  userInput: string
): PipelineContext {
  const content = userInput || config.defaultValue || "";
  if (!content) return context;

  return {
    ...context,
    messages: [
      ...context.messages,
      { role: "user", content },
    ],
  };
}

async function processInference(
  config: InferenceConfig,
  context: PipelineContext,
  pipeline: Pipeline,
  nodeIndex: number,
  executorConfig: ExecutorConfig
): Promise<PipelineContext> {
  // Build messages for the API
  let messages: PipelineMessage[];

  if (config.contextMode === "fresh") {
    // Start fresh - only include the last user message
    const lastUserMessage = [...context.messages].reverse().find((m) => m.role === "user");
    messages = lastUserMessage ? [lastUserMessage] : [];
  } else {
    // Continue - use full conversation history
    messages = [...context.messages];
  }

  // Add optional system prompt override
  if (config.systemPrompt) {
    const existingSystemIndex = messages.findIndex((m) => m.role === "system");
    if (existingSystemIndex >= 0) {
      // Append to existing system prompt
      messages[existingSystemIndex] = {
        ...messages[existingSystemIndex],
        content: `${messages[existingSystemIndex].content}\n\n${config.systemPrompt}`,
      };
    } else {
      // Add new system prompt at start
      messages.unshift({ role: "system", content: config.systemPrompt });
    }
  }

  // Get tools for downstream output nodes
  const tools = getEnabledTools(pipeline, nodeIndex);

  // Call the LLM
  const response = await callLLM(messages, tools, config, executorConfig);

  // Extract tool calls from response
  const toolCalls = extractToolCalls(response.content);

  // Build assistant message
  const assistantMessage: PipelineMessage = {
    role: "assistant",
    content: extractTextContent(response.content),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };

  return {
    ...context,
    messages: [...context.messages, assistantMessage],
    latestOutputs: toolCalls,
  };
}

// ─────────────────────────────────────────────────────────────────
// LLM Integration
// ─────────────────────────────────────────────────────────────────

async function callLLM(
  messages: PipelineMessage[],
  tools: Tool[],
  config: InferenceConfig,
  executorConfig: ExecutorConfig
): Promise<Anthropic.Message> {
  const gatewayUrl = `${executorConfig.posthogApiUrl || "https://us.posthog.com"}/api/projects/${executorConfig.posthogProjectId}/llm_gateway`;

  const client = new Anthropic({
    baseURL: gatewayUrl,
    apiKey: executorConfig.posthogApiKey,
    defaultHeaders: {
      Authorization: `Bearer ${executorConfig.posthogApiKey}`,
    },
  });

  // Convert messages to Anthropic format
  const systemMessage = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const apiMessages: MessageParam[] = nonSystemMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens ?? 1024,
    temperature: config.temperature,
    system: systemMessage?.content,
    messages: apiMessages,
    tools: tools.length > 0 ? tools : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────
// Tool Resolution
// ─────────────────────────────────────────────────────────────────

/**
 * Get tools enabled by downstream output nodes
 * Stops at the next inference node (it has its own tools)
 */
function getEnabledTools(pipeline: Pipeline, currentNodeIndex: number): Tool[] {
  const tools: Tool[] = [];

  for (let i = currentNodeIndex + 1; i < pipeline.nodes.length; i++) {
    const node = pipeline.nodes[i];

    // Stop at next inference node
    if (node.type === "inference") {
      break;
    }

    // Add tool for output nodes
    if (isOutputNode(node.type)) {
      const tool = getToolForNode(node);
      if (tool) {
        tools.push(tool);
      }
    }
  }

  return tools;
}

// ─────────────────────────────────────────────────────────────────
// Response Parsing
// ─────────────────────────────────────────────────────────────────

function extractToolCalls(content: ContentBlock[]): ToolCallResult[] {
  const results: ToolCallResult[] = [];

  for (const block of content) {
    if (block.type === "tool_use") {
      const parsed = parseToolName(block.name);
      if (parsed) {
        results.push({
          type: parsed.outputType,
          toolName: block.name,
          data: block.input as OutputDataByType[typeof parsed.outputType],
          explanation: (block.input as Record<string, unknown>).explanation as string | undefined,
        });
      }
    }
  }

  return results;
}

function extractTextContent(content: ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

// ─────────────────────────────────────────────────────────────────
// Utility: Create initial context
// ─────────────────────────────────────────────────────────────────

export function createInitialContext(pipelineId: string): PipelineContext {
  return {
    messages: [],
    latestOutputs: [],
    urlContext: [],
    metadata: {
      pipelineId,
      startedAt: Date.now(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Utility: Get output for a specific node type
// ─────────────────────────────────────────────────────────────────

export function getOutputForNodeType<T>(
  context: PipelineContext,
  outputType: OutputType
): T | null {
  const result = context.latestOutputs.find((o) => o.type === outputType);
  return result ? (result.data as T) : null;
}
