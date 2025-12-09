"use client";

import type {
  PipelineNodeConfig,
  NodeConfigByType,
  SystemPromptConfig,
  InferenceConfig,
  IconDisplayConfig,
  ColorDisplayConfig,
  TextOutput,
  IconOutput,
  ColorOutput,
} from "@/types/pipeline";
import { SystemPromptNodeEditor } from "./SystemPromptNodeEditor";
import { InferenceNodeEditor } from "./InferenceNodeEditor";
import { IconDisplayNodeEditor } from "./IconDisplayNodeEditor";
import { ColorDisplayNodeEditor } from "./ColorDisplayNodeEditor";

interface NodeRendererProps {
  node: PipelineNodeConfig;
  onConfigChange: (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => void;
  userInputValue?: string;
  onUserInputChange?: (nodeId: string, value: string) => void;
  onRunInference?: (nodeId: string) => void;
  isLoading?: boolean;
  output?: unknown;
}

export function NodeRenderer({
  node,
  onConfigChange,
  userInputValue = "",
  onUserInputChange,
  onRunInference,
  isLoading = false,
  output = null,
}: NodeRendererProps) {
  switch (node.type) {
    case "system_prompt":
      return (
        <SystemPromptNodeEditor
          config={node.config as SystemPromptConfig}
          onChange={(config) => onConfigChange(node.id, config)}
        />
      );

    case "inference":
      return (
        <InferenceNodeEditor
          config={node.config as InferenceConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          userInput={userInputValue}
          onUserInputChange={(value) => onUserInputChange?.(node.id, value)}
          onRun={() => onRunInference?.(node.id)}
          loading={isLoading}
          output={output as TextOutput | null}
        />
      );

    case "icon_display":
      return (
        <IconDisplayNodeEditor
          config={node.config as IconDisplayConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          output={output as IconOutput | null}
          loading={isLoading}
        />
      );

    case "color_display":
      return (
        <ColorDisplayNodeEditor
          config={node.config as ColorDisplayConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          output={output as ColorOutput | null}
          loading={isLoading}
        />
      );

    // Placeholder for other node types
    case "gauge_display":
    case "pixel_art_display":
    case "webhook_trigger":
    case "survey":
      return (
        <div style={{ padding: "0.75rem", fontSize: "0.875rem", color: "var(--foreground)", opacity: 0.6 }}>
          {node.type.replace("_", " ")} editor coming soon...
        </div>
      );

    default:
      return null;
  }
}
