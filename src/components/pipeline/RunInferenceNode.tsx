import { PipelineNode } from "./PipelineNode";
import styles from "./nodes.module.css";

interface RunInferenceNodeProps {
  userMessage: string;
  loading: boolean;
  onUserMessageChange: (value: string) => void;
  onRun: () => void;
}

export function RunInferenceNode({
  userMessage,
  loading,
  onUserMessageChange,
  onRun,
}: RunInferenceNodeProps) {
  return (
    <PipelineNode
      title="Run Inference"
      description="Enter your message and run the model"
    >
      <textarea
        className={styles.textarea}
        value={userMessage}
        onChange={(e) => onUserMessageChange(e.target.value)}
        placeholder="What would you like to ask?"
        rows={3}
        disabled={loading}
      />
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
