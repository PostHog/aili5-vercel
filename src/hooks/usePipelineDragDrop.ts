import { useState, useCallback } from "react";
import {
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { PipelineNodeConfig, NodeType, NodeConfigByType } from "@/types/pipeline";
import { getDefaultConfig } from "@/lib/nodeDefaults";

// Generate unique IDs
let nodeIdCounter = 0;
export function generateNodeId(): string {
  return `node-${++nodeIdCounter}-${Date.now()}`;
}

interface DragData {
  type: NodeType;
  fromPalette?: boolean;
}

interface UsePipelineDragDropOptions {
  nodes: PipelineNodeConfig[];
  onAddNode: (node: PipelineNodeConfig, insertIndex?: number) => void;
  onReorderNodes: (oldIndex: number, newIndex: number) => void;
}

export interface PipelineDragDropState {
  activeId: string | null;
  activeType: NodeType | null;
  overId: string | null;
}

export interface PipelineDragDropHandlers {
  sensors: ReturnType<typeof useSensors>;
  collisionDetection: CollisionDetection;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

export function usePipelineDragDrop({
  nodes,
  onAddNode,
  onReorderNodes,
}: UsePipelineDragDropOptions): PipelineDragDropState & PipelineDragDropHandlers {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<NodeType | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom collision detection that works better for vertical lists
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First try pointerWithin for precise drops
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // Fall back to rectIntersection for edge cases
    return rectIntersection(args);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const activeIdStr = active.id as string;
      setActiveId(activeIdStr);

      const data = active.data.current as DragData | undefined;
      if (data?.type) {
        setActiveType(data.type);
      } else {
        // Dragging an existing node - find its type
        const existingNode = nodes.find((n) => n.id === activeIdStr);
        if (existingNode) {
          setActiveType(existingNode.type);
        }
      }
    },
    [nodes]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setActiveType(null);
      setOverId(null);

      if (!over) return;

      const activeData = active.data.current as DragData | undefined;

      // Dragging from palette - add new node
      if (activeData?.fromPalette && activeData.type) {
        // Don't allow adding system_prompt from palette (it's fixed)
        if (activeData.type === "system_prompt") return;

        const newNode: PipelineNodeConfig = {
          id: generateNodeId(),
          type: activeData.type,
          config: getDefaultConfig(activeData.type),
        };

        // Find insertion index (account for fixed system prompt at index 0)
        if (over.id === "pipeline-canvas") {
          // Dropped on canvas - add to end
          onAddNode(newNode);
        } else if (over.id === "system-prompt-fixed") {
          // Dropped on system prompt - insert at beginning
          onAddNode(newNode, 0);
        } else {
          // Dropped on existing node - insert before it
          const overIndex = nodes.findIndex((n) => n.id === over.id);
          onAddNode(newNode, overIndex === -1 ? undefined : overIndex);
        }
        return;
      }

      // Reordering existing nodes (system prompt cannot be reordered)
      if (active.id !== over.id && active.id !== "system-prompt-fixed") {
        // If trying to move before system prompt, ignore
        if (over.id === "system-prompt-fixed") return;

        const oldIndex = nodes.findIndex((n) => n.id === active.id);
        const newIndex = nodes.findIndex((n) => n.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorderNodes(oldIndex, newIndex);
        }
      }
    },
    [nodes, onAddNode, onReorderNodes]
  );

  return {
    // State
    activeId,
    activeType,
    overId,
    // Handlers
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
