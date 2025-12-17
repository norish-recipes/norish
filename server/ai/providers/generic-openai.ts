import { AIProvider, ImageInput } from "./base";

import { parseJsonWithRepair } from "@/lib/helpers";
import { aiLogger } from "@/server/logger";

export interface GenericOpenAIProviderConfig {
  endpoint: string;
  apiKey?: string;
  model: string;
  visionModel?: string;
  temperature?: number;
  maxTokens?: number;
}

export class GenericOpenAIProvider implements AIProvider {
  name = "Generic OpenAI Compatible";
  private config: GenericOpenAIProviderConfig;

  constructor(config: GenericOpenAIProviderConfig) {
    this.config = config;
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: any,
    systemMessage = "Return valid JSON only."
  ): Promise<T | null> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.config.apiKey) {
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(`${this.config.endpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.config.model,
          temperature: this.config.temperature ?? 1.0,
          max_tokens: this.config.maxTokens,
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response",
              strict: true,
              schema,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Generic OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim() || "{}";
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.config.apiKey) {
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      }

      // Build image content parts (OpenAI vision API format)
      const imageContent = images.map((img) => ({
        type: "image_url",
        image_url: {
          url: `data:${img.mimeType};base64,${img.data}`,
          detail: "high",
        },
      }));

      const visionModel = this.config.visionModel || this.config.model;

      aiLogger.debug(
        { provider: this.name, imageCount: images.length, model: visionModel },
        "Sending images to vision model"
      );

      const response = await fetch(`${this.config.endpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: visionModel,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens || 4096,
          messages: [
            { role: "system", content: systemMessage },
            {
              role: "user",
              content: [...imageContent, { type: "text", text: prompt }],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "recipe_response",
              strict: true,
              schema,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Generic OpenAI vision API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim() || "{}";
      const parsed = parseJsonWithRepair(content);

      return (Array.isArray(parsed) ? parsed[0] : parsed) as T;
    } catch (error) {
      aiLogger.error({ err: error, provider: this.name }, "AI vision provider error");

      return null;
    }
  }
}
