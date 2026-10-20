"use client";

import Link from "next/link";
import ImportingRecipeCard from "@/components/dashboard/importing-recipe-card";
import { useBulkImport } from "@/context/bulk-import-context";
import { usePermissionsContext } from "@/context/permissions-context";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

const RESULTS_ID = "bulk-import-results-title";

export default function BulkImageImport() {
  const t = useTranslations("recipes.bulkImport");
  const { isAIEnabled } = usePermissionsContext();
  const { batch, items, retry, clearBatch } = useBulkImport();

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

  const batchItems = batch?.items ?? [];
  const done = batchItems.filter((item) => item.status === "done").length;
  const failed = batchItems.filter((item) => item.status === "failed").length;
  const hasBatch = batchItems.length > 0;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link className="text-muted text-sm underline underline-offset-2" href="/">
          {t("backToRecipes")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          {batch ? (
            <Button size="sm" variant="tertiary" onPress={clearBatch}>
              {t("clear")}
            </Button>
          ) : null}
        </div>
        <p className="text-muted text-sm">{t("pageDescription")}</p>
      </header>

      {hasBatch ? (
        <section aria-labelledby={RESULTS_ID} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold" id={RESULTS_ID}>
              {t("progressTitle")}
            </h2>
            <p aria-live="polite" className="text-muted text-sm">
              {t("progressCount", { done, total: batchItems.length })}
            </p>
          </div>

          {failed > 0 ? (
            <p className="text-danger text-sm">{t("progressFailed", { count: failed })}</p>
          ) : null}

          <ul aria-label={t("progressTitle")} className="flex flex-col gap-2">
            {batchItems.map((item) => (
              <li
                key={item.itemId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--border-secondary) p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="text-muted mt-1 text-xs">{t(`status.${item.status}`)}</p>
                  {item.status === "failed" ? (
                    <p className="text-danger mt-1 text-xs">
                      {t(`error.${item.errorCode ?? "extraction-failed"}`)}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {item.recipeId ? (
                    <Link
                      className="text-accent text-sm underline underline-offset-2"
                      href={`/recipes/${item.recipeId}`}
                    >
                      {t("openRecipe")}
                    </Link>
                  ) : null}

                  {item.status === "failed" && item.retryable ? (
                    <Button size="sm" variant="secondary" onPress={() => retry([item])}>
                      {t("retry")}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : items.length > 0 ? (
        <ul aria-label={t("progressTitle")} className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.itemId}>
              <ImportingRecipeCard item={item} variant="list" onRetry={retry} />
            </li>
          ))}
        </ul>
      ) : (
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
      )}
    </section>
  );
}
