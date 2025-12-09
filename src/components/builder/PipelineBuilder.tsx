"use client";

import { useState, useCallback } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import type { PipelineNodeConfig, InferenceConfig, TextOutput } from "@/types/pipeline";
import { getToolsForDownstreamNodes } from "@/lib/tools";
import { usePipelineState } from "@/hooks/usePipelineState";
import { usePipelineDragDrop } from "@/hooks/usePipelineDragDrop";
import { useURLLoader } from "@/hooks/useURLLoader";
import { useGenieState } from "@/hooks/useGenieState";
import { buildSystemPrompt } from "@/services/inference/promptBuilder";
import { routeToolCalls } from "@/services/inference/toolRouter";
import { runInference } from "@/services/inference/api";
import { ModulePalette, MODULE_DEFINITIONS, SYSTEM_PROMPT_MODULE } from "./ModulePalette";
import { PipelineCanvas } from "./PipelineCanvas";
import styles from "./PipelineBuilder.module.css";

export function PipelineBuilder() {
  // Compose hooks
  const pipeline = usePipelineState();
  const urlLoader = useURLLoader();

  const dragDrop = usePipelineDragDrop({
    nodes: pipeline.nodes,
    onAddNode: pipeline.addNode,
    onReorderNodes: pipeline.reorderNodes,
  });

  // Loading state
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);

  // Wrapper for buildSystemPrompt that uses current state
  const buildSystemPromptWrapper = useCallback(
    (nodeIndex: number, additionalPrompt?: string, includeGenies: boolean = true): string => {
      const precedingNodes = pipeline.nodes.slice(0, nodeIndex);
      return buildSystemPrompt(
        pipeline.systemPromptConfig.prompt,
        precedingNodes,
        pipeline.genieConversations,
        urlLoader.urlContexts,
        pipeline.userInputs,
        { additionalPrompt, includeGenieConversations: includeGenies }
      );
    },
    [
      pipeline.nodes,
      pipeline.systemPromptConfig.prompt,
      pipeline.genieConversations,
      pipeline.userInputs,
      urlLoader.urlContexts,
    ]
  );

  const genie = useGenieState({
    nodes: pipeline.nodes,
    genieConversations: pipeline.genieConversations,
    setGenieConversation: pipeline.setGenieConversation,
    setGenieBackstoryUpdate: pipeline.setGenieBackstoryUpdate,
    setNodes: pipeline.setNodes,
    setLoadingNodeId,
    buildSystemPrompt: buildSystemPromptWrapper,
  });

  // Main inference handler
  const handleRunInference = useCallback(
    async (inferenceNodeId: string) => {
      // Build the full node list including fixed system prompt
      const fullNodes: PipelineNodeConfig[] = [
        {
          id: "system-prompt-fixed",
          type: "system_prompt",
          config: pipeline.systemPromptConfig,
        },
        ...pipeline.nodes,
      ];

      const nodeIndex = fullNodes.findIndex((n) => n.id === inferenceNodeId);
      if (nodeIndex === -1) return;

      const inferenceNode = fullNodes[nodeIndex];
      const inferenceConfig = inferenceNode.config as InferenceConfig;

      // Get user input from the inference node itself
      const userMessage = pipeline.userInputs[inferenceNodeId] || "";
      if (!userMessage.trim()) {
        console.error("No user input provided");
        return;
      }

      // Get preceding nodes for context
      const precedingNodes = fullNodes.slice(0, nodeIndex);

      // Get tools for preceding output nodes (use fullNodes with correct index)
      const { tools, nodeIdByToolName } = getToolsForDownstreamNodes(fullNodes, nodeIndex);

      // Build system prompt from preceding nodes
      const systemPrompt =
        buildSystemPrompt(
          pipeline.systemPromptConfig.prompt,
          precedingNodes,
          pipeline.genieConversations,
          urlLoader.urlContexts,
          pipeline.userInputs,
          { includeGenieConversations: true }
        ) || "You are a helpful assistant.";

      // Debug logging
      console.log("=== Inference Debug ===");
      console.log("System prompt length:", systemPrompt.length);
      console.log("Tools count:", tools.length);
      console.log("Tools:", JSON.stringify(tools, null, 2));
      console.log("nodeIdByToolName:", nodeIdByToolName);
      console.log(
        "Preceding nodes:",
        precedingNodes.map((n) => ({ id: n.id, type: n.type }))
      );

      setLoadingNodeId(inferenceNodeId);

      try {
        const result = await runInference({
          systemPrompt,
          userMessage,
          model: inferenceConfig.model,
          temperature: inferenceConfig.temperature,
          tools: tools.length > 0 ? tools : undefined,
        });

        console.log("=== Inference Result ===");
        console.log("result.response:", result.response);
        console.log("result.toolCalls:", result.toolCalls);
        console.log("result.error:", result.error);

        if (result.error) {
          console.error("Inference error:", result.error);
          return;
        }

        // Store text response in the inference node itself
        if (result.response) {
          pipeline.setOutput(inferenceNodeId, { content: result.response } as TextOutput);
        }

        // Route tool call results to their target output nodes
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log("Routing tool calls...");
          const outputs = routeToolCalls(result.toolCalls, nodeIdByToolName);
          console.log("Routed outputs:", outputs);
          Object.entries(outputs).forEach(([id, output]) => {
            console.log(`Setting output for node ${id}:`, output);
            pipeline.setOutput(id, output);
          });
        } else {
          console.log("No tool calls received");
        }

        // Process genie backstory updates
        genie.processBackstoryUpdates(precedingNodes, result);
      } catch (error) {
        console.error("Failed to run inference:", error);
      } finally {
        setLoadingNodeId(null);
      }
    },
    [pipeline, urlLoader.urlContexts, genie]
  );

  // Compose all nodes (fixed system prompt + user-added nodes)
  const allNodes: PipelineNodeConfig[] = [
    {
      id: "system-prompt-fixed",
      type: "system_prompt",
      config: pipeline.systemPromptConfig,
    },
    ...pipeline.nodes,
  ];

  // Find module info for drag overlay
  const activeModule = dragDrop.activeType
    ? dragDrop.activeType === "system_prompt"
      ? SYSTEM_PROMPT_MODULE
      : MODULE_DEFINITIONS.find((m) => m.type === dragDrop.activeType)
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
          genieConversations={pipeline.genieConversations}
          onGenieSelfInference={genie.selfInference}
          onGenieSaveBackstory={genie.saveBackstory}
          genieBackstoryUpdates={pipeline.genieBackstoryUpdates}
          onGenieClearUpdate={pipeline.clearGenieUpdate}
        />
        <ModulePalette />
      </div>

      <DragOverlay>
        {activeModule && (
          <div
            className={styles.dragOverlay}
            style={
              {
                "--module-color": activeModule.color,
              } as React.CSSProperties
            }
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
