"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { AIButton } from "@/components/shared/ai-button";
import { cssAIIconColor } from "@/config/css-tokens";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Button, Description, Label, Modal, Radio, RadioGroup, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import type {
  ReviewScope,
  ReviewScopeSummary,
} from "@norish/shared/contracts/ingredient-catalogue";

/** The scopes, the gap first: the foods AI has given no answer for yet. */
const SCOPES: readonly ReviewScope[] = ["unsuggested", "flagged"];

/** How many foods a scope holds. */
function countOf(summary: ReviewScopeSummary, scope: ReviewScope): number {
  return scope === "flagged" ? summary.flagged : summary.unsuggested;
}

/**
 * Asks before a round of Ask AI starts, and over which flagged ingredients:
 * only those no suggestion waits on, which it starts on as bulk enrichment
 * fills only gaps, or every one, asking again about those that have a
 * suggestion and replacing it. Each choice says how many ingredients it
 * holds, the whole catalogue's rather than the screen's, and about how many
 * tokens it takes, side by side so they compare at a glance. Below them, the
 * chosen round's tokens per model it asks, and one line on what they are
 * based on: the last round where one was measured, the prompt otherwise,
 * which leaves out a model's reasoning.
 */
export function AskAIRoundModal({
  isOpen,
  isStarting,
  onClose,
  onStart,
}: {
  isOpen: boolean;
  isStarting: boolean;
  onClose: () => void;
  onStart: (scope: ReviewScope) => void;
}) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: summary, isError } = useQuery({
    ...trpc.ingredients.reviewScope.queryOptions(),
    enabled: isOpen,
  });
  // The person's pick stays for the next round, unless nothing is left in it.
  const [picked, setPicked] = useState<ReviewScope | null>(null);
  const scope: ReviewScope =
    picked && (!summary || countOf(summary, picked) > 0)
      ? picked
      : summary?.unsuggested === 0
        ? "flagged"
        : "unsuggested";
  const count = summary ? countOf(summary, scope) : 0;

  /** About how many tokens, compact: "2.4M". */
  const compact = (tokens: number) =>
    format.number(tokens, { notation: "compact", maximumFractionDigits: 1 });
  const models = summary?.tokens.models ?? [];
  // A food's question, every model it asks together.
  const perFood = models.reduce((sum, use) => sum + use.perFood, 0);

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid="ingredients-ask-ai-dialog">
          <Modal.Header className="flex-row items-center gap-2">
            <SparklesIcon className={twMerge("size-5 shrink-0", cssAIIconColor)} />
            <Modal.Heading>{t("askAIAll")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col">
            <p>{t("askAIRound.intro")}</p>
            {summary ? (
              <>
                <RadioGroup
                  aria-label={t("askAIRound.scopeLabel")}
                  // The filled control a field on a surface takes, as the panels' inputs do.
                  variant="secondary"
                  value={scope}
                  onChange={(value) => setPicked(value === "flagged" ? "flagged" : "unsuggested")}
                >
                  {SCOPES.map((option) => {
                    const foods = countOf(summary, option);

                    return (
                      <Radio
                        key={option}
                        data-testid={`ingredients-ask-ai-scope-${option}`}
                        isDisabled={foods === 0}
                        value={option}
                      >
                        <Radio.Content>
                          <Radio.Control>
                            <Radio.Indicator />
                          </Radio.Control>
                          <Label>{t(`askAIRound.scopes.${option}`)}</Label>
                        </Radio.Content>
                        <Description className="tabular-nums">
                          {t("askAIRound.scopeSize", {
                            count: foods,
                            tokens: compact(foods * perFood),
                          })}
                          {option === "flagged" && foods > 0 ? (
                            <span className="block">{t("askAIRound.replaces")}</span>
                          ) : null}
                        </Description>
                      </Radio>
                    );
                  })}
                </RadioGroup>
                {models.length > 0 ? (
                  // How the chosen round's tokens split between the models it asks.
                  <dl
                    className="mt-4 flex flex-col gap-1 text-xs"
                    data-testid="ingredients-ask-ai-models"
                  >
                    {models.map((use) => (
                      <div
                        key={`${use.provider}/${use.model}`}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <dt className="min-w-0 truncate font-mono">{`${use.provider} · ${use.model}`}</dt>
                        <dd className="text-foreground shrink-0 tabular-nums">
                          {t("askAIRound.modelTokens", { tokens: compact(count * use.perFood) })}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <p className="mt-2 text-xs" data-testid="ingredients-ask-ai-tokens">
                  {summary.tokens.basis === "measured"
                    ? t("askAIRound.basisMeasured")
                    : t("askAIRound.basisPrompt")}
                </p>
              </>
            ) : isError ? (
              <p className="text-danger mt-4">{t("errors.unknown")}</p>
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
              data-testid="ingredients-ask-ai-start"
              isDisabled={count === 0}
              isPending={isStarting}
              variant="secondary"
              onPress={() => onStart(scope)}
            >
              {t("askAI")}
            </AIButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
