// @vitest-environment node
/**
 * The lookup's second linking route (ADR-0035): one Choice over the offered
 * products plus none, a link where the Decision is sure enough, a ranking kept
 * with the Miss otherwise. The AI Runtime's decide is the one mocked AI seam,
 * plus the loader's one question — is the Grocery linking use on.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PricedCandidate } from "@norish/shared/lib/currency";
import { AIConfigurationError, AIProviderError } from "@norish/shared-server/ai/runtime/errors";
import { isDecisionUseEnabled } from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({ decide: vi.fn() }));
const logger = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({ decide: mocked.decide }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isDecisionUseEnabled: vi.fn(),
}));
vi.mock("@norish/shared-server/logger", () => ({ createLogger: () => logger }));

const { decideProduct, LINK_THRESHOLD, MAX_CANDIDATES, SHOWN_RANKED } =
  await import("@norish/queue/store-lookup/product-decision");

/** The options as the Decision saw them, and as the job monitor names them. */
const OPTION = {
  a: "Oude kaas 500 g · 500 g · 7.99 EUR",
  b: "Oude kaas 1 kg · 1 kg · 13.99 EUR",
  c: "Jonge kaas 500 g · 500 g · 6.49 EUR",
};

function candidate(name: string, url: string, price = 2.49, size?: string): PricedCandidate {
  return { name, url, price, currency: "EUR", ...(size ? { size } : {}) };
}

const OFFERED = [
  candidate("Oude kaas 500 g", "https://shop/a", 7.99, "500 g"),
  candidate("Oude kaas 1 kg", "https://shop/b", 13.99, "1 kg"),
  candidate("Jonge kaas 500 g", "https://shop/c", 6.49, "500 g"),
];

/** The Decision's answer: the chosen option and the distribution over every option. */
function chose(choice: string, probabilities: Record<string, number>) {
  return {
    model: "jev-2026-09-01",
    answers: { product: { type: "choice", choice, probabilities } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
  mocked.decide.mockResolvedValue(chose("p1", { p1: 0.95, p2: 0.03, p3: 0.01, none: 0.01 }));
});

describe("decideProduct", () => {
  it("asks one Choice over the offered products plus none, on the grocery and the candidates", async () => {
    await decideProduct("oude kaas", OFFERED);

    expect(vi.mocked(isDecisionUseEnabled)).toHaveBeenCalledWith("groceryLinking");
    expect(mocked.decide).toHaveBeenCalledTimes(1);
    expect(mocked.decide).toHaveBeenCalledWith({
      feature: "grocery-linking",
      state: {
        grocery: { name: "oude kaas" },
        candidates: [
          { id: "p1", name: "Oude kaas 500 g", size: "500 g", price: 7.99, currency: "EUR" },
          { id: "p2", name: "Oude kaas 1 kg", size: "1 kg", price: 13.99, currency: "EUR" },
          { id: "p3", name: "Jonge kaas 500 g", size: "500 g", price: 6.49, currency: "EUR" },
        ],
      },
      questions: {
        product: {
          type: "choice",
          instructions: expect.stringMatching(/which product is the grocery/i),
          criteria: {
            p1: "Oude kaas 500 g · 500 g · 7.99 EUR",
            p2: "Oude kaas 1 kg · 1 kg · 13.99 EUR",
            p3: "Jonge kaas 500 g · 500 g · 6.49 EUR",
            none: expect.stringMatching(/none/i),
          },
        },
      },
    });
  });

  it("links the chosen product at exactly the link threshold, and not just below it", async () => {
    // Half the mass: the pick outweighs every alternative together, none included.
    expect(LINK_THRESHOLD).toBe(0.5);

    mocked.decide.mockResolvedValue(chose("p1", { p1: 0.5, p2: 0.3, p3: 0.1, none: 0.1 }));
    await expect(decideProduct("oude kaas", OFFERED)).resolves.toEqual({
      asked: true,
      linked: OFFERED[0],
      suggestion: null,
      verdict: {
        pick: OPTION.a,
        none: 0.1,
        ranked: [
          { option: OPTION.a, probability: 0.5 },
          { option: OPTION.b, probability: 0.3 },
          { option: OPTION.c, probability: 0.1 },
        ],
      },
    });

    mocked.decide.mockResolvedValue(chose("p1", { p1: 0.49, p2: 0.31, p3: 0.1, none: 0.1 }));
    const decided = await decideProduct("oude kaas", OFFERED);

    expect(decided.asked && decided.linked).toBeNull();
    expect(decided.asked && decided.suggestion?.ranked[0]?.url).toBe("https://shop/a");
    expect(decided.asked && decided.verdict.pick).toBe(OPTION.a);
  });

  it("ranks the offered products most likely first when it links nothing", async () => {
    mocked.decide.mockResolvedValue(chose("p2", { p1: 0.3, p2: 0.4, p3: 0.1, none: 0.2 }));
    await expect(decideProduct("oude kaas", OFFERED)).resolves.toEqual({
      asked: true,
      linked: null,
      suggestion: {
        ranked: [
          { url: "https://shop/b", probability: 0.4 },
          { url: "https://shop/a", probability: 0.3 },
          { url: "https://shop/c", probability: 0.1 },
        ],
      },
      verdict: {
        pick: OPTION.b,
        none: 0.2,
        ranked: [
          { option: OPTION.b, probability: 0.4 },
          { option: OPTION.a, probability: 0.3 },
          { option: OPTION.c, probability: 0.1 },
        ],
      },
    });
  });

  it("shows the job monitor two decimals, and judges the bar on the number the model gave", async () => {
    mocked.decide.mockResolvedValue(
      chose("p1", { p1: 0.4999999, p2: 0.30000001, p3: 0.1, none: 0.1000001 })
    );

    const decided = await decideProduct("oude kaas", OFFERED);

    expect(decided.asked && decided.linked).toBeNull();
    expect(decided.asked && decided.verdict).toEqual({
      pick: OPTION.a,
      none: 0.1,
      ranked: [
        { option: OPTION.a, probability: 0.5 },
        { option: OPTION.b, probability: 0.3 },
        { option: OPTION.c, probability: 0.1 },
      ],
    });
  });

  it("links nothing when the Decision picks none, however sure, and still ranks the rest", async () => {
    mocked.decide.mockResolvedValue(chose("none", { p1: 0.02, p2: 0.02, p3: 0.01, none: 0.95 }));

    const decided = await decideProduct("sterrenstof", OFFERED);

    expect(decided.asked && decided.linked).toBeNull();
    expect(decided.asked && decided.verdict).toEqual({
      pick: null,
      none: 0.95,
      ranked: [
        { option: OPTION.a, probability: 0.02 },
        { option: OPTION.b, probability: 0.02 },
        { option: OPTION.c, probability: 0.01 },
      ],
    });
    expect(decided.asked && decided.suggestion?.ranked.map((entry) => entry.url)).toEqual([
      "https://shop/a",
      "https://shop/b",
      "https://shop/c",
    ]);
  });

  it("offers one product listed under two addresses once, and caps the options", async () => {
    const twins = [
      candidate("Oude kaas", "https://shop/a", 7.99, "500 g"),
      candidate("Oude kaas", "https://shop/a2", 7.99, "500 g"),
    ];
    const many = Array.from({ length: MAX_CANDIDATES + 20 }, (_, index) =>
      candidate(`Kaas ${index}`, `https://shop/${index}`, 1 + index)
    );

    mocked.decide.mockResolvedValue(chose("none", { none: 1 }));
    const decided = await decideProduct("oude kaas", [...twins, ...many]);

    const asked = mocked.decide.mock.calls[0]?.[0];

    expect(asked.state.candidates).toHaveLength(MAX_CANDIDATES);
    expect(asked.state.candidates[0]).toMatchObject({ name: "Oude kaas" });
    expect(asked.state.candidates[1]).toMatchObject({ name: "Kaas 0" });
    expect(Object.keys(asked.questions.product.criteria)).toHaveLength(MAX_CANDIDATES + 1);
    // The job monitor is shown the likeliest few, not a hundred.
    expect(decided.asked && decided.verdict.ranked).toHaveLength(SHOWN_RANKED);
    expect(decided.asked && decided.suggestion?.ranked).toHaveLength(MAX_CANDIDATES);
  });

  it("decides nothing when there is nothing offered, without asking, and says so", async () => {
    await expect(decideProduct("oude kaas", [])).resolves.toEqual({
      asked: false,
      reason: "not asked: nothing was offered",
    });
    expect(mocked.decide).not.toHaveBeenCalled();
  });

  it("decides nothing when the Grocery linking use is off, and says so", async () => {
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);

    await expect(decideProduct("oude kaas", OFFERED)).resolves.toEqual({
      asked: false,
      reason: expect.stringMatching(/^not asked: .*Grocery linking is off/),
    });
    expect(mocked.decide).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-retryable failure", new AIConfigurationError("no model")],
    ["a retryable failure", new AIProviderError("overloaded", { retryable: true })],
    ["an unexpected error", new Error("socket hang up")],
  ])("decides nothing on %s, logging at warn and saying so", async (_case, failure) => {
    mocked.decide.mockRejectedValue(failure);

    await expect(decideProduct("oude kaas", OFFERED)).resolves.toEqual({
      asked: false,
      reason: `failed: ${failure.message}`,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure, feature: "grocery-linking" }),
      expect.stringMatching(/shop's order/i)
    );
  });
});
