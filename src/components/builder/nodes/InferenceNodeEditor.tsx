"use client";

import type { InferenceConfig, TextOutput } from "@/types/pipeline";
import { AVAILABLE_MODELS } from "@/types/pipeline";
import styles from "./NodeEditor.module.css";

interface InferenceNodeEditorProps {
  config: InferenceConfig;
  onChange: (config: InferenceConfig) => void;
  userInput: string;
  onUserInputChange: (value: string) => void;
  onRun: () => void;
  loading: boolean;
  output: TextOutput | null;
}

export function InferenceNodeEditor({
  config,
  onChange,
  userInput,
  onUserInputChange,
  onRun,
  loading,
  output,
}: InferenceNodeEditorProps) {
  const canRun = userInput.trim().length > 0;

  return (
    <div className={styles.nodeEditor}>
      <textarea
        className={styles.textarea}
        value={userInput}
        onChange={(e) => onUserInputChange(e.target.value)}
        placeholder="Enter your message..."
        rows={3}
        disabled={loading}
      />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="model-select">
          Model
        </label>
        <select
          id="model-select"
          className={styles.select}
          value={config.model}
          onChange={(e) => onChange({ ...config, model: e.target.value })}
          disabled={loading}
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="temperature-slider">
          Temperature: {config.temperature.toFixed(1)}
        </label>
        <input
          id="temperature-slider"
          type="range"
          className={styles.slider}
          min="0"
          max="1"
          step="0.1"
          value={config.temperature}
          onChange={(e) =>
            onChange({ ...config, temperature: parseFloat(e.target.value) })
          }
          disabled={loading}
        />
        <div className={styles.sliderLabels}>
          <span>Focused</span>
          <span>Creative</span>
        </div>
      </div>

      <button
        className={styles.runButton}
        onClick={onRun}
        disabled={loading || !canRun}
      >
        {loading ? (
          <>
            <span className={styles.spinner} />
            Running...
          </>
        ) : (
          "Run"
        )}
      </button>

      <div className={styles.outputContainer}>
        {loading ? (
          <div className={styles.loadingOutput}>
            <span className={styles.spinner} />
            Generating response...
          </div>
        ) : output?.content ? (
          <div className={styles.response}>{output.content}</div>
        ) : (
          <div className={styles.emptyState}>
            Response will appear here
          </div>
        )}
      </div>
    </div>
  );
}
