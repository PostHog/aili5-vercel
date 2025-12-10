# About the project

aili5 is a toy for learning about LLMs voiced in the style of a children's book.

It works by presenting users with a pipeline of inputs and configuration options to let them play with LLMs interactively and learn in the process.

## Vertical slice

We need to prove the workflow we're describing is workable. To do this, we will build a simple pipeline with the following components. The components will be a linear series of node, connected by edged, forming a pipeline or "graph" type flow.

Here are the components:

- System prompt: this will be a user-editable text input. It will be connected to the system prompt input of the model.
- Model editor: allows the selection of model versions and the setting of temperature.
- Run inference button: runs inference based on the above input
- Inference output: displays inference result

The architecture should support the insertion of additional components in the future, but the vertical slice should be focused to ensure this premise works as we expect.

## Node component design

Assume a basic I/O based on JSON objects.

UI-wise, each node component has a title and description subtitle.

## Technologies

- We'll use Next.js for our framework
- We'll use the PostHog agent framework with a PostHog API key set in the environment for inference; the agent has a basic run commmand which should work for our purposes, along with a configuration interface we can use to set model parameters, etc

ALWAYS consult the Next development MCP server for error correction and references

## Prototype output

Generate a single page that contains the complete workflow described by the above components.

---

# Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Page Layout                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐                                       │
│  │  PipelineNode        │                                       │
│  │  "System Prompt"     │                                       │
│  │  ┌────────────────┐  │                                       │
│  │  │  <textarea>    │  │                                       │
│  │  └────────────────┘  │                                       │
│  └──────────┬───────────┘                                       │
│             │ (JSON: {systemPrompt: string})                    │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │  PipelineNode        │                                       │
│  │  "Model Settings"    │                                       │
│  │  ┌────────────────┐  │                                       │
│  │  │ Model: [____▼] │  │                                       │
│  │  │ Temp:  [====○] │  │                                       │
│  │  └────────────────┘  │                                       │
│  └──────────┬───────────┘                                       │
│             │ (JSON: {model: string, temperature: number})      │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │  PipelineNode        │                                       │
│  │  "Run Inference"     │                                       │
│  │  ┌────────────────┐  │                                       │
│  │  │  [ Run ▶ ]     │  │                                       │
│  │  └────────────────┘  │                                       │
│  └──────────┬───────────┘                                       │
│             │ (triggers API call)                               │
│             ▼                                                    │
│  ┌──────────────────────┐                                       │
│  │  PipelineNode        │                                       │
│  │  "Output"            │                                       │
│  │  ┌────────────────┐  │                                       │
│  │  │  Response text │  │                                       │
│  │  │  ...           │  │                                       │
│  │  └────────────────┘  │                                       │
│  └──────────────────────┘                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/
│   ├── page.tsx              # Main pipeline page (client component)
│   ├── layout.tsx            # Root layout (existing)
│   ├── globals.css           # Global styles (existing)
│   └── api/
│       └── inference/
│           └── route.ts      # API route for LLM inference
├── components/
│   └── pipeline/
│       ├── PipelineNode.tsx  # Reusable node wrapper component
│       ├── SystemPromptNode.tsx
│       ├── ModelSettingsNode.tsx
│       ├── RunInferenceNode.tsx
│       └── OutputNode.tsx
├── lib/
│   └── inference.ts          # PostHog Agent inference wrapper
└── types/
    └── pipeline.ts           # TypeScript types for pipeline data
```

## Component Specifications

### 1. PipelineNode (Base Component)
```typescript
interface PipelineNodeProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}
```
- Renders a card with title, description subtitle, and content area
- Visual connector line to next node (CSS pseudo-element)

### 2. SystemPromptNode
- **Input**: None (first node)
- **Output**: `{ systemPrompt: string }`
- **UI**: Labeled textarea with placeholder text
- **Default**: "You are a helpful assistant."

### 3. ModelSettingsNode
- **Input**: `{ systemPrompt: string }`
- **Output**: `{ systemPrompt: string, model: string, temperature: number }`
- **UI**:
  - Model dropdown: claude-sonnet-4-20250514, claude-haiku-3-20240307
  - Temperature slider: 0.0 - 1.0 (default 0.7)

### 4. RunInferenceNode
- **Input**: `{ systemPrompt: string, model: string, temperature: number }`
- **Output**: Triggers inference, passes result to OutputNode
- **UI**:
  - User message textarea (what to ask the model)
  - Run button (disabled while loading)
  - Loading spinner during inference

### 5. OutputNode
- **Input**: `{ response: string, loading: boolean, error?: string }`
- **Output**: None (terminal node)
- **UI**:
  - Scrollable text area displaying model response
  - Error display if inference fails
  - Empty state before first run

## API Route: `/api/inference`

### Request
```typescript
interface InferenceRequest {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
}
```

### Response
```typescript
interface InferenceResponse {
  response: string;
  error?: string;
}
```

### Implementation
Uses `@posthog/agent` with the PostHog LLM gateway:

```typescript
import { Agent } from '@posthog/agent';

const agent = new Agent({
  workingDirectory: process.cwd(),
  posthogApiUrl: process.env.POSTHOG_API_URL || 'https://us.posthog.com',
  posthogApiKey: process.env.POSTHOG_API_KEY!,
  posthogProjectId: parseInt(process.env.POSTHOG_PROJECT_ID || '1'),
});

// Use agent.run() for simple prompt execution
const result = await agent.run(userMessage, {
  queryOverrides: {
    model,
    systemPrompt,
    temperature,
  }
});
```

## Environment Variables

```env
POSTHOG_API_KEY=phx_...        # PostHog personal API key
POSTHOG_API_URL=https://us.posthog.com  # or https://eu.posthog.com
POSTHOG_PROJECT_ID=12345       # PostHog project ID
```

## State Management

Use React's built-in `useState` for simplicity:

```typescript
// In page.tsx
const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
const [model, setModel] = useState("claude-sonnet-4-20250514");
const [temperature, setTemperature] = useState(0.7);
const [userMessage, setUserMessage] = useState("");
const [response, setResponse] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

## Styling Approach

- Use CSS Modules (already set up by Next.js)
- Minimal, clean design focused on learning
- Visual flow indicators (arrows/lines between nodes)
- Responsive layout (stack vertically on mobile)

## Implementation Steps

1. **Install dependency**: `pnpm add @posthog/agent`
2. **Create types**: Define pipeline data structures
3. **Build PipelineNode**: Base wrapper component
4. **Build individual nodes**: SystemPrompt, ModelSettings, RunInference, Output
5. **Create API route**: `/api/inference` using PostHog agent
6. **Wire up page.tsx**: Compose nodes with state management
7. **Add styling**: CSS for node cards and connectors
8. **Test end-to-end**: Verify inference works with PostHog gateway

## Future Extensibility

The node-based architecture supports:
- **New node types**: e.g., "Few-shot Examples", "Output Parser", "Token Counter"
- **Branching**: Multiple paths through the pipeline
- **Persistence**: Save/load pipeline configurations
- **Drag-and-drop**: Rearrange nodes (would require additional library)


## Additional modules

* Trigger webhook: based on inference output or user configuration, make a web request
* Display a color: a simple color display set by the LLM
* Display an icon: a menu of icons the LLM can pick and display one of
* Gauge (numeric): a large number set by the LLM
* Surveys: an interactive sequence of questions guided by the LLM
* Paint input: the user paints things and the LLM interprets it
* Pixel art generator: the LLM can generate pixel art

