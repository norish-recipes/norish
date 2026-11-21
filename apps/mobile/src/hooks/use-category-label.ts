import { useIntl } from "react-intl";

import { isBuiltInCategory } from "@norish/shared/lib/categories";

/** Labels a Category: a built-in translated, any other name as written. */
export function useCategoryLabel(): (name: string) => string {
  const intl = useIntl();

  return (name) =>
    isBuiltInCategory(name)
      ? intl.formatMessage({ id: `recipes.form.category.${name.toLowerCase()}` })
      : name;
}
