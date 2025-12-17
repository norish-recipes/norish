import { AIProvider, ImageInput } from "./base";

import { parseJsonWithRepair } from "@/lib/helpers";
import { aiLogger } from "@/server/logger";

export interface OllamaProviderConfig {
  endpoint: string;
  model: string;
  visionModel?: string;
  temperature?: number;
}

export class OllamaProvider implements AIProvider {
  name = "Ollama";
  private config: OllamaProviderConfig;

  constructor(config: OllamaProviderConfig) {
    this.config = config;
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: any,
    systemMessage = "Return valid JSON only."
  ): Promise<T | null> {
    try {
      const fullPrompt = `${systemMessage}\n\n${prompt}`;

      const response = await fetch(`${this.config.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          prompt: fullPrompt,
          stream: false,
          format: schema,
          options: {
            temperature: this.config.temperature ?? 1.0,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.response?.trim() || "{}";
      const parsed = parseJsonWithRepair(content);

      return (Array.isArray(parsed) ? parsed[0] : parsed) as T;
    } catch (error) {
      aiLogger.error({ err: error, provider: this.name }, "AI provider error");

      return null;
    }
  }

  async generateFromImages<T>(
    images: ImageInput[],
    prompt: string,
    schema: any,
    systemMessage = "Extract recipe data from these images and return valid JSON only."
  ): Promise<T | null> {
    try {
      const visionModel = this.config.visionModel || this.config.model;

      const imageData = images.map((img) => img.data);

      aiLogger.debug(
        { provider: this.name, imageCount: images.length, model: visionModel },
        "Sending images to Ollama vision model"
      );

      const response = await fetch(`${this.config.endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: "system",
              content: systemMessage,
            },
            {
              role: "user",
              content: prompt,
              images: imageData,
            },
          ],
          stream: false,
          format: schema,
          options: {
            temperature: this.config.temperature ?? 1.0,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama vision API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.message?.content?.trim() || "{}";
      const parsed = parseJsonWithRepair(content);

      return (Array.isArray(parsed) ? parsed[0] : parsed) as T;
    } catch (error) {
      aiLogger.error({ err: error, provider: this.name }, "AI vision provider error");

      return null;
    }
  }
}
