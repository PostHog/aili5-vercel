"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { GenieConfig, GenieOutput } from "@/types/pipeline";
import type { NodeInterface, InferenceResponse } from "@/lib/nodeInterface";
import { AVAILABLE_MODELS } from "@/types/pipeline";
import styles from "./NodeEditor.module.css";

/**
 * Genie backstory update parsed from inference response
 */
export interface GenieBackstoryUpdate {
  backstory?: string;
  shouldAutoRespond?: boolean;
}

/**
 * Genie Node Interface
 * Implements NodeInterface for genie blocks
 * Note: The parse method returns GenieBackstoryUpdate (not GenieOutput)
 * because it parses backstory updates from the main inference response
 */
export const GenieNodeInterface: NodeInterface<GenieConfig, GenieBackstoryUpdate> = {
  /**
   * Generate block metadata string for system prompt
   * Formats the genie's conversation history as context
   */
  meta: (config: GenieConfig, blockId: string): string => {
    // This will be called with the actual conversation history from state
    // For now, return a placeholder - the actual formatting happens in PipelineBuilder
    return "";
  },

  /**
   * Parse backstory update from inference response
   */
  parse: (response: InferenceResponse, blockId: string): { backstory?: string; shouldAutoRespond?: boolean } | undefined => {
    const text = response.response || "";
    const updatePattern = /UPDATE_GENIE_BACKSTORY:\s*(.+?)(?:\n|$)/i;
    const match = text.match(updatePattern);
    
    if (match && match[1]) {
      return {
        backstory: match[1].trim(),
        shouldAutoRespond: true,
      };
    }
    
    return undefined;
  },
};

interface GenieNodeEditorProps {
  config: GenieConfig;
  onChange: (config: GenieConfig) => void;
  conversation: GenieOutput | null;
  onSelfInference: (message: string) => void;
  onSaveBackstory: () => void;
  loading: boolean;
  hasUpdate: boolean;
  onClearUpdate: () => void;
}

export function GenieNodeEditor({
  config,
  onChange,
  conversation,
  onSelfInference,
  onSaveBackstory,
  loading,
  hasUpdate,
  onClearUpdate,
}: GenieNodeEditorProps) {
  const [userMessage, setUserMessage] = useState("");
  const [backstoryDirty, setBackstoryDirty] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const messages = conversation?.messages || [];

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Clear update notification when user interacts
  useEffect(() => {
    if (hasUpdate && (userMessage || messages.length > 0)) {
      onClearUpdate();
    }
  }, [hasUpdate, userMessage, messages.length, onClearUpdate]);

  const handleBackstoryChange = (value: string) => {
    onChange({ ...config, backstory: value });
    setBackstoryDirty(true);
  };

  const handleSaveBackstory = () => {
    setBackstoryDirty(false);
    onSaveBackstory();
  };

  const handleSendMessage = () => {
    if (!userMessage.trim() || loading) return;
    const message = userMessage.trim();
    setUserMessage("");
    onSelfInference(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={styles.nodeEditor}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="genie-name">
          Name
        </label>
        <input
          id="genie-name"
          type="text"
          className={styles.input}
          value={config.name}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
          placeholder="e.g., luke, sophia, zap"
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="genie-backstory">
          Backstory
        </label>
        <textarea
          id="genie-backstory"
          className={styles.textarea}
          value={config.backstory}
          onChange={(e) => handleBackstoryChange(e.target.value)}
          placeholder="You are a helpful genie..."
          rows={3}
          disabled={loading}
        />
        {backstoryDirty && (
          <button
            className={styles.runButton}
            onClick={handleSaveBackstory}
            disabled={loading}
            style={{ marginTop: "0.5rem" }}
          >
            Save Backstory
          </button>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="genie-model-select">
          Model
        </label>
        <select
          id="genie-model-select"
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
        <label className={styles.label} htmlFor="genie-temperature-slider">
          Temperature: {config.temperature.toFixed(1)}
        </label>
        <input
          id="genie-temperature-slider"
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

      <div className={styles.field}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.autoRespondOnUpdate || false}
            onChange={(e) =>
              onChange({ ...config, autoRespondOnUpdate: e.target.checked })
            }
            disabled={loading}
          />
          Auto-respond when backstory is updated
        </label>
      </div>

      <div className={styles.genieChatContainer} ref={chatContainerRef}>
        <div className={styles.genieMessages}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              {config.backstory ? "Start chatting with " + config.name + "..." : "Set a backstory first"}
            </div>
          ) : (
            messages.map((msg, idx) => {
              let messageClass = styles.genieMessageAssistant;
              let messageLabel = config.name;
              
              if (msg.role === "user") {
                messageClass = styles.genieMessageUser;
                messageLabel = "You";
              } else if (msg.role === "system") {
                messageClass = styles.genieMessageSystem;
                messageLabel = "System";
              }
              
              return (
                <div
                  key={idx}
                  className={`${styles.genieMessage} ${messageClass}`}
                >
                  <div className={styles.genieMessageLabel}>
                    {messageLabel}:
                  </div>
                  <div className={styles.genieMessageContent}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              );
            })
          )}
          {loading && (
            <div className={styles.genieMessage}>
              <div className={styles.genieMessageLabel}>{config.name}:</div>
              <div className={styles.loadingOutput}>
                <span className={styles.spinner} />
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.genieInputContainer}>
          <textarea
            className={styles.textarea}
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${config.name}...`}
            rows={2}
            disabled={loading || !config.backstory.trim()}
          />
          <button
            className={styles.runButton}
            onClick={handleSendMessage}
            disabled={loading || !userMessage.trim() || !config.backstory.trim()}
            style={{ marginTop: "0.5rem" }}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Sending...
              </>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

