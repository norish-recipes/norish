"use client";

import { useRouter } from "next/navigation";
import { useBulkImport } from "@/context/bulk-import-context";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function BulkImportIndicator() {
  const router = useRouter();
  const t = useTranslations("recipes.dashboard");
  const { activeCount } = useBulkImport();
  const isSingleDigit = activeCount < 10;

  if (activeCount === 0) return null;

  return (
    <Button
      aria-label={t("activeImports", { count: activeCount })}
      className={`bg-accent text-accent-foreground absolute -top-2 -right-1 z-10 h-5 rounded-full text-xs font-semibold tabular-nums ${
        isSingleDigit ? "w-5 px-0" : "min-w-5 px-1"
      }`}
      data-testid="bulk-import-count"
      size="sm"
      variant="primary"
      onPress={() => router.push("/recipes/import")}
    >
      {activeCount}
    </Button>
  );
}
