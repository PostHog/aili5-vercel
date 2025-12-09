import { useState, useCallback } from "react";
import type { URLContextItem } from "@/types/pipeline";

export interface URLLoaderState {
  urlContexts: Record<string, URLContextItem>;
  loadingUrlNodeIds: Set<string>;
}

export interface URLLoaderActions {
  loadURL: (nodeId: string, url: string, label?: string) => Promise<void>;
  clearContext: (nodeId: string) => void;
  setUrlContext: (nodeId: string, context: URLContextItem) => void;
}

export function useURLLoader(): URLLoaderState & URLLoaderActions {
  const [urlContexts, setUrlContexts] = useState<Record<string, URLContextItem>>({});
  const [loadingUrlNodeIds, setLoadingUrlNodeIds] = useState<Set<string>>(new Set());

  const loadURL = useCallback(async (nodeId: string, url: string, label?: string) => {
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
  }, []);

  const clearContext = useCallback((nodeId: string) => {
    setUrlContexts((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  const setUrlContext = useCallback((nodeId: string, context: URLContextItem) => {
    setUrlContexts((prev) => ({ ...prev, [nodeId]: context }));
  }, []);

  return {
    urlContexts,
    loadingUrlNodeIds,
    loadURL,
    clearContext,
    setUrlContext,
  };
}
