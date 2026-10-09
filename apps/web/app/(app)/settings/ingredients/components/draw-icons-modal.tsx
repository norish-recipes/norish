"use client";

import { useState } from "react";
import { AIButton } from "@/components/shared/ai-button";
import { cssAIIconColor } from "@/config/css-tokens";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Button, Description, Label, Modal, Radio, RadioGroup, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import type { IconScope, IconScopeSummary } from "@norish/shared/contracts/ingredient-catalogue";
import { ICON_SCOPES } from "@norish/shared/contracts/ingredient-catalogue";

/**
 * Asks before a Draw icons round starts, and over which foods: only those
 * with no icon at all, the default, which leaves a food that borrows its
 * parent's alone; or every food without one of its own. Each choice says how
 * many icons it draws, the whole catalogue's rather than the screen's. No
 * price: what an image costs differs by provider and model.
 */
export function DrawIconsModal({
  isOpen,
  isStarting,
  summary,
  onClose,
  onStart,
}: {
  isOpen: boolean;
  isStarting: boolean;
  summary: IconScopeSummary | undefined;
  onClose: () => void;
  onStart: (scope: IconScope) => void;
}) {
  const t = useTranslations("settings.ingredients.drawIcons");
  const tActions = useTranslations("common.actions");
  const [picked, setPicked] = useState<IconScope | null>(null);
  // The person's pick stays, unless nothing is left in it.
  const scope: IconScope =
    picked && (!summary || summary[picked] > 0) ? picked : summary?.bare === 0 ? "unowned" : "bare";
  const count = summary?.[scope] ?? 0;

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid="ingredients-draw-icons-dialog">
          <Modal.Header className="flex-row items-center gap-2">
            <SparklesIcon className={twMerge("size-5 shrink-0", cssAIIconColor)} />
            <Modal.Heading>{t("title")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col">
            <p>{t("intro")}</p>
            {summary ? (
              <RadioGroup
                aria-label={t("scopeLabel")}
                value={scope}
                // The filled control a field on a surface takes, as the panels' inputs do.
                variant="secondary"
                onChange={(value) => setPicked(value === "unowned" ? "unowned" : "bare")}
              >
                {ICON_SCOPES.map((option) => (
                  <Radio
                    key={option}
                    data-testid={`ingredients-draw-icons-scope-${option}`}
                    isDisabled={summary[option] === 0}
                    value={option}
                  >
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      <Label>{t(`scopes.${option}`)}</Label>
                    </Radio.Content>
                    <Description className="tabular-nums">
                      {t("scopeSize", { count: summary[option] })}
                    </Description>
                  </Radio>
                ))}
              </RadioGroup>
            ) : (
              <div className="flex justify-center pt-6 pb-2">
                <Spinner size="sm" />
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              {tActions("cancel")}
            </Button>
            <AIButton
              data-testid="ingredients-draw-icons-start"
              isDisabled={count === 0}
              isPending={isStarting}
              variant="secondary"
              onPress={() => onStart(scope)}
            >
              {t("start")}
            </AIButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
