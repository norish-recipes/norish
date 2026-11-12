"use client";

import { useState } from "react";
import { Checkbox, CheckboxGroup, Description, Label } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useFillGaps, useFillGapsCounts } from "@norish/shared-react/admin";

import { CatalogueAIRun } from "./catalogue-ai-run";

const KINDS = ["nutrition", "conversions", "icons"] as const;

type Kind = (typeof KINDS)[number];

/** Fill gaps: AI supplies what listed foods are missing, after picking which kinds and a confirm. */
export default function FillGaps() {
  const t = useTranslations("settings.admin.aiProcessing.ingredientCatalogue.fillGaps");
  const [isOpen, setIsOpen] = useState(false);
  const [picked, setPicked] = useState<Kind[]>([]);
  const data = useFillGapsCounts();
  const { start, isStarting } = useFillGaps();
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
      starting={isStarting}
      testId="fill-gaps"
      title={t("title")}
      onOpenChange={setIsOpen}
      onStart={async () => {
        const started = await start({
          nutrition: chosen.includes("nutrition"),
          conversions: chosen.includes("conversions"),
          icons: chosen.includes("icons"),
        });

        if (started) {
          setIsOpen(false);
          setPicked([]);
        }
      }}
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
