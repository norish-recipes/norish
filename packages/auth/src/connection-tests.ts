import {
  normalizeAzureEndpoint,
  normalizeOllamaEndpoint,
  normalizeOpenAICompatibleEndpoint,
} from "@norish/shared-server/ai/runtime/endpoints";
import { aiLogger } from "@norish/shared-server/logger";

export async function testOIDCProvider(config: {
  issuer: string;
  wellknown?: string;
}): Promise<{ success: boolean; error?: string }> {
  const wellKnownUrl =
    config.wellknown || `${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;

  try {
    const response = await fetch(wellKnownUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch OIDC configuration: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    const config = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    if (!config || !("authorization_endpoint" in config) || !("token_endpoint" in config)) {
      return {
        success: false,
        error: "Invalid OIDC configuration: missing required endpoints",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to OIDC provider",
    };
  }
}

export async function testGitHubProvider(config: {
  clientId: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!/^[a-zA-Z0-9]{20}$/.test(config.clientId)) {
    return {
      success: false,
      error: "Invalid GitHub Client ID format",
    };
  }

  return { success: true };
}

export async function testGoogleProvider(config: {
  clientId: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!config.clientId.endsWith(".apps.googleusercontent.com")) {
    return {
      success: false,
      error: "Invalid Google Client ID format",
    };
  }

  return { success: true };
}

async function testPerplexityConnection(
  apiKey?: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey) {
    return { success: false, error: "API key is required for Perplexity" };
  }

  try {
    // Perplexity doesn't have a /models endpoint, so we use a minimal chat completion request
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      if (response.status === 401) {
        return { success: false, error: "Invalid API key" };
      }

      return {
        success: false,
        error: `Failed to connect: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to Perplexity",
    };
  }
}

/**
 * The URL a failed test attempted, with any credential in the query string
 * removed — Google AI carries its API key there, and a log line is not the
 * place for it.
 */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);

    for (const key of parsed.searchParams.keys()) {
      parsed.searchParams.set(key, "***");
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Ask a provider whether the configured endpoint and key work.
 *
 * The URL is built with the same normalization the AI Runtime uses, because a
 * test that addresses a different URL than the real requests do tests nothing:
 * an `…/api/v1` base URL used to have a second `/v1` appended here only, so a
 * working OpenRouter configuration answered 404 to its own test while every
 * enrichment job succeeded (#537).
 */
export async function testAIEndpoint(config: {
  provider: string;
  endpoint?: string;
  apiKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  let testUrl: string;

  switch (config.provider) {
    case "openai":
      testUrl = "https://api.openai.com/v1/models";
      break;
    case "azure":
      if (config.endpoint) {
        testUrl = `${normalizeAzureEndpoint(config.endpoint)}/models?api-version=2024-02-01`;
      } else {
        // Without an endpoint, we can only validate that an API key was provided
        if (!config.apiKey) {
          return { success: false, error: "API key is required for Azure OpenAI" };
        }

        return { success: true }; // Can't test without endpoint, assume valid if API key provided
      }
      break;
    case "anthropic":
      testUrl = "https://api.anthropic.com/v1/models";
      break;
    case "google":
      if (!config.apiKey) {
        return { success: false, error: "API key is required for Google AI" };
      }
      testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`;
      break;
    case "mistral":
      testUrl = "https://api.mistral.ai/v1/models";
      break;
    case "deepseek":
      testUrl = "https://api.deepseek.com/models";
      break;
    case "groq":
      testUrl = "https://api.groq.com/openai/v1/models";
      break;
    case "ollama":
      if (!config.endpoint) {
        return { success: false, error: "Endpoint is required for Ollama" };
      }
      testUrl = `${normalizeOllamaEndpoint(config.endpoint)}/api/tags`;
      break;
    case "lm-studio":
      if (!config.endpoint) {
        return { success: false, error: "Endpoint is required for LM Studio" };
      }
      testUrl = `${normalizeOpenAICompatibleEndpoint(config.endpoint)}/models`;
      break;
    case "generic-openai":
      if (!config.endpoint) {
        return { success: false, error: "Endpoint is required for generic OpenAI" };
      }
      testUrl = `${normalizeOpenAICompatibleEndpoint(config.endpoint)}/models`;
      break;
    case "perplexity":
      // Perplexity doesn't have a /models endpoint, use chat completions with minimal request
      return testPerplexityConnection(config.apiKey);
    default:
      return { success: false, error: `Unknown provider: ${config.provider}` };
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    // Different providers use different auth headers
    if (config.apiKey) {
      switch (config.provider) {
        case "anthropic":
          headers["x-api-key"] = config.apiKey;
          headers["anthropic-version"] = "2023-06-01";
          break;
        case "azure":
          headers["api-key"] = config.apiKey;
          break;
        case "google":
          // Google uses query param, already included in URL
          break;
        default:
          // Most providers use Bearer token
          headers["Authorization"] = `Bearer ${config.apiKey}`;
          break;
      }
    }

    const response = await fetch(testUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      // The mutation answers `{ success: false }` rather than throwing, so this
      // is the only record of what was attempted. Without the URL and status a
      // failing test leaves no breadcrumb anywhere — not in Norish's log, and
      // not in the provider's, when the request never reached it (#537).
      aiLogger.warn(
        {
          provider: config.provider,
          url: redactUrl(testUrl),
          status: response.status,
          statusText: response.statusText,
        },
        "AI endpoint test failed"
      );

      return {
        success: false,
        error: `Failed to connect: ${response.status} ${response.statusText}`,
      };
    }

    aiLogger.debug(
      { provider: config.provider, url: redactUrl(testUrl), status: response.status },
      "AI endpoint test succeeded"
    );

    return { success: true };
  } catch (error) {
    aiLogger.warn(
      { err: error, provider: config.provider, url: redactUrl(testUrl) },
      "AI endpoint test could not reach the provider"
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to AI endpoint",
    };
  }
}
