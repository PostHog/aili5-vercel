"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./InspectorConnector.module.css";

interface InspectorConnectorProps {
  isOpen: boolean;
  targetNodeId: string | null;
  color?: string;
  inspectorHeaderSelector?: string;
}

interface ConnectorPoints {
  startY: number;
  endY: number;
  startX: number;
  endX: number;
}

export function InspectorConnector({
  isOpen,
  targetNodeId,
  color = "#666",
  inspectorHeaderSelector = "[class*='headerIcon']",
}: InspectorConnectorProps) {
  const [points, setPoints] = useState<ConnectorPoints | null>(null);

  const updatePositions = useCallback(() => {
    if (!isOpen || !targetNodeId) {
      setPoints(null);
      return;
    }

    // Find the inspector header icon
    const headerIcon = document.querySelector(inspectorHeaderSelector);
    // Find the target node
    const targetNode = document.querySelector(`[data-node-id="${targetNodeId}"]`);

    if (!headerIcon || !targetNode) {
      setPoints(null);
      return;
    }

    const headerRect = headerIcon.getBoundingClientRect();
    const nodeRect = targetNode.getBoundingClientRect();

    setPoints({
      startX: headerRect.right,
      startY: headerRect.top + headerRect.height / 2,
      endX: nodeRect.left,
      endY: nodeRect.top + 20, // Align with top of node header
    });
  }, [isOpen, targetNodeId, inspectorHeaderSelector]);

  useEffect(() => {
    updatePositions();

    // Update on scroll and resize
    window.addEventListener("scroll", updatePositions, true);
    window.addEventListener("resize", updatePositions);

    // Also update periodically for smooth animation after panel opens
    const interval = setInterval(updatePositions, 50);
    const timeout = setTimeout(() => clearInterval(interval), 500);

    return () => {
      window.removeEventListener("scroll", updatePositions, true);
      window.removeEventListener("resize", updatePositions);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [updatePositions]);

  if (!isOpen || !points) {
    return null;
  }

  const { startX, startY, endX, endY } = points;
  const width = Math.max(endX - startX, 1);
  const height = Math.abs(endY - startY) + 40;
  const minY = Math.min(startY, endY) - 20;

  // Create a bezier curve path
  const localStartY = startY - minY;
  const localEndY = endY - minY;
  const controlPointOffset = width * 0.4;

  const path = `
    M 0 ${localStartY}
    C ${controlPointOffset} ${localStartY},
      ${width - controlPointOffset} ${localEndY},
      ${width} ${localEndY}
  `;

  return (
    <svg
      className={styles.connector}
      style={{
        left: startX,
        top: minY,
        width,
        height,
      }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={20}
        strokeOpacity={0.3}
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.8}
      />
    </svg>
  );
}
