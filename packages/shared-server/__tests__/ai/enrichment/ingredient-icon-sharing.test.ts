/**
 * Which seeded foods the drawing tool draws an icon of their own: the
 * Decision Model is asked, per food, whether it would look clearly different
 * from its lender's icon. `decide` is the one mocked seam.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const decide = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({ decide, generateImage: vi.fn() }));

const { needsOwnIcon, OWN_ICON_THRESHOLD } =
  await import("@norish/shared-server/ai/enrichment/ingredient-icon-drawer");
const { MAX_QUESTIONS_PER_DECISION } =
  await import("@norish/shared-server/ai/enrichment/verification");

/** Answer every question with P(own icon) from `probabilityOf`, by the food its instructions name. */
function answerWith(probabilityOf: (instructions: string) => number) {
  decide.mockImplementation((asked: { questions: Record<string, { instructions: string }> }) => {
    return Promise.resolve({
      model: "jev",
      answers: Object.fromEntries(
        Object.entries(asked.questions).map(([id, question]) => [
          id,
          { type: "boolean", probability: probabilityOf(question.instructions) },
        ])
      ),
    });
  });
}

describe("needsOwnIcon", () => {
  beforeEach(() => {
    decide.mockReset();
  });

  it("draws a food only when it looks different enough from its lender", async () => {
    answerWith((asked) => (asked.includes('"tomato paste"') ? 0.9 : OWN_ICON_THRESHOLD - 0.01));

    await expect(
      needsOwnIcon([
        { food: "olive oil", lender: "vegetable oil" },
        { food: "tomato paste", lender: "tomato" },
      ])
    ).resolves.toEqual([false, true]);
  });

  it("asks in as many Decisions as the question limit needs, keeping the order", async () => {
    answerWith((asked) => (asked.includes('"food 1"') ? 1 : 0));
    const loans = Array.from({ length: MAX_QUESTIONS_PER_DECISION + 2 }, (_, index) => ({
      food: `food ${index}`,
      lender: "lender",
    }));

    const own = await needsOwnIcon(loans);

    expect(decide).toHaveBeenCalledTimes(2);
    expect(own).toHaveLength(loans.length);
    expect(own.flatMap((drawn, index) => (drawn ? [index] : []))).toEqual([1]);
  });
});
