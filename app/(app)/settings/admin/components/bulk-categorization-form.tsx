"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export default function BulkCategorizationForm() {
  const t = useTranslations("settings.admin.aiProcessing.bulkCategorization");
  const trpc = useTRPC();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ queued: number } | null>(null);

  const categorizeAllMutation = useMutation(
    trpc.admin.categorizeAllRecipes.mutationOptions({
      onSuccess: (data) => {
        setResult(data);
      },
      onSettled: () => {
        setIsLoading(false);
      },
    })
  );

  const handleCategorize = () => {
    setIsLoading(true);
    setResult(null);
    categorizeAllMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-default-500 text-sm">{t("description")}</p>
      <div className="flex items-center justify-end gap-4">
        <Button color="primary" isLoading={isLoading} variant="flat" onPress={handleCategorize}>
          {t("button")}
        </Button>
        {result !== null && (
          <span className="text-success text-sm">{t("queued", { count: result.queued })}</span>
        )}
      </div>
    </div>
  );
}
