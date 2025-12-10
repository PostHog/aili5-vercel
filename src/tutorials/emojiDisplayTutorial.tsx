"use client";

import { useState, useCallback } from "react";
import { runInference } from "@/services/inference/api";
import styles from "./Tutorial.module.css";

const EXAMPLE_PROMPTS = [
  { label: "Happy", prompt: "happy celebration joy" },
  { label: "Sad", prompt: "sad crying upset" },
  { label: "Love", prompt: "love heart romance" },
  { label: "Nature", prompt: "nature plants trees animals" },
  { label: "Food", prompt: "delicious food meal" },
  { label: "Tech", prompt: "technology computer coding" },
];

export function EmojiDisplayTutorial() {
  const [emoji, setEmoji] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const generateEmoji = useCallback(async (prompt: string) => {
    if (loading) return;
    
    setLoading(true);
    setEmoji(null);

    try {
      const result = await runInference({
        systemPrompt: "You are an emoji selector. Given a theme or feeling, respond with ONLY a single emoji character that best represents it. No text, no explanation, just one emoji.",
        userMessage: prompt,
        model: "claude-3-haiku-20240307",
        temperature: 0.8,
      });

      if (result.response) {
        // Extract just the emoji (first emoji character found)
        const emojiMatch = result.response.match(/\p{Extended_Pictographic}/u);
        setEmoji(emojiMatch ? emojiMatch[0] : result.response.trim().slice(0, 2));
      }
    } catch (error) {
      console.error("Emoji generation error:", error);
      setEmoji("❓");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is an Emoji Display Node?</h3>
          <p>
            The Emoji Display node shows emojis that the model generates. The model can output
            emoji characters, and this node displays them in a large, visible format.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            When an inference node calls the <code>display_emoji</code> tool, it specifies an
            emoji character. The Emoji Display node receives this and shows it prominently. This
            is useful for reactions, status indicators, or adding visual flair to responses.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Generate an Emoji</h3>
          <p>Click a theme or type your own:</p>
          <div className={styles.emojiPromptGrid}>
            {EXAMPLE_PROMPTS.map(({ label, prompt }) => (
              <button
                key={label}
                className={styles.emojiPromptButton}
                onClick={() => generateEmoji(prompt)}
                disabled={loading}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.emojiCustomRow}>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && customPrompt.trim() && generateEmoji(customPrompt)}
              placeholder="Type a theme..."
              disabled={loading}
            />
            <button
              onClick={() => generateEmoji(customPrompt)}
              disabled={loading || !customPrompt.trim()}
            >
              {loading ? "..." : "Go"}
            </button>
          </div>
          <div className={styles.emojiDisplay}>
            {loading ? (
              <div className={styles.emojiLoading}>✨</div>
            ) : emoji ? (
              <div className={styles.emojiResult}>{emoji}</div>
            ) : (
              <div className={styles.emojiPlaceholder}>?</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
