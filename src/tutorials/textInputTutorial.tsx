"use client";

import { useState } from "react";
import { TextInputNodeEditor } from "@/components/builder/nodes/TextInputNodeEditor";
import { ContextWindow } from "./components/ContextWindow";
import type { TextInputConfig } from "@/types/pipeline";
import styles from "./Tutorial.module.css";

export function TextInputTutorial() {
  const [config, setConfig] = useState<TextInputConfig>({
    label: "Additional Context",
    placeholder: "Enter text to add to context...",
  });
  const [value, setValue] = useState("");
  const [contextItems, setContextItems] = useState<string[]>([
    "System Prompt: You are a helpful assistant",
  ]);

  const handleAddToContext = () => {
    if (value.trim()) {
      setContextItems((prev) => [...prev, `${config.label || "Text"}: ${value}`]);
      setValue("");
    }
  };

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a Text Input Node?</h3>
          <p>
            The Text Input node lets you add custom text to the pipeline's context. This text will
            be available to all inference nodes that come after it.
          </p>
        </div>

        <div className={styles.section}>
          <h3>Context Window</h3>
          <p>
            Watch how your text input gets added to the context window. This context is available
            to downstream inference nodes.
          </p>
          <ContextWindow items={contextItems} maxItems={5} />
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            Text Input nodes are useful for adding static information, instructions, or examples
            to your pipeline. The text you enter becomes part of the context that flows through
            your pipeline, making it available to the model when generating responses.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <div className={styles.liveDemo}>
            <TextInputNodeEditor
              config={config}
              onChange={setConfig}
              value={value}
              onValueChange={setValue}
              nodeId="tutorial-text-input"
            />
            <button
              className={styles.addButton}
              onClick={handleAddToContext}
              disabled={!value.trim()}
            >
              Add to Context
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
