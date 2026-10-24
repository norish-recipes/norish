"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Description, Label, Radio, RadioGroup, toast } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { CatalogueAIRun, watchRun } from "./catalogue-ai-run";

const SCOPES = ["recipe-foods", "whole-catalogue"] as const;

type Scope = (typeof SCOPES)[number];

const COUNT_OF = { "recipe-foods": "recipeFoods", "whole-catalogue": "wholeCatalogue" } as const;

/** Clean up catalogue: AI over the foods already listed, in one job, after a scope and a confirm. */
export default function CleanUpCatalogue() {
  const t = useTranslations("settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("recipe-foods");
  const counts = useQuery(
    trpc.admin.ingredientCatalogue.cleanUpCounts.queryOptions(undefined, watchRun)
  );
  const cleanUp = useMutation(
    trpc.admin.ingredientCatalogue.cleanUp.mutationOptions({
      onSuccess: ({ queued }) => {
        setIsOpen(false);
        toast(t("started", { count: queued }), { variant: "success" });
      },
      onError: (error) =>
        showSafeErrorToast({
          title: t("error"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "admin-ai:clean-up-catalogue",
        }),
      onSettled: () => void counts.refetch(),
    })
  );
  const count = counts.data?.[COUNT_OF[scope]] ?? 0;
  const running = counts.data?.running ?? false;

  return (
    <CatalogueAIRun
      button={t("button")}
      canStart={count > 0}
      counted={counts.data !== undefined}
      description={running ? t("running") : t("description")}
      intro={t("intro")}
      isOpen={isOpen}
      running={running}
      start={t("start")}
      starting={cleanUp.isPending}
      testId="clean-up-catalogue"
      title={t("title")}
      onOpenChange={setIsOpen}
      onStart={() => cleanUp.mutate({ scope })}
    >
      <RadioGroup
        aria-label={t("scopeLabel")}
        value={scope}
        variant="secondary"
        onChange={(value) => setScope(value === "whole-catalogue" ? value : "recipe-foods")}
      >
        {SCOPES.map((option) => (
          <Radio key={option} data-testid={`clean-up-scope-${option}`} value={option}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Label>{t(`scopes.${option}`)}</Label>
            </Radio.Content>
            <Description>{t(`scopes.${option}-description`)}</Description>
          </Radio>
        ))}
      </RadioGroup>
      <p className="text-muted tabular-nums" data-testid="clean-up-count">
        {t("count", { count })}
      </p>
    </CatalogueAIRun>
  );
}
