// ─────────────────────────────────────────────────────────────────
// Pipeline Core Types
// ─────────────────────────────────────────────────────────────────

export interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNodeConfig[];
}

export interface PipelineNodeConfig {
  id: string;
  type: NodeType;
  config: NodeConfigByType[NodeType];
  output?: OutputDataByType[keyof OutputDataByType] | null;
}

export type NodeType =
  | "system_prompt"
  | "user_input"
  | "url_loader"
  | "text_input"
  | "paint"
  | "inference"
  | "text_display"
  | "color_display"
  | "icon_display"
  | "emoji_display"
  | "gauge_display"
  | "pixel_art_display"
  | "webhook_trigger"
  | "survey"
  | "genie";

// ─────────────────────────────────────────────────────────────────
// Node Configuration Types
// ─────────────────────────────────────────────────────────────────

export interface SystemPromptConfig {
  prompt: string;
}

export interface UserInputConfig {
  placeholder?: string;
  defaultValue?: string;
}

export interface URLLoaderConfig {
  /** The URL to fetch content from */
  url: string;
  /** Label for this context source */
  label?: string;
}

export interface TextInputConfig {
  /** Label for this text input */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
}

export interface PaintConfig {
  /** Label for this paint canvas */
  label?: string;
}

export interface InferenceConfig {
  model: string;
  temperature: number;
  maxTokens?: number;
  systemPrompt?: string;
  contextMode?: ContextMode;
}

export type ContextMode = "continue" | "fresh";

export interface TextDisplayConfig {
  label?: string;
}

export interface ColorDisplayConfig {
  /** Unique name for this output - becomes the tool name (e.g., "mood" → "display_mood_color") */
  name?: string;
  label?: string;
  showHex?: boolean;
}

export interface IconDisplayConfig {
  /** Unique name for this output - becomes the tool name (e.g., "weather" → "display_weather_icon") */
  name?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export interface EmojiDisplayConfig {
  /** Unique name for this output - becomes the tool name (e.g., "mood" → "display_mood_emoji") */
  name?: string;
  label?: string;
}

export interface GaugeDisplayConfig {
  /** Unique name for this output - becomes the tool name (e.g., "score" → "display_score_gauge") */
  name?: string;
  label?: string;
  showValue?: boolean;
  style?: "bar" | "dial" | "number";
}

export interface PixelArtDisplayConfig {
  /** Unique name for this output - becomes the tool name */
  name?: string;
  label?: string;
  pixelSize?: number;
}

export interface WebhookTriggerConfig {
  /** Unique name for this output - becomes the tool name */
  name?: string;
  label?: string;
  allowedDomains?: string[];
  showResponse?: boolean;
}

export interface SurveyConfig {
  /** Unique name for this output - becomes the tool name */
  name?: string;
  label?: string;
  style?: "buttons" | "radio" | "dropdown";
}

export interface GenieConfig {
  /** The genie's name (e.g., "luke", "sophia", "zap") */
  name: string;
  /** Initial prompt/backstory for the genie */
  backstory: string;
  /** Model to use for self-inference */
  model: string;
  /** Temperature setting */
  temperature: number;
  /** Whether to auto-respond when backstory is updated */
  autoRespondOnUpdate?: boolean;
}

// Map node types to their config types
export interface NodeConfigByType {
  system_prompt: SystemPromptConfig;
  user_input: UserInputConfig;
  url_loader: URLLoaderConfig;
  text_input: TextInputConfig;
  paint: PaintConfig;
  inference: InferenceConfig;
  text_display: TextDisplayConfig;
  color_display: ColorDisplayConfig;
  icon_display: IconDisplayConfig;
  emoji_display: EmojiDisplayConfig;
  gauge_display: GaugeDisplayConfig;
  pixel_art_display: PixelArtDisplayConfig;
  webhook_trigger: WebhookTriggerConfig;
  survey: SurveyConfig;
  genie: GenieConfig;
}

// ─────────────────────────────────────────────────────────────────
// Pipeline Context (flows through nodes)
// ─────────────────────────────────────────────────────────────────

export interface URLContextItem {
  url: string;
  label?: string;
  content: string;
  error?: string;
}

export interface PipelineContext {
  messages: PipelineMessage[];
  latestOutputs: ToolCallResult[];
  urlContext: URLContextItem[];
  metadata: PipelineMetadata;
}

export interface PipelineMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallResult[];
}

export interface ToolCallResult {
  type: OutputType;
  toolName: string;
  data: OutputDataByType[OutputType];
  explanation?: string;
}

export interface PipelineMetadata {
  pipelineId: string;
  startedAt: number;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────
// Output Types (from tool calls)
// ─────────────────────────────────────────────────────────────────

export type OutputType =
  | "text"
  | "color"
  | "icon"
  | "emoji"
  | "gauge"
  | "pixel_art"
  | "webhook"
  | "survey";

export interface TextOutput {
  content: string;
}

export interface ColorOutput {
  hex: string;
  name?: string;
  explanation?: string;
}

export interface IconOutput {
  id: IconId;
  label?: string;
  explanation?: string;
}

export interface EmojiOutput {
  emoji: string;
  explanation?: string;
}

export const ICON_IDS = [
  "check", "x", "warning", "info", "star", "heart", "fire", "sparkles",
  "lightbulb", "moon", "sun", "cloud", "rain", "snow", "wind", "leaf",
  "flower", "tree"
] as const;

export type IconId = (typeof ICON_IDS)[number];

export interface GaugeOutput {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  label?: string;
  explanation?: string;
}

export interface PixelArtOutput {
  colors: Record<string, string>; // e.g., { transparent: 'transparent', white: '#f0f0f0', ... }
  grid: string[]; // Array of strings, each string is a row
  width?: number; // Optional, can be inferred from grid
  height?: number; // Optional, can be inferred from grid
  explanation?: string;
}

export interface WebhookOutput {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  explanation?: string;
  response?: {
    status: number;
    body: unknown;
  };
}

export interface SurveyOutput {
  question: string;
  options: Array<{ id: string; label: string }>;
  allowMultiple?: boolean;
  explanation?: string;
  selectedIds?: string[];
}

// Map output types to their data types
export interface OutputDataByType {
  text: TextOutput;
  color: ColorOutput;
  icon: IconOutput;
  emoji: EmojiOutput;
  gauge: GaugeOutput;
  pixel_art: PixelArtOutput;
  webhook: WebhookOutput;
  survey: SurveyOutput;
}

// ─────────────────────────────────────────────────────────────────
// Model Configuration
// ─────────────────────────────────────────────────────────────────

export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "claude-3-haiku-20240307", name: "Claude Haiku 3" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

// ─────────────────────────────────────────────────────────────────
// API Types (for /api/inference compatibility)
// ─────────────────────────────────────────────────────────────────

export interface InferenceRequest {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
  genieContext?: string;
}

export interface InferenceResponse {
  response: string;
  error?: string;
  toolCalls?: Array<{ toolName: string; toolId: string; input: Record<string, unknown> }>;
}

export interface GenieMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenieOutput {
  messages: GenieMessage[];
  lastUpdated?: number;
}

// Pipeline execution request
export interface PipelineExecutionRequest {
  pipeline: Pipeline;
  userInputs: Record<string, string>;
}

export interface PipelineExecutionResponse {
  context: PipelineContext;
  error?: string;
}
