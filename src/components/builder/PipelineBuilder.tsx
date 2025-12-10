"use client";

import { useState, useCallback } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import type { PipelineNodeConfig, InferenceConfig, TextOutput, GenieOutput, GenieConfig } from "@/types/pipeline";
import { getToolsForDownstreamNodes, isGenieMessageTool } from "@/lib/tools";
import { usePipelineDragDrop } from "@/hooks/usePipelineDragDrop";
import { useGenieState } from "@/hooks/useGenieState";
import { useURLLoader } from "@/hooks/useURLLoader";
import { buildSystemPrompt } from "@/services/inference/promptBuilder";
import { routeToolCalls } from "@/services/inference/toolRouter";
import { runInference, runStreamingInference, type ImageData } from "@/services/inference/api";
import { usePipelineStore } from "@/store/pipelineStore";
import { getGenieConversation, getGenieBackstoryUpdate } from "@/hooks/useGenieState";
import { parseBlockOutput } from "@/lib/blockParsers";
import type { GenieUpdate } from "@/components/builder/nodes/GenieNodeEditor";
import { ModulePalette, MODULE_DEFINITIONS, SYSTEM_PROMPT_MODULE } from "./ModulePalette";
import { PipelineCanvas } from "./PipelineCanvas";
import { ContextInspector } from "./ContextInspector";
import { InspectorConnector } from "./InspectorConnector";
import { TutorialModal } from "./TutorialModal";
import type { NodeType } from "@/types/pipeline";
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

  // Context inspector state
  const [inspectorState, setInspectorState] = useState<{
    isOpen: boolean;
    targetNodeId: string | null;
  }>({ isOpen: false, targetNodeId: null });
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // Tutorial modal state
  const [tutorialState, setTutorialState] = useState<{
    isOpen: boolean;
    nodeType: NodeType | null;
  }>({ isOpen: false, nodeType: null });

  // Streaming state for inference nodes
  const [streamingState, setStreamingState] = useState<{
    nodeId: string | null;
    text: string;
    isStreaming: boolean;
  }>({ nodeId: null, text: "", isStreaming: false });

  const toggleInspector = useCallback((nodeId: string) => {
    setInspectorState((prev) => {
      // If inspector is open for this node, close it
      if (prev.isOpen && prev.targetNodeId === nodeId) {
        setHighlightedNodeId(null);
        return { isOpen: false, targetNodeId: null };
      }
      // Otherwise open it for this node
      return { isOpen: true, targetNodeId: nodeId };
    });
  }, []);

  const closeInspector = useCallback(() => {
    setInspectorState({ isOpen: false, targetNodeId: null });
    setHighlightedNodeId(null);
  }, []);

  // Tutorial handlers
  const handleOpenTutorial = useCallback((nodeType: string) => {
    setTutorialState({ isOpen: true, nodeType: nodeType as NodeType });
  }, []);

  const handleCloseTutorial = useCallback(() => {
    setTutorialState({ isOpen: false, nodeType: null });
  }, []);

  // Helper to build pipeline context from current state
  const buildPipelineContext = useCallback(() => {
    const genieConvos: Record<string, GenieOutput> = {};
    store.nodes.forEach((node) => {
      if (node.type === "genie") {
        const conv = getGenieConversation(store, node.id);
        if (conv) genieConvos[node.id] = conv;
      }
    });

    return {
      nodes: store.nodes, // outputs are now nested in nodes
      genieConversations: genieConvos,
      urlContexts: urlLoader.urlContexts,
      userInputs: store.userInputs,
    };
  }, [store, urlLoader.urlContexts]);

  // Wrapper for buildSystemPrompt that uses current state
  const buildSystemPromptWrapper = useCallback(
    (nodeIndex: number, additionalPrompt?: string): string => {
      const precedingNodes = store.nodes.slice(0, nodeIndex);
      const context = buildPipelineContext();

      return buildSystemPrompt(
        store.systemPromptConfig.prompt,
        precedingNodes,
        context,
        { additionalPrompt }
      );
    },
    [store, buildPipelineContext]
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
      let userMessage = store.userInputs[inferenceNodeId] || "";
      if (!userMessage.trim()) {
        console.error("No user input provided");
        return;
      }

      // Get preceding nodes for context
      const precedingNodes = fullNodes.slice(0, nodeIndex);

      // Get tools for preceding output nodes (use fullNodes with correct index)
      const { tools, nodeIdByToolName } = getToolsForDownstreamNodes(fullNodes, nodeIndex);

      // Filter out genie update tools (but keep genie message tools - LLM needs them to send messages to genies)
      // Put genie message tools FIRST to prioritize them
      const nonGenieTools = tools.filter(
        (tool) => !tool.name.startsWith("update_genie_") && !isGenieMessageTool(tool.name)
      );
      const genieMessageTools = tools.filter(
        (tool) => isGenieMessageTool(tool.name)
      );
      const filteredTools = [...genieMessageTools, ...nonGenieTools];

      // If genie tools are available and user mentions genie, add a reminder to the user message
      const genieToolNamesForUser = filteredTools.filter(t => isGenieMessageTool(t.name)).map(t => t.name);
      if (genieToolNamesForUser.length > 0 && (userMessage.toLowerCase().includes('genie') || userMessage.toLowerCase().includes('bobskin') || userMessage.toLowerCase().includes('send') || userMessage.toLowerCase().includes('message'))) {
        userMessage += `\n\nRemember: If you want to send a message to a genie, you MUST call the ${genieToolNamesForUser.join(" or ")} tool. Do not just say you will send a message - actually call the tool.`;
      }

      // Build system prompt from preceding nodes using unified context
      const pipelineContext = buildPipelineContext();
      let systemPrompt =
        buildSystemPrompt(
          store.systemPromptConfig.prompt,
          precedingNodes,
          pipelineContext
        ) || "You are a helpful assistant.";

      // Add explicit instruction about using tools if genie tools are available
      const genieToolNames = filteredTools.filter(t => isGenieMessageTool(t.name)).map(t => t.name);
      if (genieToolNames.length > 0) {
        systemPrompt += `\n\n${"#".repeat(60)}
# MANDATORY TOOL USAGE INSTRUCTIONS
${"#".repeat(60)}

You MUST call the ${genieToolNames.join(", ")} tool(s) to send messages to genies.

CRITICAL RULES:
1. If you mention sending a message to a genie, you MUST call the tool
2. Saying "I'll send a message" without calling the tool is a FAILURE
3. You MUST call ALL relevant tools, not just one
4. The genie message tool is the HIGHEST PRIORITY tool

WHEN RESPONDING:
- Call ${genieToolNames[0]} tool FIRST before any other tools
- Include your message to the genie in the "message" parameter
- THEN call other tools like display_color or display_icon

DO NOT skip the genie tool. DO NOT just use other tools without also using the genie tool.
${"#".repeat(60)}`;
      }

      // Gather images from paint nodes in the preceding context
      const images: ImageData[] = [];
      for (const node of precedingNodes) {
        if (node.type === "paint") {
          const imageData = store.userInputs[node.id];
          if (imageData && imageData.startsWith("data:image/png;base64,")) {
            // Extract base64 data from data URL
            const base64Data = imageData.replace("data:image/png;base64,", "");
            images.push({
              type: "base64",
              mediaType: "image/png",
              data: base64Data,
            });
          }
        }
      }

      store.setLoadingNodeId(inferenceNodeId);

      // Check if we have tools or images - if so, use non-streaming (tool calls don't stream well, images need special handling)
      const hasTools = filteredTools.length > 0;
      const hasImages = images.length > 0;

      if (hasTools || hasImages) {
        // Use non-streaming for tool calls and images
        try {
          const result = await runInference({
            systemPrompt,
            userMessage,
            model: inferenceConfig.model,
            temperature: inferenceConfig.temperature,
            tools: filteredTools.length > 0 ? filteredTools : undefined,
            images: images.length > 0 ? images : undefined,
          });

          if (result.error) {
            console.error("Inference error:", result.error);
            return;
          }

          // Store text response in the inference node itself
          if (result.response) {
            store.setOutput(inferenceNodeId, { content: result.response } as TextOutput);
          }

          // Process genie updates from tool calls (handles both backstory updates AND messages)
          genie.processBackstoryUpdates(precedingNodes, result, nodeIdByToolName);

          // Also check for legacy backstory updates using parseBlockOutput
          const inferenceResponse = {
            response: result.response || "",
            toolCalls: result.toolCalls || [],
            error: result.error,
          };

          for (const node of precedingNodes) {
            if (node.type === "genie") {
              const genieUpdate = parseBlockOutput<GenieUpdate>("genie", inferenceResponse, node.id);
              if (genieUpdate?.backstory) {
                const genieConfig = node.config as GenieConfig;
                store.setNodes((prev) =>
                  prev.map((n) =>
                    n.id === node.id
                      ? { ...n, config: { ...genieConfig, backstory: genieUpdate.backstory! } }
                      : n
                  )
                );
                genie.processBackstoryUpdates([node], result, nodeIdByToolName);
              }
            }
          }

          // Route tool call results to their target output nodes
          if (result.toolCalls && result.toolCalls.length > 0) {
            const nonGenieToolCalls = result.toolCalls.filter(
              (tc) => !tc.toolName.startsWith("update_genie_") && !isGenieMessageTool(tc.toolName)
            );

            if (nonGenieToolCalls.length > 0) {
              const outputs = routeToolCalls(nonGenieToolCalls, nodeIdByToolName, fullNodes, inferenceResponse);
              for (const [id, output] of Object.entries(outputs)) {
                store.setOutput(id, output);
              }
            }
          }
        } catch (error) {
          console.error("Failed to run inference:", error);
        } finally {
          store.setLoadingNodeId(null);
        }
      } else {
        // Use streaming for simple text responses
        setStreamingState({ nodeId: inferenceNodeId, text: "", isStreaming: true });

        try {
          let fullResponse = "";
          
          await runStreamingInference(
            {
              systemPrompt,
              userMessage,
              model: inferenceConfig.model,
              temperature: inferenceConfig.temperature,
            },
            // onChunk - accumulate text
            (chunk) => {
              fullResponse += chunk;
              setStreamingState((prev) => ({
                ...prev,
                text: fullResponse,
              }));
            },
            // onDone - save final output
            () => {
              store.setOutput(inferenceNodeId, { content: fullResponse } as TextOutput);
              setStreamingState({ nodeId: null, text: "", isStreaming: false });
              store.setLoadingNodeId(null);
            },
            // onError
            (error) => {
              console.error("Streaming error:", error);
              setStreamingState({ nodeId: null, text: "", isStreaming: false });
              store.setLoadingNodeId(null);
            }
          );
        } catch (error) {
          console.error("Failed to run streaming inference:", error);
          setStreamingState({ nodeId: null, text: "", isStreaming: false });
          store.setLoadingNodeId(null);
        }
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

  // Get all nodes and target index for inspector
  const getInspectorData = useCallback(
    (targetNodeId: string) => {
      const nodeIndex = allNodes.findIndex((n) => n.id === targetNodeId);
      if (nodeIndex === -1) return { allNodes: [], targetNodeIndex: -1, targetNodeColor: undefined };
      const targetNode = allNodes[nodeIndex];
      const moduleInfo = MODULE_DEFINITIONS.find((m) => m.type === targetNode.type);
      return { allNodes, targetNodeIndex: nodeIndex, targetNodeColor: moduleInfo?.color };
    },
    [allNodes]
  );

  const inspectorData = inspectorState.targetNodeId
    ? getInspectorData(inspectorState.targetNodeId)
    : { allNodes: [], targetNodeIndex: -1, targetNodeColor: undefined };

  return (
    <DndContext
      sensors={dragDrop.sensors}
      collisionDetection={dragDrop.collisionDetection}
      onDragStart={dragDrop.handleDragStart}
      onDragOver={dragDrop.handleDragOver}
      onDragEnd={dragDrop.handleDragEnd}
    >
      <div className={`${styles.builder} ${inspectorState.isOpen ? styles.inspectorOpen : ""}`}>
        <ContextInspector
          isOpen={inspectorState.isOpen}
          onClose={closeInspector}
          targetNodeId={inspectorState.targetNodeId || ""}
          targetNodeColor={inspectorData.targetNodeColor}
          systemPromptConfig={store.systemPromptConfig}
          allNodes={inspectorData.allNodes}
          targetNodeIndex={inspectorData.targetNodeIndex}
          genieConversations={genieConversations}
          urlContexts={urlLoader.urlContexts}
          userInputs={store.userInputs}
          onHoverSection={setHighlightedNodeId}
        />
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
          // outputs are now nested in nodes
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
          highlightedNodeId={highlightedNodeId}
          inspectedNodeId={inspectorState.isOpen ? inspectorState.targetNodeId : null}
          onInspectContext={toggleInspector}
          onOpenTutorial={handleOpenTutorial}
        />
        <ModulePalette onOpenTutorial={handleOpenTutorial} />
        <InspectorConnector
          isOpen={inspectorState.isOpen}
          targetNodeId={inspectorState.targetNodeId}
          color={inspectorData.targetNodeColor}
        />
      </div>

      <TutorialModal
        isOpen={tutorialState.isOpen}
        onClose={handleCloseTutorial}
        nodeType={tutorialState.nodeType}
      />

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
