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
 *   the grocery panel offers the shop's products most likely first.
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

/**
 * At or above: the chosen product is linked and priced, as an unmistakable
 * match is. Half the mass on one product means the model rates it likelier
 * than every alternative together — the other products and none. The bar
 * stood at 0.9 first, and a shop that lists the same thing in three sizes
 * splits the mass between them, so it was rarely cleared and most groceries
 * were left for the shopper to link by hand; a wrong size is one tap to undo.
 */
export const LINK_THRESHOLD = 0.5;

/**
 * How many offered products one Decision considers, in the shop's order. A
 * Choice carries at most 255 options and a shop's first page rarely more
 * than a few dozen; what lies beyond is offered unranked, as before.
 */
export const MAX_CANDIDATES = 100;

const NONE = "none";

/** How many of the ranked options the job monitor is shown. */
export const SHOWN_RANKED = 5;

/**
 * The Decision's answer as the job monitor shows it beside the lookup's step:
 * the option it chose, the chance it gave none of them, and the likeliest
 * options with the probability of each — the options as the Decision saw
 * them, name, size and price. Probabilities are rounded to two decimals here
 * and nowhere else; the bar is judged on the number the model gave.
 */
export interface DecisionVerdict {
  /** The option the Decision chose, or null where it chose none. */
  pick: string | null;
  /** The probability it gave none of the offered products being the grocery. */
  none: number;
  /** The likeliest options, most likely first. */
  ranked: { option: string; probability: number }[];
}

/**
 * What the Decision route came to. Asked: a product to link where the
 * Decision was sure enough, else the ranking to keep with the Miss, and the
 * verdict for the job monitor either way. Not asked, or failed: the reason,
 * in the words the job monitor shows.
 */
export type ProductDecision =
  | {
      asked: true;
      /** The product to link and price, where the Decision was sure enough. */
      linked: PricedCandidate | null;
      /** The ranking to keep with the Miss otherwise; null when a product was linked. */
      suggestion: ProductSuggestion | null;
      /** What it answered, for the job monitor. */
      verdict: DecisionVerdict;
    }
  | { asked: false; reason: string };

/** Two decimals: what a person reads off a probability. */
function shown(probability: number): number {
  return Math.round(probability * 100) / 100;
}

/** One line a shopper could tell the product by: its name, size and price. */
function describe(candidate: PricedCandidate): string {
  return [candidate.name, candidate.size, `${candidate.price} ${candidate.currency}`]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(" · ");
}

/**
 * Ask which offered product is the grocery, if any. Nothing is decided —
 * today's Miss — when there is nothing to choose between, the use is off or
 * no Decision Model is configured, or the Decision fails with any
 * retryability; a failure is a warn log, never the lookup's failure, and each
 * of the three says so for the job monitor.
 */
export async function decideProduct(
  name: string,
  candidates: readonly PricedCandidate[]
): Promise<ProductDecision> {
  if (candidates.length === 0) return { asked: false, reason: "not asked: nothing was offered" };
  if (!(await isDecisionUseEnabled("groceryLinking"))) {
    return { asked: false, reason: "not asked: no Decision Model, or Grocery linking is off" };
  }

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
      .map(([key, candidate]) => ({ candidate, probability: probabilities[key] ?? 0 }))
      .sort((a, b) => b.probability - a.probability);
    const chosen = choice === NONE ? null : byKey.get(choice);
    const probability = probabilities[choice] ?? 0;
    const linked = chosen && probability >= LINK_THRESHOLD ? chosen : null;
    const verdict: DecisionVerdict = {
      pick: chosen ? describe(chosen) : null,
      none: shown(probabilities[NONE] ?? 0),
      ranked: ranked.slice(0, SHOWN_RANKED).map((entry) => ({
        option: describe(entry.candidate),
        probability: shown(entry.probability),
      })),
    };

    log.info(
      {
        groceryName: name,
        candidates: options.length,
        choice,
        probability,
        none: verdict.none,
        linked: linked !== null,
      },
      "Decision ranked the offered products"
    );

    return {
      asked: true,
      linked,
      suggestion: linked
        ? null
        : {
            ranked: ranked.map((entry) => ({
              url: entry.candidate.url,
              probability: entry.probability,
            })),
          },
      verdict,
    };
  } catch (error) {
    log.warn(
      { err: error, feature: "grocery-linking", groceryName: name },
      "Decision failed, leaving the offered products in the shop's order"
    );

    return {
      asked: false,
      reason: `failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
