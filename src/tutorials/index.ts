import type { NodeType } from "@/types/pipeline";
import { SystemPromptTutorial } from "./systemPromptTutorial";
import { URLLoaderTutorial } from "./urlLoaderTutorial";
import { TextInputTutorial } from "./textInputTutorial";
import { InferenceTutorial } from "./inferenceTutorial";
import { ColorDisplayTutorial } from "./colorDisplayTutorial";
import { IconDisplayTutorial } from "./iconDisplayTutorial";
import { EmojiDisplayTutorial } from "./emojiDisplayTutorial";
import { GaugeDisplayTutorial } from "./gaugeDisplayTutorial";
import { PixelArtDisplayTutorial } from "./pixelArtDisplayTutorial";
import { WebhookTriggerTutorial } from "./webhookTriggerTutorial";
import { SurveyTutorial } from "./surveyTutorial";
import { GenieTutorial } from "./genieTutorial";

export const TUTORIALS: Record<NodeType, React.ComponentType> = {
  system_prompt: SystemPromptTutorial,
  url_loader: URLLoaderTutorial,
  text_input: TextInputTutorial,
  inference: InferenceTutorial,
  color_display: ColorDisplayTutorial,
  icon_display: IconDisplayTutorial,
  emoji_display: EmojiDisplayTutorial,
  gauge_display: GaugeDisplayTutorial,
  pixel_art_display: PixelArtDisplayTutorial,
  webhook_trigger: WebhookTriggerTutorial,
  survey: SurveyTutorial,
  genie: GenieTutorial,
  // These node types don't have tutorials yet
  user_input: SystemPromptTutorial, // fallback
  text_display: SystemPromptTutorial, // fallback
};
