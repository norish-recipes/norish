import type { useTranslations } from "next-intl";

import type { AIChange } from "@norish/shared-react/ingredients";
import { changeCopy } from "@norish/shared-react/ingredients";

type Translate = ReturnType<typeof useTranslations<"settings.ingredients">>;

/** What an AI Change did to the food it is listed under, without the food's name. */
export function changeMessage(t: Translate, change: AIChange, locale: string): string {
  const { key, values } = changeCopy(change, locale);

  return t(key, values);
}
