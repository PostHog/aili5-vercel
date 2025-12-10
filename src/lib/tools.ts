import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import type {
  NodeType,
  OutputType,
  PipelineNodeConfig,
  ColorDisplayConfig,
  IconDisplayConfig,
  EmojiDisplayConfig,
  GaugeDisplayConfig,
  PixelArtDisplayConfig,
  WebhookTriggerConfig,
  SurveyConfig,
  GenieConfig,
} from "@/types/pipeline";
import { ICON_IDS } from "@/types/pipeline";

// ─────────────────────────────────────────────────────────────────
// Tool Name Validation
// ─────────────────────────────────────────────────────────────────

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const toolNameSchema = z.string().regex(TOOL_NAME_PATTERN, {
  message: "Tool name must match pattern: ^[a-zA-Z0-9_-]{1,128}$",
});

/**
 * Sanitize a custom name to ensure it's valid for tool names
 * Pattern: ^[a-zA-Z0-9_-]{1,128}$
 */
function sanitizeCustomName(name: string): string {
  // Replace invalid characters with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  // Remove consecutive underscores
  sanitized = sanitized.replace(/_+/g, "_");
  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, "");
  // Ensure it's not empty (use "custom" as fallback)
  if (!sanitized) sanitized = "custom";
  // Truncate to 128 characters
  if (sanitized.length > 128) sanitized = sanitized.substring(0, 128);
  return sanitized;
}

/**
 * Validate and sanitize a tool name
 */
function validateAndSanitizeToolName(toolName: string): string {
  // First try to validate as-is
  const result = toolNameSchema.safeParse(toolName);
  if (result.success) {
    return toolName;
  }

  // If invalid, sanitize
  let sanitized = toolName.replace(/[^a-zA-Z0-9_-]/g, "_");
  sanitized = sanitized.replace(/_+/g, "_");
  sanitized = sanitized.replace(/^_+|_+$/g, "");
  
  // Ensure it's not empty
  if (!sanitized) sanitized = "tool";
  
  // Truncate to 128 characters
  if (sanitized.length > 128) {
    sanitized = sanitized.substring(0, 128);
  }

  // Validate again after sanitization
  const finalResult = toolNameSchema.safeParse(sanitized);
  if (!finalResult.success) {
    // Fallback to a safe default
    return "tool";
  }

  return sanitized;
}

// ─────────────────────────────────────────────────────────────────
// Tool Schema Templates (without names - names are generated dynamically)
// ─────────────────────────────────────────────────────────────────

interface ToolTemplate {
  baseToolName: string;
  description: string;
  input_schema: Tool["input_schema"];
}

// Tool templates for output types that use tool calling (excludes "text" which uses plain response)
const TOOL_TEMPLATES: Partial<Record<OutputType, ToolTemplate>> = {
  color: {
    baseToolName: "display_color",
    description: "Display a color to the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        hex: {
          type: "string",
          pattern: "^#[0-9a-fA-F]{6}$",
          description: "Hex color code, e.g. #ff5500",
        },
        name: {
          type: "string",
          description: "Human-readable color name",
        },
        explanation: {
          type: "string",
          description: "Why you chose this color",
        },
      },
      required: ["hex"],
    },
  },

  icon: {
    baseToolName: "display_icon",
    description: "Display an icon to represent a concept, status, or emotion.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          enum: ICON_IDS as unknown as string[],
          description: "Icon identifier. Available: " + ICON_IDS.join(", "),
        },
        label: {
          type: "string",
          description: "Label to show with the icon",
        },
        explanation: {
          type: "string",
          description: "Why you chose this icon",
        },
      },
      required: ["id"],
    },
  },

  emoji: {
    baseToolName: "display_emoji",
    description: "Display an emoji to represent a concept, emotion, or status.",
    input_schema: {
      type: "object" as const,
      properties: {
        emoji: {
          type: "string",
          description: "A single emoji character",
        },
        explanation: {
          type: "string",
          description: "Why you chose this emoji",
        },
      },
      required: ["emoji"],
    },
  },

  gauge: {
    baseToolName: "display_gauge",
    description: "Display a numeric value on a gauge or meter.",
    input_schema: {
      type: "object" as const,
      properties: {
        value: {
          type: "number",
          description: "The numeric value to display",
        },
        min: {
          type: "number",
          description: "Minimum value (default: 0)",
        },
        max: {
          type: "number",
          description: "Maximum value (default: 100)",
        },
        unit: {
          type: "string",
          description: "Unit label, e.g. '%', '°F', 'points'",
        },
        label: {
          type: "string",
          description: "What this value represents",
        },
        explanation: {
          type: "string",
          description: "Why you chose this value",
        },
      },
      required: ["value"],
    },
  },

  pixel_art: {
    baseToolName: "generate_pixel_art",
    description: "Generate pixel art on a grid using color codes.",
    input_schema: {
      type: "object" as const,
      properties: {
        colors: {
          type: "object",
          description: "Color map: keys are single-character codes, values are hex colors or 'transparent'",
        },
        grid: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of strings, each string is a row. Characters map to colors object",
        },
        explanation: {
          type: "string",
          description: "Description of what you drew",
        },
      },
      required: ["colors", "grid"],
    },
  },

  webhook: {
    baseToolName: "trigger_webhook",
    description: "Make an HTTP request to a URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          format: "uri",
          description: "The URL to request",
        },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "DELETE"],
          description: "HTTP method",
        },
        headers: {
          type: "object",
          description: "HTTP headers to include",
        },
        body: {
          type: "object",
          description: "Request body (for POST/PUT)",
        },
        explanation: {
          type: "string",
          description: "Why you're making this request",
        },
      },
      required: ["url", "method"],
    },
  },

  survey: {
    baseToolName: "ask_survey",
    description: "Present a multiple choice question to the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "The question to ask",
        },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
            },
            required: ["id", "label"],
          },
          description: "Available choices (2-6 options)",
        },
        allowMultiple: {
          type: "boolean",
          description: "Allow selecting multiple options",
        },
        explanation: {
          type: "string",
          description: "Context for why you're asking this",
        },
      },
      required: ["question", "options"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────
// Mapping Utilities
// ─────────────────────────────────────────────────────────────────

const NODE_TYPE_TO_OUTPUT_TYPE: Partial<Record<NodeType, OutputType>> = {
  color_display: "color",
  icon_display: "icon",
  emoji_display: "emoji",
  gauge_display: "gauge",
  pixel_art_display: "pixel_art",
  webhook_trigger: "webhook",
  survey: "survey",
};

/**
 * Get the custom name from a node's config, if present
 */
function getCustomName(node: PipelineNodeConfig): string | undefined {
  const config = node.config as
    | ColorDisplayConfig
    | IconDisplayConfig
    | EmojiDisplayConfig
    | GaugeDisplayConfig
    | PixelArtDisplayConfig
    | WebhookTriggerConfig
    | SurveyConfig;
  return config?.name;
}

/**
 * Generate a tool for sending messages to a genie node
 */
export function getGenieTool(node: PipelineNodeConfig): Tool | null {
  if (node.type !== "genie") return null;

  const genieConfig = node.config as GenieConfig;
  const genieName = genieConfig.name || "genie";
  
  // Sanitize genie name
  const sanitizedGenieName = sanitizeCustomName(genieName);
  
  // Generate tool name: send_message_to_genie or send_message_to_{genie_name}
  const toolName = sanitizedGenieName === "genie" 
    ? "send_message_to_genie"
    : `send_message_to_${sanitizedGenieName}`;

  // Validate and sanitize the final tool name
  const validatedToolName = validateAndSanitizeToolName(toolName);

  return {
    name: validatedToolName,
    description: `Send a message to the genie "${genieName}". The genie will receive this message and respond to it.`,
    input_schema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: `The message to send to ${genieName}. This will be added to the genie's conversation with role "system".`,
        },
      },
      required: ["message"],
    },
  };
}

/**
 * Generate a tool name from base name and optional custom name
 * e.g., "display_icon" + "weather" → "display_weather_icon"
 * Validates and sanitizes the final tool name to match pattern: ^[a-zA-Z0-9_-]{1,128}$
 */
function generateToolName(baseToolName: string, customName?: string): string {
  // Validate base tool name first
  const validatedBase = validateAndSanitizeToolName(baseToolName);
  
  if (!customName) {
    return validatedBase;
  }

  // Sanitize custom name first
  const sanitizedCustomName = sanitizeCustomName(customName);

  // Insert custom name: "display_icon" → "display_weather_icon"
  const parts = validatedBase.split("_");
  let toolName: string;
  if (parts.length >= 2) {
    // Insert after first part: display_[custom]_icon
    toolName = `${parts[0]}_${sanitizedCustomName}_${parts.slice(1).join("_")}`;
  } else {
    toolName = `${validatedBase}_${sanitizedCustomName}`;
  }

  // Validate and sanitize the final tool name
  return validateAndSanitizeToolName(toolName);
}

/**
 * Generate a tool definition for a specific output node
 * The tool name is customized based on the node's config.name
 */
export function getToolForNode(node: PipelineNodeConfig): Tool | null {
  const outputType = NODE_TYPE_TO_OUTPUT_TYPE[node.type];
  if (!outputType) return null;

  const template = TOOL_TEMPLATES[outputType];
  if (!template) return null;

  const customName = getCustomName(node);
  const toolName = generateToolName(template.baseToolName, customName);

  // Enhance description with custom name context
  let description = template.description;
  if (customName) {
    description = `${description} Use this for "${customName}" output.`;
  }

  return {
    name: toolName,
    description,
    input_schema: template.input_schema,
  };
}

/**
 * Parse a tool name to extract the output type and custom name
 * e.g., "display_weather_icon" → { outputType: "icon", customName: "weather" }
 * Also handles genie message tools: "send_message_to_genie" or "send_message_to_{name}"
 */
export function parseToolName(toolName: string): { outputType: OutputType; customName?: string } | null {
  // Check if it's a genie message tool
  if (toolName === "send_message_to_genie" || toolName.startsWith("send_message_to_")) {
    // For genie tools, we don't return an output type since they're handled separately
    // This function is used for output nodes, so we return null for genie tools
    return null;
  }

  // Try each template to find a match
  for (const [outputType, template] of Object.entries(TOOL_TEMPLATES)) {
    const baseName = template.baseToolName;

    // Exact match (no custom name)
    if (toolName === baseName) {
      return { outputType: outputType as OutputType };
    }

    // Check for custom name pattern
    const parts = baseName.split("_");
    if (parts.length >= 2) {
      const prefix = parts[0] + "_";
      const suffix = "_" + parts.slice(1).join("_");

      if (toolName.startsWith(prefix) && toolName.endsWith(suffix)) {
        const customName = toolName.slice(prefix.length, -suffix.length);
        if (customName) {
          return { outputType: outputType as OutputType, customName };
        }
      }
    }
  }

  return null;
}

/**
 * Get tools from all output nodes ABOVE the current inference node.
 * Context flows downward - each inference gathers tools from preceding output nodes.
 * Stops at any previous inference node.
 */
export function getToolsFromPrecedingNodes(
  nodes: PipelineNodeConfig[],
  currentNodeIndex: number
): { tools: Tool[]; nodeIdByToolName: Record<string, string> } {
  const tools: Tool[] = [];
  const nodeIdByToolName: Record<string, string> = {};

  // Scan backwards from current inference node
  for (let i = currentNodeIndex - 1; i >= 0; i--) {
    const node = nodes[i];

    // Stop at previous inference node
    if (node.type === "inference") break;

    // Get tool for output nodes
    const tool = getToolForNode(node);
    if (tool) {
      tools.push(tool);
      nodeIdByToolName[tool.name] = node.id;
    }

    // Get tool for genie nodes
    const genieTool = getGenieTool(node);
    if (genieTool) {
      tools.push(genieTool);
      nodeIdByToolName[genieTool.name] = node.id;
    }
  }

  return { tools, nodeIdByToolName };
}

// Alias for backward compatibility
export const getToolsForDownstreamNodes = getToolsFromPrecedingNodes;

/**
 * Get the output type for a node type
 */
export function nodeTypeToOutputType(nodeType: NodeType): OutputType | null {
  return NODE_TYPE_TO_OUTPUT_TYPE[nodeType] ?? null;
}

/**
 * Check if a node type is an output node (has an associated tool)
 */
export function isOutputNode(nodeType: NodeType): boolean {
  return nodeType in NODE_TYPE_TO_OUTPUT_TYPE;
}

/**
 * Check if a tool name is a genie message tool
 */
export function isGenieMessageTool(toolName: string): boolean {
  return toolName === "send_message_to_genie" || toolName.startsWith("send_message_to_");
}

// Legacy export for backward compatibility
export const OUTPUT_TOOLS = Object.fromEntries(
  Object.entries(TOOL_TEMPLATES).map(([key, template]) => [
    key,
    {
      name: template.baseToolName,
      description: template.description,
      input_schema: template.input_schema,
    },
  ])
) as Record<string, Tool>;
