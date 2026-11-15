"use client";

import type { CookingModeDialogProps } from "./types";
import { CookingIngredientsView } from "./cooking-ingredients-view";
import { CookingModeBottomBar } from "./cooking-mode-bottom-bar";
import { CookingModeHeader } from "./cooking-mode-header";
import { CookingStepView } from "./cooking-step-view";

type CookingModeShellProps = CookingModeDialogProps & {
  showIngredientsTitle: boolean;
};

/**
 * Cooking mode's frame: a compact header, the view the cook is on, and the
 * bottom bar under both.
 *
 * The two views are switched by state rather than by a tab set — the tab bar
 * is gone, and a tab set with no list to click is a control with no controls.
 * Reaching the ingredients is the horizontal swipe and the bottom bar's
 * button, in place of the header's tabs.
 */
export function CookingModeShell({
  activeStep,
  activeView,
  areTimersOpen,
  displayIngredients,
  readyAt,
  recipe,
  showIngredientsTitle,
  steps,
  onClose,
  onPointerDown,
  onPointerUp,
  onStepChange,
  onViewChange,
  onTimersOpenChange,
  checkedIngredients,
  onCheckedIngredientsChange,
}: CookingModeShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <CookingModeHeader recipe={recipe} onClose={onClose} />

      <div
        className="min-h-0 flex-1 overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {activeView === "ingredients" ? (
          <CookingIngredientsView
            checkedIngredients={checkedIngredients}
            displayIngredients={displayIngredients}
            recipe={recipe}
            showTitle={showIngredientsTitle}
            onCheckedIngredientsChange={onCheckedIngredientsChange}
          />
        ) : (
          <CookingStepView
            activeStep={activeStep}
            displayIngredients={displayIngredients}
            recipe={recipe}
            steps={steps}
            onStepChange={onStepChange}
          />
        )}
      </div>

      {/* Below both views, so the utilities a cook reaches for stay in the
          same place whichever one is showing. */}
      <CookingModeBottomBar
        activeStep={activeStep}
        activeView={activeView}
        areTimersOpen={areTimersOpen}
        readyAt={readyAt}
        steps={steps}
        onStepChange={onStepChange}
        onTimersOpenChange={onTimersOpenChange}
        onViewChange={onViewChange}
      />
    </div>
  );
}
