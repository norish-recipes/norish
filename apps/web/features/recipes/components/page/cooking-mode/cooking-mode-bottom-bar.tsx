"use client";

import { useTimerStore } from "@/lib/timers";
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  ListBulletIcon,
} from "@heroicons/react/20/solid";
import { Button, Meter } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { useTimersEnabledQuery } from "@norish/shared-react/config";

import type { CookingModeDialogProps } from "./types";
import WakeLockToggle from "../wake-lock-toggle";
import { clampStep } from "./utils";

type CookingModeBottomBarProps = Pick<
  CookingModeDialogProps,
  | "activeStep"
  | "activeView"
  | "areTimersOpen"
  | "readyAt"
  | "steps"
  | "onStepChange"
  | "onTimersOpenChange"
  | "onViewChange"
>;

/**
 * Cooking mode's bottom bar: where the cook is, when the food is projected
 * to be ready, and the handful of things a cook reaches for mid-recipe,
 * within thumb reach.
 *
 * The bar paints no ground of its own — it sits on whatever the dialog is,
 * the phone's full-bleed page background or the desktop card's surface, with
 * the rule as the separation. A ground of its own is how the desktop bar
 * ended up the exact colour of the backdrop behind the card.
 *
 * The back chevron is kept deliberately. The vertical swipe still changes
 * step, but a touch user who never discovers it would otherwise have no way
 * back at all.
 */
export function CookingModeBottomBar({
  activeStep,
  activeView,
  areTimersOpen,
  readyAt,
  steps,
  onStepChange,
  onTimersOpenChange,
  onViewChange,
}: CookingModeBottomBarProps) {
  const tCookMode = useTranslations("recipes.cookMode");
  const tCommon = useTranslations("common.actions");
  const locale = useLocale();
  // Folds the administrator's switch and the reader's Hidden Item together,
  // so a reader who has timers hidden is not offered them here either.
  const { timersEnabled } = useTimersEnabledQuery();
  const timerCount = useTimerStore((state) => state.timers.length);

  const totalSteps = steps.length;
  const progressValue = totalSteps > 0 ? ((activeStep + 1) / totalSteps) * 100 : 0;
  const previousDisabled = activeStep <= 0;
  const nextDisabled = activeStep >= totalSteps - 1;
  const showingIngredients = activeView === "ingredients";
  const stepCounter = tCookMode("stepCounter", {
    current: activeStep + 1,
    total: totalSteps,
  });

  return (
    <div className="border-border shrink-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pt-4 md:pb-4">
      <Meter aria-label={stepCounter} className="w-full" color="accent" value={progressValue}>
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>

      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        {/* A projection anchored to when this Cooking Session began, never a
            promise that anything is on schedule. */}
        <span className="text-muted truncate">
          {readyAt
            ? tCookMode("readyAt", {
                time: readyAt.toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
            : ""}
        </span>
        <span className="text-muted shrink-0 font-medium tabular-nums">{stepCounter}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            isIconOnly
            aria-label={tCommon("back")}
            className="size-10 min-w-10 rounded-full"
            isDisabled={previousDisabled}
            variant="secondary"
            onPress={() => {
              onViewChange("steps");
              onStepChange(clampStep(activeStep - 1, totalSteps));
            }}
          >
            <ChevronUpIcon className="size-5" />
          </Button>

          {timersEnabled && (
            <Button
              isIconOnly
              aria-label={tCookMode("timers")}
              className="size-10 min-w-10 rounded-full"
              isDisabled={timerCount === 0}
              variant="secondary"
              onPress={() => onTimersOpenChange(!areTimersOpen)}
            >
              <ClockIcon className="size-5" />
            </Button>
          )}

          <Button
            isIconOnly
            aria-label={showingIngredients ? tCookMode("steps") : tCookMode("ingredients")}
            className="size-10 min-w-10 rounded-full"
            variant="secondary"
            onPress={() => onViewChange(showingIngredients ? "steps" : "ingredients")}
          >
            {showingIngredients ? (
              <ListBulletIcon className="size-5" />
            ) : (
              <BookOpenIcon className="size-5" />
            )}
          </Button>

          {/* Cooking mode already holds the wake lock, so the toggle only ever
              hands it back — it never races cooking mode for a second one. */}
          <WakeLockToggle autoEnable={false} />
        </div>

        <Button
          aria-label={nextDisabled ? tCommon("done") : tCookMode("nextStep")}
          className="shrink-0 rounded-full"
          isDisabled={nextDisabled}
          variant="primary"
          onPress={() => {
            onViewChange("steps");
            onStepChange(clampStep(activeStep + 1, totalSteps));
          }}
        >
          <span>{nextDisabled ? tCommon("done") : tCookMode("nextStep")}</span>
          <ChevronDownIcon className="size-5" />
        </Button>
      </div>
    </div>
  );
}
