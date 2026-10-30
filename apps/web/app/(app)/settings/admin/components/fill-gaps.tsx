"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Checkbox, CheckboxGroup, Description, Label, toast } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { CatalogueAIRun, watchRun } from "./catalogue-ai-run";

const KINDS = ["nutrition", "conversions", "icons"] as const;

type Kind = (typeof KINDS)[number];

/** Fill gaps: AI supplies what listed foods are missing, after picking which kinds and a confirm. */
export default function FillGaps() {
  const t = useTranslations("settings.admin.aiProcessing.ingredientCatalogue.fillGaps");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const [isOpen, setIsOpen] = useState(false);
  const [picked, setPicked] = useState<Kind[]>([]);
  const counts = useQuery(
    trpc.admin.ingredientCatalogue.fillGapsCounts.queryOptions(undefined, watchRun)
  );
  const fillGaps = useMutation(
    trpc.admin.ingredientCatalogue.fillGaps.mutationOptions({
      onSuccess: () => {
        setIsOpen(false);
        setPicked([]);
        toast(t("started"), { variant: "success" });
      },
      onError: (error) =>
        showSafeErrorToast({
          title: t("error"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "admin-ai:fill-gaps",
        }),
      onSettled: () => void counts.refetch(),
    })
  );
  const data = counts.data;
  const countOf = (kind: Kind) => data?.[kind] ?? 0;
  // Icons are null where the image provider cannot draw: not offered.
  const offered = KINDS.filter((kind) => data?.[kind] !== null);
  const chosen = picked.filter((kind) => offered.includes(kind) && countOf(kind) > 0);
  const running = data?.running ?? false;

  return (
    <CatalogueAIRun
      button={t("button")}
      canStart={chosen.length > 0}
      counted={data !== undefined}
      description={running ? t("running") : t("description")}
      intro={t("intro")}
      isOpen={isOpen}
      running={running}
      start={t("start")}
      starting={fillGaps.isPending}
      testId="fill-gaps"
      title={t("title")}
      onOpenChange={setIsOpen}
      onStart={() =>
        fillGaps.mutate({
          nutrition: chosen.includes("nutrition"),
          conversions: chosen.includes("conversions"),
          icons: chosen.includes("icons"),
        })
      }
    >
      <CheckboxGroup
        aria-label={t("kindsLabel")}
        value={picked}
        variant="secondary"
        onChange={(value) => setPicked(KINDS.filter((kind) => value.includes(kind)))}
      >
        {offered.map((kind) => (
          <Checkbox
            key={kind}
            data-testid={`fill-gaps-${kind}`}
            isDisabled={countOf(kind) === 0}
            value={kind}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>{t(`kinds.${kind}`)}</Label>
            </Checkbox.Content>
            <Description className="tabular-nums">
              {t("count", { count: countOf(kind) })}
            </Description>
          </Checkbox>
        ))}
      </CheckboxGroup>
    </CatalogueAIRun>
  );
}
