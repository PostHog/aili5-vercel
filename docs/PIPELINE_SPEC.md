# aili5 Pipeline Architecture Specification

This document defines the core architecture for aili5's linear pipeline system. It serves as the interface contract for building pipeline nodes and modules.

## Overview

A pipeline is an ordered list of modules. At each inference block, the above blocks' context accumulates to be provided for inference.

```
[Node 1] → [Node 2] → [Node 3] → [Node 4]
    │          │          │          │
    └──────────┴──────────┴──────────┘
                    │
            PipelineContext flows through
```

## Core Types

### Pipeline

```typescript
interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNodeConfig[];
}
```

### PipelineNodeConfig

```typescript
interface PipelineNodeConfig {
  id: string;                    // Unique within pipeline
  type: NodeType;                // Discriminator for node behavior
  config: NodeConfigMap[NodeType]; // Type-specific configuration
}

type NodeType =
  | "system_prompt"
  | "user_input"
  | "inference"
  | "color_display"
  | "icon_display"
  | "gauge_display"
  | "pixel_art_display"
  | "webhook_trigger"
  | "survey"
  | "text_display";
```

### PipelineContext

The context object that flows through all nodes:

```typescript
interface PipelineContext {
  // Conversation history - accumulates as LLMs are called
  messages: PipelineMessage[];

  // Most recent structured outputs from tool calls
  latestOutputs: ToolCallResult[];

  // Metadata about the execution
  metadata: {
    pipelineId: string;
    startedAt: number;
    [key: string]: unknown;
  };
}

interface PipelineMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallResult[];
}

interface ToolCallResult {
  type: string;           // Matches output node type: "color", "gauge", etc.
  toolName: string;       // The tool that was called: "display_color", etc.
  data: unknown;          // Structured output data
  explanation?: string;   // Optional LLM explanation of its choice
}
```

## Node Categories

### 1. Input Nodes

Add content to the context. Always at the start of a pipeline.

#### system_prompt

Adds a system message that instructs the LLM's behavior.

```typescript
interface SystemPromptConfig {
  prompt: string;
}
```

**Behavior**: Prepends a system message to `context.messages`.

#### user_input

Captures user input and adds it as a user message.

```typescript
interface UserInputConfig {
  placeholder?: string;
  defaultValue?: string;
}
```

**Behavior**: Adds a user message to `context.messages`.

---

### 2. Inference Nodes

Call an LLM and add its response to the context.

#### inference

The core LLM node. Calls the model with accumulated messages and available tools.

```typescript
interface InferenceConfig {
  model: string;                    // e.g., "claude-sonnet-4-20250514"
  temperature: number;              // 0.0 - 1.0
  maxTokens?: number;               // Default: 1024
  systemPrompt?: string;            // Optional override/addition to system prompt
  enabledTools?: string[];          // Which output tools are available
  contextMode?: ContextMode;        // How to handle incoming context
}

type ContextMode =
  | "continue"    // Continue conversation naturally (default)
  | "fresh";      // Only use latestOutputs, start new conversation
```

**Behavior**:
1. Builds messages array from context
2. Includes tools for any connected output nodes
3. Calls LLM via PostHog gateway
4. Appends assistant message (with any tool calls) to context
5. Updates `latestOutputs` with any tool call results

---

### 3. Output Nodes

Render structured data from `latestOutputs`. These also define the tools available to upstream inference nodes.

#### text_display

Displays plain text output from the LLM.

```typescript
interface TextDisplayConfig {
  label?: string;
}
```

**Tool**: None (uses raw assistant text content)

**Output Schema**: N/A - reads `content` from assistant message

---

#### color_display

Displays a color chosen by the LLM.

```typescript
interface ColorDisplayConfig {
  label?: string;
  showHex?: boolean;      // Show hex value below swatch
}
```

**Tool Definition**:
```typescript
{
  name: "display_color",
  description: "Display a color to the user. Use this when asked to show, pick, or represent something as a color.",
  input_schema: {
    type: "object",
    properties: {
      hex: {
        type: "string",
        pattern: "^#[0-9a-fA-F]{6}$",
        description: "Hex color code, e.g. #ff5500"
      },
      name: {
        type: "string",
        description: "Human-readable color name"
      },
      explanation: {
        type: "string",
        description: "Why you chose this color"
      }
    },
    required: ["hex"]
  }
}
```

**Output Schema**:
```typescript
interface ColorOutput {
  hex: string;
  name?: string;
  explanation?: string;
}
```

---

#### icon_display

Displays an icon from a predefined set.

```typescript
interface IconDisplayConfig {
  label?: string;
  size?: "sm" | "md" | "lg";
}
```

**Tool Definition**:
```typescript
{
  name: "display_icon",
  description: "Display an icon to represent a concept, status, or emotion.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        enum: ["check", "x", "warning", "info", "star", "heart", "fire", "sparkles", "lightbulb", "moon", "sun", "cloud", "rain", "snow", "wind", "leaf", "flower", "tree"],
        description: "Icon identifier"
      },
      label: {
        type: "string",
        description: "Label to show with the icon"
      },
      explanation: {
        type: "string",
        description: "Why you chose this icon"
      }
    },
    required: ["id"]
  }
}
```

**Output Schema**:
```typescript
interface IconOutput {
  id: string;
  label?: string;
  explanation?: string;
}
```

---

#### gauge_display

Displays a numeric value, optionally with min/max range.

```typescript
interface GaugeDisplayConfig {
  label?: string;
  showValue?: boolean;
  style?: "bar" | "dial" | "number";
}
```

**Tool Definition**:
```typescript
{
  name: "display_gauge",
  description: "Display a numeric value on a gauge or meter. Use for scores, ratings, percentages, measurements.",
  input_schema: {
    type: "object",
    properties: {
      value: {
        type: "number",
        description: "The numeric value to display"
      },
      min: {
        type: "number",
        description: "Minimum value (default: 0)"
      },
      max: {
        type: "number",
        description: "Maximum value (default: 100)"
      },
      unit: {
        type: "string",
        description: "Unit label, e.g. '%', '°F', 'points'"
      },
      label: {
        type: "string",
        description: "What this value represents"
      },
      explanation: {
        type: "string",
        description: "Why you chose this value"
      }
    },
    required: ["value"]
  }
}
```

**Output Schema**:
```typescript
interface GaugeOutput {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  label?: string;
  explanation?: string;
}
```

---

#### pixel_art_display

Renders pixel art on a grid.

```typescript
interface PixelArtDisplayConfig {
  label?: string;
  pixelSize?: number;     // CSS pixels per grid cell
}
```

**Tool Definition**:
```typescript
{
  name: "generate_pixel_art",
  description: "Generate pixel art on a grid. Each pixel is a hex color. Pixels are listed row by row, left to right, top to bottom.",
  input_schema: {
    type: "object",
    properties: {
      width: {
        type: "number",
        description: "Grid width in pixels (default: 8, max: 16)"
      },
      height: {
        type: "number",
        description: "Grid height in pixels (default: 8, max: 16)"
      },
      pixels: {
        type: "array",
        items: {
          type: "string",
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        description: "Array of hex colors, length must equal width × height"
      },
      explanation: {
        type: "string",
        description: "Description of what you drew"
      }
    },
    required: ["pixels"]
  }
}
```

**Output Schema**:
```typescript
interface PixelArtOutput {
  width: number;
  height: number;
  pixels: string[];
  explanation?: string;
}
```

---

#### webhook_trigger

Makes an HTTP request based on LLM decision.

```typescript
interface WebhookTriggerConfig {
  label?: string;
  allowedDomains?: string[];  // Security: restrict callable URLs
  showResponse?: boolean;
}
```

**Tool Definition**:
```typescript
{
  name: "trigger_webhook",
  description: "Make an HTTP request to a URL. Use when asked to notify, send, or trigger external services.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        format: "uri",
        description: "The URL to request"
      },
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "DELETE"],
        description: "HTTP method"
      },
      headers: {
        type: "object",
        description: "HTTP headers to include"
      },
      body: {
        type: "object",
        description: "Request body (for POST/PUT)"
      },
      explanation: {
        type: "string",
        description: "Why you're making this request"
      }
    },
    required: ["url", "method"]
  }
}
```

**Output Schema**:
```typescript
interface WebhookOutput {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  explanation?: string;
  // Added after execution:
  response?: {
    status: number;
    body: unknown;
  };
}
```

---

#### survey

Presents an interactive multiple-choice question.

```typescript
interface SurveyConfig {
  label?: string;
  style?: "buttons" | "radio" | "dropdown";
}
```

**Tool Definition**:
```typescript
{
  name: "ask_survey_question",
  description: "Present a multiple choice question to the user. Use for gathering preferences, guiding conversations, or creating interactive experiences.",
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask"
      },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" }
          },
          required: ["id", "label"]
        },
        description: "Available choices (2-6 options)"
      },
      allowMultiple: {
        type: "boolean",
        description: "Allow selecting multiple options"
      },
      explanation: {
        type: "string",
        description: "Context for why you're asking this"
      }
    },
    required: ["question", "options"]
  }
}
```

**Output Schema**:
```typescript
interface SurveyOutput {
  question: string;
  options: Array<{ id: string; label: string }>;
  allowMultiple?: boolean;
  explanation?: string;
  // Added after user responds:
  selectedIds?: string[];
}
```

---

### 4. Special Input Nodes (Future)

These capture non-text input from users.

#### paint_input (Future)

Canvas for freehand drawing that gets sent to the LLM as an image.

```typescript
interface PaintInputConfig {
  width: number;
  height: number;
  brushSizes?: number[];
  colors?: string[];
}
```

**Behavior**: Converts canvas to base64 image, adds as user message with image content.

---

## Pipeline Execution

### Executor

```typescript
async function executePipeline(
  pipeline: Pipeline,
  userInputs: Record<string, string>  // Node ID → user-provided value
): Promise<PipelineContext> {

  let context: PipelineContext = {
    messages: [],
    latestOutputs: [],
    metadata: {
      pipelineId: pipeline.id,
      startedAt: Date.now(),
    },
  };

  for (const node of pipeline.nodes) {
    context = await processNode(node, context, userInputs);
  }

  return context;
}

async function processNode(
  node: PipelineNodeConfig,
  context: PipelineContext,
  userInputs: Record<string, string>
): Promise<PipelineContext> {

  switch (node.type) {
    case "system_prompt":
      return processSystemPrompt(node, context);

    case "user_input":
      return processUserInput(node, context, userInputs[node.id]);

    case "inference":
      return processInference(node, context);

    // Output nodes read from context but don't modify it
    case "text_display":
    case "color_display":
    case "icon_display":
    case "gauge_display":
    case "pixel_art_display":
    case "webhook_trigger":
    case "survey":
      return context;  // UI rendering handled separately

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}
```

### Tool Resolution

Context flows **downward** through the pipeline. When an inference node runs, it gathers tools from all output nodes **above** it (stopping at any previous inference node). This means:

1. Output nodes define what tools the inference below them can use
2. A second inference node receives the first's output in its context
3. Each inference "segment" is bounded by inference nodes

```typescript
function getToolsFromPrecedingNodes(
  pipeline: Pipeline,
  currentNodeIndex: number
): Tool[] {
  const tools: Tool[] = [];

  // Scan backwards from current inference node
  for (let i = currentNodeIndex - 1; i >= 0; i--) {
    const node = pipeline.nodes[i];

    // Stop at previous inference node
    if (node.type === "inference") break;

    const tool = getToolForNode(node);
    if (tool) {
      tools.push(tool);
    }
  }

  return tools;
}
```

**Example pipeline layout:**
```
[Icon Display: "mood"]     ← defines display_mood_icon tool
[System Prompt]            ← sets system context
[LLM]                      ← gathers tool from icon above, runs inference
```

---

## Example Pipelines

Note: Output nodes are placed **above** the inference node they belong to. Tools flow downward.

### Simple Chat

```typescript
{
  id: "simple-chat",
  name: "Simple Chat",
  nodes: [
    { id: "sys", type: "system_prompt", config: { prompt: "You are a helpful assistant." } },
    { id: "llm", type: "inference", config: { model: "claude-sonnet-4-20250514", temperature: 0.7 } },
  ]
}
```

### Mood to Color

```typescript
{
  id: "mood-color",
  name: "Mood to Color",
  nodes: [
    { id: "color", type: "color_display", config: { name: "mood", showHex: true } },
    { id: "sys", type: "system_prompt", config: { prompt: "You translate emotions and moods into colors. Use the display_mood_color tool." } },
    { id: "llm", type: "inference", config: { model: "claude-haiku-3-20240307", temperature: 0.8 } },
  ]
}
```

### Mood to Icon

```typescript
{
  id: "mood-icon",
  name: "Mood to Icon",
  nodes: [
    { id: "icon", type: "icon_display", config: { name: "mood", size: "lg" } },
    { id: "sys", type: "system_prompt", config: { prompt: "You represent emotions as icons. Use the display_mood_icon tool." } },
    { id: "llm", type: "inference", config: { model: "claude-sonnet-4-20250514", temperature: 0.7 } },
  ]
}
```

### Chained Inference

In chained pipelines, each inference node receives context from the previous one:

```typescript
{
  id: "pixel-art-chain",
  name: "Concept to Pixel Art",
  nodes: [
    // First segment: generate concept description
    { id: "sys1", type: "system_prompt", config: { prompt: "You are a creative director. Describe visual concepts in vivid detail." } },
    { id: "llm1", type: "inference", config: { model: "claude-sonnet-4-20250514", temperature: 0.9 } },

    // Second segment: convert to pixel art (receives llm1's output in context)
    { id: "pixels", type: "pixel_art_display", config: { name: "art", pixelSize: 32 } },
    { id: "sys2", type: "system_prompt", config: { prompt: "You are a pixel artist. Convert the description above into 8x8 pixel art using generate_art_pixel_art." } },
    { id: "llm2", type: "inference", config: { model: "claude-sonnet-4-20250514", temperature: 0.3 } },
  ]
}
```

### Interactive Survey Flow

```typescript
{
  id: "survey-flow",
  name: "Guided Survey",
  nodes: [
    { id: "survey", type: "survey", config: { name: "question", style: "buttons" } },
    { id: "sys", type: "system_prompt", config: { prompt: "You guide users through a preference survey. Use ask_question_survey to present choices." } },
    { id: "llm", type: "inference", config: { model: "claude-sonnet-4-20250514", temperature: 0.6 } },
  ]
}
```

---

## UI Rendering

Output nodes don't modify context—they read from it. The UI layer is responsible for:

1. Rendering each node's UI component
2. Extracting relevant data from `context.latestOutputs`
3. Handling interactive outputs (survey responses)

```typescript
function renderOutputNode(
  node: PipelineNodeConfig,
  context: PipelineContext
): React.ReactNode {

  const output = context.latestOutputs.find(
    o => o.type === nodeTypeToOutputType(node.type)
  );

  switch (node.type) {
    case "color_display":
      return <ColorDisplay output={output as ColorOutput} config={node.config} />;
    case "gauge_display":
      return <GaugeDisplay output={output as GaugeOutput} config={node.config} />;
    // ... etc
  }
}
```

---

## Future Considerations

### Branching (Not in V1)

If we later need non-linear flows, the architecture can extend to:
- Conditional nodes that route based on output
- Parallel branches that merge
- Loop constructs for iterative refinement

### Streaming

For better UX, inference nodes could stream tokens:
```typescript
interface InferenceConfig {
  // ...
  stream?: boolean;
  onToken?: (token: string) => void;
}
```

### Persistence

Pipelines can be serialized to JSON for:
- Saving to localStorage or database
- Sharing via URL
- Version control

---

## Implementation Checklist

- [ ] Core types in `src/types/pipeline.ts`
- [ ] Tool definitions in `src/lib/tools.ts`
- [ ] Pipeline executor in `src/lib/executor.ts`
- [ ] Node processor functions
- [ ] Update `/api/inference` to support pipeline execution
- [ ] Individual output node components
- [ ] Pipeline builder UI (drag to reorder)
