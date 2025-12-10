"use client";

import { useState, useCallback } from "react";
import type { URLContextItem } from "@/types/pipeline";
import styles from "./Tutorial.module.css";

export function URLLoaderTutorial() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [urlContext, setUrlContext] = useState<URLContextItem | null>(null);

  const handleLoadURL = useCallback(async () => {
    if (!url.trim() || loading) return;

    setLoading(true);
    setUrlContext(null);

    try {
      const response = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.error) {
        setUrlContext({
          url,
          content: "",
          error: data.error,
        });
      } else {
        setUrlContext({
          url: data.url,
          content: data.content,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setUrlContext({
        url,
        content: "",
        error: message,
      });
    } finally {
      setLoading(false);
    }
  }, [url, loading]);

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a URL Loader?</h3>
          <p>
            The URL Loader fetches content from web pages and adds it to your pipeline's context.
            This is useful for RAG (Retrieval-Augmented Generation) - giving the model access to
            external information.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            When you load a URL, the content is fetched and stored. Any inference node that comes
            after this URL Loader will have access to this content in its context. This allows
            the model to answer questions about web pages, summarize articles, or use external
            information in its responses.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <p>Enter a URL to fetch its content:</p>
          <div className={styles.urlLoaderDemo}>
            <div className={styles.urlInputRow}>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoadURL()}
                placeholder="https://example.com"
                disabled={loading}
              />
              <button onClick={handleLoadURL} disabled={loading || !url.trim()}>
                {loading ? "Loading..." : "Fetch"}
              </button>
            </div>
          </div>
        </div>

        {urlContext && (
          <div className={styles.section}>
            <h3>{urlContext.error ? "Error" : "Loaded Content"}</h3>
            <div className={styles.urlPreview}>
              <div className={styles.urlPreviewHeader}>
                <strong>URL:</strong> {urlContext.url}
              </div>
              {urlContext.error ? (
                <div className={styles.urlPreviewError}>
                  ❌ {urlContext.error}
                </div>
              ) : (
                <>
                  <div className={styles.urlPreviewContent}>
                    {urlContext.content.slice(0, 500)}
                    {urlContext.content.length > 500 && "..."}
                  </div>
                  <div className={styles.urlPreviewFooter}>
                    ✅ {urlContext.content.length} characters loaded
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
