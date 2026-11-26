"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

/** A grocery list with nothing on it. */
export function GroceryListEmpty() {
  const t = useTranslations("groceries.empty");

  return <EmptyState icon={ShoppingCartIcon} title={t("title")} variant="page" />;
}
