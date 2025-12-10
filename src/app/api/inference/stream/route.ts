import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { AUTH_COOKIE_NAME, OAUTH_CONFIG } from "@/lib/auth/constants";
import type { StoredAuthData } from "@/lib/auth/oauth";

interface StreamRequest {
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature: number;
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

export async function POST(request: NextRequest) {
  try {
    const body: StreamRequest = await request.json();
    const { systemPrompt, userMessage, model, temperature } = body;

    if (!userMessage?.trim()) {
      return new Response(
        JSON.stringify({ error: "User message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const credentials = await getAuthCredentials();

    if (!credentials) {
      return new Response(
        JSON.stringify({ error: "Not authenticated. Please log in with PostHog." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
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

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messageStream = await client.messages.stream({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
            temperature,
          });

          for await (const event of messageStream) {
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if ("text" in delta) {
                // Send text chunk as SSE
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`)
                );
              }
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream request error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
