"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Eye } from "lucide-react";
import type { GenieConfig, GenieOutput } from "@/types/pipeline";
import type { NodeInterface, InferenceResponse, NodeRuntimeState } from "@/lib/nodeInterface";
import { AVAILABLE_MODELS } from "@/types/pipeline";
import styles from "./NodeEditor.module.css";

/**
 * Genie update parsed from inference response
 * Can contain either a backstory update or a message to send to the genie
 */
export interface GenieUpdate {
  backstory?: string;
  shouldAutoRespond?: boolean;
  message?: string;
}

/**
 * Genie Node Interface
 * Implements NodeInterface for genie blocks
 * The parse method extracts messages from tool calls or backstory updates from text
 */
export const GenieNodeInterface: NodeInterface<GenieConfig, GenieUpdate> = {
  /**
   * Generate block metadata string for system prompt
   * Tells the LLM about the genie and how to send messages to it
   */
  meta: (config: GenieConfig, blockId: string): string => {
    const genieName = config.name || "genie";
    const toolName = genieName === "genie" 
      ? "send_message_to_genie"
      : `send_message_to_${genieName}`;

    return `\n\nAvailable output block:
- "${genieName}": ${blockId}, tool: ${toolName}

To send a message to ${genieName}, you MUST call the ${toolName} tool with:
- message: A valid message string to send to ${genieName}. This will be added to ${genieName}'s conversation with role "system", and ${genieName} will automatically respond to it.

CRITICAL: If you want to communicate with ${genieName}, you MUST use the ${toolName} tool. Simply mentioning ${genieName} in your text response is NOT sufficient - you must make a tool call.

${genieName}'s backstory: ${config.backstory || "No backstory set"}`;
  },

  /**
   * Parse genie update from inference response
   * Looks for:
   * 1. Tool calls with genie message tools (send_message_to_genie or send_message_to_{name})
   * 2. Text pattern for backstory updates (legacy support)
   */
  parse: (response: InferenceResponse, blockId: string): GenieUpdate | undefined => {
    // First, check for tool calls with genie message tools
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.toolName;
        
        // Check if this is a genie message tool
        if (toolName === "send_message_to_genie" || toolName.startsWith("send_message_to_")) {
          const input = toolCall.input as { message?: string };
          if (input.message) {
            return {
              message: input.message,
            };
          }
        }
      }
    }

    // Fallback: check text response for legacy backstory update pattern
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

  /**
   * Generate context from genie's conversation for downstream nodes
   */
  context: (config: GenieConfig, _blockId: string, state: NodeRuntimeState): string | null => {
    const conversation = state.conversation as GenieOutput | undefined;
    const genieName = config.name || "genie";

    let context = `\n\n${"=".repeat(50)}`;
    context += `\nGENIE: ${genieName}`;
    context += `\nBackstory: ${config.backstory || "No backstory"}`;
    
    if (conversation && conversation.messages.length > 0) {
      context += `\n${"─".repeat(50)}`;
      context += `\nConversation History:`;
      for (const msg of conversation.messages) {
        if (msg.role === "user") {
          context += `\nUser: ${msg.content}`;
        } else if (msg.role === "system") {
          context += `\n[System]: ${msg.content}`;
        } else {
          context += `\n${genieName}: ${msg.content}`;
        }
      }
    }
    context += `\n${"=".repeat(50)}\n`;
    
    return context;
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
  onInspectContext?: () => void;
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
  onInspectContext,
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
            <div className={`${styles.genieMessage} ${styles.genieMessageThinking}`}>
              <div className={styles.loadingOutput}>
                <span className={styles.spinner} />
                {config.name} is thinking...
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
          <div className={styles.buttonRow}>
            {onInspectContext && (
              <button
                className={styles.inspectButton}
                onClick={onInspectContext}
                title="Inspect Context"
              >
                <Eye size={16} />
              </button>
            )}
            <button
              className={styles.runButton}
              onClick={handleSendMessage}
              disabled={loading || !userMessage.trim() || !config.backstory.trim()}
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
    </div>
  );
}

