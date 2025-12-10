"use client";

import { useState, useRef, useEffect } from "react";
import {
  XCircle,
  FileText,
  MessageSquare,
  Globe,
  Type,
  Wrench,
  Blocks,
  ChevronDown,
  ChevronRight,
  Paintbrush,
  Eye,
} from "lucide-react";
import type {
  PipelineNodeConfig,
  SystemPromptConfig,
  GenieOutput,
  URLContextItem,
  GenieConfig,
  TextInputConfig,
  PaintConfig,
} from "@/types/pipeline";
import { generateBlockMetadata } from "@/lib/blockParsers";
import { getToolForNode, getGenieTool } from "@/lib/tools";
import { MODULE_DEFINITIONS, SYSTEM_PROMPT_MODULE } from "./ModulePalette";
import styles from "./ContextInspector.module.css";

// Helper to get module color by node type
function getModuleColor(nodeType: string): string {
  if (nodeType === "system_prompt") {
    return SYSTEM_PROMPT_MODULE.color;
  }
  const module = MODULE_DEFINITIONS.find((m) => m.type === nodeType);
  return module?.color || "#6B7280"; // Default grey
}

export interface ContextSection {
  id: string;
  type: "system_prompt" | "genie" | "url" | "text_input" | "paint" | "block_metadata" | "tools";
  sourceNodeId: string;
  sourceNodeType: string;
  title: string;
  content: string;
  icon: typeof FileText;
  isDimmed?: boolean;
  color: string;
}

interface ContextInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string;
  targetNodeColor?: string;

  // Context data
  systemPromptConfig: SystemPromptConfig;
  allNodes: PipelineNodeConfig[];
  targetNodeIndex: number;
  genieConversations: Record<string, GenieOutput>;
  urlContexts: Record<string, URLContextItem>;
  userInputs: Record<string, string>;

  // For highlighting source nodes
  onHoverSection: (nodeId: string | null) => void;
}

/**
 * Gather individual context sections from pipeline state
 */
function gatherContextSections(
  systemPromptConfig: SystemPromptConfig,
  allNodes: PipelineNodeConfig[],
  targetNodeIndex: number,
  genieConversations: Record<string, GenieOutput>,
  urlContexts: Record<string, URLContextItem>,
  userInputs: Record<string, string>
): ContextSection[] {
  const sections: ContextSection[] = [];

  // 1. System Prompt (always visible, never dimmed since it's first)
  if (systemPromptConfig.prompt) {
    sections.push({
      id: "system-prompt",
      type: "system_prompt",
      sourceNodeId: "system-prompt-fixed",
      sourceNodeType: "system_prompt",
      title: "System Prompt",
      content: systemPromptConfig.prompt,
      icon: FileText,
      isDimmed: false,
      color: getModuleColor("system_prompt"),
    });
  }

  // 2. Process all nodes
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    // Skip system prompt (already handled) and the target node itself
    if (node.type === "system_prompt") continue;
    if (i === targetNodeIndex) continue;

    // Mark as dimmed if this node comes AFTER the target node
    const isDimmed = i > targetNodeIndex;

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
          sourceNodeType: node.type,
          title: `Genie: ${genieConfig.name}`,
          content,
          icon: MessageSquare,
          isDimmed,
          color: getModuleColor(node.type),
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
          sourceNodeType: node.type,
          title: ctx.label || ctx.url,
          content: `Source: ${ctx.url}\n\n${ctx.content}`,
          icon: Globe,
          isDimmed,
          color: getModuleColor(node.type),
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
          sourceNodeType: node.type,
          title: config.label || "Text Input",
          content: content.trim(),
          icon: Type,
          isDimmed,
          color: getModuleColor(node.type),
        });
      }
    }

    // Paint inputs
    if (node.type === "paint") {
      const imageData = userInputs[node.id];
      if (imageData && imageData.startsWith("data:image/")) {
        const config = node.config as PaintConfig;
        sections.push({
          id: `paint-${node.id}`,
          type: "paint",
          sourceNodeId: node.id,
          sourceNodeType: node.type,
          title: config.label || "Drawing",
          content: "[an image to be uploaded to the LLM for interpretation]",
          icon: Paintbrush,
          isDimmed,
          color: getModuleColor(node.type),
        });
      }
    }

    // Block metadata (for output nodes like icon_display, color_display)
    // Include tool definition if this node provides one
    const metadata = generateBlockMetadata(node.type, node.config, node.id);
    const nodeTool = getToolForNode(node);
    const genieTool = getGenieTool(node);
    const tool = nodeTool || genieTool;

    if (metadata || tool) {
      let content = "";
      if (metadata) {
        content += metadata.trim();
      }
      if (tool) {
        if (content) content += "\n\n";
        content += `Tool: ${tool.name}\n${tool.description}`;
      }

      sections.push({
        id: `block-${node.id}`,
        type: "block_metadata",
        sourceNodeId: node.id,
        sourceNodeType: node.type,
        title: node.type.replace(/_/g, " "),
        content,
        icon: tool ? Wrench : Blocks,
        isDimmed,
        color: getModuleColor(node.type),
      });
    }

    // Node outputs (for nodes that have generated output)
    if (node.output) {
      let outputContent = "";
      if (typeof node.output === "object") {
        outputContent = JSON.stringify(node.output, null, 2);
      } else {
        outputContent = String(node.output);
      }
      sections.push({
        id: `output-${node.id}`,
        type: "block_metadata", // Reuse type for now
        sourceNodeId: node.id,
        sourceNodeType: node.type,
        title: `Output: ${node.type.replace(/_/g, " ")}`,
        content: outputContent,
        icon: Blocks,
        isDimmed,
        color: getModuleColor(node.type),
      });
    }
  }

  return sections;
}

export function ContextInspector({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeColor,
  systemPromptConfig,
  allNodes,
  targetNodeIndex,
  genieConversations,
  urlContexts,
  userInputs,
  onHoverSection,
}: ContextInspectorProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Gather context sections
  const sections = gatherContextSections(
    systemPromptConfig,
    allNodes || [],
    targetNodeIndex,
    genieConversations,
    urlContexts,
    userInputs
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
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close inspector"
        >
          <XCircle size={18} />
        </button>
        <div className={styles.headerText}>
          <h3 className={styles.title}>Context Inspector</h3>
          <p className={styles.description}>
            This is all the information available to the selected inference node.
          </p>
        </div>
        <div
          className={styles.headerIcon}
          style={targetNodeColor ? { background: targetNodeColor, color: 'white' } : undefined}
        >
          <Eye size={20} />
        </div>
      </div>

      <div className={styles.content}>
        {sections.length === 0 ? (
          <div className={styles.emptyState}>
            No context available for this node.
          </div>
        ) : (
          (() => {
            const firstDimmedIndex = sections.findIndex((s) => s.isDimmed);
            return sections.map((section, index) => {
              const isCollapsed = collapsedSections.has(section.id);
              const IconComponent = section.icon;
              const showDivider = firstDimmedIndex !== -1 && index === firstDimmedIndex;

              return (
                <div key={section.id}>
                  {showDivider && (
                    <div className={styles.outOfContextDivider}>
                      <span>Out of context (drag above this node to include)</span>
                    </div>
                  )}
                  <div
                    className={`${styles.section} ${section.isDimmed ? styles.dimmed : ""}`}
                    style={{ "--section-color": section.color } as React.CSSProperties}
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
                </div>
              );
            });
          })()
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
