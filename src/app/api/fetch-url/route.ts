import { NextResponse } from "next/server";
import { NodeHtmlMarkdown } from "node-html-markdown";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP/HTTPS URLs are supported" },
        { status: 400 }
      );
    }

    // Try to fetch .md version first
    const mdUrl = url.endsWith("/")
      ? url.slice(0, -1) + ".md"
      : url + ".md";

    let content: string;
    let finalUrl: string = url;

    // Try markdown version first
    try {
      const mdResponse = await fetch(mdUrl, {
        headers: {
          "User-Agent": "aili5-url-loader/1.0",
          "Accept": "text/markdown, text/plain, */*",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (mdResponse.ok) {
        const contentType = mdResponse.headers.get("content-type") || "";
        // Check if it's actually markdown or plain text
        if (
          contentType.includes("text/markdown") ||
          contentType.includes("text/plain") ||
          contentType.includes("text/x-markdown")
        ) {
          content = await mdResponse.text();
          finalUrl = mdUrl;
        } else {
          // Fall through to HTML fetch
          throw new Error("Not markdown");
        }
      } else {
        // Fall through to HTML fetch
        throw new Error("MD not found");
      }
    } catch {
      // Fetch original URL and convert HTML to markdown
      const response = await fetch(url, {
        headers: {
          "User-Agent": "aili5-url-loader/1.0",
          "Accept": "text/html, application/xhtml+xml, */*",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
          { status: 502 }
        );
      }

      const contentType = response.headers.get("content-type") || "";
      const html = await response.text();

      // If it's HTML, convert to markdown
      if (contentType.includes("text/html") || html.trim().startsWith("<!") || html.trim().startsWith("<html")) {
        const nhm = new NodeHtmlMarkdown({
          codeFence: "```",
          bulletMarker: "-",
          codeBlockStyle: "fenced",
          emDelimiter: "_",
          strongDelimiter: "**",
          strikeDelimiter: "~~",
        });
        content = nhm.translate(html);
      } else {
        // Plain text or other format
        content = html;
      }
    }

    // Clean up content - remove excessive whitespace
    content = content
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Limit content size (100KB max)
    const maxSize = 100 * 1024;
    if (content.length > maxSize) {
      content = content.slice(0, maxSize) + "\n\n[Content truncated...]";
    }

    return NextResponse.json({
      url: finalUrl,
      content,
      originalUrl: url,
      contentLength: content.length,
    });
  } catch (error) {
    console.error("URL fetch error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch URL: ${message}` },
      { status: 500 }
    );
  }
}
