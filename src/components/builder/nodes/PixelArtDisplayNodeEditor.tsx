"use client";

import { useRef, useEffect } from "react";
import type { PixelArtDisplayConfig, PixelArtOutput } from "@/types/pipeline";
import type { NodeInterface, InferenceResponse, NodeRuntimeState } from "@/lib/nodeInterface";
import styles from "./NodeEditor.module.css";

/**
 * Pixel Art Display Node Interface
 * Implements NodeInterface for pixel art display blocks
 */
export const PixelArtDisplayNodeInterface: NodeInterface<PixelArtDisplayConfig, PixelArtOutput> = {
  /**
   * Generate block metadata string for system prompt
   */
  meta: (config: PixelArtDisplayConfig, blockId: string): string => {
    const toolName = config.name ? `generate_${config.name}_pixel_art` : "generate_pixel_art";
    const label = config.label || config.name || "Pixel Art";

    return `\n\nAvailable output block:
- "${label}": ${blockId}, tool: ${toolName}

To generate pixel art, you MUST call the ${toolName} tool with:
- colors: An object mapping single-character codes to colors (e.g., { "W": "#f0f0f0", "S": "#a0a0a0", ".": "transparent" })
- grid: An array of strings, where each string is a row. Each character in the string maps to a color in the colors object
- explanation: (optional) Description of what you drew

Pixel art format example:
{
  "colors": {
    "transparent": "transparent",
    "white": "#f0f0f0",
    "lightGray": "#c0c0c0",
    "stem": "#a0a0a0",
    "darkStem": "#707070"
  },
  "grid": [
    ".....W..........",
    "....WWW.........",
    ".....W....W....."
  ]
}

Guidelines:
- Grid dimensions must be between 32x32 and 128x128 pixels (width and height)
- Maximum of 32 colors in the colors object (including transparent)
- Use single-character codes for colors (e.g., "W" for white, "." for transparent)
- All rows in the grid must have the same length
- Use "transparent" for empty/background pixels`;
  },

  /**
   * Parse pixel art output from inference response
   */
  parse: (response: InferenceResponse, blockId: string): PixelArtOutput | undefined => {
    // Try to find pixel art tool call (with or without custom name)
    if (response.toolCalls) {
      const pixelArtToolCall = response.toolCalls.find((tc) =>
        (tc.toolName.startsWith("generate_") && tc.toolName.endsWith("_pixel_art")) ||
        tc.toolName === "generate_pixel_art"
      );
      if (pixelArtToolCall && pixelArtToolCall.input) {
        const input = pixelArtToolCall.input;
        const colors = input.colors as Record<string, string>;
        const grid = input.grid as string[];
        
        if (colors && grid && Array.isArray(grid) && grid.length > 0) {
          // Infer width and height from grid
          const height = grid.length;
          const width = grid[0]?.length || 0;
          
          return {
            colors,
            grid,
            width,
            height,
            explanation: input.explanation as string | undefined,
          };
        }
      }
    }
    return undefined;
  },

  /**
   * Generate context string from pixel art output for downstream nodes
   */
  context: (config: PixelArtDisplayConfig, blockId: string, state: NodeRuntimeState): string | null => {
    const output = state.output as PixelArtOutput | undefined;
    if (!output || !output.grid || output.grid.length === 0) {
      return null;
    }

    const label = config.label || config.name || "Pixel Art";
    const width = output.width || output.grid[0]?.length || 0;
    const height = output.height || output.grid.length;
    
    let context = `\n\n### ${label} (${width}x${height} pixels)\n`;
    
    if (output.explanation) {
      context += `Description: ${output.explanation}\n\n`;
    }

    // Format colors
    context += `Color palette:\n`;
    const colorEntries = Object.entries(output.colors || {});
    for (const [code, color] of colorEntries) {
      if (color !== "transparent") {
        context += `- "${code}": ${color}\n`;
      } else {
        context += `- "${code}": transparent\n`;
      }
    }
    context += `\n`;

    // Format grid (show first few rows as example, then indicate total)
    context += `Pixel grid (${height} rows):\n`;
    const maxRowsToShow = 10;
    const rowsToShow = output.grid.slice(0, maxRowsToShow);
    for (const row of rowsToShow) {
      context += `${row}\n`;
    }
    if (output.grid.length > maxRowsToShow) {
      context += `... (${output.grid.length - maxRowsToShow} more rows)\n`;
    }

    return context;
  },
};

interface PixelArtDisplayNodeEditorProps {
  config: PixelArtDisplayConfig;
  onChange: (config: PixelArtDisplayConfig) => void;
  output: PixelArtOutput | null;
  loading: boolean;
}

export function PixelArtDisplayNodeEditor({
  config,
  onChange,
  output,
  loading,
}: PixelArtDisplayNodeEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw pixel art on canvas
  useEffect(() => {
    if (!output || !output.grid || output.grid.length === 0 || !canvasRef.current || !containerRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gridWidth = output.width || output.grid[0]?.length || 0;
    const gridHeight = output.height || output.grid.length;

    if (gridWidth === 0 || gridHeight === 0) return;

    // Get container dimensions
    const containerWidth = container.clientWidth;
    const containerHeight = 400; // Fixed height for consistency
    const maxWidth = containerWidth - 32; // Padding
    const maxHeight = containerHeight - 32;

    // Calculate scale to fit while maintaining aspect ratio
    const scaleX = maxWidth / gridWidth;
    const scaleY = maxHeight / gridHeight;
    const scale = Math.min(scaleX, scaleY, 16); // Max 16px per pixel for quality

    const pixelSize = Math.max(1, Math.floor(scale));
    const canvasWidth = gridWidth * pixelSize;
    const canvasHeight = gridHeight * pixelSize;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw pixels
    output.grid.forEach((row, rowIndex) => {
      row.split("").forEach((char, colIndex) => {
        const color = output.colors[char] || "transparent";
        if (color !== "transparent" && color) {
          ctx.fillStyle = color;
          ctx.fillRect(colIndex * pixelSize, rowIndex * pixelSize, pixelSize, pixelSize);
        }
      });
    });
  }, [output]);

  const renderPixelArt = () => {
    if (!output || !output.grid || output.grid.length === 0) return null;

    return (
      <div ref={containerRef} className={styles.pixelArtCanvasContainer}>
        <canvas ref={canvasRef} className={styles.pixelArtCanvas} />
      </div>
    );
  };

  return (
    <div className={styles.nodeEditor}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pixel-art-name">
          Tool Name
        </label>
        <input
          id="pixel-art-name"
          type="text"
          className={styles.input}
          value={config.name || ""}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
          placeholder="e.g., art, design, pattern"
        />
        <span className={styles.hint}>
          Tool: {config.name ? `generate_${config.name}_pixel_art` : "generate_pixel_art"}
        </span>
      </div>

      <div className={styles.pixelArtContainer}>
        {loading ? (
          <div className={styles.loadingOutput}>
            <span className={styles.spinner} />
            Generating pixel art...
          </div>
        ) : output && output.grid ? (
          <div className={styles.pixelArtDisplay}>
            {renderPixelArt()}
            {output.explanation && (
              <p className={styles.explanation}>{output.explanation}</p>
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.pixelArtCanvasContainer}>
              <canvas
                className={styles.pixelArtCanvas}
                width={64}
                height={64}
                style={{ width: "64px", height: "64px", opacity: 0.3 }}
                ref={(canvas) => {
                  if (canvas) {
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                      // Draw a simple checkerboard pattern
                      for (let y = 0; y < 8; y++) {
                        for (let x = 0; x < 8; x++) {
                          ctx.fillStyle = (x + y) % 2 === 0 ? "#f0f0f0" : "#c0c0c0";
                          ctx.fillRect(x * 8, y * 8, 8, 8);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <span>Model will generate pixel art</span>
          </div>
        )}
      </div>
    </div>
  );
}

