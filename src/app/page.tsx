"use client";

import { useState } from "react";
import {
  SystemPromptNode,
  ModelSettingsNode,
  RunInferenceNode,
  OutputNode,
} from "@/components/pipeline";
import type { ModelId, InferenceRequest, InferenceResponse } from "@/types/pipeline";
import styles from "./page.module.css";

export default function Home() {
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [model, setModel] = useState<ModelId>("claude-sonnet-4-20250514");
  const [temperature, setTemperature] = useState(0.7);
  const [userMessage, setUserMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunInference = async () => {
    setLoading(true);
    setError(null);
    setResponse("");

    try {
      const requestBody: InferenceRequest = {
        systemPrompt,
        userMessage,
        model,
        temperature,
      };

      const res = await fetch("/api/inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data: InferenceResponse = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResponse(data.response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run inference");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>aili5</h1>
        <p className={styles.subtitle}>Learn how LLMs work by building a pipeline</p>
      </header>

      <main className={styles.pipeline}>
        <SystemPromptNode value={systemPrompt} onChange={setSystemPrompt} />

        <ModelSettingsNode
          model={model}
          temperature={temperature}
          onModelChange={setModel}
          onTemperatureChange={setTemperature}
        />

        <RunInferenceNode
          userMessage={userMessage}
          loading={loading}
          onUserMessageChange={setUserMessage}
          onRun={handleRunInference}
        />

        <OutputNode response={response} loading={loading} error={error} />
      </main>
    </div>
  );
}
