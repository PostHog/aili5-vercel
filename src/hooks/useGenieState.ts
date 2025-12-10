import { useCallback } from "react";
import type { PipelineNodeConfig, GenieConfig, GenieOutput, URLContextItem } from "@/types/pipeline";
import { runInference, type InferenceResult } from "@/services/inference/api";
import { parseBlockOutput } from "@/lib/blockParsers";
import { usePipelineStore, type PipelineStore } from "@/store/pipelineStore";
import { buildSystemPrompt, type PipelineContext } from "@/services/inference/promptBuilder";

export interface GenieStateActions {
  selfInference: (nodeId: string, userMessage: string, skipAddingUserMessage?: boolean) => Promise<void>;
  saveBackstory: (nodeId: string) => Promise<void>;
  processBackstoryUpdates: (precedingNodes: PipelineNodeConfig[], response: InferenceResult, nodeIdByToolName?: Record<string, string>) => void;
  addSystemMessage: (nodeId: string, message: string) => void;
}

// Helper functions to get/set genie state from nodeState
export function getGenieConversation(store: PipelineStore, nodeId: string): GenieOutput | null {
  return (store.getNodeState(nodeId, "genie:conversation") as GenieOutput) || null;
}

function setGenieConversation(store: PipelineStore, nodeId: string, conversation: GenieOutput): void {
  store.setNodeState(nodeId, "genie:conversation", conversation);
}

export function getGenieBackstoryUpdate(store: PipelineStore, nodeId: string): boolean {
  return (store.getNodeState(nodeId, "genie:backstoryUpdate") as boolean) || false;
}

function setGenieBackstoryUpdate(store: PipelineStore, nodeId: string, hasUpdate: boolean): void {
  store.setNodeState(nodeId, "genie:backstoryUpdate", hasUpdate);
}

export function clearGenieUpdate(store: PipelineStore, nodeId: string): void {
  store.clearNodeState(nodeId, "genie:backstoryUpdate");
}

/**
 * Hook for managing genie-specific state and behaviors
 */
export function useGenieState(): GenieStateActions {
  const store = usePipelineStore();

  /**
   * Handle genie self-inference (independent from main pipeline)
   * @param skipAddingUserMessage - If true, don't add userMessage to conversation (used when message was already added as system)
   */
  const selfInference = useCallback(
    async (nodeId: string, userMessage: string, skipAddingUserMessage = false) => {
      const genieNode = store.nodes.find((n) => n.id === nodeId);
      if (!genieNode || genieNode.type !== "genie") return;

      const genieNodeIndex = store.nodes.findIndex((n) => n.id === nodeId);
      const genieConfig = genieNode.config as GenieConfig;
      const conversation = getGenieConversation(store, nodeId) || { messages: [] };

      // Build genie's own identity prompt
      let genieIdentityPrompt = `You are ${genieConfig.name}. Act as ${genieConfig.name} would act. ${genieConfig.backstory}`;

      // Add this genie's own conversation history if it exists
      if (conversation.messages.length > 0) {
        genieIdentityPrompt += "\n\nYour previous conversation:\n";
        for (const msg of conversation.messages) {
          if (msg.role === "user") {
            genieIdentityPrompt += `User: ${msg.content}\n`;
          } else if (msg.role === "system") {
            genieIdentityPrompt += `System: ${msg.content}\n`;
          } else {
            genieIdentityPrompt += `${genieConfig.name}: ${msg.content}\n`;
          }
        }
      }

      // Build pipeline context for preceding nodes
      const pipelineContext: PipelineContext = {
        nodes: store.nodes, // outputs are now nested in nodes
        genieConversations: {},
        urlContexts: {},
        userInputs: store.userInputs,
      };

      // Gather genie conversations
      store.nodes.forEach((node) => {
        if (node.type === "genie") {
          const conv = getGenieConversation(store, node.id);
          if (conv) pipelineContext.genieConversations[node.id] = conv;
        }
      });

      // Gather URL contexts
      store.nodes.forEach((node) => {
        if (node.type === "url_loader") {
          const context = store.getNodeState(node.id, "url:context") as URLContextItem | undefined;
          if (context) pipelineContext.urlContexts[node.id] = context;
        }
      });

      // Build system prompt from preceding nodes + genie identity
      const systemPrompt = buildSystemPrompt(
        store.systemPromptConfig.prompt,
        store.nodes.slice(0, genieNodeIndex),
        pipelineContext,
        { additionalPrompt: genieIdentityPrompt }
      );

      store.setLoadingNodeId(nodeId);

      try {
        const result = await runInference({
          systemPrompt,
          userMessage,
          model: genieConfig.model,
          temperature: genieConfig.temperature,
        });

        if (result.error) {
          console.error("Genie inference error:", result.error);
          return;
        }

        // Update conversation with assistant response (and optionally user message)
        const newMessages: GenieOutput["messages"] = skipAddingUserMessage
          ? [{ role: "assistant" as const, content: result.response! }]
          : [
              { role: "user" as const, content: userMessage },
              { role: "assistant" as const, content: result.response! },
            ];

        const updatedMessages: GenieOutput["messages"] = [
          ...conversation.messages,
          ...newMessages,
        ];

        setGenieConversation(store, nodeId, { messages: updatedMessages });
      } catch (error) {
        console.error("Failed to run genie inference:", error);
      } finally {
        store.setLoadingNodeId(null);
      }
    },
    [store]
  );

  /**
   * Handle saving genie backstory (triggers initial response)
   */
  const saveBackstory = useCallback(
    async (nodeId: string) => {
      const genieNode = store.nodes.find((n) => n.id === nodeId);
      if (!genieNode || genieNode.type !== "genie") return;

      const genieNodeIndex = store.nodes.findIndex((n) => n.id === nodeId);
      const genieConfig = genieNode.config as GenieConfig;

      // Build genie's identity prompt with introduction request
      const genieIdentityPrompt = `You are ${genieConfig.name}. Act as ${genieConfig.name} would act. ${genieConfig.backstory}. Introduce yourself.`;

      // Build pipeline context for preceding nodes
      const pipelineContext: PipelineContext = {
        nodes: store.nodes, // outputs are now nested in nodes
        genieConversations: {},
        urlContexts: {},
        userInputs: store.userInputs,
      };

      // Gather genie conversations
      store.nodes.forEach((node) => {
        if (node.type === "genie") {
          const conv = getGenieConversation(store, node.id);
          if (conv) pipelineContext.genieConversations[node.id] = conv;
        }
      });

      // Gather URL contexts
      store.nodes.forEach((node) => {
        if (node.type === "url_loader") {
          const context = store.getNodeState(node.id, "url:context") as URLContextItem | undefined;
          if (context) pipelineContext.urlContexts[node.id] = context;
        }
      });

      // Build system prompt from preceding nodes + genie identity
      const systemPrompt = buildSystemPrompt(
        store.systemPromptConfig.prompt,
        store.nodes.slice(0, genieNodeIndex),
        pipelineContext,
        { additionalPrompt: genieIdentityPrompt }
      );

      store.setLoadingNodeId(nodeId);

      try {
        const result = await runInference({
          systemPrompt,
          userMessage: "Introduce yourself.",
          model: genieConfig.model,
          temperature: genieConfig.temperature,
        });

        if (result.error) {
          console.error("Genie introduction error:", result.error);
          return;
        }

        // Initialize conversation with introduction
        setGenieConversation(store, nodeId, {
          messages: [
            { role: "user", content: "Introduce yourself." },
            { role: "assistant", content: result.response! },
          ],
        });
      } catch (error) {
        console.error("Failed to get genie introduction:", error);
      } finally {
        store.setLoadingNodeId(null);
      }
    },
    [store]
  );

  /**
   * Add a system message to a genie's conversation and trigger response
   */
  const addSystemMessage = useCallback(
    (nodeId: string, message: string) => {
      const genieNode = store.nodes.find((n) => n.id === nodeId);
      if (!genieNode || genieNode.type !== "genie") return;

      const currentConversation = getGenieConversation(store, nodeId) || { messages: [] };
      const systemMessage = {
        role: "system" as const,
        content: message,
      };
      const updatedMessages: GenieOutput["messages"] = [...currentConversation.messages, systemMessage];

      setGenieConversation(store, nodeId, { messages: updatedMessages });
      setGenieBackstoryUpdate(store, nodeId, true);

      // Immediately trigger genie to respond to the system message
      // Skip adding user message since we already added it as system message
      selfInference(nodeId, message, true);
    },
    [store, selfInference]
  );

  /**
   * Process genie backstory updates from inference response
   */
  const processBackstoryUpdates = useCallback(
    (precedingNodes: PipelineNodeConfig[], response: InferenceResult, nodeIdByToolName?: Record<string, string>) => {
      // Process genie updates from tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const targetNodeId = nodeIdByToolName?.[toolCall.toolName];
          if (!targetNodeId) continue;

          const node = precedingNodes.find((n) => n.id === targetNodeId);
          if (!node || node.type !== "genie") continue;

          const genieConfig = node.config as GenieConfig;
          const input = toolCall.input as { backstory?: string; message?: string };

          // Update backstory if provided
          if (input.backstory) {
            store.setNodes((prev) =>
              prev.map((n) =>
                n.id === targetNodeId
                  ? { ...n, config: { ...genieConfig, backstory: input.backstory! } }
                  : n
              )
            );
            setGenieBackstoryUpdate(store, targetNodeId, true);

            // Auto-respond if enabled
            if (genieConfig.autoRespondOnUpdate) {
              setTimeout(() => {
                selfInference(targetNodeId, "Your backstory has been updated. Say something new.");
              }, 500);
            }
          }

          // Update conversation if message provided (legacy tool call handling)
          if (input.message) {
            addSystemMessage(targetNodeId, input.message);
          }
        }
      }

      // Also check text response for legacy pattern
      const inferenceResponse = {
        response: response.response || "",
        toolCalls: response.toolCalls || [],
        error: response.error,
      };

      for (const node of precedingNodes) {
        if (node.type === "genie") {
          const update = parseBlockOutput<{ backstory?: string; shouldAutoRespond?: boolean }>(
            "genie",
            inferenceResponse,
            node.id
          );
          if (update?.backstory) {
            const genieConfig = node.config as GenieConfig;
            store.setNodes((prev) =>
              prev.map((n) =>
                n.id === node.id
                  ? { ...n, config: { ...genieConfig, backstory: update.backstory! } }
                  : n
              )
            );
            setGenieBackstoryUpdate(store, node.id, true);
            if (update.shouldAutoRespond && genieConfig.autoRespondOnUpdate) {
              setTimeout(() => {
                selfInference(node.id, "Your backstory has been updated. Say something new.");
              }, 500);
            }
          }
        }
      }
    },
    [store, selfInference, addSystemMessage]
  );

  return {
    selfInference,
    saveBackstory,
    processBackstoryUpdates,
    addSystemMessage,
  };
}
