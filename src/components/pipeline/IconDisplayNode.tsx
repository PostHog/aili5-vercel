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
import { PipelineNode } from "./PipelineNode";
import type { IconOutput, IconId } from "@/types/pipeline";
import styles from "./IconDisplayNode.module.css";

// Map our icon IDs to Lucide components
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

// Human-readable names for icons
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

interface IconDisplayNodeProps {
  output: IconOutput | null;
  loading?: boolean;
}

export function IconDisplayNode({ output, loading }: IconDisplayNodeProps) {
  const IconComponent = output ? ICON_MAP[output.id] : null;

  return (
    <PipelineNode
      title="Icon Display"
      description="An icon chosen by the model"
      isLast
    >
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Choosing icon...</span>
          </div>
        ) : output && IconComponent ? (
          <div className={styles.iconDisplay}>
            <div className={styles.iconWrapper}>
              <IconComponent className={styles.icon} />
            </div>
            <div className={styles.details}>
              <span className={styles.iconName}>
                {output.label || ICON_NAMES[output.id]}
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
            <span>The model will choose an icon based on your input</span>
          </div>
        )}
      </div>
    </PipelineNode>
  );
}

// Export icon map for use elsewhere
export { ICON_MAP, ICON_NAMES };
