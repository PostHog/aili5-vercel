"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  MessageSquare,
  Settings,
  Type,
  Palette,
  CircleDot,
  Gauge,
  Grid3X3,
  Webhook,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { NodeType } from "@/types/pipeline";
import styles from "./ModulePalette.module.css";

interface ModuleDefinition {
  type: NodeType;
  name: string;
  description: string;
  icon: LucideIcon;
  category: "input" | "inference" | "output";
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    type: "system_prompt",
    name: "System Prompt",
    description: "Set model behavior",
    icon: MessageSquare,
    category: "input",
  },
  {
    type: "inference",
    name: "LLM",
    description: "Run the model",
    icon: Settings,
    category: "inference",
  },
  {
    type: "color_display",
    name: "Color",
    description: "Display a color",
    icon: Palette,
    category: "output",
  },
  {
    type: "icon_display",
    name: "Icon",
    description: "Display an icon",
    icon: CircleDot,
    category: "output",
  },
  {
    type: "gauge_display",
    name: "Gauge",
    description: "Display a number",
    icon: Gauge,
    category: "output",
  },
  {
    type: "pixel_art_display",
    name: "Pixel Art",
    description: "Display pixel art",
    icon: Grid3X3,
    category: "output",
  },
  {
    type: "webhook_trigger",
    name: "Webhook",
    description: "Trigger HTTP request",
    icon: Webhook,
    category: "output",
  },
  {
    type: "survey",
    name: "Survey",
    description: "Multiple choice",
    icon: ClipboardList,
    category: "output",
  },
];

interface DraggableModuleProps {
  module: ModuleDefinition;
}

function DraggableModule({ module }: DraggableModuleProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${module.type}`,
    data: {
      type: module.type,
      fromPalette: true,
    },
  });

  const Icon = module.icon;

  return (
    <div
      ref={setNodeRef}
      className={`${styles.module} ${isDragging ? styles.dragging : ""}`}
      {...listeners}
      {...attributes}
    >
      <div className={styles.moduleIcon}>
        <Icon size={18} />
      </div>
      <div className={styles.moduleInfo}>
        <span className={styles.moduleName}>{module.name}</span>
        <span className={styles.moduleDescription}>{module.description}</span>
      </div>
    </div>
  );
}

export function ModulePalette() {
  const inputModules = MODULE_DEFINITIONS.filter((m) => m.category === "input");
  const inferenceModules = MODULE_DEFINITIONS.filter((m) => m.category === "inference");
  const outputModules = MODULE_DEFINITIONS.filter((m) => m.category === "output");

  return (
    <div className={styles.palette}>
      <h2 className={styles.title}>Modules</h2>
      <p className={styles.hint}>Drag modules to the pipeline</p>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Input</h3>
        {inputModules.map((module) => (
          <DraggableModule key={module.type} module={module} />
        ))}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Inference</h3>
        {inferenceModules.map((module) => (
          <DraggableModule key={module.type} module={module} />
        ))}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Output</h3>
        {outputModules.map((module) => (
          <DraggableModule key={module.type} module={module} />
        ))}
      </div>
    </div>
  );
}
