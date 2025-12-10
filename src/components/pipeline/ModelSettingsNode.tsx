import { PipelineNode } from "./PipelineNode";
import { AVAILABLE_MODELS, type ModelId } from "@/types/pipeline";
import styles from "./nodes.module.css";

interface ModelSettingsNodeProps {
  model: ModelId;
  temperature: number;
  onModelChange: (model: ModelId) => void;
  onTemperatureChange: (temperature: number) => void;
}

export function ModelSettingsNode({
  model,
  temperature,
  onModelChange,
  onTemperatureChange,
}: ModelSettingsNodeProps) {
  return (
    <PipelineNode
      title="Model Settings"
      description="Choose the model and adjust creativity"
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
        />
        <div className={styles.sliderLabels}>
          <span>Focused</span>
          <span>Creative</span>
        </div>
      </div>
    </PipelineNode>
  );
}
