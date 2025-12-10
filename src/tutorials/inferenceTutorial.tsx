"use client";

import { useState } from "react";
import { InferenceNodeEditor } from "@/components/builder/nodes/InferenceNodeEditor";
import { TokenVisualizer } from "./components/TokenVisualizer";
import { ContextWindow } from "./components/ContextWindow";
import type { InferenceConfig, TextOutput } from "@/types/pipeline";
import { runInference } from "@/services/inference/api";
import styles from "./Tutorial.module.css";

export function InferenceTutorial() {
  const [config, setConfig] = useState<InferenceConfig>({
    model: "claude-sonnet-4-20250514",
    temperature: 0.4,
  });
  const [userInput, setUserInput] = useState("What is a butterfly?");
  const [output, setOutput] = useState<TextOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTokenAnimation, setShowTokenAnimation] = useState(false);
  const [contextItems, setContextItems] = useState<string[]>([
    "System Prompt: You are a helpful assistant",
  ]);

  const handleRun = async () => {
    setLoading(true);
    setOutput(null);
    setShowTokenAnimation(false);

    try {
      const result = await runInference({
        systemPrompt: "You are a helpful assistant.",
        userMessage: userInput,
        model: config.model,
        temperature: config.temperature,
      });

      if (result.response) {
        setOutput({ content: result.response });
        setShowTokenAnimation(true);
        setContextItems((prev) => [...prev, `User: ${userInput}`, `Assistant: ${result.response.slice(0, 50)}...`]);
      }
    } catch (error) {
      console.error("Inference error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is an Inference Node?</h3>
          <p>
            The Inference node runs the language model. It takes your message and generates a response
            using the model's understanding of language.
          </p>
        </div>

        <div className={styles.section}>
          <h3>Temperature</h3>
          <p>
            Temperature controls creativity. Lower values (0-0.3) are focused and predictable.
            Higher values (0.7-1.0) are creative and varied.
          </p>
          <div className={styles.temperatureDemo}>
            <div className={styles.temperatureExample}>
              <strong>Temperature 0.0:</strong> "The butterfly is an insect with wings."
            </div>
            <div className={styles.temperatureExample}>
              <strong>Temperature 1.0:</strong> "Butterflies! Those fluttering rainbows of the sky, dancing on flower petals..."
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3>Context Window</h3>
          <p>
            The context window shows what information the model has access to. Each node before
            the inference node adds to this context.
          </p>
          <ContextWindow items={contextItems} maxItems={5} />
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <div className={styles.liveDemo}>
            <InferenceNodeEditor
              config={config}
              onChange={setConfig}
              userInput={userInput}
              onUserInputChange={setUserInput}
              onRun={handleRun}
              loading={loading}
              output={output}
            />
          </div>
        </div>

        {output && showTokenAnimation && (
          <div className={styles.section}>
            <h3>Token Generation</h3>
            <p>
              The model generates text one token at a time. Watch how the response builds up:
            </p>
            <TokenVisualizer text={output.content} speed={50} />
          </div>
        )}
      </div>
    </div>
  );
}
