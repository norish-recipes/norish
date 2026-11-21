import { CakeIcon, FireIcon, MoonIcon, Squares2X2Icon, SunIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import type { BuiltInCategory } from "@norish/shared/lib/categories";
import { isBuiltInCategory } from "@norish/shared/lib/categories";

const BUILT_IN_ICONS: Record<BuiltInCategory, typeof FireIcon> = {
  Breakfast: FireIcon,
  Lunch: SunIcon,
  Dinner: MoonIcon,
  Snack: CakeIcon,
};

/** A built-in's own icon; every other Category shares one. */
export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = isBuiltInCategory(name) ? BUILT_IN_ICONS[name] : Squares2X2Icon;

  return <Icon className={className} />;
}

/** Labels a Category: a built-in translated, any other name as written. */
export function useCategoryLabel(): (name: string) => string {
  const tForm = useTranslations("recipes.form");

  return (name) => (isBuiltInCategory(name) ? tForm(`category.${name.toLowerCase()}`) : name);
}
