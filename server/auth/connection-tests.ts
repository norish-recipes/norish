import { aiLogger } from "../logger";

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

    if (!data.authorization_endpoint || !data.token_endpoint) {
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
      // Azure uses deployment-specific endpoints, but we can test the base API
      // If endpoint is provided, use it; otherwise we can't really test without knowing the resource URL
      if (config.endpoint) {
        testUrl = `${config.endpoint.replace(/\/$/, "")}/openai/models?api-version=2024-02-01`;
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
      testUrl = `${config.endpoint.replace(/\/$/, "")}/api/tags`;
      break;
    case "lm-studio":
      if (!config.endpoint) {
        return { success: false, error: "Endpoint is required for LM Studio" };
      }
      testUrl = `${config.endpoint.replace(/\/$/, "")}/v1/models`;
      break;
    case "generic-openai":
      if (!config.endpoint) {
        return { success: false, error: "Endpoint is required for generic OpenAI" };
      }
      testUrl = `${config.endpoint.replace(/\/$/, "")}/v1/models`;
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

    aiLogger.debug(
      { status: response.status, statusText: response.statusText, url: testUrl },
      "Test AI endpoint"
    );
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to connect: ${response.status} ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to AI endpoint",
    };
  }
}
