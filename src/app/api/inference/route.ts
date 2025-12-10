import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { AUTH_COOKIE_NAME, OAUTH_CONFIG } from "@/lib/auth/constants";
import type { StoredAuthData } from "@/lib/auth/oauth";

interface ToolCallResult {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

interface ImageData {
  type: "base64";
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string;
}

interface InferenceRequest {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
  tools?: Tool[];
  toolChoice?: "auto" | "any" | { type: "tool"; name: string };
  images?: ImageData[];
}

interface InferenceResponse {
  response: string;
  toolCalls: ToolCallResult[];
  error?: string;
}

/**
 * Get authentication credentials from OAuth cookie or environment variables
 */
async function getAuthCredentials(): Promise<{
  apiKey: string;
  projectId: string;
  apiUrl: string;
} | null> {
  // Try OAuth token first
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (authCookie) {
    try {
      const authData: StoredAuthData = JSON.parse(authCookie);

      // Check if token is expired
      if (authData.expiresAt > Date.now()) {
        const config = OAUTH_CONFIG[authData.region];
        return {
          apiKey: authData.accessToken,
          projectId: String(authData.projectId),
          apiUrl: config.baseUrl,
        };
      }
    } catch {
      // Invalid cookie, fall through to env vars
    }
  }

  // Fall back to environment variables (for local dev or server-side usage)
  const posthogApiKey = process.env.POSTHOG_API_KEY;
  const posthogProjectId = process.env.POSTHOG_PROJECT_ID;
  const posthogApiUrl = process.env.POSTHOG_API_URL || "https://us.posthog.com";

  if (posthogApiKey && posthogProjectId) {
    return {
      apiKey: posthogApiKey,
      projectId: posthogProjectId,
      apiUrl: posthogApiUrl,
    };
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse<InferenceResponse>> {
  try {
    const body: InferenceRequest = await request.json();
    const { systemPrompt, userMessage, model, temperature, tools, toolChoice, images } = body;

    if (!userMessage?.trim()) {
      return NextResponse.json(
        { response: "", toolCalls: [], error: "User message is required" },
        { status: 400 }
      );
    }

    const credentials = await getAuthCredentials();

    if (!credentials) {
      return NextResponse.json(
        { response: "", toolCalls: [], error: "Not authenticated. Please log in with PostHog." },
        { status: 401 }
      );
    }

    const gatewayUrl = `${credentials.apiUrl}/api/projects/${credentials.projectId}/llm_gateway`;

    const client = new Anthropic({
      baseURL: gatewayUrl,
      apiKey: credentials.apiKey,
      defaultHeaders: {
        Authorization: `Bearer ${credentials.apiKey}`,
      },
    });

    // Build message content (text + optional images)
    type MediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: MediaType; data: string } };

    const messageContent: ContentBlock[] = [];

    // Add images first (Claude processes images better when they come before text)
    if (images && images.length > 0) {
      for (const img of images) {
        messageContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mediaType as MediaType,
            data: img.data,
          },
        });
      }
    }

    // Add the text message
    messageContent.push({ type: "text", text: userMessage });

    // Build the request options
    const requestOptions: Parameters<typeof client.messages.create>[0] = {
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: messageContent }],
      temperature,
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestOptions.tools = tools;
      // Use tool_choice if provided, default to "auto" so model decides when to use tools
      if (toolChoice) {
        requestOptions.tool_choice = toolChoice as Anthropic.ToolChoice;
      } else {
        requestOptions.tool_choice = { type: "auto" } as Anthropic.ToolChoice;
      }
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
