"use client";

import type {
  PipelineNodeConfig,
  NodeConfigByType,
  SystemPromptConfig,
  InferenceConfig,
  IconDisplayConfig,
  ColorDisplayConfig,
  EmojiDisplayConfig,
  PixelArtDisplayConfig,
  URLLoaderConfig,
  TextInputConfig,
  PaintConfig,
  GenieConfig,
  URLContextItem,
  TextOutput,
  IconOutput,
  ColorOutput,
  EmojiOutput,
  PixelArtOutput,
  GenieOutput,
} from "@/types/pipeline";
import { SystemPromptNodeEditor } from "./SystemPromptNodeEditor";
import { InferenceNodeEditor } from "./InferenceNodeEditor";
import { IconDisplayNodeEditor } from "./IconDisplayNodeEditor";
import { ColorDisplayNodeEditor } from "./ColorDisplayNodeEditor";
import { EmojiDisplayNodeEditor } from "./EmojiDisplayNodeEditor";
import { PixelArtDisplayNodeEditor } from "./PixelArtDisplayNodeEditor";
import { URLLoaderNodeEditor } from "./URLLoaderNodeEditor";
import { TextInputNodeEditor } from "./TextInputNodeEditor";
import { PaintNodeEditor } from "./PaintNodeEditor";
import { GenieNodeEditor } from "./GenieNodeEditor";

interface NodeRendererProps {
  node: PipelineNodeConfig;
  onConfigChange: (nodeId: string, config: NodeConfigByType[keyof NodeConfigByType]) => void;
  userInputValue?: string;
  onUserInputChange?: (nodeId: string, value: string) => void;
  onRunInference?: (nodeId: string) => void;
  onLoadURL?: (nodeId: string, url: string, label?: string) => void;
  isLoading?: boolean;
  output?: unknown;
  urlContext?: URLContextItem | null;
  // Genie-specific props
  genieConversation?: GenieOutput | null;
  onGenieSelfInference?: (nodeId: string, message: string) => void;
  onGenieSaveBackstory?: (nodeId: string) => void;
  genieHasUpdate?: boolean;
  onGenieClearUpdate?: (nodeId: string) => void;
  // Context inspector prop
  onInspectContext?: (nodeId: string) => void;
}

export function NodeRenderer({
  node,
  onConfigChange,
  userInputValue = "",
  onUserInputChange,
  onRunInference,
  onLoadURL,
  isLoading = false,
  output = null,
  urlContext = null,
  genieConversation,
  onGenieSelfInference,
  onGenieSaveBackstory,
  genieHasUpdate,
  onGenieClearUpdate,
  onInspectContext,
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
          onInspectContext={onInspectContext ? () => onInspectContext(node.id) : undefined}
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

    case "emoji_display":
      return (
        <EmojiDisplayNodeEditor
          config={node.config as EmojiDisplayConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          output={output as EmojiOutput | null}
          loading={isLoading}
        />
      );

    case "pixel_art_display":
      return (
        <PixelArtDisplayNodeEditor
          config={node.config as PixelArtDisplayConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          output={output as PixelArtOutput | null}
          loading={isLoading}
        />
      );

    case "url_loader":
      return (
        <URLLoaderNodeEditor
          config={node.config as URLLoaderConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          urlContext={urlContext}
          onLoadURL={onLoadURL || (() => {})}
          nodeId={node.id}
          loading={isLoading}
        />
      );

    case "text_input":
      return (
        <TextInputNodeEditor
          config={node.config as TextInputConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          value={userInputValue}
          onValueChange={(value) => onUserInputChange?.(node.id, value)}
          nodeId={node.id}
        />
      );

    case "paint":
      return (
        <PaintNodeEditor
          config={node.config as PaintConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          value={userInputValue}
          onValueChange={(value) => onUserInputChange?.(node.id, value)}
          nodeId={node.id}
        />
      );

    case "genie":
      return (
        <GenieNodeEditor
          config={node.config as GenieConfig}
          onChange={(config) => onConfigChange(node.id, config)}
          conversation={genieConversation || null}
          onSelfInference={(message) => onGenieSelfInference?.(node.id, message)}
          onSaveBackstory={() => onGenieSaveBackstory?.(node.id)}
          loading={isLoading}
          hasUpdate={genieHasUpdate || false}
          onClearUpdate={() => onGenieClearUpdate?.(node.id)}
          onInspectContext={onInspectContext ? () => onInspectContext(node.id) : undefined}
        />
      );

    // Placeholder for other node types
    case "gauge_display":
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
