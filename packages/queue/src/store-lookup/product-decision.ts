/**
 * The Decision behind a lookup's second linking route (ADR-0035). The
 * auto-link rule (`chooseUnmistakable`) runs first and is unchanged: it links
 * only a name a human would not hesitate over. When it declines, a Decision
 * Model with its Grocery linking use on is asked one Choice over the offered
 * products plus `none`, and two things can follow:
 *
 * - the chosen product's probability clears {@link LINK_THRESHOLD}: the
 *   grocery is linked to it, exactly as an unmistakable match links, and the
 *   row gets its price;
 * - it does not: nothing is linked. The Miss keeps the Decision's ranking, so
 *   the grocery panel offers the shop's products most likely first with the
 *   best guess marked where it clears {@link SUGGESTION_THRESHOLD}.
 *
 * `auto-link.ts` refuses a tunable threshold on purpose, and that rule stands
 * for the string-similarity number it is about, which has no meaning a
 * person can reason about. A Decision's probability is the model's stated
 * chance that this product is the grocery, so the constant below is a
 * statement of how sure Norish wants to be before pricing a row on a
 * shopper's behalf — a named constant with a test, never a setting.
 */

import type { ProductSuggestion } from "@norish/shared/contracts";
import type { PricedCandidate } from "@norish/shared/lib/currency";
import { decide } from "@norish/shared-server/ai/runtime/runtime";
import { isDecisionUseEnabled } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { distinctProducts } from "@norish/shared/lib/auto-link";

const log = createLogger("queue:store-lookup");

/** At or above: the chosen product is linked and priced, as an unmistakable match is. */
export const LINK_THRESHOLD = 0.9;

/** At or above: the top-ranked product is marked as the best guess in the offered list. */
export const SUGGESTION_THRESHOLD = 0.5;

/**
 * How many offered products one Decision considers, in the shop's order. A
 * Choice carries at most 255 options and a shop's first page rarely more
 * than a few dozen; what lies beyond is offered unranked, as before.
 */
export const MAX_CANDIDATES = 100;

const NONE = "none";

export interface ProductDecision {
  /** The product to link and price, where the Decision was sure enough. */
  linked: PricedCandidate | null;
  /** The ranking to keep with the Miss otherwise; null when nothing was ranked. */
  suggestion: ProductSuggestion | null;
}

/** One line a shopper could tell the product by: its name, size and price. */
function describe(candidate: PricedCandidate): string {
  return [candidate.name, candidate.size, `${candidate.price} ${candidate.currency}`]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(" · ");
}

/**
 * Ask which offered product is the grocery, if any. Returns null — nothing
 * decided, today's Miss — when the use is off, there is nothing to choose
 * between, or the Decision fails with any retryability; a failure is a warn
 * log, never the lookup's failure.
 */
export async function decideProduct(
  name: string,
  candidates: readonly PricedCandidate[]
): Promise<ProductDecision | null> {
  if (candidates.length === 0) return null;
  if (!(await isDecisionUseEnabled("groceryLinking"))) return null;

  // One product listed twice is one option; see `distinctProducts`.
  const options = distinctProducts([...candidates]).slice(0, MAX_CANDIDATES);
  const byKey = new Map(options.map((candidate, index) => [`p${index + 1}`, candidate]));

  // The option labels are the answer schema: one per offered product, plus none.
  const criteria: Record<string, string> = {
    ...Object.fromEntries(
      [...byKey.entries()].map(([key, candidate]) => [key, describe(candidate)])
    ),
    [NONE]: "None of these products is the grocery.",
  };

  try {
    const { answers } = await decide({
      feature: "grocery-linking",
      state: {
        grocery: { name },
        candidates: options.map((candidate, index) => ({
          id: `p${index + 1}`,
          name: candidate.name,
          size: candidate.size ?? null,
          price: candidate.price,
          currency: candidate.currency,
        })),
      },
      questions: {
        product: {
          type: "choice",
          instructions:
            "Which product is the grocery the shopper asked for, if any? Pick none when no offered product is that grocery.",
          criteria,
        },
      },
    });
    const { choice, probabilities } = answers.product;
    const ranked = [...byKey.entries()]
      .map(([key, candidate]) => ({ url: candidate.url, probability: probabilities[key] ?? 0 }))
      .sort((a, b) => b.probability - a.probability);
    const top = ranked[0];
    const chosen = choice === NONE ? null : byKey.get(choice);
    const linked = chosen && (probabilities[choice] ?? 0) >= LINK_THRESHOLD ? chosen : null;
    const suggestion: ProductSuggestion = {
      ranked,
      best: top && top.probability >= SUGGESTION_THRESHOLD ? top.url : null,
    };

    log.info(
      {
        groceryName: name,
        candidates: options.length,
        choice,
        probability: probabilities[choice] ?? 0,
        linked: linked !== null,
        best: suggestion.best,
      },
      "Decision ranked the offered products"
    );

    return { linked, suggestion: linked ? null : suggestion };
  } catch (error) {
    log.warn(
      { err: error, feature: "grocery-linking", groceryName: name },
      "Decision failed, leaving the offered products in the shop's order"
    );

    return null;
  }
}
