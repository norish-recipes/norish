"use client";

import { useState } from "react";
import { Description, Label, Radio, RadioGroup } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useCleanUpCatalogueMutation, useCleanUpCounts } from "@norish/shared-react/admin";

import { CatalogueAIRun } from "./catalogue-ai-run";

const SCOPES = ["recipe-foods", "whole-catalogue"] as const;

type Scope = (typeof SCOPES)[number];

const COUNT_OF = { "recipe-foods": "recipeFoods", "whole-catalogue": "wholeCatalogue" } as const;

/** Clean up catalogue: AI over the foods already listed, in one job, after a scope and a confirm. */
export default function CleanUpCatalogue() {
  const t = useTranslations("settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue");
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("recipe-foods");
  const counts = useCleanUpCounts();
  const { start, isStarting } = useCleanUpCatalogueMutation();
  const count = counts?.[COUNT_OF[scope]] ?? 0;
  const running = counts?.running ?? false;

  return (
    <CatalogueAIRun
      button={t("button")}
      canStart={count > 0}
      counted={counts !== undefined}
      description={running ? t("running") : t("description")}
      intro={t("intro")}
      isOpen={isOpen}
      running={running}
      start={t("start")}
      starting={isStarting}
      testId="clean-up-catalogue"
      title={t("title")}
      onOpenChange={setIsOpen}
      onStart={async () => {
        if (await start({ scope })) setIsOpen(false);
      }}
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
