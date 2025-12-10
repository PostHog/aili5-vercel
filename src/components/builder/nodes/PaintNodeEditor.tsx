"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { PaintConfig } from "@/types/pipeline";
import type { NodeInterface, NodeRuntimeState } from "@/lib/nodeInterface";
import styles from "./NodeEditor.module.css";

const CANVAS_SIZE = 300;
const BRUSH_SIZE = 2;

type Tool = "brush" | "eraser";

/**
 * Paint Node Interface
 * Provides image data as base64 for downstream inference nodes
 */
export const PaintNodeInterface: NodeInterface<PaintConfig, never> = {
  meta: () => "",
  parse: () => undefined,
  context: (config, _blockId, state) => {
    // The image data will be handled specially - we return a marker
    // that the promptBuilder can recognize to include the image
    const imageData = state.userInput; // We store base64 in userInput
    if (!imageData || imageData === "data:," || !imageData.startsWith("data:image/")) return null;

    // Return a special marker that indicates an image should be included
    // The actual image data is stored in the store and handled by the API
    return `\n\n### ${config.label || "Drawing"}\n[an image to be uploaded to the LLM for interpretation]`;
  },
};

interface PaintNodeEditorProps {
  config: PaintConfig;
  onChange: (config: PaintConfig) => void;
  value: string;
  onValueChange: (data: string) => void;
  nodeId: string;
}

export function PaintNodeEditor({
  config,
  onChange,
  value,
  onValueChange,
  nodeId,
}: PaintNodeEditorProps) {
  // value contains the base64 image data
  const imageData = value;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // If we have existing image data, load it
    if (imageData && imageData !== "data:,") {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasDrawn(true);
      };
      img.src = imageData;
    }
  }, []);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const draw = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH_SIZE;

    if (tool === "brush") {
      ctx.strokeStyle = "#000000";
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.strokeStyle = "#ffffff";
      ctx.globalCompositeOperation = "source-over";
    }

    if (lastPosRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    lastPosRef.current = { x, y };
  }, [tool]);

  const saveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    onValueChange(dataUrl);
    setHasDrawn(true);
  }, [onValueChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getCanvasCoords(e);
    lastPosRef.current = coords;
    draw(coords.x, coords.y);
  }, [getCanvasCoords, draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    draw(coords.x, coords.y);
  }, [isDrawing, getCanvasCoords, draw]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPosRef.current = null;
      saveCanvas();
    }
  }, [isDrawing, saveCanvas]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPosRef.current = null;
      saveCanvas();
    }
  }, [isDrawing, saveCanvas]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    onValueChange("");
    setHasDrawn(false);
  }, [onValueChange]);

  return (
    <div className={styles.nodeEditor}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`paint-label-${nodeId}`}>
          Label (optional)
        </label>
        <input
          id={`paint-label-${nodeId}`}
          type="text"
          className={styles.input}
          value={config.label || ""}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g., Sketch, Diagram, Drawing"
        />
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label}>
            {config.label || "Canvas"}
          </label>
          {hasDrawn && (
            <span className={styles.characterCount}>
              Drawing saved
            </span>
          )}
        </div>

        <div className={styles.paintToolbar}>
          <button
            type="button"
            className={`${styles.paintToolButton} ${tool === "brush" ? styles.paintToolActive : ""}`}
            onClick={() => setTool("brush")}
            title="Brush"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.paintToolButton} ${tool === "eraser" ? styles.paintToolActive : ""}`}
            onClick={() => setTool("eraser")}
            title="Eraser"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 21h10" />
              <path d="M5.5 11.5L16.5 22.5" />
              <path d="M21 7.5l-9 9-5-5 9-9z" />
              <path d="M7.5 15.5L3 20" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.paintClearButton}
            onClick={handleClear}
            title="Clear canvas"
          >
            Clear
          </button>
        </div>

        <div className={styles.paintCanvasContainer}>
          <canvas
            ref={canvasRef}
            className={styles.paintCanvas}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        </div>
      </div>
    </div>
  );
}
