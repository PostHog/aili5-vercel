import { useState, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type {
  PipelineNodeConfig,
  NodeConfigByType,
  SystemPromptConfig,
  TextOutput,
  IconOutput,
  ColorOutput,
  GaugeOutput,
  GenieOutput,
  URLContextItem,
} from "@/types/pipeline";

// Output types union
export type OutputData = TextOutput | IconOutput | ColorOutput | GaugeOutput | null;

export interface PipelineState {
  systemPromptConfig: SystemPromptConfig;
  nodes: PipelineNodeConfig[];
  outputs: Record<string, OutputData>;
  userInputs: Record<string, string>;
  genieConversations: Record<string, GenieOutput>;
  genieBackstoryUpdates: Record<string, boolean>;
  urlContexts: Record<string, URLContextItem>;
}

export interface PipelineStateActions {
  setSystemPromptConfig: (config: SystemPromptConfig) => void;
  addNode: (node: PipelineNodeConfig, insertIndex?: number) => void;
  removeNode: (nodeId: string) => void;
  updateConfig: (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => void;
  reorderNodes: (oldIndex: number, newIndex: number) => void;
  setOutput: (nodeId: string, output: OutputData) => void;
  setUserInput: (nodeId: string, value: string) => void;
  setGenieConversation: (nodeId: string, conversation: GenieOutput) => void;
  setGenieBackstoryUpdate: (nodeId: string, hasUpdate: boolean) => void;
  clearGenieUpdate: (nodeId: string) => void;
  setUrlContext: (nodeId: string, context: URLContextItem) => void;
  clearUrlContext: (nodeId: string) => void;
  setNodes: React.Dispatch<React.SetStateAction<PipelineNodeConfig[]>>;
}

export function usePipelineState(): PipelineState & PipelineStateActions {
  const [systemPromptConfig, setSystemPromptConfig] = useState<SystemPromptConfig>({
    prompt: "You are a helpful assistant.",
  });
  const [nodes, setNodes] = useState<PipelineNodeConfig[]>([]);
  const [outputs, setOutputs] = useState<Record<string, OutputData>>({});
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [genieConversations, setGenieConversations] = useState<Record<string, GenieOutput>>({});
  const [genieBackstoryUpdates, setGenieBackstoryUpdates] = useState<Record<string, boolean>>({});
  const [urlContexts, setUrlContexts] = useState<Record<string, URLContextItem>>({});

  const addNode = useCallback((node: PipelineNodeConfig, insertIndex?: number) => {
    setNodes((prev) => {
      if (insertIndex === undefined) return [...prev, node];
      return [...prev.slice(0, insertIndex), node, ...prev.slice(insertIndex)];
    });
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    // Cannot remove the fixed system prompt
    if (nodeId === "system-prompt-fixed") return;

    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    // Clean up associated state
    setUserInputs((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setOutputs((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setUrlContexts((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    // Clean up genie state
    setGenieConversations((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setGenieBackstoryUpdates((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  const updateConfig = useCallback(
    (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => {
      // Handle system prompt config separately
      if (nodeId === "system-prompt-fixed") {
        setSystemPromptConfig(config as SystemPromptConfig);
        return;
      }
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, config } : n)));
    },
    []
  );

  const reorderNodes = useCallback((oldIndex: number, newIndex: number) => {
    setNodes((prev) => arrayMove(prev, oldIndex, newIndex));
  }, []);

  const setOutput = useCallback((nodeId: string, output: OutputData) => {
    setOutputs((prev) => ({ ...prev, [nodeId]: output }));
  }, []);

  const setUserInput = useCallback((nodeId: string, value: string) => {
    setUserInputs((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  const setGenieConversation = useCallback((nodeId: string, conversation: GenieOutput) => {
    setGenieConversations((prev) => ({ ...prev, [nodeId]: conversation }));
  }, []);

  const setGenieBackstoryUpdate = useCallback((nodeId: string, hasUpdate: boolean) => {
    setGenieBackstoryUpdates((prev) => ({ ...prev, [nodeId]: hasUpdate }));
  }, []);

  const clearGenieUpdate = useCallback((nodeId: string) => {
    setGenieBackstoryUpdates((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  const setUrlContext = useCallback((nodeId: string, context: URLContextItem) => {
    setUrlContexts((prev) => ({ ...prev, [nodeId]: context }));
  }, []);

  const clearUrlContext = useCallback((nodeId: string) => {
    setUrlContexts((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  return {
    // State
    systemPromptConfig,
    nodes,
    outputs,
    userInputs,
    genieConversations,
    genieBackstoryUpdates,
    urlContexts,
    // Actions
    setSystemPromptConfig,
    addNode,
    removeNode,
    updateConfig,
    reorderNodes,
    setOutput,
    setUserInput,
    setGenieConversation,
    setGenieBackstoryUpdate,
    clearGenieUpdate,
    setUrlContext,
    clearUrlContext,
    setNodes,
  };
}
