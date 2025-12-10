"use client";

import type { TextInputConfig } from "@/types/pipeline";
import styles from "./NodeEditor.module.css";

interface TextInputNodeEditorProps {
  config: TextInputConfig;
  onChange: (config: TextInputConfig) => void;
  value: string;
  onValueChange: (value: string) => void;
  nodeId: string;
}

export function TextInputNodeEditor({
  config,
  onChange,
  value,
  onValueChange,
  nodeId,
}: TextInputNodeEditorProps) {
  const characterCount = value.length;

  return (
    <div className={styles.nodeEditor}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`text-label-${nodeId}`}>
          Label (optional)
        </label>
        <input
          id={`text-label-${nodeId}`}
          type="text"
          className={styles.input}
          value={config.label || ""}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g., Background Info, Notes"
        />
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={`text-input-${nodeId}`}>
            {config.label || "Text"}
          </label>
          <span className={styles.characterCount}>
            {characterCount.toLocaleString()} characters
          </span>
        </div>
        <textarea
          id={`text-input-${nodeId}`}
          className={styles.textarea}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={config.placeholder || "Enter text to add to context..."}
          rows={4}
        />
      </div>
    </div>
  );
}
