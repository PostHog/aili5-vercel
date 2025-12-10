"use client";

import { useState, useCallback } from "react";
import { runStreamingInference } from "@/services/inference/api";
import type { GenieConfig, GenieOutput, GenieMessage } from "@/types/pipeline";
import styles from "./Tutorial.module.css";

export function GenieTutorial() {
  const [config, setConfig] = useState<GenieConfig>({
    name: "Wishmaster",
    backstory: "You are a magical genie who grants wishes. You speak in a mystical, playful tone. Keep responses brief (1-2 sentences).",
    model: "claude-3-haiku-20240307",
    temperature: 0.7,
    autoRespondOnUpdate: false,
  });
  const [messages, setMessages] = useState<GenieMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [streamingText, setStreamingText] = useState("");

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    
    // Add user message
    const newMessages: GenieMessage[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);
    setStreamingText("");

    // Build conversation history for context
    const conversationHistory = newMessages
      .map((m) => `${m.role === "user" ? "Human" : config.name}: ${m.content}`)
      .join("\n");

    const systemPrompt = `${config.backstory}\n\nYour name is ${config.name}. Respond in character. Keep responses concise.`;

    let fullResponse = "";

    await runStreamingInference(
      {
        systemPrompt,
        userMessage: conversationHistory + `\nHuman: ${userMessage}\n${config.name}:`,
        model: config.model,
        temperature: config.temperature,
      },
      (chunk) => {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      },
      () => {
        setMessages((prev) => [...prev, { role: "assistant", content: fullResponse }]);
        setStreamingText("");
        setLoading(false);
      },
      (error) => {
        console.error("Genie error:", error);
        setMessages((prev) => [...prev, { role: "assistant", content: "✨ *The genie's magic fizzled* - " + error }]);
        setStreamingText("");
        setLoading(false);
      }
    );
  }, [inputValue, loading, messages, config]);

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a Genie Node?</h3>
          <p>
            The Genie node creates a self-inferencing agent that can have conversations and update
            its own backstory. Unlike regular inference nodes, genies can think and respond
            autonomously.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>Genies are special nodes that can:</p>
          <ul className={styles.featureList}>
            <li><strong>Self-inference:</strong> They can think and respond on their own</li>
            <li><strong>Memory:</strong> They maintain conversation history</li>
            <li><strong>Backstory updates:</strong> They can update their own backstory based on interactions</li>
            <li><strong>Autonomous behavior:</strong> They can respond automatically when their backstory is updated</li>
          </ul>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Chat with {config.name}</h3>
          <div className={styles.genieDemo}>
            <div className={styles.genieBackstory}>
              <label>Backstory:</label>
              <textarea
                value={config.backstory}
                onChange={(e) => setConfig({ ...config, backstory: e.target.value })}
                rows={2}
              />
            </div>
            <div className={styles.genieChat}>
              {messages.length === 0 && !streamingText && (
                <div className={styles.geniePlaceholder}>
                  ✨ Ask the genie something...
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={msg.role === "user" ? styles.genieUserMsg : styles.genieAssistantMsg}
                >
                  <strong>{msg.role === "user" ? "You" : config.name}:</strong> {msg.content}
                </div>
              ))}
              {streamingText && (
                <div className={styles.genieAssistantMsg}>
                  <strong>{config.name}:</strong> {streamingText}
                  <span className={styles.streamingCursor} />
                </div>
              )}
            </div>
            <div className={styles.genieInputRow}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Make a wish..."
                disabled={loading}
              />
              <button onClick={handleSendMessage} disabled={loading || !inputValue.trim()}>
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
