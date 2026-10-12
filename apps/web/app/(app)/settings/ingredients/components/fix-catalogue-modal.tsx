"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { AIButton } from "@/components/shared/ai-button";
import { cssAIIconColor } from "@/config/css-tokens";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Button, Checkbox, CheckboxGroup, Description, Label, Modal, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import type {
  FixPart,
  NameScopeSummary,
  ReviewScopeSummary,
  ReviewTokenEstimate,
} from "@norish/shared/contracts/ingredient-catalogue";
import { FIX_PARTS } from "@norish/shared/contracts/ingredient-catalogue";

/** What a part of the catalogue holds: how many foods, and what a food's question takes. */
type PartSize = { count: number; tokens: ReviewTokenEstimate };

/** Picked when the dialog first opens: every part but asking again, which replaces suggestions. */
const DEFAULT_PARTS: readonly FixPart[] = ["unsuggested", "name"];

/** How many foods a part holds, and what a food's question takes. */
function sizeOf(review: ReviewScopeSummary, names: NameScopeSummary, part: FixPart): PartSize {
  if (part === "name") return { count: names.foods, tokens: names.tokens };

  return { count: review[part], tokens: review.tokens };
}

/**
 * How the picked parts' tokens split between the models they ask, each part's
 * foods at its own question's price, and, where every part was measured over
 * the last rounds rather than counted from the prompt, a line saying so.
 */
function RoundTokens({ sizes, testId }: { sizes: PartSize[]; testId: string }) {
  const t = useTranslations("settings.ingredients");
  const format = useFormatter();
  const byModel = new Map<string, number>();

  for (const { count, tokens } of sizes) {
    for (const use of tokens.models) {
      const label = `${use.provider} · ${use.model}`;

      byModel.set(label, (byModel.get(label) ?? 0) + count * use.perFood);
    }
  }

  return (
    <>
      {byModel.size > 0 ? (
        <dl className="mt-4 flex flex-col gap-1 text-xs" data-testid={`${testId}-models`}>
          {[...byModel].map(([label, tokens]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 truncate font-mono">{label}</dt>
              <dd className="text-foreground shrink-0 tabular-nums">
                {t("askAIRound.modelTokens", {
                  tokens: format.number(tokens, { notation: "compact", maximumFractionDigits: 1 }),
                })}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {sizes.every((size) => size.tokens.basis === "measured") ? (
        <p className="mt-2 text-xs" data-testid={`${testId}-tokens`}>
          {t("askAIRound.basisMeasured")}
        </p>
      ) : null}
    </>
  );
}

/**
 * Asks before a round of Fix catalogue starts, and what it fixes, any parts
 * together in one round: the flagged ingredients no suggestion waits on,
 * asking what each is; the flagged ones that have one, asking again and
 * replacing it; and the names, asking for each unsettled name's Plain Name.
 * No food is in two parts. Each part says how many ingredients it holds, the
 * whole catalogue's rather than the screen's, and about how many tokens it
 * takes, side by side so they compare at a glance. Below them, the picked
 * parts' tokens per model they ask.
 */
export function FixCatalogueModal({
  isOpen,
  isStarting,
  onClose,
  onStart,
}: {
  isOpen: boolean;
  isStarting: boolean;
  onClose: () => void;
  onStart: (parts: FixPart[]) => void;
}) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const format = useFormatter();
  const trpc = useTRPC();
  const review = useQuery({ ...trpc.ingredients.reviewScope.queryOptions(), enabled: isOpen });
  const names = useQuery({ ...trpc.ingredients.nameScope.queryOptions(), enabled: isOpen });
  const sizes =
    review.data && names.data
      ? new Map(FIX_PARTS.map((part) => [part, sizeOf(review.data, names.data, part)]))
      : null;
  // The person's pick stays for the next round, less any part with nothing left in it.
  const [picked, setPicked] = useState<readonly FixPart[]>(DEFAULT_PARTS);
  const parts = sizes ? picked.filter((part) => sizes.get(part)!.count > 0) : [];

  /** About how many tokens, compact: "2.4M". */
  const compact = (tokens: number) =>
    format.number(tokens, { notation: "compact", maximumFractionDigits: 1 });
  // A food's question, every model it asks together.
  const perFood = (tokens: ReviewTokenEstimate) =>
    tokens.models.reduce((sum, use) => sum + use.perFood, 0);

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid="ingredients-fix-catalogue-dialog">
          <Modal.Header className="flex-row items-center gap-2">
            <SparklesIcon className={twMerge("size-5 shrink-0", cssAIIconColor)} />
            <Modal.Heading>{t("fixCatalogue")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col">
            <p>{t("askAIRound.intro")}</p>
            {sizes ? (
              <>
                <CheckboxGroup
                  aria-label={t("askAIRound.scopeLabel")}
                  value={[...parts]}
                  // The filled control a field on a surface takes, as the panels' inputs do.
                  variant="secondary"
                  onChange={(values) =>
                    setPicked(FIX_PARTS.filter((part) => values.includes(part)))
                  }
                >
                  {FIX_PARTS.map((part) => {
                    const { count, tokens } = sizes.get(part)!;

                    return (
                      <Checkbox
                        key={part}
                        data-testid={`ingredients-fix-catalogue-scope-${part}`}
                        isDisabled={count === 0}
                        value={part}
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Label>{t(`askAIRound.scopes.${part}`)}</Label>
                        </Checkbox.Content>
                        <Description className="tabular-nums">
                          {t("askAIRound.scopeSize", {
                            count,
                            tokens: compact(count * perFood(tokens)),
                          })}
                          <span className="block">{t(`askAIRound.hints.${part}`)}</span>
                        </Description>
                      </Checkbox>
                    );
                  })}
                </CheckboxGroup>
                {parts.length > 0 ? (
                  <RoundTokens
                    sizes={parts.map((part) => sizes.get(part)!)}
                    testId="ingredients-fix-catalogue"
                  />
                ) : null}
              </>
            ) : review.isError || names.isError ? (
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
              data-testid="ingredients-fix-catalogue-start"
              isDisabled={parts.length === 0}
              isPending={isStarting}
              variant="secondary"
              onPress={() => onStart(parts)}
            >
              {t("askAI")}
            </AIButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
