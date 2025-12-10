import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { arrayMove } from "@dnd-kit/sortable";
import type {
  PipelineNodeConfig,
  NodeConfigByType,
  SystemPromptConfig,
  TextOutput,
  IconOutput,
  ColorOutput,
  GaugeOutput,
} from "@/types/pipeline";

// Output types union
export type OutputData = TextOutput | IconOutput | ColorOutput | GaugeOutput | null;

// Storage key
const STORAGE_KEY = "aili5-pipeline-state";

// Debounce timer
let saveTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 500;

// Serializable state (for localStorage)
interface SerializableState {
  systemPromptConfig: SystemPromptConfig;
  nodes: PipelineNodeConfig[];
  outputs: Record<string, OutputData>;
  userInputs: Record<string, string>;
  // Generic node-specific state (e.g., genie conversations, url contexts, etc.)
  nodeState: Record<string, unknown>;
}

// Full state interface
interface PipelineState extends SerializableState {
  loadingNodeId: string | null;
  loadingNodeIds: Set<string>;
}

interface PipelineActions {
  // System prompt
  setSystemPromptConfig: (config: SystemPromptConfig) => void;

  // Nodes
  addNode: (node: PipelineNodeConfig, insertIndex?: number) => void;
  removeNode: (nodeId: string) => void;
  updateConfig: (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => void;
  reorderNodes: (oldIndex: number, newIndex: number) => void;
  setNodes: (nodes: PipelineNodeConfig[] | ((prev: PipelineNodeConfig[]) => PipelineNodeConfig[])) => void;

  // Outputs
  setOutput: (nodeId: string, output: OutputData) => void;

  // User inputs
  setUserInput: (nodeId: string, value: string) => void;

  // Generic node state (for any node-specific state like genie conversations, url contexts, etc.)
  setNodeState: (nodeId: string, key: string, value: unknown) => void;
  getNodeState: (nodeId: string, key: string) => unknown;
  clearNodeState: (nodeId: string, key: string) => void;

  // Loading state
  setLoadingNodeId: (nodeId: string | null) => void;
  setLoadingNodeIdForNode: (nodeId: string, loading: boolean) => void;

  // Clear all
  clearPipeline: () => void;

  // Copy/Paste
  getSerializedPipeline: () => string;
  pastePipeline: (serializedState: string) => void;
}

type PipelineStore = PipelineState & PipelineActions;

// Helper to save to localStorage (debounced)
function saveToStorage(state: SerializableState) {
  if (typeof window === "undefined") return;
  
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    try {
      // Convert nodeState to serializable format (no special handling needed, JSON.stringify handles it)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }, DEBOUNCE_MS);
}

// Helper to load from localStorage
function loadFromStorage(): Partial<SerializableState> | null {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<SerializableState>;
    // Ensure nodeState exists
    if (!parsed.nodeState) {
      parsed.nodeState = {};
    }
    return parsed;
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
    return null;
  }
}

// Initial state
const initialState: SerializableState = {
  systemPromptConfig: { prompt: "You are a helpful assistant." },
  nodes: [],
  outputs: {},
  userInputs: {},
  nodeState: {},
};

// Load initial state from localStorage
const stored = loadFromStorage();
const initialSerializableState = stored ? { ...initialState, ...stored } : initialState;

export const usePipelineStore = create<PipelineStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...initialSerializableState,
    loadingNodeId: null,
    loadingNodeIds: new Set<string>(),

    // System prompt
    setSystemPromptConfig: (config) => {
      set({ systemPromptConfig: config });
      saveToStorage(get());
    },

    // Nodes
    addNode: (node, insertIndex) => {
      set((state) => {
        const newNodes =
          insertIndex === undefined
            ? [...state.nodes, node]
            : [...state.nodes.slice(0, insertIndex), node, ...state.nodes.slice(insertIndex)];
        saveToStorage({ ...state, nodes: newNodes });
        return { nodes: newNodes };
      });
    },

    removeNode: (nodeId) => {
      if (nodeId === "system-prompt-fixed") return;

      set((state) => {
        const newNodes = state.nodes.filter((n) => n.id !== nodeId);
        const newUserInputs = { ...state.userInputs };
        delete newUserInputs[nodeId];
        const newOutputs = { ...state.outputs };
        delete newOutputs[nodeId];
        const newNodeState = { ...state.nodeState };
        // Remove all state for this node
        Object.keys(newNodeState).forEach((k) => {
          if (k.startsWith(`${nodeId}:`)) {
            delete newNodeState[k];
          }
        });

        const newState = {
          nodes: newNodes,
          userInputs: newUserInputs,
          outputs: newOutputs,
          nodeState: newNodeState,
        };
        saveToStorage({ ...state, ...newState });
        return newState;
      });
    },

    updateConfig: (nodeId, config) => {
      if (nodeId === "system-prompt-fixed") {
        set({ systemPromptConfig: config as SystemPromptConfig });
        saveToStorage(get());
        return;
      }
      set((state) => {
        const newNodes = state.nodes.map((n) => (n.id === nodeId ? { ...n, config } : n));
        saveToStorage({ ...state, nodes: newNodes });
        return { nodes: newNodes };
      });
    },

    reorderNodes: (oldIndex, newIndex) => {
      set((state) => {
        const newNodes = arrayMove(state.nodes, oldIndex, newIndex);
        saveToStorage({ ...state, nodes: newNodes });
        return { nodes: newNodes };
      });
    },

    setNodes: (nodes) => {
      set((state) => {
        const newNodes = typeof nodes === "function" ? nodes(state.nodes) : nodes;
        saveToStorage({ ...state, nodes: newNodes });
        return { nodes: newNodes };
      });
    },

    // Outputs
    setOutput: (nodeId, output) => {
      set((state) => {
        const newOutputs = { ...state.outputs, [nodeId]: output };
        saveToStorage({ ...state, outputs: newOutputs });
        return { outputs: newOutputs };
      });
    },

    // User inputs
    setUserInput: (nodeId, value) => {
      set((state) => {
        const newUserInputs = { ...state.userInputs, [nodeId]: value };
        saveToStorage({ ...state, userInputs: newUserInputs });
        return { userInputs: newUserInputs };
      });
    },

    // Generic node state
    setNodeState: (nodeId, key, value) => {
      set((state) => {
        const newNodeState = {
          ...state.nodeState,
          [`${nodeId}:${key}`]: value,
        };
        saveToStorage({ ...state, nodeState: newNodeState });
        return { nodeState: newNodeState };
      });
    },

    getNodeState: (nodeId, key) => {
      return get().nodeState[`${nodeId}:${key}`];
    },

    clearNodeState: (nodeId, key) => {
      set((state) => {
        const newNodeState = { ...state.nodeState };
        delete newNodeState[`${nodeId}:${key}`];
        saveToStorage({ ...state, nodeState: newNodeState });
        return { nodeState: newNodeState };
      });
    },

    // Loading state
    setLoadingNodeId: (nodeId) => {
      set({ loadingNodeId: nodeId });
    },

    setLoadingNodeIdForNode: (nodeId, loading) => {
      set((state) => {
        const newSet = new Set(state.loadingNodeIds);
        if (loading) {
          newSet.add(nodeId);
        } else {
          newSet.delete(nodeId);
        }
        return { loadingNodeIds: newSet };
      });
    },

            // Clear all
            clearPipeline: () => {
              set({
                ...initialState,
                loadingNodeId: null,
                loadingNodeIds: new Set<string>(),
              });
              if (typeof window !== "undefined") {
                try {
                  localStorage.removeItem(STORAGE_KEY);
                } catch (error) {
                  console.error("Failed to clear localStorage:", error);
                }
              }
            },

            // Get serialized pipeline
            getSerializedPipeline: () => {
              const state = get();
              const serializableState: SerializableState = {
                systemPromptConfig: state.systemPromptConfig,
                nodes: state.nodes,
                outputs: state.outputs,
                userInputs: state.userInputs,
                nodeState: state.nodeState,
              };
              return JSON.stringify(serializableState, null, 2);
            },

            // Paste pipeline
            pastePipeline: (serializedState: string) => {
              try {
                const parsed = JSON.parse(serializedState) as Partial<SerializableState>;
                
                // Validate and set the state
                const newState: SerializableState = {
                  systemPromptConfig: parsed.systemPromptConfig || initialState.systemPromptConfig,
                  nodes: parsed.nodes || initialState.nodes,
                  outputs: parsed.outputs || initialState.outputs,
                  userInputs: parsed.userInputs || initialState.userInputs,
                  nodeState: parsed.nodeState || initialState.nodeState,
                };
                
                set({
                  ...newState,
                  loadingNodeId: null,
                  loadingNodeIds: new Set<string>(),
                });
                
                // Save to localStorage
                saveToStorage(newState);
              } catch (error) {
                console.error("Failed to paste pipeline:", error);
                throw error;
              }
            },
  }))
);

// Export store type for use in hooks
export type { PipelineStore };

