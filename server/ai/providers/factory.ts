import { AIProvider } from "./base";
import { OpenAIProvider } from "./openai";
import { OllamaProvider } from "./ollama";
import { LMStudioProvider } from "./lm-studio";
import { GenericOpenAIProvider } from "./generic-openai";

import { getAIConfig } from "@/config/server-config-loader";

export async function getAIProvider(): Promise<AIProvider> {
  const config = await getAIConfig(true);

  if (!config || !config.enabled) {
    throw new Error("AI is not enabled. Configure AI settings in the admin panel.");
  }

  const { provider, model, visionModel, endpoint, apiKey, temperature, maxTokens } = config;

  switch (provider) {
    case "openai":
      if (!apiKey) throw new Error("API Key is required for OpenAI provider");

      return new OpenAIProvider({ apiKey, model, visionModel, temperature, maxTokens });

    case "ollama":
      if (!endpoint) throw new Error("Endpoint is required for Ollama provider");

      return new OllamaProvider({ endpoint, model, visionModel, temperature });

    case "lm-studio":
      if (!endpoint) throw new Error("Endpoint is required for LM Studio provider");

      return new LMStudioProvider({ endpoint, model, visionModel, temperature, maxTokens });

    case "generic-openai":
      if (!endpoint) throw new Error("Endpoint is required for Generic OpenAI provider");

      return new GenericOpenAIProvider({
        endpoint,
        apiKey,
        model,
        visionModel,
        temperature,
        maxTokens,
      });

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
