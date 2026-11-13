import type { useTranslations } from "next-intl";

import type { AIChange } from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

type Translate = ReturnType<typeof useTranslations<"settings.ingredients">>;

/** What an AI Change did to the food it is listed under, without the food's name. */
export function changeMessage(t: Translate, change: AIChange, locale: string): string {
  switch (change.kind) {
    case "merge":
      return t("changedByAI.merge", { from: change.from ?? "" });
    case "parent": {
      if (!change.target) {
        const of = change.dropped ? ingredientDisplayName(change.dropped, locale) : "";

        return t("changedByAI.parentDropped", { of });
      }
      const of = ingredientDisplayName(change.target, locale);

      return t("changedByAI.parent", { of });
    }
    case "plain-name":
      return t("changedByAI.plainName", { from: change.from ?? "" });
    case "not-a-food":
      return t("changedByAI.notAFood");
    case "spelling":
      return change.target
        ? t("changedByAI.spellingMoved", {
            from: change.from ?? "",
            of: ingredientDisplayName(change.target, locale),
          })
        : t("changedByAI.spellingRemoved", { from: change.from ?? "" });
  }
}
