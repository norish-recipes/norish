/**
 * The Decision Model block (ADR-0035): its own provider and key, the model
 * and endpoint defaults, and the one-list selection of uses that is all on
 * the moment a Decision Model is configured.
 */
import { describe, expect, it } from "vitest";

import type { DecisionConfig } from "@norish/config/zod/server-config";
import {
  DECISION_USES,
  DecisionConfigSchema,
  DEFAULT_DECISION_ENDPOINT,
  DEFAULT_DECISION_MODEL,
  isDecisionConfigValid,
  isDecisionUseSelected,
  resolveDecisionSettings,
  selectedDecisionUses,
  SENSITIVE_CONFIG_KEYS,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";

function decisionConfig(overrides: Partial<DecisionConfig> = {}): DecisionConfig {
  return DecisionConfigSchema.parse({
    provider: "typesafe",
    apiKey: "ts-key",
    ...overrides,
  });
}

describe("DecisionConfigSchema", () => {
  it("accepts TypeSafe and disabled, and nothing else", () => {
    expect(decisionConfig().provider).toBe("typesafe");
    expect(DecisionConfigSchema.parse({ provider: "disabled" }).provider).toBe("disabled");
    expect(() => DecisionConfigSchema.parse({ provider: "openai" })).toThrow();
  });

  it("is a sensitive key, so the stored key rides the shared merge and mask", () => {
    expect(SENSITIVE_CONFIG_KEYS).toContain(ServerConfigKeys.DECISION_CONFIG);
  });

  it("has no timeout of its own", () => {
    // ADR-0015: there is one AI timeout, and a Decision runs under it.
    expect(decisionConfig()).not.toHaveProperty("timeoutMs");
  });

  it("refuses an endpoint that is not a URL and an unknown use", () => {
    expect(() => decisionConfig({ endpoint: "not a url" })).toThrow();
    expect(() =>
      DecisionConfigSchema.parse({ provider: "typesafe", uses: ["importTriage"] })
    ).toThrow();
  });

  it("lists every use in the order the form shows them", () => {
    expect(DECISION_USES).toEqual([
      "autoCategorization",
      "allergyDetection",
      "recipeProvenance",
      "groceryLinking",
      "validateEnrichments",
    ]);
  });
});

describe("resolveDecisionSettings", () => {
  it("fills the model and endpoint defaults", () => {
    expect(resolveDecisionSettings(decisionConfig())).toEqual({
      provider: "typesafe",
      apiKey: "ts-key",
      model: DEFAULT_DECISION_MODEL,
      endpoint: DEFAULT_DECISION_ENDPOINT,
    });
    expect(DEFAULT_DECISION_MODEL).toBe("jev-latest");
    expect(DEFAULT_DECISION_ENDPOINT).toBe("https://api.typesafe.ai/v1");
  });

  it("treats blank strings as unset", () => {
    const settings = resolveDecisionSettings(decisionConfig({ model: "  ", apiKey: "" }));

    expect(settings.model).toBe(DEFAULT_DECISION_MODEL);
    expect(settings.apiKey).toBeUndefined();
  });

  it("prefers the block's own model and endpoint", () => {
    const settings = resolveDecisionSettings(
      decisionConfig({ model: "jev-2026-09-01", endpoint: "https://gateway.example/v1" })
    );

    expect(settings.model).toBe("jev-2026-09-01");
    expect(settings.endpoint).toBe("https://gateway.example/v1");
  });
});

describe("isDecisionConfigValid", () => {
  it("ships unconfigured: no stored block means no Decision Model", () => {
    expect(isDecisionConfigValid(null)).toBe(false);
    expect(isDecisionConfigValid(undefined)).toBe(false);
  });

  it("is unconfigured when the provider is disabled or the key is missing", () => {
    expect(isDecisionConfigValid(decisionConfig({ provider: "disabled" }))).toBe(false);
    expect(isDecisionConfigValid(decisionConfig({ apiKey: undefined }))).toBe(false);
    expect(isDecisionConfigValid(decisionConfig({ apiKey: "" }))).toBe(false);
  });

  it("takes the block's own key and no other: there is no fallback to the AI key", () => {
    // The helper takes one argument on purpose — the provider never matches
    // the AI provider, so there is nothing to borrow.
    expect(isDecisionConfigValid.length).toBe(1);
    expect(isDecisionConfigValid(decisionConfig())).toBe(true);
  });
});

describe("selectedDecisionUses", () => {
  it("stores every use selected as no list, so a use added later is on for the block", () => {
    expect(selectedDecisionUses([...DECISION_USES])).toBeUndefined();
    expect(selectedDecisionUses([...DECISION_USES].reverse())).toBeUndefined();
    expect(
      isDecisionUseSelected(decisionConfig({ uses: selectedDecisionUses([...DECISION_USES]) }), "validateEnrichments")
    ).toBe(true);
  });

  it("stores a partial selection as the list, in the vocabulary's order", () => {
    expect(selectedDecisionUses(["validateEnrichments", "autoCategorization"])).toEqual([
      "autoCategorization",
      "validateEnrichments",
    ]);
    expect(selectedDecisionUses([])).toEqual([]);
  });
});

describe("isDecisionUseSelected", () => {
  it("is false for every use when no Decision Model is configured", () => {
    for (const use of DECISION_USES) {
      expect(isDecisionUseSelected(null, use)).toBe(false);
      expect(isDecisionUseSelected(decisionConfig({ provider: "disabled" }), use)).toBe(false);
      expect(isDecisionUseSelected(decisionConfig({ apiKey: undefined }), use)).toBe(false);
    }
  });

  it("means every use when a configured block stores no list", () => {
    // A block that predates a use gains it; a use added in a later release is
    // on for everyone until an administrator deselects it.
    for (const use of DECISION_USES) {
      expect(isDecisionUseSelected(decisionConfig(), use)).toBe(true);
    }
  });

  it("follows a stored partial selection", () => {
    const config = decisionConfig({ uses: ["allergyDetection"] });

    expect(isDecisionUseSelected(config, "allergyDetection")).toBe(true);
    expect(isDecisionUseSelected(config, "autoCategorization")).toBe(false);
    expect(isDecisionUseSelected(decisionConfig({ uses: [] }), "allergyDetection")).toBe(false);
  });
});
