"use client";

import type { SystemPromptConfig } from "@/types/pipeline";
import styles from "./NodeEditor.module.css";

interface SystemPromptNodeEditorProps {
  config: SystemPromptConfig;
  onChange: (config: SystemPromptConfig) => void;
}

export function SystemPromptNodeEditor({ config, onChange }: SystemPromptNodeEditorProps) {
  return (
    <div className={styles.nodeEditor}>
      <p className={styles.hint}>
        Sets the tone, behavior and identity for the robot. Be as descriptive or whimsical as you like.
      </p>
      <textarea
        className={styles.textarea}
        value={config.prompt}
        onChange={(e) => onChange({ ...config, prompt: e.target.value })}
        placeholder="You are a helpful assistant..."
        rows={4}
      />
    </div>
  );
}
