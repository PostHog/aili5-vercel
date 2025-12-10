import type {
  SelfInferencingNodeBehavior,
  SelfInferencingNodeConfig,
  ConversationState,
} from "./types";

/**
 * Genie behavior definition
 *
 * The genie is a self-inferencing node that:
 * - Has a name and backstory (systemPrompt)
 * - Maintains its own conversation history
 * - Can have its backstory updated by external inference
 */
export const genieBehavior: SelfInferencingNodeBehavior = {
  buildIdentityPrompt: (
    config: SelfInferencingNodeConfig,
    conversation: ConversationState
  ): string => {
    let prompt = `You are ${config.name}. Act as ${config.name} would act. ${config.systemPrompt}`;

    if (conversation.messages.length > 0) {
      prompt += "\n\nYour previous conversation:\n";
      for (const msg of conversation.messages) {
        if (msg.role === "user") {
          prompt += `User: ${msg.content}\n`;
        } else {
          prompt += `${config.name}: ${msg.content}\n`;
        }
      }
    }

    return prompt;
  },

  formatContextForOthers: (
    config: SelfInferencingNodeConfig,
    conversation: ConversationState
  ): string => {
    let context = `\n\nGenie Context (name: ${config.name}):\n`;
    context += `[Backstory: ${config.systemPrompt}]\n\nConversation:\n`;

    for (const msg of conversation.messages) {
      if (msg.role === "user") {
        context += `User: ${msg.content}\n`;
      } else {
        context += `${config.name}: ${msg.content}\n`;
      }
    }

    return context;
  },

  onExternalUpdate: (
    _config: SelfInferencingNodeConfig,
    update: unknown
  ): Partial<SelfInferencingNodeConfig> => {
    const typed = update as { backstory?: string };
    if (typed.backstory) {
      return { systemPrompt: typed.backstory };
    }
    return {};
  },

  getInitializationPrompt: (_config: SelfInferencingNodeConfig): string => {
    return "Introduce yourself.";
  },
};
