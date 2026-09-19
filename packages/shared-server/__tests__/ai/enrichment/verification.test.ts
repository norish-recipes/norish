/**
 * Enrichment Validation Tests
 *
 * The AI Runtime's `decide` is the single mocked AI seam, plus the loader's
 * two questions: is a Decision Model configured at all, and is the Validate
 * enrichments use on. The helper reads no repository — that is the point —
 * so there is nothing else to mock.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIConfigurationError, AIProviderError } from "@norish/shared-server/ai/runtime/errors";
import {
  isDecisionModelConfigured,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({ decide: vi.fn() }));

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({ decide: mocked.decide }));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isDecisionModelConfigured: vi.fn(),
  isDecisionUseEnabled: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({ aiLogger: logger }));

const {
  verifyClaims,
  shadowScore,
  DROP_THRESHOLD,
  ALLERGEN_DROP_THRESHOLD,
  MAX_QUESTIONS_PER_DECISION,
} = await import("@norish/shared-server/ai/enrichment/verification");

const state = { title: "Overnight oats", ingredients: ["oats", "milk"] };

function claim(id: string) {
  return { id, question: `Does the tag ${id} apply to this recipe?` };
}

/** Answers keyed by claim id, at the given probability of being true. */
function answered(probabilities: Record<string, number>) {
  return {
    model: "jev-2026-09-01",
    answers: Object.fromEntries(
      Object.entries(probabilities).map(([id, probability]) => [
        id,
        { type: "boolean", probability },
      ])
    ),
  };
}

describe("verifyClaims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(true);
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
    mocked.decide.mockResolvedValue(answered({ quick: 0.9, vegan: 0.1, "one-pot": 0.5 }));
  });

  it("asks nothing when there are no claims", async () => {
    await expect(verifyClaims({ feature: "auto-tagging", state, claims: [] })).resolves.toEqual({
      kept: [],
      dropped: [],
      mode: "off",
    });
    expect(mocked.decide).not.toHaveBeenCalled();
    expect(isDecisionModelConfigured).not.toHaveBeenCalled();
  });

  it("keeps every claim unjudged when no Decision Model is configured", async () => {
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(false);
    const claims = [claim("quick"), claim("vegan")];

    await expect(verifyClaims({ feature: "auto-tagging", state, claims })).resolves.toEqual({
      kept: claims,
      dropped: [],
      mode: "off",
    });
    expect(mocked.decide).not.toHaveBeenCalled();
  });

  it("asks one Boolean per claim, keyed by the claim, on the run's state", async () => {
    const claims = [claim("quick"), claim("vegan"), claim("one-pot")];

    await verifyClaims({ feature: "auto-tagging", state, claims });

    expect(mocked.decide).toHaveBeenCalledTimes(1);
    expect(mocked.decide).toHaveBeenCalledWith({
      feature: "auto-tagging:validation",
      state,
      questions: {
        quick: { type: "boolean", instructions: "Does the tag quick apply to this recipe?" },
        vegan: { type: "boolean", instructions: "Does the tag vegan apply to this recipe?" },
        "one-pot": { type: "boolean", instructions: "Does the tag one-pot apply to this recipe?" },
      },
    });
  });

  it("drops a claim at exactly the threshold and keeps one just above it, in enforce mode", async () => {
    expect(DROP_THRESHOLD).toBe(0.2);
    mocked.decide.mockResolvedValue(answered({ quick: 0.2, vegan: 0.21 }));
    const claims = [claim("quick"), claim("vegan")];

    const result = await verifyClaims({ feature: "auto-tagging", state, claims });

    expect(result).toEqual({
      kept: [claim("vegan")],
      dropped: [{ claim: claim("quick"), probability: 0.2 }],
      mode: "enforce",
    });
  });

  it("keeps a doubtful claim: only a clear no removes what the language model made", async () => {
    mocked.decide.mockResolvedValue(answered({ quick: 0.5 }));

    const result = await verifyClaims({ feature: "auto-tagging", state, claims: [claim("quick")] });

    expect(result.kept).toEqual([claim("quick")]);
    expect(result.dropped).toEqual([]);
  });

  it("takes a kind's stricter constant: the allergen one drops at 0.05 and not at 0.06, and keeps 0.2", async () => {
    expect(ALLERGEN_DROP_THRESHOLD).toBe(0.05);
    mocked.decide.mockResolvedValue(answered({ gluten: 0.05, dairy: 0.06, nuts: 0.2 }));
    const claims = [claim("gluten"), claim("dairy"), claim("nuts")];

    const result = await verifyClaims({
      feature: "allergy-detection",
      state,
      claims,
      dropThreshold: ALLERGEN_DROP_THRESHOLD,
    });

    expect(result.kept).toEqual([claim("dairy"), claim("nuts")]);
    expect(result.dropped).toEqual([{ claim: claim("gluten"), probability: 0.05 }]);
  });

  it("logs and keeps everything in shadow mode, when a kind asks for it", async () => {
    mocked.decide.mockResolvedValue(answered({ calories: 0.05 }));
    const claims = [claim("calories")];

    const result = await verifyClaims({
      feature: "nutrition-estimation",
      state,
      claims,
      mode: "shadow",
    });

    expect(result).toEqual({ kept: claims, dropped: [], mode: "shadow" });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "nutrition-estimation",
        mode: "shadow",
        claimed: 1,
        kept: 1,
        dropped: 0,
        disputed: [{ id: "calories", probability: 0.05 }],
      }),
      "Enrichment Validation completed"
    );
  });

  it("behaves as shadow when the Validate enrichments use is off", async () => {
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    mocked.decide.mockResolvedValue(answered({ quick: 0.01 }));
    const claims = [claim("quick")];

    const result = await verifyClaims({ feature: "auto-tagging", state, claims });

    expect(result).toEqual({ kept: claims, dropped: [], mode: "shadow" });
    expect(mocked.decide).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isDecisionUseEnabled)).toHaveBeenCalledWith("validateEnrichments");
  });

  it("carries the feature, mode and counts on its log line", async () => {
    mocked.decide.mockResolvedValue(answered({ quick: 0.9, vegan: 0.1 }));

    await verifyClaims({
      feature: "auto-tagging",
      state,
      claims: [claim("quick"), claim("vegan")],
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "auto-tagging",
        mode: "enforce",
        claimed: 2,
        kept: 1,
        dropped: 1,
      }),
      "Enrichment Validation completed"
    );
  });

  it.each([
    ["a non-retryable failure", new AIConfigurationError("no model")],
    ["a retryable failure", new AIProviderError("overloaded", { retryable: true })],
    ["an unexpected error", new Error("socket hang up")],
  ])("keeps every claim on %s, logging at warn", async (_case, failure) => {
    mocked.decide.mockRejectedValue(failure);
    const claims = [claim("quick"), claim("vegan")];

    await expect(verifyClaims({ feature: "auto-tagging", state, claims })).resolves.toEqual({
      kept: claims,
      dropped: [],
      mode: "off",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure, feature: "auto-tagging" }),
      expect.stringMatching(/keeping every claim/i)
    );
  });

  it("splits a run with more claims than one Decision carries into several", async () => {
    const claims = Array.from({ length: MAX_QUESTIONS_PER_DECISION + 1 }, (_, index) =>
      claim(`tag-${index}`)
    );

    mocked.decide.mockImplementation(({ questions }: { questions: Record<string, unknown> }) =>
      Promise.resolve(
        answered(
          Object.fromEntries(Object.keys(questions).map((id) => [id, id === "tag-0" ? 0.01 : 0.9]))
        )
      )
    );

    const result = await verifyClaims({ feature: "auto-tagging", state, claims });

    expect(mocked.decide).toHaveBeenCalledTimes(2);
    expect(Object.keys(mocked.decide.mock.calls[0]?.[0].questions)).toHaveLength(
      MAX_QUESTIONS_PER_DECISION
    );
    expect(Object.keys(mocked.decide.mock.calls[1]?.[0].questions)).toHaveLength(1);
    expect(result.dropped).toEqual([{ claim: claim("tag-0"), probability: 0.01 }]);
    expect(result.kept).toHaveLength(MAX_QUESTIONS_PER_DECISION);
  });
});

describe("shadowScore", () => {
  const rubric = ["Unfaithful", "Mostly faithful", "Faithful"];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(true);
  });

  it("asks nothing without a Decision Model", async () => {
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(false);

    await expect(
      shadowScore({
        feature: "recipe-extraction",
        state,
        instructions: "How faithful?",
        criteria: rubric,
      })
    ).resolves.toBeNull();
    expect(mocked.decide).not.toHaveBeenCalled();
  });

  it("asks one Score question and logs the verdict without acting on it", async () => {
    mocked.decide.mockResolvedValue({
      model: "jev-2026-09-01",
      answers: {
        faithfulness: { type: "score", score: 1.7, probabilities: { 0: 0.1, 1: 0.1, 2: 0.8 } },
      },
    });

    await expect(
      shadowScore({
        feature: "recipe-extraction",
        state,
        instructions: "How faithful?",
        criteria: rubric,
      })
    ).resolves.toBe(1.7);
    expect(mocked.decide).toHaveBeenCalledWith({
      feature: "recipe-extraction:validation",
      state,
      questions: {
        faithfulness: { type: "score", instructions: "How faithful?", criteria: rubric },
      },
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "recipe-extraction",
        mode: "shadow",
        score: 1.7,
        levels: 3,
      }),
      "Enrichment Validation scored"
    );
  });

  it("answers null and warns when the Decision fails", async () => {
    mocked.decide.mockRejectedValue(new AIProviderError("down", { retryable: true }));

    await expect(
      shadowScore({
        feature: "recipe-extraction",
        state,
        instructions: "How faithful?",
        criteria: rubric,
      })
    ).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });
});
