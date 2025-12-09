import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

interface ToolCallResult {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

interface InferenceRequest {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
  tools?: Tool[];
}

interface InferenceResponse {
  response: string;
  toolCalls: ToolCallResult[];
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<InferenceResponse>> {
  try {
    const body: InferenceRequest = await request.json();
    const { systemPrompt, userMessage, model, temperature, tools } = body;

    if (!userMessage?.trim()) {
      return NextResponse.json(
        { response: "", toolCalls: [], error: "User message is required" },
        { status: 400 }
      );
    }

    const posthogApiKey = process.env.POSTHOG_API_KEY;
    const posthogProjectId = process.env.POSTHOG_PROJECT_ID;
    const posthogApiUrl = process.env.POSTHOG_API_URL || "https://us.posthog.com";

    if (!posthogApiKey || !posthogProjectId) {
      return NextResponse.json(
        { response: "", toolCalls: [], error: "PostHog API credentials not configured" },
        { status: 500 }
      );
    }

    const gatewayUrl = `${posthogApiUrl}/api/projects/${posthogProjectId}/llm_gateway`;

    const client = new Anthropic({
      baseURL: gatewayUrl,
      apiKey: posthogApiKey,
      defaultHeaders: {
        Authorization: `Bearer ${posthogApiKey}`,
      },
    });

    // Build the request options
    const requestOptions: Parameters<typeof client.messages.create>[0] = {
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature,
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestOptions.tools = tools;
    }

    const message = await client.messages.create(requestOptions) as Anthropic.Message;

    // Extract text response and tool calls
    let responseText = "";
    const toolCalls: ToolCallResult[] = [];

    for (const block of message.content) {
      if (block.type === "text") {
        responseText += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          toolName: block.name,
          toolId: block.id,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    return NextResponse.json({ response: responseText, toolCalls });
  } catch (error) {
    console.error("Inference error:", error);
    return NextResponse.json(
      {
        response: "",
        toolCalls: [],
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
