import { isCatalogueRefusal } from "@norish/shared/contracts/ingredient-catalogue";
import { createClientLogger } from "@norish/shared/lib/logger";

import { usePlatform } from "../platform/platform";

const log = createClientLogger("ingredients");

/** Toasts a failed catalogue write and logs it under `ingredients:<context>`. */
export function useCatalogueFailure() {
  const { toast } = usePlatform();

  const fail = (error: unknown, context: string, title: string, description: string) => {
    log.error({ error }, `ingredients:${context}`);
    toast.show({ severity: "danger", title, description });
  };

  /** Says why the server refused an edit to the catalogue, in the reader's words. */
  const refuse = (error: unknown, context: string) => {
    const refusal = error instanceof Error ? error.message : null;

    fail(
      error,
      context,
      toast.translate("settings.ingredients.errors.title"),
      isCatalogueRefusal(refusal)
        ? toast.translate(`settings.ingredients.errors.${refusal}`)
        : toast.translate("settings.ingredients.errors.unknown")
    );
  };

  return { fail, refuse };
}
