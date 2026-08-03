"use client";

import { Tabs } from "@heroui/react";

import type { CookingModeDialogProps, CookingModeTab } from "./types";
import { CookingIngredientsView } from "./cooking-ingredients-view";
import { CookingModeHeader } from "./cooking-mode-header";
import { CookingStepView } from "./cooking-step-view";

type CookingModeTabsProps = CookingModeDialogProps & {
  showIngredientsTitle: boolean;
};

export function CookingModeTabs({
  activeStep,
  activeTab,
  displayIngredients,
  recipeId,
  recipeName,
  recipeServings,
  recipeSystemUsed,
  showIngredientsTitle,
  steps,
  onClose,
  onPointerDown,
  onPointerUp,
  onStepChange,
  onTabChange,
}: CookingModeTabsProps) {
  return (
    <Tabs
      className="flex h-full min-h-0 flex-1 flex-col"
      selectedKey={activeTab}
      onSelectionChange={(key) => onTabChange(String(key) as CookingModeTab)}
    >
      <CookingModeHeader
        activeTab={activeTab}
        recipeName={recipeName}
        onClose={onClose}
        onTabChange={onTabChange}
      />

      <Tabs.Panel
        className="min-h-0 flex-1 overflow-hidden"
        id="steps"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <CookingStepView
          activeStep={activeStep}
          recipeId={recipeId}
          recipeName={recipeName}
          steps={steps}
          onStepChange={onStepChange}
        />
      </Tabs.Panel>

      <CookingIngredientsView
        displayIngredients={displayIngredients}
        recipeServings={recipeServings}
        recipeSystemUsed={recipeSystemUsed}
        showTitle={showIngredientsTitle}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />
    </Tabs>
  );
}
