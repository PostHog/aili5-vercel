"use client";

import { useState, useRef, useEffect } from "react";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import {
  X,
  FileText,
  MessageSquare,
  Globe,
  Type,
  Wrench,
  Blocks,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type {
  PipelineNodeConfig,
  SystemPromptConfig,
  GenieOutput,
  URLContextItem,
  GenieConfig,
  TextInputConfig,
} from "@/types/pipeline";
import { generateBlockMetadata } from "@/lib/blockParsers";
import styles from "./ContextInspector.module.css";

export interface ContextSection {
  id: string;
  type: "system_prompt" | "genie" | "url" | "text_input" | "block_metadata" | "tools";
  sourceNodeId: string;
  title: string;
  content: string;
  icon: typeof FileText;
}

interface ContextInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string;

  // Context data
  systemPromptConfig: SystemPromptConfig;
  precedingNodes: PipelineNodeConfig[];
  genieConversations: Record<string, GenieOutput>;
  urlContexts: Record<string, URLContextItem>;
  userInputs: Record<string, string>;
  tools: Tool[];

  // For highlighting source nodes
  onHoverSection: (nodeId: string | null) => void;
}

/**
 * Gather individual context sections from pipeline state
 */
function gatherContextSections(
  systemPromptConfig: SystemPromptConfig,
  precedingNodes: PipelineNodeConfig[],
  genieConversations: Record<string, GenieOutput>,
  urlContexts: Record<string, URLContextItem>,
  userInputs: Record<string, string>,
  tools: Tool[]
): ContextSection[] {
  const sections: ContextSection[] = [];

  // 1. System Prompt
  if (systemPromptConfig.prompt) {
    sections.push({
      id: "system-prompt",
      type: "system_prompt",
      sourceNodeId: "system-prompt-fixed",
      title: "System Prompt",
      content: systemPromptConfig.prompt,
      icon: FileText,
    });
  }

  // 2. Process preceding nodes
  for (const node of precedingNodes) {
    // Skip system prompt (already handled)
    if (node.type === "system_prompt") continue;

    // Genie conversations
    if (node.type === "genie") {
      const genieConfig = node.config as GenieConfig;
      const conversation = genieConversations[node.id];
      if (conversation && conversation.messages.length > 0) {
        let content = `Backstory: ${genieConfig.backstory}\n\nConversation:\n`;
        for (const msg of conversation.messages) {
          if (msg.role === "user") {
            content += `User: ${msg.content}\n`;
          } else {
            content += `${genieConfig.name}: ${msg.content}\n`;
          }
        }
        sections.push({
          id: `genie-${node.id}`,
          type: "genie",
          sourceNodeId: node.id,
          title: `Genie: ${genieConfig.name}`,
          content,
          icon: MessageSquare,
        });
      }
    }

    // URL contexts
    if (node.type === "url_loader") {
      const ctx = urlContexts[node.id];
      if (ctx && ctx.content && !ctx.error) {
        sections.push({
          id: `url-${node.id}`,
          type: "url",
          sourceNodeId: node.id,
          title: ctx.label || ctx.url,
          content: `Source: ${ctx.url}\n\n${ctx.content}`,
          icon: Globe,
        });
      }
    }

    // Text inputs
    if (node.type === "text_input") {
      const content = userInputs[node.id];
      if (content && content.trim()) {
        const config = node.config as TextInputConfig;
        sections.push({
          id: `text-${node.id}`,
          type: "text_input",
          sourceNodeId: node.id,
          title: config.label || "Text Input",
          content: content.trim(),
          icon: Type,
        });
      }
    }

    // Block metadata (for output nodes like icon_display, color_display)
    const metadata = generateBlockMetadata(node.type, node.config, node.id);
    if (metadata) {
      sections.push({
        id: `block-${node.id}`,
        type: "block_metadata",
        sourceNodeId: node.id,
        title: `Block: ${node.type.replace("_", " ")}`,
        content: metadata,
        icon: Blocks,
      });
    }
  }

  // 3. Tool definitions
  if (tools.length > 0) {
    const toolContent = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n\n");
    sections.push({
      id: "tools",
      type: "tools",
      sourceNodeId: "tools", // Special ID for tools section
      title: `Tools (${tools.length})`,
      content: toolContent,
      icon: Wrench,
    });
  }

  return sections;
}

export function ContextInspector({
  isOpen,
  onClose,
  targetNodeId,
  systemPromptConfig,
  precedingNodes,
  genieConversations,
  urlContexts,
  userInputs,
  tools,
  onHoverSection,
}: ContextInspectorProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Gather context sections
  const sections = gatherContextSections(
    systemPromptConfig,
    precedingNodes,
    genieConversations,
    urlContexts,
    userInputs,
    tools
  );

  // Toggle section collapse
  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      ref={panelRef}
      className={`${styles.inspector} ${isOpen ? styles.open : ""}`}
      data-section-refs={JSON.stringify(
        sections.map((s) => ({ id: s.id, nodeId: s.sourceNodeId }))
      )}
    >
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h3 className={styles.title}>Context Inspector</h3>
          <p className={styles.description}>
            This is all the information available to the selected inference node.
          </p>
        </div>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close inspector"
        >
          <X size={18} />
        </button>
      </div>

      <div className={styles.content}>
        {sections.length === 0 ? (
          <div className={styles.emptyState}>
            No context available for this node.
          </div>
        ) : (
          sections.map((section) => {
            const isCollapsed = collapsedSections.has(section.id);
            const IconComponent = section.icon;

            return (
              <div
                key={section.id}
                className={styles.section}
                data-section-id={section.id}
                data-node-id={section.sourceNodeId}
                onMouseEnter={() => onHoverSection(section.sourceNodeId)}
                onMouseLeave={() => onHoverSection(null)}
              >
                <button
                  className={styles.sectionHeader}
                  onClick={() => toggleSection(section.id)}
                >
                  <div className={styles.sectionTitleRow}>
                    {isCollapsed ? (
                      <ChevronRight size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    <IconComponent size={14} className={styles.sectionIcon} />
                    <span className={styles.sectionTitle}>{section.title}</span>
                  </div>
                  <span className={styles.sectionType}>{section.type}</span>
                </button>

                {!isCollapsed && (
                  <div className={styles.sectionContent}>
                    <pre className={styles.contentPre}>{section.content}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerText}>
          {sections.length} section{sections.length !== 1 ? "s" : ""} •{" "}
          {sections.reduce((acc, s) => acc + s.content.length, 0).toLocaleString()} chars
        </span>
      </div>
    </div>
  );
}
