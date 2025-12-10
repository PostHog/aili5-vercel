import { PipelineNode } from "./PipelineNode";
import { AVAILABLE_MODELS, type ModelId } from "@/types/pipeline";
import styles from "./nodes.module.css";

interface ModelAndInferenceNodeProps {
  model: ModelId;
  temperature: number;
  userMessage: string;
  loading: boolean;
  onModelChange: (model: ModelId) => void;
  onTemperatureChange: (temperature: number) => void;
  onUserMessageChange: (value: string) => void;
  onRun: () => void;
}

export function ModelAndInferenceNode({
  model,
  temperature,
  userMessage,
  loading,
  onModelChange,
  onTemperatureChange,
  onUserMessageChange,
  onRun,
}: ModelAndInferenceNodeProps) {
  return (
    <PipelineNode
      title="Model & Inference"
      description="Configure the model and run your prompt"
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor="model-select">
          Model
        </label>
        <select
          id="model-select"
          className={styles.select}
          value={model}
          onChange={(e) => onModelChange(e.target.value as ModelId)}
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
          Temperature: {temperature.toFixed(1)}
        </label>
        <input
          id="temperature-slider"
          type="range"
          className={styles.slider}
          min="0"
          max="1"
          step="0.1"
          value={temperature}
          onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
          disabled={loading}
        />
        <div className={styles.sliderLabels}>
          <span>Focused</span>
          <span>Creative</span>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="user-message">
          Your Message
        </label>
        <textarea
          id="user-message"
          className={styles.textarea}
          value={userMessage}
          onChange={(e) => onUserMessageChange(e.target.value)}
          placeholder="What would you like to ask?"
          rows={3}
          disabled={loading}
        />
      </div>

      <button
        className={styles.runButton}
        onClick={onRun}
        disabled={loading || !userMessage.trim()}
      >
        {loading ? (
          <>
            <span className={styles.spinner} />
            Running...
          </>
        ) : (
          "Run Inference"
        )}
      </button>
    </PipelineNode>
  );
}
