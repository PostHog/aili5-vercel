"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
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
} from "@/types/pipeline";
import { getToolsForDownstreamNodes } from "@/lib/tools";
import { generateBlockMetadata } from "@/lib/blockParsers";
import { ModulePalette, MODULE_DEFINITIONS } from "./ModulePalette";
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

export function PipelineBuilder() {
  const [nodes, setNodes] = useState<PipelineNodeConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<NodeType | null>(null);

  // State for user inputs (keyed by node id)
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});

  // State for outputs (keyed by node id)
  const [outputs, setOutputs] = useState<Record<string, OutputData>>({});

  // Loading state for inference
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    const data = active.data.current as DragData | undefined;
    if (data?.type) {
      setActiveType(data.type);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeData = active.data.current as DragData | undefined;

    // Dragging from palette - add new node
    if (activeData?.fromPalette && activeData.type) {
      const newNode: PipelineNodeConfig = {
        id: generateNodeId(),
        type: activeData.type,
        config: getDefaultConfig(activeData.type),
      };

      // Find insertion index
      if (over.id === "pipeline-canvas") {
        // Dropped on canvas - add to end
        setNodes((prev) => [...prev, newNode]);
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

    // Reordering existing nodes
    if (active.id !== over.id) {
      setNodes((prev) => {
        const oldIndex = prev.findIndex((n) => n.id === active.id);
        const newIndex = prev.findIndex((n) => n.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleRemoveNode = useCallback((id: string) => {
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
  }, []);

  const handleConfigChange = useCallback(
    (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, config } : n))
      );
    },
    []
  );

  const handleUserInputChange = useCallback((nodeId: string, value: string) => {
    setUserInputs((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  const handleRunInference = useCallback(
    async (inferenceNodeId: string) => {
      const nodeIndex = nodes.findIndex((n) => n.id === inferenceNodeId);
      if (nodeIndex === -1) return;

      const inferenceNode = nodes[nodeIndex];
      const inferenceConfig = inferenceNode.config as InferenceConfig;

      // Get user input from the inference node itself
      const userMessage = userInputs[inferenceNodeId] || "";
      if (!userMessage.trim()) {
        console.error("No user input provided");
        return;
      }

      // Gather context from preceding nodes
      const precedingNodes = nodes.slice(0, nodeIndex);

      // Find system prompt
      const systemPromptNode = precedingNodes.find((n) => n.type === "system_prompt");
      let systemPrompt = systemPromptNode
        ? (systemPromptNode.config as SystemPromptConfig).prompt
        : "You are a helpful assistant.";

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
    [nodes, userInputs]
  );

  // Find module info for drag overlay
  const activeModule = activeType
    ? MODULE_DEFINITIONS.find((m) => m.type === activeType)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.builder}>
        <PipelineCanvas
          nodes={nodes}
          onRemoveNode={handleRemoveNode}
          onConfigChange={handleConfigChange}
          userInputs={userInputs}
          onUserInputChange={handleUserInputChange}
          onRunInference={handleRunInference}
          loadingNodeId={loadingNodeId}
          outputs={outputs}
          activeNodeId={activeId}
        />
        <ModulePalette />
      </div>

      <DragOverlay>
        {activeModule && (
          <div className={styles.dragOverlay}>
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
