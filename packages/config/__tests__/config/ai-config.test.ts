import { describe, expect, it } from "vitest";

import type { ImageGenerationConfig } from "@norish/config/zod/server-config";
import {
  AIConfigSchema,
  DEFAULT_AUTOMATIC_ENRICHMENT,
  ImageGenerationConfigSchema,
  isImageGenerationConfigValid,
  resolveImageGenerationSettings,
} from "@norish/config/zod/server-config";

const base = {
  enabled: true,
  provider: "openai" as const,
  model: "gpt-5-mini",
  temperature: 1,
  maxTokens: 10000,
};

function parse(input: Record<string, unknown>) {
  return AIConfigSchema.parse({ ...base, ...input });
}

describe("AIConfigSchema automatic enrichment", () => {
  it("defaults new installations to the documented switches", () => {
    const config = parse({});

    expect(config.automaticEnrichment).toEqual({
      autoTagging: false,
      allergyDetection: true,
      autoCategorization: false,
      nutritionEstimation: false,
      recipeProvenance: false,
      // A new kind ships off: an upgrade must not silently spend AI.
      ingredientLinking: false,
      imageGeneration: false,
    });
    expect(config.automaticEnrichment).toEqual(DEFAULT_AUTOMATIC_ENRICHMENT);
  });

  it("defaults the tag strategy to predefined", () => {
    expect(parse({}).tagStrategy).toBe("predefined");
  });

  it("defaults the cuisine strategy to the restrictive one", () => {
    // An administrator opts in to letting AI mint Cuisines; it is never the
    // default, and it is independent of every automatic switch.
    expect(parse({}).cuisineStrategy).toBe("existing");
    expect(parse({ cuisineStrategy: "extend" }).cuisineStrategy).toBe("extend");
    expect(parse({ cuisineStrategy: "extend" }).automaticEnrichment.recipeProvenance).toBe(false);
  });

  it("keeps explicit canonical values", () => {
    const config = parse({
      tagStrategy: "freeform",
      automaticEnrichment: {
        autoTagging: true,
        allergyDetection: false,
        autoCategorization: true,
        nutritionEstimation: true,
        recipeProvenance: true,
        ingredientLinking: true,
        imageGeneration: true,
      },
    });

    expect(config.tagStrategy).toBe("freeform");
    expect(config.automaticEnrichment).toEqual({
      autoTagging: true,
      allergyDetection: false,
      autoCategorization: true,
      nutritionEstimation: true,
      recipeProvenance: true,
      ingredientLinking: true,
      imageGeneration: true,
    });
  });

  it("leaves image generation off for stored config that predates the kind", () => {
    // The seventh switch arrives through the same fallback as its siblings:
    // a row written before it existed parses with the kind off, never on.
    const config = parse({
      automaticEnrichment: { autoTagging: true, allergyDetection: true },
    });

    expect(config.automaticEnrichment.imageGeneration).toBe(false);
  });

  it("drops the legacy fields from the canonical output", () => {
    const config = parse({ autoTaggingMode: "freeform", autoTagAllergies: false });

    expect(config).not.toHaveProperty("autoTaggingMode");
    expect(config).not.toHaveProperty("autoTagAllergies");
  });
});

describe("AIConfigSchema legacy migration", () => {
  it("migrates a disabled tagging mode to automation off with predefined retained", () => {
    const config = parse({ autoTaggingMode: "disabled" });

    expect(config.automaticEnrichment.autoTagging).toBe(false);
    expect(config.tagStrategy).toBe("predefined");
  });

  it.each(["predefined", "predefined_db", "freeform"] as const)(
    "migrates the %s tagging mode to automation on with the same strategy",
    (mode) => {
      const config = parse({ autoTaggingMode: mode });

      expect(config.automaticEnrichment.autoTagging).toBe(true);
      expect(config.tagStrategy).toBe(mode);
    }
  );

  it("migrates the legacy allergy switch directly", () => {
    expect(parse({ autoTagAllergies: false }).automaticEnrichment.allergyDetection).toBe(false);
    expect(parse({ autoTagAllergies: true }).automaticEnrichment.allergyDetection).toBe(true);
  });

  it("leaves the new category and nutrition controls off when upgrading", () => {
    const config = parse({ autoTaggingMode: "freeform", autoTagAllergies: true });

    expect(config.automaticEnrichment.autoCategorization).toBe(false);
    expect(config.automaticEnrichment.nutritionEstimation).toBe(false);
  });

  it("lets canonical values win over legacy ones", () => {
    const config = parse({
      autoTaggingMode: "disabled",
      tagStrategy: "freeform",
      automaticEnrichment: { autoTagging: true },
    });

    expect(config.tagStrategy).toBe("freeform");
    expect(config.automaticEnrichment.autoTagging).toBe(true);
  });

  it("is idempotent when re-parsing its own output", () => {
    const once = parse({ autoTaggingMode: "predefined_db", autoTagAllergies: false });
    const twice = AIConfigSchema.parse(once);

    expect(twice).toEqual(once);
  });
});

describe("ImageGenerationConfigSchema", () => {
  function imageConfig(overrides: Partial<ImageGenerationConfig> = {}): ImageGenerationConfig {
    return ImageGenerationConfigSchema.parse({
      provider: "openai",
      model: "gpt-image-1",
      apiKey: "image-key",
      ...overrides,
    });
  }

  it("accepts only providers whose SDK package exposes an image model", () => {
    for (const provider of ["openai", "google", "azure", "ollama", "lm-studio", "generic-openai"]) {
      expect(ImageGenerationConfigSchema.parse({ provider, model: "m" }).provider).toBe(provider);
    }
    expect(ImageGenerationConfigSchema.parse({ provider: "disabled" }).provider).toBe("disabled");
  });

  it.each(["anthropic", "mistral", "deepseek", "groq", "perplexity"])(
    "refuses %s, which exposes no image model",
    (provider) => {
      expect(() => ImageGenerationConfigSchema.parse({ provider, model: "m" })).toThrow();
    }
  );

  it("has no timeout of its own", () => {
    // ADR-0015: there is one AI timeout, and image generation runs under it.
    expect(imageConfig()).not.toHaveProperty("timeoutMs");
  });

  describe("resolveImageGenerationSettings", () => {
    const aiConfig = { provider: "openai", endpoint: "https://ai.example", apiKey: "ai-key" };

    it("falls back to the AI configuration when the provider matches", () => {
      const settings = resolveImageGenerationSettings(
        imageConfig({ apiKey: undefined, endpoint: undefined }),
        aiConfig
      );

      expect(settings).toEqual({ endpoint: "https://ai.example", apiKey: "ai-key" });
    });

    it("does not fall back when the provider differs", () => {
      const settings = resolveImageGenerationSettings(
        imageConfig({ provider: "google", apiKey: undefined, endpoint: undefined }),
        aiConfig
      );

      expect(settings).toEqual({ endpoint: undefined, apiKey: undefined });
    });

    it("prefers the block's own endpoint and key over the fallback", () => {
      const settings = resolveImageGenerationSettings(
        imageConfig({ endpoint: "https://images.example", apiKey: "own-key" }),
        aiConfig
      );

      expect(settings).toEqual({ endpoint: "https://images.example", apiKey: "own-key" });
    });
  });

  describe("isImageGenerationConfigValid", () => {
    it("ships unconfigured: no stored block means no image provider", () => {
      expect(isImageGenerationConfigValid(null, null)).toBe(false);
    });

    it("is unconfigured when the provider is disabled or the model is blank", () => {
      expect(isImageGenerationConfigValid(imageConfig({ provider: "disabled" }), null)).toBe(false);
      expect(isImageGenerationConfigValid(imageConfig({ model: "  " }), null)).toBe(false);
      expect(isImageGenerationConfigValid(imageConfig({ model: undefined }), null)).toBe(false);
    });

    it("requires a key for cloud providers, honouring the matching-provider fallback", () => {
      const keyless = imageConfig({ apiKey: undefined });

      expect(isImageGenerationConfigValid(keyless, null)).toBe(false);
      expect(isImageGenerationConfigValid(keyless, { provider: "openai", apiKey: "ai-key" })).toBe(
        true
      );
      expect(
        isImageGenerationConfigValid(keyless, { provider: "anthropic", apiKey: "ai-key" })
      ).toBe(false);
    });

    it.each([
      ["lm-studio", "http://localhost:1234"],
      ["ollama", "http://localhost:11434"],
    ] as const)("requires an endpoint for %s, and no key", (provider, endpoint) => {
      const local = imageConfig({ provider, apiKey: undefined, endpoint: undefined });

      expect(isImageGenerationConfigValid(local, null)).toBe(false);
      expect(isImageGenerationConfigValid(imageConfig({ ...local, endpoint }), null)).toBe(true);
    });

    it("borrows the AI configuration's Ollama endpoint when the provider matches", () => {
      const local = imageConfig({ provider: "ollama", apiKey: undefined, endpoint: undefined });

      expect(
        isImageGenerationConfigValid(local, { provider: "ollama", endpoint: "http://ollama:11434" })
      ).toBe(true);
    });
  });
});
