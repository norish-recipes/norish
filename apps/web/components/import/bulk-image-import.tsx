"use client";

import Link from "next/link";
import ImportingRecipeCard from "@/components/dashboard/importing-recipe-card";
import { useBulkImport } from "@/context/bulk-import-context";
import { usePermissionsContext } from "@/context/permissions-context";
import { useTranslations } from "next-intl";

export default function BulkImageImport() {
  const t = useTranslations("recipes.bulkImport");
  const { isAIEnabled } = usePermissionsContext();
  const { items, retry } = useBulkImport();

  if (!isAIEnabled) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted">{t("aiDisabled")}</p>
        <Link className="text-accent text-sm underline underline-offset-2" href="/">
          {t("backToRecipes")}
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link className="text-muted text-sm underline underline-offset-2" href="/">
          {t("backToRecipes")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted text-sm">{t("pageDescription")}</p>
      </header>

      {items.length === 0 ? (
        <section
          aria-live="polite"
          className="flex flex-col items-center gap-2 rounded-lg border border-(--border-secondary) p-6 text-center"
        >
          <p className="text-sm font-medium">{t("emptyTitle")}</p>
          <p className="text-muted text-sm">{t("emptyHint")}</p>
          <Link className="text-accent text-sm underline underline-offset-2" href="/">
            {t("emptyAction")}
          </Link>
        </section>
      ) : (
        <ul aria-label={t("progressTitle")} className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.itemId}>
              <ImportingRecipeCard item={item} variant="list" onRetry={retry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
