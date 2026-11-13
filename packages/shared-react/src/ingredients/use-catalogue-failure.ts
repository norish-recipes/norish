import { CATALOGUE_REFUSALS } from "@norish/shared/contracts/ingredient-catalogue";
import { NUTRITION_REFUSALS } from "@norish/shared/contracts/ingredient-nutrition";
import { createClientLogger } from "@norish/shared/lib/logger";

import { usePlatform } from "../platform/platform";

const log = createClientLogger("ingredients");

/** Each refusal list with the messages its toasts say: `<messages>.title`, `.<refusal>`, `.unknown`. */
const REFUSALS = {
  catalogue: { messages: "settings.ingredients.errors", refusals: CATALOGUE_REFUSALS },
  nutrition: { messages: "settings.ingredients.nutrition.errors", refusals: NUTRITION_REFUSALS },
} as const;

type Refusals = keyof typeof REFUSALS;

/** Toasts a failed catalogue write and logs it under `ingredients:<context>`. */
export function useCatalogueFailure() {
  const { toast } = usePlatform();

  /** Toasts `description` under the refusal list's title. */
  const fail = (
    error: unknown,
    context: string,
    description: string,
    refusals: Refusals = "catalogue"
  ) => {
    log.error({ error }, `ingredients:${context}`);
    toast.show({
      severity: "danger",
      title: toast.translate(`${REFUSALS[refusals].messages}.title`),
      description: toast.translate(description),
    });
  };

  /** Says why the server refused a write, in the reader's words, else that something went wrong. */
  const refuse = (error: unknown, context: string, refusals: Refusals = "catalogue") => {
    const { messages, refusals: known } = REFUSALS[refusals];
    const refusal =
      error instanceof Error && (known as readonly string[]).includes(error.message)
        ? error.message
        : "unknown";

    fail(error, context, `${messages}.${refusal}`, refusals);
  };

  return { fail, refuse };
}
