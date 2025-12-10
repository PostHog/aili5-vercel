"use client";

import { useState, useRef } from "react";
import { Loader2, Check, AlertCircle, ExternalLink } from "lucide-react";
import type { URLLoaderConfig, URLContextItem } from "@/types/pipeline";
import styles from "./NodeEditor.module.css";

interface URLLoaderNodeEditorProps {
  config: URLLoaderConfig;
  onChange: (config: URLLoaderConfig) => void;
  urlContext: URLContextItem | null;
  onLoadURL: (nodeId: string, url: string, label?: string) => void;
  nodeId: string;
  loading: boolean;
}

export function URLLoaderNodeEditor({
  config,
  onChange,
  urlContext,
  onLoadURL,
  nodeId,
  loading,
}: URLLoaderNodeEditorProps) {
  const [urlInput, setUrlInput] = useState(config.url || "");
  const lastLoadedUrl = useRef(config.url || "");

  const handleBlur = () => {
    const trimmedUrl = urlInput.trim();
    if (trimmedUrl && trimmedUrl !== lastLoadedUrl.current) {
      onChange({ ...config, url: trimmedUrl });
      lastLoadedUrl.current = trimmedUrl;
      onLoadURL(nodeId, trimmedUrl, config.label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  const isLoaded = urlContext && !urlContext.error;
  const hasError = urlContext?.error;

  // Truncate content for preview
  const contentPreview = urlContext?.content
    ? urlContext.content.length > 300
      ? urlContext.content.slice(0, 300) + "..."
      : urlContext.content
    : null;

  return (
    <div className={styles.nodeEditor}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`url-${nodeId}`}>
          URL
        </label>
        <input
          id={`url-${nodeId}`}
          type="url"
          className={styles.input}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com/page"
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`url-label-${nodeId}`}>
          Label (optional)
        </label>
        <input
          id={`url-label-${nodeId}`}
          type="text"
          className={styles.input}
          value={config.label || ""}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g., Documentation, Reference"
        />
      </div>

      <div className={styles.urlStatus}>
        {loading ? (
          <div className={styles.urlLoading}>
            <Loader2 size={14} className={styles.spinnerIcon} />
            <span>Fetching content...</span>
          </div>
        ) : hasError ? (
          <div className={styles.urlError}>
            <AlertCircle size={14} />
            <span>{urlContext.error}</span>
          </div>
        ) : isLoaded ? (
          <div className={styles.urlLoaded}>
            <div className={styles.urlLoadedHeader}>
              <Check size={14} />
              <span>Content loaded</span>
              <a
                href={urlContext.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.urlLink}
              >
                <ExternalLink size={12} />
              </a>
            </div>
            {contentPreview && (
              <div className={styles.urlPreview}>
                <pre>{contentPreview}</pre>
              </div>
            )}
            <span className={styles.urlSize}>
              {urlContext.content.length.toLocaleString()} characters
            </span>
          </div>
        ) : (
          <div className={styles.urlEmpty}>
            Enter a URL to load content into context
          </div>
        )}
      </div>
    </div>
  );
}
