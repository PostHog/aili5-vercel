import type { NodeType, NodeConfigByType } from "@/types/pipeline";

/**
 * Returns the default configuration for each node type
 */
export function getDefaultConfig(type: NodeType): NodeConfigByType[NodeType] {
  switch (type) {
    case "system_prompt":
      return { prompt: "You are a helpful assistant." };
    case "user_input":
      return { placeholder: "Enter your message..." };
    case "url_loader":
      return { url: "" };
    case "text_input":
      return { label: "", placeholder: "Enter text to add to context..." };
    case "inference":
      return { model: "claude-sonnet-4-20250514", temperature: 0.7 };
    case "text_display":
      return { label: "Response" };
    case "color_display":
      return { showHex: true };
    case "icon_display":
      return { size: "md" };
    case "gauge_display":
      return { style: "bar", showValue: true };
    case "pixel_art_display":
      return { pixelSize: 24 };
    case "webhook_trigger":
      return { showResponse: true };
    case "survey":
      return { style: "buttons" };
    case "genie":
      return {
        name: "genie",
        backstory: "You are a helpful genie.",
        model: "claude-sonnet-4-20250514",
        temperature: 0.7,
        autoRespondOnUpdate: false,
      };
    default:
      return {} as NodeConfigByType[NodeType];
  }
}
