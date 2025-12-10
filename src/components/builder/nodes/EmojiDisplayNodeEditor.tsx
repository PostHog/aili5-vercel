"use client";

import type { EmojiDisplayConfig, EmojiOutput } from "@/types/pipeline";
import type { NodeInterface, InferenceResponse } from "@/lib/nodeInterface";
import styles from "./NodeEditor.module.css";

/**
 * Emoji Display Node Interface
 * Implements NodeInterface for emoji display blocks
 */
export const EmojiDisplayNodeInterface: NodeInterface<EmojiDisplayConfig, EmojiOutput> = {
  /**
   * Generate block metadata string for system prompt
   */
  meta: (config: EmojiDisplayConfig, blockId: string): string => {
    const toolName = config.name ? `display_${config.name}_emoji` : "display_emoji";
    const label = config.label || config.name || "Emoji";

    return `\n\nAvailable output block:
- "${label}": ${blockId}, tool: ${toolName}

To display an emoji, you MUST call the ${toolName} tool with:
- emoji: A single emoji character (e.g., "🎉", "😊", "🔥", "⭐")
- explanation: (optional) Why you chose this emoji

Emoji guidelines:
- Use emojis to convey emotions, concepts, or status
- Choose emojis that clearly represent the intended meaning
- Single emoji per call (not multiple emojis)`;
  },

  /**
   * Parse emoji output from inference response
   */
  parse: (response: InferenceResponse, blockId: string): EmojiOutput | undefined => {
    // Try to find emoji tool call (with or without custom name)
    if (response.toolCalls) {
      const emojiToolCall = response.toolCalls.find((tc) =>
        (tc.toolName.startsWith("display_") && tc.toolName.endsWith("_emoji")) ||
        tc.toolName === "display_emoji"
      );
      if (emojiToolCall && emojiToolCall.input) {
        const input = emojiToolCall.input;
        return {
          emoji: input.emoji as string,
          explanation: input.explanation as string | undefined,
        };
      }
    }
    return undefined;
  },
};

interface EmojiDisplayNodeEditorProps {
  config: EmojiDisplayConfig;
  onChange: (config: EmojiDisplayConfig) => void;
  output: EmojiOutput | null;
  loading: boolean;
}

export function EmojiDisplayNodeEditor({
  config,
  onChange,
  output,
  loading,
}: EmojiDisplayNodeEditorProps) {
  return (
    <div className={styles.nodeEditor}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="emoji-name">
          Tool Name
        </label>
        <input
          id="emoji-name"
          type="text"
          className={styles.input}
          value={config.name || ""}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
          placeholder="e.g., mood, reaction, status"
        />
        <span className={styles.hint}>
          Tool: {config.name ? `display_${config.name}_emoji` : "display_emoji"}
        </span>
      </div>

      <div className={styles.emojiContainer}>
        {loading ? (
          <div className={styles.loadingOutput}>
            <span className={styles.spinner} />
            Choosing emoji...
          </div>
        ) : output && output.emoji ? (
          <div className={styles.emojiDisplay}>
            <div className={styles.emojiWrapper}>
              <span className={styles.emoji}>{output.emoji}</span>
            </div>
            <div className={styles.emojiDetails}>
              {output.explanation && (
                <p className={styles.explanation}>{output.explanation}</p>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emojiGrid}>
              <span className={styles.previewEmoji}>🎉</span>
              <span className={styles.previewEmoji}>😊</span>
              <span className={styles.previewEmoji}>🔥</span>
              <span className={styles.previewEmoji}>⭐</span>
              <span className={styles.previewEmoji}>💡</span>
              <span className={styles.previewEmoji}>❤️</span>
            </div>
            <span>Model will choose an emoji</span>
          </div>
        )}
      </div>
    </div>
  );
}

