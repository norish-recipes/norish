import { describe, expect, it } from "vitest";

import { AIConfigSchema, DEFAULT_AUTOMATIC_ENRICHMENT } from "@norish/config/zod/server-config";

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
    });
    expect(config.automaticEnrichment).toEqual(DEFAULT_AUTOMATIC_ENRICHMENT);
  });

  it("defaults the tag strategy to predefined", () => {
    expect(parse({}).tagStrategy).toBe("predefined");
  });

  it("keeps explicit canonical values", () => {
    const config = parse({
      tagStrategy: "freeform",
      automaticEnrichment: {
        autoTagging: true,
        allergyDetection: false,
        autoCategorization: true,
        nutritionEstimation: true,
      },
    });

    expect(config.tagStrategy).toBe("freeform");
    expect(config.automaticEnrichment).toEqual({
      autoTagging: true,
      allergyDetection: false,
      autoCategorization: true,
      nutritionEstimation: true,
    });
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
