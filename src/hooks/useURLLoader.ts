import { useCallback } from "react";
import type { URLContextItem } from "@/types/pipeline";
import { usePipelineStore, type PipelineStore } from "@/store/pipelineStore";

export interface URLLoaderState {
  urlContexts: Record<string, URLContextItem>;
  loadingUrlNodeIds: Set<string>;
}

export interface URLLoaderActions {
  loadURL: (nodeId: string, url: string, label?: string) => Promise<void>;
  clearContext: (nodeId: string) => void;
  setUrlContext: (nodeId: string, context: URLContextItem) => void;
}

// Helper functions to get/set URL context from nodeState
export function getUrlContext(store: PipelineStore, nodeId: string): URLContextItem | null {
  return (store.getNodeState(nodeId, "url:context") as URLContextItem) || null;
}

function setUrlContext(store: PipelineStore, nodeId: string, context: URLContextItem): void {
  store.setNodeState(nodeId, "url:context", context);
}

export function useURLLoader(): URLLoaderState & URLLoaderActions {
  const store = usePipelineStore();

  // Get all URL contexts
  const urlContexts: Record<string, URLContextItem> = {};
  store.nodes.forEach((node) => {
    if (node.type === "url_loader") {
      const context = getUrlContext(store, node.id);
      if (context) urlContexts[node.id] = context;
    }
  });

  // Get loading state for URL nodes
  const loadingUrlNodeIds = new Set<string>();
  store.nodes.forEach((node) => {
    if (node.type === "url_loader" && store.loadingNodeIds.has(node.id)) {
      loadingUrlNodeIds.add(node.id);
    }
  });

  const loadURL = useCallback(
    async (nodeId: string, url: string, label?: string) => {
      if (!url) return;

      store.setLoadingNodeIdForNode(nodeId, true);

      try {
        const response = await fetch("/api/fetch-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (data.error) {
          setUrlContext(store, nodeId, {
            url,
            label,
            content: "",
            error: data.error,
          });
        } else {
          setUrlContext(store, nodeId, {
            url: data.url,
            label,
            content: data.content,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setUrlContext(store, nodeId, {
          url,
          label,
          content: "",
          error: message,
        });
      } finally {
        store.setLoadingNodeIdForNode(nodeId, false);
      }
    },
    [store]
  );

  const clearContext = useCallback(
    (nodeId: string) => {
      store.clearNodeState(nodeId, "url:context");
    },
    [store]
  );

  const setUrlContextCallback = useCallback(
    (nodeId: string, context: URLContextItem) => {
      setUrlContext(store, nodeId, context);
    },
    [store]
  );

  return {
    urlContexts,
    loadingUrlNodeIds,
    loadURL,
    clearContext,
    setUrlContext: setUrlContextCallback,
  };
}
