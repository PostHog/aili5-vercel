"use client";

import {
  Check,
  X,
  AlertTriangle,
  Info,
  Star,
  Heart,
  Flame,
  Sparkles,
  Lightbulb,
  Moon,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Wind,
  Leaf,
  Flower2,
  TreeDeciduous,
  type LucideIcon,
} from "lucide-react";
import type { IconDisplayConfig, IconOutput, IconId, ICON_IDS } from "@/types/pipeline";
import type { NodeInterface, InferenceResponse } from "@/lib/nodeInterface";
import styles from "./NodeEditor.module.css";

/**
 * Icon Display Node Interface
 * Implements NodeInterface for icon display blocks
 */
export const IconDisplayNodeInterface: NodeInterface<IconDisplayConfig, IconOutput> = {
  /**
   * Generate block metadata string for system prompt
   */
  meta: (config: IconDisplayConfig, blockId: string): string => {
    const toolName = config.name ? `display_${config.name}_icon` : "display_icon";
    const label = config.label || config.name || "Icon";
    const availableIcons = [
      "check", "x", "warning", "info", "star", "heart", "fire", "sparkles",
      "lightbulb", "moon", "sun", "cloud", "rain", "snow", "wind", "leaf", "flower", "tree"
    ].join(", ");

    return `\n\nAvailable output block:
- "${label}": ${blockId}, tool: ${toolName}

To display an icon, you MUST call the ${toolName} tool with:
- id: One of [${availableIcons}]
- label: (optional) A label to show with the icon
- explanation: (optional) Why you chose this icon

Icon meanings:
- check: Success, yes, approval
- x: Failure, no, rejection
- warning: Caution, alert
- info: Information, details
- star: Excellence, favorite
- heart: Love, appreciation
- fire: Hot, urgent, energy
- sparkles: Magic, special, celebration
- lightbulb: Idea, insight
- moon/sun: Night/day, calm/energy
- cloud/rain/snow/wind: Weather, moods
- leaf/flower/tree: Nature, growth`;
  },

  /**
   * Parse icon output from inference response
   */
  parse: (response: InferenceResponse, blockId: string): IconOutput | undefined => {
    // Try to find icon tool call (with or without custom name)
    if (response.toolCalls) {
      const iconToolCall = response.toolCalls.find((tc) =>
        tc.toolName.startsWith("display_") && tc.toolName.endsWith("_icon") ||
        tc.toolName === "display_icon"
      );
      if (iconToolCall && iconToolCall.input) {
        const input = iconToolCall.input;
        return {
          id: input.id as IconOutput["id"],
          label: input.label as string | undefined,
          explanation: input.explanation as string | undefined,
        };
      }
    }
    return undefined;
  },
};

const ICON_MAP: Record<IconId, LucideIcon> = {
  check: Check,
  x: X,
  warning: AlertTriangle,
  info: Info,
  star: Star,
  heart: Heart,
  fire: Flame,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  moon: Moon,
  sun: Sun,
  cloud: Cloud,
  rain: CloudRain,
  snow: Snowflake,
  wind: Wind,
  leaf: Leaf,
  flower: Flower2,
  tree: TreeDeciduous,
};

const ICON_NAMES: Record<IconId, string> = {
  check: "Check",
  x: "X",
  warning: "Warning",
  info: "Info",
  star: "Star",
  heart: "Heart",
  fire: "Fire",
  sparkles: "Sparkles",
  lightbulb: "Lightbulb",
  moon: "Moon",
  sun: "Sun",
  cloud: "Cloud",
  rain: "Rain",
  snow: "Snow",
  wind: "Wind",
  leaf: "Leaf",
  flower: "Flower",
  tree: "Tree",
};

interface IconDisplayNodeEditorProps {
  config: IconDisplayConfig;
  onChange: (config: IconDisplayConfig) => void;
  output: IconOutput | null;
  loading: boolean;
}

export function IconDisplayNodeEditor({
  config,
  onChange,
  output,
  loading,
}: IconDisplayNodeEditorProps) {
  const IconComponent = output?.id ? ICON_MAP[output.id as IconId] : null;

  return (
    <div className={styles.nodeEditor}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="icon-name">
          Tool Name
        </label>
        <input
          id="icon-name"
          type="text"
          className={styles.input}
          value={config.name || ""}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
          placeholder="e.g., mood, weather, status"
        />
        <span className={styles.hint}>
          Tool: {config.name ? `display_${config.name}_icon` : "display_icon"}
        </span>
      </div>

      <div className={styles.iconContainer}>
        {loading ? (
          <div className={styles.loadingOutput}>
            <span className={styles.spinner} />
            Choosing icon...
          </div>
        ) : output && IconComponent ? (
          <div className={styles.iconDisplay}>
            <div className={styles.iconWrapper}>
              <IconComponent className={styles.icon} />
            </div>
            <div className={styles.iconDetails}>
              <span className={styles.iconName}>
                {output.label || ICON_NAMES[output.id as IconId]}
              </span>
              {output.explanation && (
                <p className={styles.explanation}>{output.explanation}</p>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.iconGrid}>
              {Object.entries(ICON_MAP).slice(0, 6).map(([id, Icon]) => (
                <Icon key={id} className={styles.previewIcon} />
              ))}
            </div>
            <span>Model will choose an icon</span>
          </div>
        )}
      </div>
    </div>
  );
}
