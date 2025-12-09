# Pipeline Builder Refactoring Plan

This document outlines the architectural refactor for the AILI5 pipeline builder, moving from a monolithic component to a modular, composable architecture.

## Current State: God Component Problem

`PipelineBuilder.tsx` (804 lines) mixes **5 distinct concerns**:

1. **Drag-and-drop orchestration** (dnd-kit setup, handlers)
2. **Pipeline state management** (nodes, outputs, user inputs)
3. **Genie state & logic** (conversations, backstory updates, self-inference)
4. **URL loading** (fetch, caching)
5. **Inference orchestration** (prompt building, API calls, tool routing)

---

## Proposed Architecture

```
src/
├── components/
│   └── builder/
│       ├── PipelineBuilder.tsx          # ~100 lines - Composition only
│       ├── PipelineCanvas.tsx           # Keep as-is (rendering)
│       ├── ModulePalette.tsx            # Keep as-is
│       └── nodes/                       # Keep as-is
│
├── hooks/
│   ├── usePipelineState.ts              # Node CRUD, outputs, user inputs
│   ├── usePipelineDragDrop.ts           # dnd-kit integration
│   ├── useSelfInferencingNodes.ts       # Generic self-inferencing (replaces useGenieState)
│   └── useURLLoader.ts                  # URL fetching with caching
│
├── services/
│   └── inference/
│       ├── index.ts                     # Export inferenceService
│       ├── promptBuilder.ts             # buildSystemPrompt, gatherContext
│       ├── toolRouter.ts                # Route tool calls to output nodes
│       └── api.ts                       # /api/inference calls
│
├── lib/
│   ├── tools.ts                         # Keep (tool definitions)
│   ├── blockParsers.ts                  # Keep (node interfaces)
│   ├── nodeDefaults.ts                  # NEW: getDefaultConfig moved here
│   └── nodeInterfaces/                  # NEW: Self-inferencing behaviors
│       ├── index.ts                     # Registry of behaviors
│       ├── types.ts                     # SelfInferencingNodeBehavior interface
│       └── genieBehavior.ts             # Genie-specific behavior
│
└── types/
    └── pipeline.ts                      # Keep (type definitions)
```

---

## Refactor Details

### 1. `hooks/usePipelineState.ts` (~80 lines)

Manages core pipeline state:

```typescript
export function usePipelineState() {
  const [systemPromptConfig, setSystemPromptConfig] = useState<SystemPromptConfig>({
    prompt: "You are a helpful assistant.",
  });
  const [nodes, setNodes] = useState<PipelineNodeConfig[]>([]);
  const [outputs, setOutputs] = useState<Record<string, OutputData>>({});
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});

  const addNode = useCallback((node: PipelineNodeConfig, insertIndex?: number) => {
    setNodes((prev) => {
      if (insertIndex === undefined) return [...prev, node];
      return [...prev.slice(0, insertIndex), node, ...prev.slice(insertIndex)];
    });
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    if (nodeId === "system-prompt-fixed") return;
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    // Clean up associated state
    setUserInputs((prev) => { const next = { ...prev }; delete next[nodeId]; return next; });
    setOutputs((prev) => { const next = { ...prev }; delete next[nodeId]; return next; });
  }, []);

  const updateConfig = useCallback((nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => {
    if (nodeId === "system-prompt-fixed") {
      setSystemPromptConfig(config as SystemPromptConfig);
      return;
    }
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, config } : n)));
  }, []);

  const reorderNodes = useCallback((oldIndex: number, newIndex: number) => {
    setNodes((prev) => arrayMove(prev, oldIndex, newIndex));
  }, []);

  const setOutput = useCallback((nodeId: string, output: OutputData) => {
    setOutputs((prev) => ({ ...prev, [nodeId]: output }));
  }, []);

  const setUserInput = useCallback((nodeId: string, value: string) => {
    setUserInputs((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  return {
    systemPromptConfig,
    setSystemPromptConfig,
    nodes,
    outputs,
    userInputs,
    addNode,
    removeNode,
    updateConfig,
    reorderNodes,
    setOutput,
    setUserInput,
  };
}
```

---

### 2. `hooks/usePipelineDragDrop.ts` (~100 lines)

Encapsulates all dnd-kit logic:

```typescript
import {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  CollisionDetection,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

interface DragData {
  type: NodeType;
  fromPalette?: boolean;
}

export function usePipelineDragDrop(
  nodes: PipelineNodeConfig[],
  onAddNode: (node: PipelineNodeConfig, insertIndex?: number) => void,
  onReorderNodes: (oldIndex: number, newIndex: number) => void
) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<NodeType | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const data = active.data.current as DragData | undefined;
    if (data?.type) {
      setActiveType(data.type);
    } else {
      const existingNode = nodes.find((n) => n.id === active.id);
      if (existingNode) setActiveType(existingNode.type);
    }
  }, [nodes]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);
    setOverId(null);

    if (!over) return;

    const activeData = active.data.current as DragData | undefined;

    // Dragging from palette - add new node
    if (activeData?.fromPalette && activeData.type) {
      if (activeData.type === "system_prompt") return;

      const newNode: PipelineNodeConfig = {
        id: generateNodeId(),
        type: activeData.type,
        config: getDefaultConfig(activeData.type),
      };

      if (over.id === "pipeline-canvas") {
        onAddNode(newNode);
      } else if (over.id === "system-prompt-fixed") {
        onAddNode(newNode, 0);
      } else {
        const overIndex = nodes.findIndex((n) => n.id === over.id);
        onAddNode(newNode, overIndex === -1 ? undefined : overIndex);
      }
      return;
    }

    // Reordering existing nodes
    if (active.id !== over.id && active.id !== "system-prompt-fixed") {
      if (over.id === "system-prompt-fixed") return;
      const oldIndex = nodes.findIndex((n) => n.id === active.id);
      const newIndex = nodes.findIndex((n) => n.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderNodes(oldIndex, newIndex);
      }
    }
  }, [nodes, onAddNode, onReorderNodes]);

  return {
    sensors,
    collisionDetection,
    activeId,
    activeType,
    overId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
```

---

### 3. Self-Inferencing Nodes (Generic Pattern)

The genie's "self-inference" is really just a node that can trigger its own inference loop independently of the main pipeline. This is a pattern that could apply to other node types.

#### The Pattern: Self-Inferencing Nodes

A **self-inferencing node** is any node that:
1. Has its own conversation state (messages history)
2. Can trigger inference independently of the main pipeline
3. Builds its own context from preceding nodes
4. May update its own config based on external inference results

**Genie is just one instance of this pattern.**

Other potential self-inferencing nodes:
- **Critic** - Reviews pipeline outputs, provides feedback
- **Planner** - Breaks down tasks, tracks progress
- **Researcher** - Gathers information, builds knowledge base
- **Persona** - Like genie but with different interaction style

#### `types/selfInferencing.ts`

```typescript
interface SelfInferencingNodeConfig {
  // Identity
  name: string;
  systemPrompt: string;  // Was "backstory" for genie

  // Inference settings
  model: string;
  temperature: number;

  // Behavior
  autoRespondOnUpdate?: boolean;
  includeOtherConversations?: boolean;  // Include sibling self-inferencing nodes
}

interface ConversationState {
  messages: { role: "user" | "assistant"; content: string }[];
}

interface SelfInferencingNodeBehavior {
  // How to build the identity prompt
  buildIdentityPrompt: (config: SelfInferencingNodeConfig, conversation: ConversationState) => string;

  // How to format this node's context for other nodes
  formatContextForOthers: (config: SelfInferencingNodeConfig, conversation: ConversationState) => string;

  // What to do when the main pipeline updates this node
  onExternalUpdate?: (config: SelfInferencingNodeConfig, update: unknown) => Partial<SelfInferencingNodeConfig>;

  // Initial message to trigger (like genie's "Introduce yourself")
  getInitializationPrompt?: (config: SelfInferencingNodeConfig) => string;
}
```

#### `hooks/useSelfInferencingNodes.ts` (~150 lines)

Generic hook that replaces the genie-specific `useGenieState`:

```typescript
export function useSelfInferencingNodes(
  nodes: PipelineNodeConfig[],
  buildPrecedingContext: (nodeIndex: number) => string,
  behaviors: Record<NodeType, SelfInferencingNodeBehavior>
) {
  const [conversations, setConversations] = useState<Record<string, ConversationState>>({});
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({});
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);

  // Check if a node type is self-inferencing
  const isSelfInferencing = useCallback((type: NodeType) => {
    return type in behaviors;
  }, [behaviors]);

  // Generic self-inference
  const runSelfInference = useCallback(async (nodeId: string, userMessage: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !isSelfInferencing(node.type)) return;

    const behavior = behaviors[node.type];
    const config = node.config as SelfInferencingNodeConfig;
    const conversation = conversations[nodeId] || { messages: [] };
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);

    // Build prompt: preceding context + identity
    const precedingContext = buildPrecedingContext(nodeIndex);
    const identityPrompt = behavior.buildIdentityPrompt(config, conversation);
    const systemPrompt = precedingContext + "\n\n" + identityPrompt;

    setLoadingNodeId(nodeId);

    try {
      const result = await runInference({
        systemPrompt,
        userMessage,
        model: config.model,
        temperature: config.temperature,
      });

      if (result.error) return;

      setConversations((prev) => ({
        ...prev,
        [nodeId]: {
          messages: [
            ...conversation.messages,
            { role: "user", content: userMessage },
            { role: "assistant", content: result.response! },
          ],
        },
      }));
    } finally {
      setLoadingNodeId(null);
    }
  }, [nodes, conversations, behaviors, buildPrecedingContext]);

  // Initialize a node (trigger first message)
  const initializeNode = useCallback(async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !isSelfInferencing(node.type)) return;

    const behavior = behaviors[node.type];
    const config = node.config as SelfInferencingNodeConfig;

    const initPrompt = behavior.getInitializationPrompt?.(config);
    if (initPrompt) {
      await runSelfInference(nodeId, initPrompt);
    }
  }, [nodes, behaviors, runSelfInference]);

  // Process updates from main pipeline inference
  const processExternalUpdates = useCallback((
    precedingNodes: PipelineNodeConfig[],
    response: InferenceResult
  ) => {
    for (const node of precedingNodes) {
      if (!isSelfInferencing(node.type)) continue;

      const behavior = behaviors[node.type];
      if (!behavior.onExternalUpdate) continue;

      const update = parseBlockOutput(node.type, response, node.id);
      if (update) {
        // Signal that this node has a pending update
        setPendingUpdates((prev) => ({ ...prev, [node.id]: true }));
        // Return the config updates to apply
        // (caller is responsible for updating node config)
      }
    }
  }, [behaviors, isSelfInferencing]);

  // Format all self-inferencing nodes' context for system prompt
  const formatAllContexts = useCallback((upToIndex: number): string => {
    let context = "";
    for (let i = 0; i < upToIndex; i++) {
      const node = nodes[i];
      if (!isSelfInferencing(node.type)) continue;

      const behavior = behaviors[node.type];
      const config = node.config as SelfInferencingNodeConfig;
      const conversation = conversations[node.id];

      if (conversation?.messages.length) {
        context += behavior.formatContextForOthers(config, conversation);
      }
    }
    return context;
  }, [nodes, conversations, behaviors, isSelfInferencing]);

  return {
    conversations,
    pendingUpdates,
    loadingNodeId,
    isSelfInferencing,
    runSelfInference,
    initializeNode,
    processExternalUpdates,
    formatAllContexts,
    clearUpdate: (nodeId: string) => setPendingUpdates((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    }),
  };
}
```

#### `lib/nodeInterfaces/genieBehavior.ts`

Genie as a behavior definition (pure object, easy to test):

```typescript
import type { SelfInferencingNodeBehavior, SelfInferencingNodeConfig, ConversationState } from "@/types/selfInferencing";

export const genieBehavior: SelfInferencingNodeBehavior = {
  buildIdentityPrompt: (config: SelfInferencingNodeConfig, conversation: ConversationState): string => {
    let prompt = `You are ${config.name}. Act as ${config.name} would act. ${config.systemPrompt}`;

    if (conversation.messages.length > 0) {
      prompt += "\n\nYour previous conversation:\n";
      for (const msg of conversation.messages) {
        prompt += msg.role === "user"
          ? `User: ${msg.content}\n`
          : `${config.name}: ${msg.content}\n`;
      }
    }
    return prompt;
  },

  formatContextForOthers: (config: SelfInferencingNodeConfig, conversation: ConversationState): string => {
    let context = `\n\nGenie Context (name: ${config.name}):\n`;
    context += `[Backstory: ${config.systemPrompt}]\n\nConversation:\n`;
    for (const msg of conversation.messages) {
      context += msg.role === "user"
        ? `User: ${msg.content}\n`
        : `${config.name}: ${msg.content}\n`;
    }
    return context;
  },

  onExternalUpdate: (config: SelfInferencingNodeConfig, update: unknown): Partial<SelfInferencingNodeConfig> => {
    const typed = update as { backstory?: string };
    if (typed.backstory) {
      return { systemPrompt: typed.backstory };
    }
    return {};
  },

  getInitializationPrompt: (config: SelfInferencingNodeConfig): string => "Introduce yourself.",
};
```

#### `lib/nodeInterfaces/index.ts`

Registry of all self-inferencing behaviors:

```typescript
import type { NodeType } from "@/types/pipeline";
import type { SelfInferencingNodeBehavior } from "@/types/selfInferencing";
import { genieBehavior } from "./genieBehavior";
// import { criticBehavior } from "./criticBehavior";  // Future
// import { plannerBehavior } from "./plannerBehavior"; // Future

export const selfInferencingBehaviors: Partial<Record<NodeType, SelfInferencingNodeBehavior>> = {
  genie: genieBehavior,
  // critic: criticBehavior,
  // planner: plannerBehavior,
};
```

#### Benefits of Generic Self-Inferencing

| Before (Genie-specific) | After (Generic) |
|------------------------|-----------------|
| `useGenieState` hook with hardcoded genie logic | `useSelfInferencingNodes` with pluggable behaviors |
| Adding new self-inferencing node = copy genie code | Adding new = just define behavior object |
| Genie context formatting scattered | Each behavior defines its own `formatContextForOthers` |
| Hard to test | Behaviors are pure objects, easy to unit test |

---

### 4. `hooks/useURLLoader.ts` (~60 lines)

URL fetching with loading state:

```typescript
export function useURLLoader() {
  const [urlContexts, setUrlContexts] = useState<Record<string, URLContextItem>>({});
  const [loadingUrlNodeIds, setLoadingUrlNodeIds] = useState<Set<string>>(new Set());

  const loadURL = useCallback(async (nodeId: string, url: string, label?: string) => {
    if (!url) return;

    setLoadingUrlNodeIds((prev) => new Set(prev).add(nodeId));

    try {
      const response = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.error) {
        setUrlContexts((prev) => ({
          ...prev,
          [nodeId]: { url, label, content: "", error: data.error },
        }));
      } else {
        setUrlContexts((prev) => ({
          ...prev,
          [nodeId]: { url: data.url, label, content: data.content },
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setUrlContexts((prev) => ({
        ...prev,
        [nodeId]: { url, label, content: "", error: message },
      }));
    } finally {
      setLoadingUrlNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, []);

  const clearContext = useCallback((nodeId: string) => {
    setUrlContexts((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  return { urlContexts, loadingUrlNodeIds, loadURL, clearContext };
}
```

---

### 5. `services/inference/promptBuilder.ts` (~80 lines)

Pure functions for building prompts:

```typescript
import type { PipelineNodeConfig, GenieOutput, URLContextItem, TextInputConfig, GenieConfig } from "@/types/pipeline";
import { generateBlockMetadata } from "@/lib/blockParsers";

interface PromptBuilderOptions {
  additionalPrompt?: string;
  includeGenieConversations?: boolean;
}

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
    systemPrompt += systemPrompt ? "\n\n" + additionalPrompt : additionalPrompt;
  }

  // Add context from preceding nodes
  if (includeGenieConversations) {
    for (const node of precedingNodes) {
      if (node.type === "genie") {
        const genieConfig = node.config as GenieConfig;
        const conversation = genieConversations[node.id];
        if (conversation?.messages.length > 0) {
          systemPrompt += formatGenieContext(genieConfig.name, genieConfig.backstory, conversation.messages);
        }
      } else {
        const metadata = generateBlockMetadata(node.type, node.config, node.id);
        if (metadata) systemPrompt += metadata;
      }
    }
  }

  // Append URL context
  const urlItems = gatherURLContext(precedingNodes, urlContexts);
  if (urlItems.length > 0) {
    systemPrompt += "\n\n## Reference Content\n";
    systemPrompt += "The following content has been loaded for context:\n\n";
    for (const item of urlItems) {
      systemPrompt += `### ${item.label || item.url}\nSource: ${item.url}\n\n${item.content}\n\n---\n\n`;
    }
  }

  // Append text inputs
  const textItems = gatherTextInputs(precedingNodes, userInputs);
  if (textItems.length > 0) {
    systemPrompt += "\n\n## Additional Context\n";
    systemPrompt += "The following text has been provided for context:\n\n";
    for (const item of textItems) {
      systemPrompt += `### ${item.label}\n${item.content}\n\n---\n\n`;
    }
  }

  return systemPrompt;
}

export function gatherURLContext(
  precedingNodes: PipelineNodeConfig[],
  urlContexts: Record<string, URLContextItem>
): URLContextItem[] {
  return precedingNodes
    .filter((node) => node.type === "url_loader")
    .map((node) => urlContexts[node.id])
    .filter((ctx): ctx is URLContextItem => ctx?.content && !ctx.error);
}

export function gatherTextInputs(
  precedingNodes: PipelineNodeConfig[],
  userInputs: Record<string, string>
): { label: string; content: string }[] {
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

function formatGenieContext(name: string, backstory: string, messages: GenieOutput["messages"]): string {
  let context = `\n\nGenie Context (name: ${name}):\n[Backstory: ${backstory}]\n\nConversation:\n`;
  for (const msg of messages) {
    context += msg.role === "user" ? `User: ${msg.content}\n` : `${name}: ${msg.content}\n`;
  }
  return context;
}
```

---

### 6. `services/inference/toolRouter.ts` (~40 lines)

Route tool calls to output nodes:

```typescript
import type { OutputData } from "@/types/pipeline";

interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export function routeToolCalls(
  toolCalls: ToolCall[],
  nodeIdByToolName: Record<string, string>
): Record<string, OutputData> {
  const outputs: Record<string, OutputData> = {};

  for (const toolCall of toolCalls) {
    const targetNodeId = nodeIdByToolName[toolCall.toolName];
    if (targetNodeId) {
      outputs[targetNodeId] = toolCall.input as OutputData;
    }
  }

  return outputs;
}
```

---

### 7. `services/inference/api.ts` (~30 lines)

API call wrapper:

```typescript
interface InferenceParams {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
  tools?: unknown[];
}

interface InferenceResult {
  response?: string;
  toolCalls?: { toolName: string; input: Record<string, unknown> }[];
  error?: string;
}

export async function runInference(params: InferenceParams): Promise<InferenceResult> {
  const response = await fetch("/api/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      model: params.model,
      temperature: params.temperature,
      tools: params.tools,
    }),
  });

  return response.json();
}
```

---

### 8. Refactored `PipelineBuilder.tsx` (~100 lines)

Pure composition:

```typescript
"use client";

import { useCallback } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import type { PipelineNodeConfig, InferenceConfig, TextOutput } from "@/types/pipeline";
import { getToolsForDownstreamNodes } from "@/lib/tools";
import { usePipelineState } from "@/hooks/usePipelineState";
import { usePipelineDragDrop } from "@/hooks/usePipelineDragDrop";
import { useGenieState } from "@/hooks/useGenieState";
import { useURLLoader } from "@/hooks/useURLLoader";
import { buildSystemPrompt } from "@/services/inference/promptBuilder";
import { routeToolCalls } from "@/services/inference/toolRouter";
import { runInference } from "@/services/inference/api";
import { ModulePalette, MODULE_DEFINITIONS, SYSTEM_PROMPT_MODULE } from "./ModulePalette";
import { PipelineCanvas } from "./PipelineCanvas";
import styles from "./PipelineBuilder.module.css";

export function PipelineBuilder() {
  // Compose hooks
  const pipeline = usePipelineState();
  const dragDrop = usePipelineDragDrop(pipeline.nodes, pipeline.addNode, pipeline.reorderNodes);
  const urlLoader = useURLLoader();
  const genie = useGenieState(pipeline.nodes, buildSystemPromptWrapper, pipeline.setNodes);

  // Loading state
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);

  // Wrapper for buildSystemPrompt that uses current state
  function buildSystemPromptWrapper(nodeIndex: number, additionalPrompt?: string, includeGenies?: boolean) {
    const precedingNodes = pipeline.nodes.slice(0, nodeIndex);
    return buildSystemPrompt(
      pipeline.systemPromptConfig.prompt,
      precedingNodes,
      genie.conversations,
      urlLoader.urlContexts,
      pipeline.userInputs,
      { additionalPrompt, includeGenieConversations: includeGenies }
    );
  }

  // Main inference handler
  const handleRunInference = useCallback(async (inferenceNodeId: string) => {
    const fullNodes: PipelineNodeConfig[] = [
      { id: "system-prompt-fixed", type: "system_prompt", config: pipeline.systemPromptConfig },
      ...pipeline.nodes,
    ];

    const nodeIndex = fullNodes.findIndex((n) => n.id === inferenceNodeId);
    if (nodeIndex === -1) return;

    const inferenceNode = fullNodes[nodeIndex];
    const inferenceConfig = inferenceNode.config as InferenceConfig;
    const userMessage = pipeline.userInputs[inferenceNodeId] || "";
    if (!userMessage.trim()) return;

    const precedingNodes = fullNodes.slice(0, nodeIndex);
    const { tools, nodeIdByToolName } = getToolsForDownstreamNodes(pipeline.nodes, nodeIndex);
    const systemPrompt = buildSystemPromptWrapper(nodeIndex) || "You are a helpful assistant.";

    setLoadingNodeId(inferenceNodeId);

    try {
      const result = await runInference({
        systemPrompt,
        userMessage,
        model: inferenceConfig.model,
        temperature: inferenceConfig.temperature,
        tools: tools.length > 0 ? tools : undefined,
      });

      if (result.error) return;

      if (result.response) {
        pipeline.setOutput(inferenceNodeId, { content: result.response } as TextOutput);
      }

      if (result.toolCalls?.length) {
        const outputs = routeToolCalls(result.toolCalls, nodeIdByToolName);
        Object.entries(outputs).forEach(([id, output]) => pipeline.setOutput(id, output));
      }

      genie.processBackstoryUpdates(precedingNodes, result);
    } finally {
      setLoadingNodeId(null);
    }
  }, [pipeline, urlLoader.urlContexts, genie]);

  // Compose all nodes
  const allNodes: PipelineNodeConfig[] = [
    { id: "system-prompt-fixed", type: "system_prompt", config: pipeline.systemPromptConfig },
    ...pipeline.nodes,
  ];

  // Find active module for drag overlay
  const activeModule = dragDrop.activeType
    ? (dragDrop.activeType === "system_prompt"
        ? SYSTEM_PROMPT_MODULE
        : MODULE_DEFINITIONS.find((m) => m.type === dragDrop.activeType))
    : null;

  return (
    <DndContext
      sensors={dragDrop.sensors}
      collisionDetection={dragDrop.collisionDetection}
      onDragStart={dragDrop.handleDragStart}
      onDragOver={dragDrop.handleDragOver}
      onDragEnd={dragDrop.handleDragEnd}
    >
      <div className={styles.builder}>
        <PipelineCanvas
          nodes={allNodes}
          onRemoveNode={pipeline.removeNode}
          onConfigChange={pipeline.updateConfig}
          userInputs={pipeline.userInputs}
          onUserInputChange={pipeline.setUserInput}
          onRunInference={handleRunInference}
          onLoadURL={urlLoader.loadURL}
          loadingNodeId={loadingNodeId}
          loadingUrlNodeIds={urlLoader.loadingUrlNodeIds}
          outputs={pipeline.outputs}
          urlContexts={urlLoader.urlContexts}
          activeNodeId={dragDrop.activeId}
          overNodeId={dragDrop.overId}
          genieConversations={genie.conversations}
          onGenieSelfInference={genie.selfInference}
          onGenieSaveBackstory={genie.saveBackstory}
          genieBackstoryUpdates={genie.backstoryUpdates}
          onGenieClearUpdate={genie.clearUpdate}
        />
        <ModulePalette />
      </div>

      <DragOverlay>
        {activeModule && (
          <div className={styles.dragOverlay} style={{ "--module-color": activeModule.color } as React.CSSProperties}>
            <div className={styles.dragOverlayIcon}>
              <activeModule.icon size={18} />
            </div>
            <span>{activeModule.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

---

## Benefits

| Before | After |
|--------|-------|
| 804-line god component | ~100-line composition component |
| Mixed concerns | Single responsibility per file |
| Hard to test | Hooks/services testable in isolation |
| Tight coupling | Loose coupling via interfaces |
| State scattered | State colocated by domain |

---

## Migration Strategy

### Phase 1: Extract State Hooks (Lowest Risk)
1. Create `hooks/usePipelineState.ts`
2. Create `hooks/usePipelineDragDrop.ts`
3. Update `PipelineBuilder.tsx` to use these hooks
4. **Test**: Verify drag-drop and node CRUD still work

### Phase 2: Extract URL Loader (Isolated Feature)
1. Create `hooks/useURLLoader.ts`
2. Update `PipelineBuilder.tsx` to use the hook
3. **Test**: Verify URL loading works

### Phase 3: Extract Inference Services
1. Create `services/inference/promptBuilder.ts`
2. Create `services/inference/toolRouter.ts`
3. Create `services/inference/api.ts`
4. Update `PipelineBuilder.tsx` to use services
5. **Test**: Verify inference flow works end-to-end

### Phase 4: Extract Self-Inferencing Nodes (Most Complex)
1. Create `types/selfInferencing.ts` with generic interfaces
2. Create `lib/nodeInterfaces/types.ts`, `genieBehavior.ts`, `index.ts`
3. Create `hooks/useSelfInferencingNodes.ts` (generic hook)
4. Update `PipelineBuilder.tsx` to use the generic hook with genie behavior
5. **Test**: Verify genie conversations still work
6. **Bonus**: Add a second self-inferencing node type to validate the pattern

### Phase 5: Final Cleanup
1. Move `getDefaultConfig` to `lib/nodeDefaults.ts`
2. Move `generateNodeId` to a utility file
3. Review and clean up any remaining coupled code
4. **Test**: Full regression test

Each phase can be tested independently before moving to the next.

---

## Testing Strategy

### Unit Tests

Each hook and service should have unit tests:

```typescript
// hooks/usePipelineState.test.ts
describe("usePipelineState", () => {
  it("should add a node", () => { ... });
  it("should remove a node and clean up state", () => { ... });
  it("should not remove the fixed system prompt", () => { ... });
});

// services/inference/promptBuilder.test.ts
describe("buildSystemPrompt", () => {
  it("should include URL context", () => { ... });
  it("should include genie conversations when enabled", () => { ... });
  it("should exclude genie conversations when disabled", () => { ... });
});
```

### Integration Tests

Test the composed `PipelineBuilder`:

```typescript
describe("PipelineBuilder", () => {
  it("should add a node when dragging from palette", () => { ... });
  it("should run inference and route tool calls", () => { ... });
  it("should handle genie self-inference", () => { ... });
});
```

---

## File Creation Checklist

### Hooks
- [ ] `src/hooks/usePipelineState.ts`
- [ ] `src/hooks/usePipelineDragDrop.ts`
- [ ] `src/hooks/useSelfInferencingNodes.ts` (generic, replaces useGenieState)
- [ ] `src/hooks/useURLLoader.ts`

### Services
- [ ] `src/services/inference/index.ts`
- [ ] `src/services/inference/promptBuilder.ts`
- [ ] `src/services/inference/toolRouter.ts`
- [ ] `src/services/inference/api.ts`

### Types
- [ ] `src/types/selfInferencing.ts`

### Node Interfaces (Self-Inferencing Behaviors)
- [ ] `src/lib/nodeInterfaces/types.ts`
- [ ] `src/lib/nodeInterfaces/genieBehavior.ts`
- [ ] `src/lib/nodeInterfaces/index.ts` (registry)

### Utilities
- [ ] `src/lib/nodeDefaults.ts`

### Refactored Components
- [ ] `src/components/builder/PipelineBuilder.tsx` (reduced to ~100 lines)
