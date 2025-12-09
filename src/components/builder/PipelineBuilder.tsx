"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type {
  PipelineNodeConfig,
  NodeType,
  NodeConfigByType,
  TextOutput,
  IconOutput,
  ColorOutput,
  GaugeOutput,
  InferenceConfig,
  SystemPromptConfig,
  URLLoaderConfig,
  TextInputConfig,
  URLContextItem,
} from "@/types/pipeline";
import { getToolsForDownstreamNodes } from "@/lib/tools";
import { generateBlockMetadata } from "@/lib/blockParsers";
import { ModulePalette, MODULE_DEFINITIONS, SYSTEM_PROMPT_MODULE } from "./ModulePalette";
import { PipelineCanvas } from "./PipelineCanvas";
import styles from "./PipelineBuilder.module.css";

// Output types union
type OutputData = TextOutput | IconOutput | ColorOutput | GaugeOutput | null;

// Generate unique IDs
let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node-${++nodeIdCounter}-${Date.now()}`;
}

// Default configs for each node type
function getDefaultConfig(type: NodeType): NodeConfigByType[NodeType] {
  switch (type) {
    case "system_prompt":
      return { prompt: "You are a helpful assistant." };
    case "user_input":
      return { placeholder: "Enter your message..." };
    case "url_loader":
      return { url: "" };
    case "text_input":
      return { label: "", placeholder: "Enter text to add to context..." };
    case "inference":
      return { model: "claude-sonnet-4-20250514", temperature: 0.7 };
    case "text_display":
      return { label: "Response" };
    case "color_display":
      return { showHex: true };
    case "icon_display":
      return { size: "md" };
    case "gauge_display":
      return { style: "bar", showValue: true };
    case "pixel_art_display":
      return { pixelSize: 24 };
    case "webhook_trigger":
      return { showResponse: true };
    case "survey":
      return { style: "buttons" };
    default:
      return {} as NodeConfigByType[NodeType];
  }
}

interface DragData {
  type: NodeType;
  fromPalette?: boolean;
}

// Fixed system prompt node that's always present
const SYSTEM_PROMPT_NODE: PipelineNodeConfig = {
  id: "system-prompt-fixed",
  type: "system_prompt",
  config: { prompt: "You are a helpful assistant." },
};

export function PipelineBuilder() {
  // System prompt is stored separately and always exists
  const [systemPromptConfig, setSystemPromptConfig] = useState<SystemPromptConfig>({
    prompt: "You are a helpful assistant.",
  });

  // Other nodes (excludes system prompt)
  const [nodes, setNodes] = useState<PipelineNodeConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<NodeType | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // State for user inputs (keyed by node id)
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});

  // State for outputs (keyed by node id)
  const [outputs, setOutputs] = useState<Record<string, OutputData>>({});

  // State for URL context (keyed by node id)
  const [urlContexts, setUrlContexts] = useState<Record<string, URLContextItem>>({});

  // Loading state for inference
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);

  // Loading state for URL loaders (keyed by node id)
  const [loadingUrlNodeIds, setLoadingUrlNodeIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom collision detection that works better for vertical lists
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First try pointerWithin for precise drops
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // Fall back to rectIntersection for edge cases
    return rectIntersection(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeIdStr = active.id as string;
    setActiveId(activeIdStr);

    const data = active.data.current as DragData | undefined;
    if (data?.type) {
      setActiveType(data.type);
    } else {
      // Dragging an existing node - find its type
      const existingNode = nodes.find((n) => n.id === activeIdStr);
      if (existingNode) {
        setActiveType(existingNode.type);
      }
    }
  }, [nodes]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
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
      // Don't allow adding system_prompt from palette (it's fixed)
      if (activeData.type === "system_prompt") return;

      const newNode: PipelineNodeConfig = {
        id: generateNodeId(),
        type: activeData.type,
        config: getDefaultConfig(activeData.type),
      };

      // Find insertion index (account for fixed system prompt at index 0)
      if (over.id === "pipeline-canvas") {
        // Dropped on canvas - add to end
        setNodes((prev) => [...prev, newNode]);
      } else if (over.id === "system-prompt-fixed") {
        // Dropped on system prompt - insert at beginning
        setNodes((prev) => [newNode, ...prev]);
      } else {
        // Dropped on existing node - insert before it
        setNodes((prev) => {
          const overIndex = prev.findIndex((n) => n.id === over.id);
          if (overIndex === -1) return [...prev, newNode];
          return [
            ...prev.slice(0, overIndex),
            newNode,
            ...prev.slice(overIndex),
          ];
        });
      }
      return;
    }

    // Reordering existing nodes (system prompt cannot be reordered)
    if (active.id !== over.id && active.id !== "system-prompt-fixed") {
      // If trying to move before system prompt, ignore
      if (over.id === "system-prompt-fixed") return;

      setNodes((prev) => {
        const oldIndex = prev.findIndex((n) => n.id === active.id);
        const newIndex = prev.findIndex((n) => n.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleRemoveNode = useCallback((id: string) => {
    // Cannot remove the fixed system prompt
    if (id === "system-prompt-fixed") return;

    setNodes((prev) => prev.filter((n) => n.id !== id));
    // Clean up associated state
    setUserInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setOutputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setUrlContexts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleConfigChange = useCallback(
    (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => {
      // Handle system prompt config separately
      if (nodeId === "system-prompt-fixed") {
        setSystemPromptConfig(config as SystemPromptConfig);
        return;
      }
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, config } : n))
      );
    },
    []
  );

  const handleUserInputChange = useCallback((nodeId: string, value: string) => {
    setUserInputs((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  const handleLoadURL = useCallback(
    async (nodeId: string, url: string, label?: string) => {
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
            [nodeId]: {
              url,
              label,
              content: "",
              error: data.error,
            },
          }));
        } else {
          setUrlContexts((prev) => ({
            ...prev,
            [nodeId]: {
              url: data.url,
              label,
              content: data.content,
            },
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setUrlContexts((prev) => ({
          ...prev,
          [nodeId]: {
            url,
            label,
            content: "",
            error: message,
          },
        }));
      } finally {
        setLoadingUrlNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }
    },
    []
  );

  const handleRunInference = useCallback(
    async (inferenceNodeId: string) => {
      // Build the full node list including fixed system prompt
      const fullNodes: PipelineNodeConfig[] = [
        {
          id: "system-prompt-fixed",
          type: "system_prompt",
          config: systemPromptConfig,
        },
        ...nodes,
      ];

      const nodeIndex = fullNodes.findIndex((n) => n.id === inferenceNodeId);
      if (nodeIndex === -1) return;

      const inferenceNode = fullNodes[nodeIndex];
      const inferenceConfig = inferenceNode.config as InferenceConfig;

      // Get user input from the inference node itself
      const userMessage = userInputs[inferenceNodeId] || "";
      if (!userMessage.trim()) {
        console.error("No user input provided");
        return;
      }

      // Gather context from preceding nodes
      const precedingNodes = fullNodes.slice(0, nodeIndex);

      // System prompt is always at the start
      let systemPrompt = systemPromptConfig.prompt;

      // Get tools for preceding output nodes
      const { tools, nodeIdByToolName } = getToolsForDownstreamNodes(nodes, nodeIndex);

      // Generate block metadata from output nodes and append to system prompt
      // This tells the LLM what output blocks are available and how to use them
      for (const node of precedingNodes) {
        const metadata = generateBlockMetadata(node.type, node.config, node.id);
        if (metadata) {
          systemPrompt += metadata;
        }
      }

      // Gather URL context from preceding URL loader nodes
      const urlContextItems: URLContextItem[] = [];
      for (const node of precedingNodes) {
        if (node.type === "url_loader") {
          const ctx = urlContexts[node.id];
          if (ctx && ctx.content && !ctx.error) {
            urlContextItems.push(ctx);
          }
        }
      }

      // Append URL context to system prompt
      if (urlContextItems.length > 0) {
        systemPrompt += "\n\n## Reference Content\n";
        systemPrompt += "The following content has been loaded for context:\n\n";
        for (const item of urlContextItems) {
          const label = item.label || item.url;
          systemPrompt += `### ${label}\n`;
          systemPrompt += `Source: ${item.url}\n\n`;
          systemPrompt += item.content;
          systemPrompt += "\n\n---\n\n";
        }
      }

      // Gather text input content from preceding text_input nodes
      const textInputItems: { label: string; content: string }[] = [];
      for (const node of precedingNodes) {
        if (node.type === "text_input") {
          const content = userInputs[node.id];
          if (content && content.trim()) {
            const config = node.config as TextInputConfig;
            textInputItems.push({
              label: config.label || "Text",
              content: content.trim(),
            });
          }
        }
      }

      // Append text input content to system prompt
      if (textInputItems.length > 0) {
        systemPrompt += "\n\n## Additional Context\n";
        systemPrompt += "The following text has been provided for context:\n\n";
        for (const item of textInputItems) {
          systemPrompt += `### ${item.label}\n`;
          systemPrompt += item.content;
          systemPrompt += "\n\n---\n\n";
        }
      }

      // Debug logging
      console.log("=== Inference Debug ===");
      console.log("System prompt length:", systemPrompt.length);
      console.log("URL contexts state:", urlContexts);
      console.log("URL context items found:", urlContextItems.length);
      console.log("Preceding nodes:", precedingNodes.map(n => ({ id: n.id, type: n.type })));
      console.log("Full system prompt:", systemPrompt);

      setLoadingNodeId(inferenceNodeId);

      try {
        const response = await fetch("/api/inference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt,
            userMessage,
            model: inferenceConfig.model,
            temperature: inferenceConfig.temperature,
            tools: tools.length > 0 ? tools : undefined,
          }),
        });

        const data = await response.json();

        if (data.error) {
          console.error("Inference error:", data.error);
          return;
        }

        // Store text response in the inference node itself
        if (data.response) {
          setOutputs((prev) => ({
            ...prev,
            [inferenceNodeId]: { content: data.response } as TextOutput,
          }));
        }

        // Route tool call results to their target output nodes
        if (data.toolCalls && data.toolCalls.length > 0) {
          const newOutputs: Record<string, OutputData> = {};

          for (const toolCall of data.toolCalls) {
            const targetNodeId = nodeIdByToolName[toolCall.toolName];
            if (targetNodeId) {
              // Store the tool call input as the output for the target node
              newOutputs[targetNodeId] = toolCall.input as OutputData;
            }
          }

          if (Object.keys(newOutputs).length > 0) {
            setOutputs((prev) => ({ ...prev, ...newOutputs }));
          }
        }
      } catch (error) {
        console.error("Failed to run inference:", error);
      } finally {
        setLoadingNodeId(null);
      }
    },
    [nodes, userInputs, urlContexts, systemPromptConfig]
  );

  // Find module info for drag overlay
  const activeModule = activeType
    ? (activeType === "system_prompt"
        ? SYSTEM_PROMPT_MODULE
        : MODULE_DEFINITIONS.find((m) => m.type === activeType))
    : null;

  // Combined nodes: fixed system prompt + user-added nodes
  const allNodes: PipelineNodeConfig[] = [
    {
      id: "system-prompt-fixed",
      type: "system_prompt",
      config: systemPromptConfig,
    },
    ...nodes,
  ];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.builder}>
        <PipelineCanvas
          nodes={allNodes}
          onRemoveNode={handleRemoveNode}
          onConfigChange={handleConfigChange}
          userInputs={userInputs}
          onUserInputChange={handleUserInputChange}
          onRunInference={handleRunInference}
          onLoadURL={handleLoadURL}
          loadingNodeId={loadingNodeId}
          loadingUrlNodeIds={loadingUrlNodeIds}
          outputs={outputs}
          urlContexts={urlContexts}
          activeNodeId={activeId}
          overNodeId={overId}
        />
        <ModulePalette />
      </div>

      <DragOverlay>
        {activeModule && (
          <div
            className={styles.dragOverlay}
            style={{
              "--module-color": activeModule.color,
            } as React.CSSProperties}
          >
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
