"use client";

import { useState, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, XCircle, HelpCircle } from "lucide-react";
import { PipeIcon } from "./PipeIcon";
import type {
  PipelineNodeConfig,
  NodeConfigByType,
  ColorOutput,
  URLContextItem,
  GenieOutput,
} from "@/types/pipeline";
import { MODULE_DEFINITIONS, SYSTEM_PROMPT_MODULE } from "./ModulePalette";
import { NodeRenderer } from "./nodes/NodeRenderer";
import styles from "./PipelineCanvas.module.css";

interface PipelineCanvasProps {
  nodes: PipelineNodeConfig[];
  onRemoveNode: (id: string) => void;
  onConfigChange: (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => void;
  userInputs: Record<string, string>;
  onUserInputChange: (nodeId: string, value: string) => void;
  onRunInference: (nodeId: string) => void;
  onLoadURL: (nodeId: string, url: string, label?: string) => void;
  loadingNodeId: string | null;
  loadingUrlNodeIds: Set<string>;
  urlContexts: Record<string, URLContextItem>;
  activeNodeId: string | null;
  overNodeId: string | null;
  // Genie-specific props
  genieConversations?: Record<string, GenieOutput>;
  onGenieSelfInference?: (nodeId: string, message: string) => void;
  onGenieSaveBackstory?: (nodeId: string) => void;
  genieBackstoryUpdates?: Record<string, boolean>;
  onGenieClearUpdate?: (nodeId: string) => void;
  // Context inspector props
  highlightedNodeId?: string | null;
  inspectedNodeId?: string | null;
  onInspectContext?: (nodeId: string) => void;
  // Tutorial props
  onOpenTutorial?: (nodeType: string) => void;
  // Streaming props
  streamingNodeId?: string | null;
  streamingText?: string;
  isStreaming?: boolean;
}

interface SortableNodeProps {
  node: PipelineNodeConfig;
  onRemove: () => void;
  onConfigChange: (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => void;
  userInputValue: string;
  onUserInputChange: (nodeId: string, value: string) => void;
  onRunInference: (nodeId: string) => void;
  onLoadURL: (nodeId: string, url: string, label?: string) => void;
  isLoading: boolean;
  isLoadingUrl: boolean;
  output: unknown;
  urlContext: URLContextItem | null;
  isLast: boolean;
  isDropTarget: boolean;
  mounted: boolean;
  // Genie-specific props
  genieConversation?: GenieOutput | null;
  onGenieSelfInference?: (nodeId: string, message: string) => void;
  onGenieSaveBackstory?: (nodeId: string) => void;
  genieHasUpdate?: boolean;
  onGenieClearUpdate?: (nodeId: string) => void;
  // Context inspector props
  isHighlighted?: boolean;
  isInspected?: boolean;
  onInspectContext?: (nodeId: string) => void;
  // Tutorial props
  onOpenTutorial?: (nodeType: string) => void;
  // Streaming props
  streamingText?: string;
  isStreaming?: boolean;
}

function SortableNode({
  node,
  onRemove,
  onConfigChange,
  userInputValue,
  onUserInputChange,
  onRunInference,
  onLoadURL,
  isLoading,
  isLoadingUrl,
  output,
  urlContext,
  isLast,
  isDropTarget,
  mounted,
  genieConversation,
  onGenieSelfInference,
  onGenieSaveBackstory,
  genieHasUpdate,
  onGenieClearUpdate,
  isHighlighted,
  isInspected,
  onInspectContext,
  onOpenTutorial,
  streamingText,
  isStreaming,
}: SortableNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Look up module info (system prompt is not in MODULE_DEFINITIONS)
  const moduleInfo = node.type === "system_prompt"
    ? SYSTEM_PROMPT_MODULE
    : MODULE_DEFINITIONS.find((m) => m.type === node.type);
  const Icon = moduleInfo?.icon;
  const isFixedSystemPrompt = node.id === "system-prompt-fixed";

  // For color_display nodes, use the generated color if available
  let nodeColor = moduleInfo?.color;
  if (node.type === "color_display" && output) {
    const colorOutput = output as ColorOutput;
    if (colorOutput.hex) {
      nodeColor = colorOutput.hex;
    }
  }

  return (
    <div className={styles.nodeWrapper}>
      {/* Drop indicator above this node */}
      {isDropTarget && !isDragging && (
        <div className={styles.dropIndicator}>
          <div className={styles.dropIndicatorLine} />
        </div>
      )}
      <div
        ref={setNodeRef}
        style={{
          ...style,
          "--module-color": nodeColor,
        } as React.CSSProperties}
        className={`${styles.node} ${isDragging ? styles.dragging : ""} ${isHighlighted ? styles.highlighted : ""} ${isInspected ? styles.inspected : ""}`}
        data-node-id={node.id}
      >
        <div className={styles.nodeHeader}>
          <div className={styles.nodeHeaderLeft}>
            {!isFixedSystemPrompt && (
              <div
                className={styles.dragHandle}
                {...attributes}
                {...listeners}
                suppressHydrationWarning
              >
                <GripVertical size={16} />
              </div>
            )}
            {Icon && (
              <div className={styles.nodeIcon}>
                <Icon size={16} />
              </div>
            )}
            <h1 className={styles.nodeName}>{moduleInfo?.name || node.type}</h1>
            {genieHasUpdate && (
              <span className={styles.notificationDot} title="Backstory updated" />
            )}
          </div>
          <div className={styles.nodeHeaderRight}>
            {onOpenTutorial && (
              <button
                className={styles.helpButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTutorial(node.type);
                }}
                title="Learn about this node"
              >
                <HelpCircle size={18} />
              </button>
            )}
            {!isFixedSystemPrompt && (
              <button
                className={styles.removeButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                title="Remove node"
              >
                <XCircle size={18} />
              </button>
            )}
          </div>
        </div>
        <div className={styles.nodeBody}>
          <NodeRenderer
            node={node}
            onConfigChange={onConfigChange}
            userInputValue={userInputValue}
            onUserInputChange={onUserInputChange}
            onRunInference={onRunInference}
            onLoadURL={onLoadURL}
            isLoading={isLoading || isLoadingUrl}
            output={output}
            urlContext={urlContext}
            genieConversation={genieConversation}
            onGenieSelfInference={onGenieSelfInference}
            onGenieSaveBackstory={onGenieSaveBackstory}
            genieHasUpdate={genieHasUpdate}
            onGenieClearUpdate={onGenieClearUpdate}
            onInspectContext={onInspectContext}
          />
        </div>
      </div>
      {mounted && !isLast && (
        <div className={styles.connector}>
          <PipeIcon size={36} />
        </div>
      )}
    </div>
  );
}

function DropZone({ index, isOver }: { index: number; isOver: boolean }) {
  return (
    <div className={`${styles.dropZone} ${isOver ? styles.dropZoneActive : ""}`}>
      <div className={styles.dropZoneLine} />
      <span className={styles.dropZoneLabel}>Drop here</span>
      <div className={styles.dropZoneLine} />
    </div>
  );
}

export function PipelineCanvas({
  nodes,
  onRemoveNode,
  onConfigChange,
  userInputs,
  onUserInputChange,
  onRunInference,
  onLoadURL,
  loadingNodeId,
  loadingUrlNodeIds,
  urlContexts,
  activeNodeId,
  overNodeId,
  genieConversations,
  onGenieSelfInference,
  onGenieSaveBackstory,
  genieBackstoryUpdates,
  onGenieClearUpdate,
  highlightedNodeId,
  inspectedNodeId,
  onInspectContext,
  onOpenTutorial,
}: PipelineCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "pipeline-canvas",
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isEmpty = nodes.length === 0;

  return (
    <div className={styles.canvas}>
      <div className={styles.header}>
        <h2 className={styles.title}>Pipeline</h2>
        {mounted && (
          <span className={styles.nodeCount}>
            {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
          </span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`${styles.nodeList} ${isEmpty ? styles.empty : ""} ${isOver ? styles.over : ""}`}
      >
        {!mounted ? (
          // Render empty state during SSR to match initial client render
          <div className={styles.emptyState}>
            <p>Drag modules here to build your pipeline</p>
          </div>
        ) : isEmpty ? (
          <div className={styles.emptyState}>
            <p>Drag modules here to build your pipeline</p>
          </div>
        ) : (
          <SortableContext
            items={nodes.map((n) => n.id)}
            strategy={verticalListSortingStrategy}
          >
            {nodes.map((node, index) => (
              <SortableNode
                key={node.id}
                node={node}
                onRemove={() => onRemoveNode(node.id)}
                onConfigChange={onConfigChange}
                userInputValue={userInputs[node.id] || ""}
                onUserInputChange={onUserInputChange}
                onRunInference={onRunInference}
                onLoadURL={onLoadURL}
                isLoading={loadingNodeId === node.id}
                isLoadingUrl={loadingUrlNodeIds.has(node.id)}
                output={node.output || null}
                urlContext={urlContexts[node.id] || null}
                isLast={index === nodes.length - 1}
                isDropTarget={overNodeId === node.id && activeNodeId !== node.id}
                mounted={mounted}
                genieConversation={genieConversations?.[node.id]}
                onGenieSelfInference={onGenieSelfInference}
                onGenieSaveBackstory={onGenieSaveBackstory}
                genieHasUpdate={genieBackstoryUpdates?.[node.id] || false}
                onGenieClearUpdate={onGenieClearUpdate}
                isHighlighted={highlightedNodeId === node.id}
                isInspected={inspectedNodeId === node.id}
                onInspectContext={onInspectContext}
                onOpenTutorial={onOpenTutorial}
              />
            ))}
          </SortableContext>
        )}

        {/* Show drop indicator when dragging over canvas (drop at end) */}
        {activeNodeId && (isOver || overNodeId === "pipeline-canvas") && (
          <DropZone index={nodes.length} isOver={true} />
        )}
      </div>
    </div>
  );
}
