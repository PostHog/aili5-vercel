"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import type {
  PipelineNodeConfig,
  NodeConfigByType,
} from "@/types/pipeline";
import { MODULE_DEFINITIONS } from "./ModulePalette";
import { NodeRenderer } from "./nodes/NodeRenderer";
import styles from "./PipelineCanvas.module.css";

interface PipelineCanvasProps {
  nodes: PipelineNodeConfig[];
  onRemoveNode: (id: string) => void;
  onConfigChange: (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => void;
  userInputs: Record<string, string>;
  onUserInputChange: (nodeId: string, value: string) => void;
  onRunInference: (nodeId: string) => void;
  loadingNodeId: string | null;
  outputs: Record<string, unknown>;
  activeNodeId: string | null;
}

interface SortableNodeProps {
  node: PipelineNodeConfig;
  onRemove: () => void;
  onConfigChange: (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => void;
  userInputValue: string;
  onUserInputChange: (nodeId: string, value: string) => void;
  onRunInference: (nodeId: string) => void;
  isLoading: boolean;
  output: unknown;
  isLast: boolean;
}

function SortableNode({
  node,
  onRemove,
  onConfigChange,
  userInputValue,
  onUserInputChange,
  onRunInference,
  isLoading,
  output,
  isLast,
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

  const moduleInfo = MODULE_DEFINITIONS.find((m) => m.type === node.type);
  const Icon = moduleInfo?.icon;

  return (
    <div className={styles.nodeWrapper}>
      <div
        ref={setNodeRef}
        style={style}
        className={`${styles.node} ${isDragging ? styles.dragging : ""}`}
      >
        <div className={styles.nodeHeader}>
          <div className={styles.nodeHeaderLeft}>
            <div
              className={styles.dragHandle}
              {...attributes}
              {...listeners}
            >
              <GripVertical size={16} />
            </div>
            {Icon && (
              <div className={styles.nodeIcon}>
                <Icon size={16} />
              </div>
            )}
            <span className={styles.nodeName}>{moduleInfo?.name || node.type}</span>
          </div>
          <button
            className={styles.removeButton}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove node"
          >
            <X size={14} />
          </button>
        </div>
        <div className={styles.nodeBody}>
          <NodeRenderer
            node={node}
            onConfigChange={onConfigChange}
            userInputValue={userInputValue}
            onUserInputChange={onUserInputChange}
            onRunInference={onRunInference}
            isLoading={isLoading}
            output={output}
          />
        </div>
      </div>
      {!isLast && <div className={styles.connector} />}
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
  loadingNodeId,
  outputs,
  activeNodeId,
}: PipelineCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "pipeline-canvas",
  });

  const isEmpty = nodes.length === 0;

  return (
    <div className={styles.canvas}>
      <div className={styles.header}>
        <h2 className={styles.title}>Pipeline</h2>
        <span className={styles.nodeCount}>
          {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`${styles.nodeList} ${isEmpty ? styles.empty : ""} ${isOver ? styles.over : ""}`}
      >
        {isEmpty ? (
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
                isLoading={loadingNodeId === node.id}
                output={outputs[node.id] || null}
                isLast={index === nodes.length - 1}
              />
            ))}
          </SortableContext>
        )}

        {/* Show drop indicator when dragging over */}
        {isOver && activeNodeId && (
          <DropZone index={nodes.length} isOver={true} />
        )}
      </div>
    </div>
  );
}
