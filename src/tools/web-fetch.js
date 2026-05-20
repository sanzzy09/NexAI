export const definition = {
  type: "function",
  function: {
    name: "web_fetch",
    description: "Fetch web content from a URL via HTTP GET or POST. Cleans HTML tags, scripts, and styles to return token-friendly plain text or parsed JSON.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The HTTP/HTTPS URL to fetch." },
        method: { type: "string", enum: ["GET", "POST"], description: "The HTTP method to use. Defaults to GET." },
        headers: { type: "object", description: "Optional key-value pairs of HTTP request headers." },
        body: { type: "string", description: "Optional stringified body content (for POST requests)." }
      },
      required: ["url"]
    }
  }
};

function cleanHtml(html) {
  if (!html) return "";
  // Remove script, style, noscript, head, and iframe tags along with their content
  let text = html.replace(/<(script|style|noscript|iframe|head)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove all other HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  // Collapse multiple spaces/newlines to a single space
  text = text.replace(/\s+/g, ' ');
  // Decode basic HTML entities
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return text.trim();
}

export async function execute(args) {
  const { url, method = "GET", headers = {}, body = null } = args;
  console.log(`[WEB_FETCH] Fetching URL: ${url} (${method})`);

  try {
    const fetchOptions = {
      method,
      headers: {
        "User-Agent": "NEX-AI-Agent/1.0",
        ...headers
      }
    };

    if (method === "POST" && body) {
      fetchOptions.body = body;
      if (!fetchOptions.headers["Content-Type"]) {
        fetchOptions.headers["Content-Type"] = "application/json";
      }
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    console.log(`[WEB_FETCH] Response status: ${response.status} (${response.statusText})`);
    console.log(`[WEB_FETCH] Content-Type: ${contentType}`);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const rawBody = await response.text();

    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(rawBody);
        return JSON.stringify({
          success: true,
          status: response.status,
          contentType,
          data: parsed
        });
      } catch {
        // Fallback to text if JSON parsing fails
      }
    }

    // If HTML, clean it for LLM digestion
    const isHtml = contentType.includes("text/html");
    const cleanedText = isHtml ? cleanHtml(rawBody) : rawBody.trim();

    // Cap output size at 50,000 characters to prevent token overflow
    const maxChars = 50000;
    const truncatedText = cleanedText.length > maxChars 
      ? cleanedText.substring(0, maxChars) + "\n\n...[Content truncated for token size]..."
      : cleanedText;

    return JSON.stringify({
      success: true,
      status: response.status,
      contentType,
      content: truncatedText
    });

  } catch (error) {
    console.log(`[WEB_FETCH] Error fetching URL: ${error.message}`);
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
}
