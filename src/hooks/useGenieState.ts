import { useCallback } from "react";
import type { PipelineNodeConfig, GenieConfig, GenieOutput } from "@/types/pipeline";
import { runInference, type InferenceResult } from "@/services/inference/api";
import { parseBlockOutput } from "@/lib/blockParsers";

interface UseGenieStateOptions {
  nodes: PipelineNodeConfig[];
  genieConversations: Record<string, GenieOutput>;
  setGenieConversation: (nodeId: string, conversation: GenieOutput) => void;
  setGenieBackstoryUpdate: (nodeId: string, hasUpdate: boolean) => void;
  setNodes: React.Dispatch<React.SetStateAction<PipelineNodeConfig[]>>;
  setLoadingNodeId: (nodeId: string | null) => void;
  buildSystemPrompt: (
    nodeIndex: number,
    additionalPrompt?: string,
    includeGenieConversations?: boolean
  ) => string;
}

export interface GenieStateActions {
  selfInference: (nodeId: string, userMessage: string) => Promise<void>;
  saveBackstory: (nodeId: string) => Promise<void>;
  processBackstoryUpdates: (precedingNodes: PipelineNodeConfig[], response: InferenceResult) => void;
}

/**
 * Hook for managing genie-specific state and behaviors
 */
export function useGenieState({
  nodes,
  genieConversations,
  setGenieConversation,
  setGenieBackstoryUpdate,
  setNodes,
  setLoadingNodeId,
  buildSystemPrompt,
}: UseGenieStateOptions): GenieStateActions {
  /**
   * Handle genie self-inference (independent from main pipeline)
   */
  const selfInference = useCallback(
    async (nodeId: string, userMessage: string) => {
      const genieNode = nodes.find((n) => n.id === nodeId);
      if (!genieNode || genieNode.type !== "genie") return;

      const genieNodeIndex = nodes.findIndex((n) => n.id === nodeId);
      const genieConfig = genieNode.config as GenieConfig;
      const conversation = genieConversations[nodeId] || { messages: [] };

      // Build genie's own identity prompt
      let genieIdentityPrompt = `You are ${genieConfig.name}. Act as ${genieConfig.name} would act. ${genieConfig.backstory}`;

      // Add this genie's own conversation history if it exists
      if (conversation.messages.length > 0) {
        genieIdentityPrompt += "\n\nYour previous conversation:\n";
        for (const msg of conversation.messages) {
          if (msg.role === "user") {
            genieIdentityPrompt += `User: ${msg.content}\n`;
          } else {
            genieIdentityPrompt += `${genieConfig.name}: ${msg.content}\n`;
          }
        }
      }

      // Build system prompt from preceding nodes + genie identity
      const systemPrompt = buildSystemPrompt(
        genieNodeIndex,
        genieIdentityPrompt,
        true // Include other genie conversations
      );

      setLoadingNodeId(nodeId);

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

        // Update conversation with user message and assistant response
        const updatedMessages = [
          ...conversation.messages,
          { role: "user" as const, content: userMessage },
          { role: "assistant" as const, content: result.response! },
        ];

        setGenieConversation(nodeId, { messages: updatedMessages });
      } catch (error) {
        console.error("Failed to run genie inference:", error);
      } finally {
        setLoadingNodeId(null);
      }
    },
    [nodes, genieConversations, setGenieConversation, setLoadingNodeId, buildSystemPrompt]
  );

  /**
   * Handle saving genie backstory (triggers initial response)
   */
  const saveBackstory = useCallback(
    async (nodeId: string) => {
      const genieNode = nodes.find((n) => n.id === nodeId);
      if (!genieNode || genieNode.type !== "genie") return;

      const genieNodeIndex = nodes.findIndex((n) => n.id === nodeId);
      const genieConfig = genieNode.config as GenieConfig;

      // Build genie's identity prompt with introduction request
      const genieIdentityPrompt = `You are ${genieConfig.name}. Act as ${genieConfig.name} would act. ${genieConfig.backstory}. Introduce yourself.`;

      // Build system prompt from preceding nodes + genie identity
      const systemPrompt = buildSystemPrompt(
        genieNodeIndex,
        genieIdentityPrompt,
        true // Include other genie conversations
      );

      setLoadingNodeId(nodeId);

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
        setGenieConversation(nodeId, {
          messages: [
            { role: "user", content: "Introduce yourself." },
            { role: "assistant", content: result.response! },
          ],
        });
      } catch (error) {
        console.error("Failed to get genie introduction:", error);
      } finally {
        setLoadingNodeId(null);
      }
    },
    [nodes, setGenieConversation, setLoadingNodeId, buildSystemPrompt]
  );

  /**
   * Process genie backstory updates from inference response
   */
  const processBackstoryUpdates = useCallback(
    (precedingNodes: PipelineNodeConfig[], response: InferenceResult) => {
      // Convert InferenceResult to the format expected by parseBlockOutput
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
            // Update genie config
            const genieConfig = node.config as GenieConfig;
            setNodes((prev) =>
              prev.map((n) =>
                n.id === node.id
                  ? { ...n, config: { ...genieConfig, backstory: update.backstory! } }
                  : n
              )
            );
            // Show notification
            setGenieBackstoryUpdate(node.id, true);
            // Auto-respond if enabled
            if (update.shouldAutoRespond && genieConfig.autoRespondOnUpdate) {
              setTimeout(() => {
                selfInference(node.id, "Your backstory has been updated. Say something new.");
              }, 500);
            }
          }
        }
      }
    },
    [setNodes, setGenieBackstoryUpdate, selfInference]
  );

  return {
    selfInference,
    saveBackstory,
    processBackstoryUpdates,
  };
}
