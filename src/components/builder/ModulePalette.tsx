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
  color: string; // Bright primary color for the module
}

// Bright primary color palette
const COLORS = {
  blue: "#3B82F6",      // System prompt - trustworthy blue
  yellow: "#FBBF24",    // LLM inference - cheerful yellow
  grey: "#6B7280",      // Color output - neutral grey
  purple: "#8B5CF6",    // Icon output - vibrant purple
  green: "#10B981",     // Gauge output - fresh green
  orange: "#F97316",    // Pixel art - creative orange
  cyan: "#06B6D4",      // Webhook - tech cyan
  red: "#EF4444",       // Survey - attention red
};

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    type: "system_prompt",
    name: "System Prompt",
    description: "Set model behavior",
    icon: MessageSquare,
    category: "input",
    color: COLORS.blue,
  },
  {
    type: "inference",
    name: "LLM",
    description: "Run the model",
    icon: Settings,
    category: "inference",
    color: COLORS.yellow,
  },
  {
    type: "color_display",
    name: "Color",
    description: "Display a color",
    icon: Palette,
    category: "output",
    color: COLORS.grey,
  },
  {
    type: "icon_display",
    name: "Icon",
    description: "Display an icon",
    icon: CircleDot,
    category: "output",
    color: COLORS.purple,
  },
  {
    type: "gauge_display",
    name: "Gauge",
    description: "Display a number",
    icon: Gauge,
    category: "output",
    color: COLORS.green,
  },
  {
    type: "pixel_art_display",
    name: "Pixel Art",
    description: "Display pixel art",
    icon: Grid3X3,
    category: "output",
    color: COLORS.orange,
  },
  {
    type: "webhook_trigger",
    name: "Webhook",
    description: "Trigger HTTP request",
    icon: Webhook,
    category: "output",
    color: COLORS.cyan,
  },
  {
    type: "survey",
    name: "Survey",
    description: "Multiple choice",
    icon: ClipboardList,
    category: "output",
    color: COLORS.red,
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
      style={{
        "--module-color": module.color,
      } as React.CSSProperties}
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
