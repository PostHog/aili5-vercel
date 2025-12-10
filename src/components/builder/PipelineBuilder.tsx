"use client";

import { useCallback } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import type { PipelineNodeConfig, InferenceConfig, TextOutput, GenieOutput } from "@/types/pipeline";
import { getToolsForDownstreamNodes } from "@/lib/tools";
import { usePipelineDragDrop } from "@/hooks/usePipelineDragDrop";
import { useGenieState } from "@/hooks/useGenieState";
import { useURLLoader } from "@/hooks/useURLLoader";
import { buildSystemPrompt } from "@/services/inference/promptBuilder";
import { routeToolCalls } from "@/services/inference/toolRouter";
import { runInference } from "@/services/inference/api";
import { usePipelineStore } from "@/store/pipelineStore";
import { getGenieConversation, getGenieBackstoryUpdate } from "@/hooks/useGenieState";
import { ModulePalette, MODULE_DEFINITIONS, SYSTEM_PROMPT_MODULE } from "./ModulePalette";
import { PipelineCanvas } from "./PipelineCanvas";
import styles from "./PipelineBuilder.module.css";

export function PipelineBuilder() {
  // Use Zustand store
  const store = usePipelineStore();
  const genie = useGenieState();
  const urlLoader = useURLLoader();

  const dragDrop = usePipelineDragDrop({
    nodes: store.nodes,
    onAddNode: store.addNode,
    onReorderNodes: store.reorderNodes,
  });

  // Wrapper for buildSystemPrompt that uses current state
  const buildSystemPromptWrapper = useCallback(
    (nodeIndex: number, additionalPrompt?: string, includeGenies: boolean = true): string => {
      const precedingNodes = store.nodes.slice(0, nodeIndex);
      
      // Get genie conversations
      const genieConversations: Record<string, GenieOutput> = {};
      precedingNodes.forEach((node) => {
        if (node.type === "genie") {
          const conv = getGenieConversation(store, node.id);
          if (conv) genieConversations[node.id] = conv;
        }
      });

      return buildSystemPrompt(
        store.systemPromptConfig.prompt,
        precedingNodes,
        genieConversations,
        urlLoader.urlContexts,
        store.userInputs,
        { additionalPrompt, includeGenieConversations: includeGenies }
      );
    },
    [store, urlLoader.urlContexts]
  );

  // Main inference handler
  const handleRunInference = useCallback(
    async (inferenceNodeId: string) => {
      // Build the full node list including fixed system prompt
      const fullNodes: PipelineNodeConfig[] = [
        {
          id: "system-prompt-fixed",
          type: "system_prompt",
          config: store.systemPromptConfig,
        },
        ...store.nodes,
      ];

      const nodeIndex = fullNodes.findIndex((n) => n.id === inferenceNodeId);
      if (nodeIndex === -1) return;

      const inferenceNode = fullNodes[nodeIndex];
      const inferenceConfig = inferenceNode.config as InferenceConfig;

      // Get user input from the inference node itself
      const userMessage = store.userInputs[inferenceNodeId] || "";
      if (!userMessage.trim()) {
        console.error("No user input provided");
        return;
      }

      // Get preceding nodes for context
      const precedingNodes = fullNodes.slice(0, nodeIndex);

      // Get tools for preceding output nodes (use fullNodes with correct index)
      const { tools, nodeIdByToolName } = getToolsForDownstreamNodes(fullNodes, nodeIndex);

      // Filter out genie update tools from being passed to the LLM as regular output tools
      const filteredTools = tools.filter((tool) => !tool.name.startsWith("update_genie_"));

      // Get genie conversations
      const genieConversations: Record<string, GenieOutput> = {};
      precedingNodes.forEach((node) => {
        if (node.type === "genie") {
          const conv = getGenieConversation(store, node.id);
          if (conv) genieConversations[node.id] = conv;
        }
      });

      // Build system prompt from preceding nodes
      const systemPrompt =
        buildSystemPrompt(
          store.systemPromptConfig.prompt,
          precedingNodes,
          genieConversations,
          urlLoader.urlContexts,
          store.userInputs,
          { includeGenieConversations: true }
        ) || "You are a helpful assistant.";

      // Debug logging
      console.log("=== Inference Debug ===");
      console.log("System prompt length:", systemPrompt.length);
      console.log("Tools count:", filteredTools.length);
      console.log("Tools:", JSON.stringify(filteredTools, null, 2));
      console.log("nodeIdByToolName:", nodeIdByToolName);
      console.log(
        "Preceding nodes:",
        precedingNodes.map((n) => ({ id: n.id, type: n.type }))
      );

      store.setLoadingNodeId(inferenceNodeId);

      try {
        const result = await runInference({
          systemPrompt,
          userMessage,
          model: inferenceConfig.model,
          temperature: inferenceConfig.temperature,
          tools: filteredTools.length > 0 ? filteredTools : undefined,
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
          store.setOutput(inferenceNodeId, { content: result.response } as TextOutput);
        }

        // Process genie updates from tool calls (before routing other tool calls)
        genie.processBackstoryUpdates(precedingNodes, result, nodeIdByToolName);

        // Route tool call results to their target output nodes (excluding genie updates)
        if (result.toolCalls && result.toolCalls.length > 0) {
          // Filter out genie update tool calls
          const nonGenieToolCalls = result.toolCalls.filter(
            (tc) => !tc.toolName.startsWith("update_genie_")
          );

          if (nonGenieToolCalls.length > 0) {
            console.log("Routing tool calls...");
            const outputs = routeToolCalls(nonGenieToolCalls, nodeIdByToolName);
            console.log("Routed outputs:", outputs);
            Object.entries(outputs).forEach(([id, output]) => {
              console.log(`Setting output for node ${id}:`, output);
              store.setOutput(id, output);
            });
          } else {
            console.log("No non-genie tool calls received");
          }
        } else {
          console.log("No tool calls received");
        }
      } catch (error) {
        console.error("Failed to run inference:", error);
      } finally {
        store.setLoadingNodeId(null);
      }
    },
    [store, urlLoader.urlContexts, genie]
  );

  // Compose all nodes (fixed system prompt + user-added nodes)
  const allNodes: PipelineNodeConfig[] = [
    {
      id: "system-prompt-fixed",
      type: "system_prompt",
      config: store.systemPromptConfig,
    },
    ...store.nodes,
  ];

  // Get genie conversations and backstory updates for canvas
  const genieConversations: Record<string, GenieOutput> = {};
  const genieBackstoryUpdates: Record<string, boolean> = {};
  store.nodes.forEach((node) => {
    if (node.type === "genie") {
      const conv = getGenieConversation(store, node.id);
      if (conv) genieConversations[node.id] = conv;
      const hasUpdate = getGenieBackstoryUpdate(store, node.id);
      if (hasUpdate) genieBackstoryUpdates[node.id] = true;
    }
  });

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
          onRemoveNode={store.removeNode}
          onConfigChange={store.updateConfig}
          userInputs={store.userInputs}
          onUserInputChange={store.setUserInput}
          onRunInference={handleRunInference}
          onLoadURL={urlLoader.loadURL}
          loadingNodeId={store.loadingNodeId}
          loadingUrlNodeIds={urlLoader.loadingUrlNodeIds}
          outputs={store.outputs}
          urlContexts={urlLoader.urlContexts}
          activeNodeId={dragDrop.activeId}
          overNodeId={dragDrop.overId}
          genieConversations={genieConversations}
          onGenieSelfInference={genie.selfInference}
          onGenieSaveBackstory={genie.saveBackstory}
          genieBackstoryUpdates={genieBackstoryUpdates}
          onGenieClearUpdate={(nodeId) => {
            store.clearNodeState(nodeId, "genie:backstoryUpdate");
          }}
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
