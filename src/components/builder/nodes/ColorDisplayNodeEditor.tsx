"use client";

import type { ColorDisplayConfig, ColorOutput } from "@/types/pipeline";
import type { NodeInterface, InferenceResponse } from "@/lib/nodeInterface";
import styles from "./NodeEditor.module.css";

/**
 * Color Display Node Interface
 * Implements NodeInterface for color display blocks
 */
export const ColorDisplayNodeInterface: NodeInterface<ColorDisplayConfig, ColorOutput> = {
  /**
   * Generate block metadata string for system prompt
   */
  meta: (config: ColorDisplayConfig, blockId: string): string => {
    const toolName = config.name ? `display_${config.name}_color` : "display_color";
    const label = config.label || config.name || "Color";

    return `\n\nAvailable output block:
- "${label}": ${blockId}, tool: ${toolName}

To display a color, you MUST call the ${toolName} tool with:
- hex: A valid hex color code (e.g., "#FF5733", "#3498DB")
- name: (optional) A name for the color (e.g., "Sunset Orange", "Ocean Blue")
- explanation: (optional) Why you chose this color

Color guidelines:
- Use warm colors (reds, oranges, yellows) for energy, passion, urgency
- Use cool colors (blues, greens, purples) for calm, trust, nature
- Use neutrals (grays, browns, blacks, whites) for balance, sophistication
- Consider color psychology when making choices
- Always provide valid 6-digit hex codes starting with #`;
  },

  /**
   * Parse color output from inference response
   */
  parse: (response: InferenceResponse, blockId: string): ColorOutput | undefined => {
    // Try to find color tool call (with or without custom name)
    if (response.toolCalls) {
      const colorToolCall = response.toolCalls.find((tc) =>
        tc.toolName.startsWith("display_") && tc.toolName.endsWith("_color") ||
        tc.toolName === "display_color"
      );
      if (colorToolCall && colorToolCall.input) {
        const input = colorToolCall.input;
        return {
          hex: input.hex as string,
          name: input.name as string | undefined,
          explanation: input.explanation as string | undefined,
        };
      }
    }
    return undefined;
  },
};

interface ColorDisplayNodeEditorProps {
  config: ColorDisplayConfig;
  onChange: (config: ColorDisplayConfig) => void;
  output: ColorOutput | null;
  loading: boolean;
}

export function ColorDisplayNodeEditor({
  config,
  onChange,
  output,
  loading,
}: ColorDisplayNodeEditorProps) {
  // Calculate contrasting text color for the hex value display
  const getContrastColor = (hex: string): string => {
    // Remove # if present
    const color = hex.replace("#", "");
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  };

  return (
    <div className={styles.nodeEditor}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="color-name">
          Tool Name
        </label>
        <input
          id="color-name"
          type="text"
          className={styles.input}
          value={config.name || ""}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
          placeholder="e.g., mood, brand, theme"
        />
        <span className={styles.hint}>
          Tool: {config.name ? `display_${config.name}_color` : "display_color"}
        </span>
      </div>

      <div className={styles.colorContainer}>
        {loading ? (
          <div className={styles.loadingOutput}>
            <span className={styles.spinner} />
            Choosing color...
          </div>
        ) : output && output.hex ? (
          <div className={styles.colorDisplay}>
            <div
              className={styles.colorSwatch}
              style={{ backgroundColor: output.hex }}
            >
              {config.showHex !== false && (
                <span
                  className={styles.hexValue}
                  style={{ color: getContrastColor(output.hex) }}
                >
                  {output.hex.toUpperCase()}
                </span>
              )}
            </div>
            <div className={styles.colorDetails}>
              {output.name && (
                <span className={styles.colorName}>{output.name}</span>
              )}
              {output.explanation && (
                <p className={styles.explanation}>{output.explanation}</p>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.colorPreview}>
              <div className={styles.previewSwatch} style={{ backgroundColor: "#FF5733" }} />
              <div className={styles.previewSwatch} style={{ backgroundColor: "#3498DB" }} />
              <div className={styles.previewSwatch} style={{ backgroundColor: "#2ECC71" }} />
              <div className={styles.previewSwatch} style={{ backgroundColor: "#9B59B6" }} />
              <div className={styles.previewSwatch} style={{ backgroundColor: "#F39C12" }} />
              <div className={styles.previewSwatch} style={{ backgroundColor: "#1ABC9C" }} />
            </div>
            <span>Model will choose a color</span>
          </div>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.showHex !== false}
            onChange={(e) => onChange({ ...config, showHex: e.target.checked })}
          />
          Show hex value on swatch
        </label>
      </div>
    </div>
  );
}
