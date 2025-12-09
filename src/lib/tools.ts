import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type {
  NodeType,
  OutputType,
  PipelineNodeConfig,
  ColorDisplayConfig,
  IconDisplayConfig,
  GaugeDisplayConfig,
  PixelArtDisplayConfig,
  WebhookTriggerConfig,
  SurveyConfig,
} from "@/types/pipeline";
import { ICON_IDS } from "@/types/pipeline";

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
    description: "Generate pixel art on a grid.",
    input_schema: {
      type: "object" as const,
      properties: {
        width: {
          type: "number",
          description: "Grid width in pixels (default: 8, max: 16)",
        },
        height: {
          type: "number",
          description: "Grid height in pixels (default: 8, max: 16)",
        },
        pixels: {
          type: "array",
          items: {
            type: "string",
            pattern: "^#[0-9a-fA-F]{6}$",
          },
          description: "Array of hex colors, length must equal width × height",
        },
        explanation: {
          type: "string",
          description: "Description of what you drew",
        },
      },
      required: ["pixels"],
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
    | GaugeDisplayConfig
    | PixelArtDisplayConfig
    | WebhookTriggerConfig
    | SurveyConfig;
  return config?.name;
}

/**
 * Generate a tool name from base name and optional custom name
 * e.g., "display_icon" + "weather" → "display_weather_icon"
 */
function generateToolName(baseToolName: string, customName?: string): string {
  if (!customName) return baseToolName;

  // Insert custom name: "display_icon" → "display_weather_icon"
  const parts = baseToolName.split("_");
  if (parts.length >= 2) {
    // Insert after first part: display_[custom]_icon
    return `${parts[0]}_${customName}_${parts.slice(1).join("_")}`;
  }
  return `${baseToolName}_${customName}`;
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
 */
export function parseToolName(toolName: string): { outputType: OutputType; customName?: string } | null {
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

    const tool = getToolForNode(node);
    if (tool) {
      tools.push(tool);
      nodeIdByToolName[tool.name] = node.id;
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
