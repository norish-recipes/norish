"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";
import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";
import { ChevronDownIcon, LinkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { LinkedRecipesTree } from "@norish/shared-react/hooks";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { selectRowsForSystem } from "@norish/shared/lib/linked-recipes";

type LinkedSection = LinkedRecipesTree["sections"][number];
type LinkedStepNode = LinkedRecipesTree["steps"][number];
type IngredientLines = FullRecipeDTO["recipeIngredients"];

/** Looks up the linked recipes that expand after a step, by the step itself. */
export function linkedSectionsByStep(nodes: LinkedStepNode[]): Map<object, LinkedSection[]> {
  return new Map(
    nodes.filter((node) => node.linked.length > 0).map((node) => [node.step, node.linked])
  );
}

/**
 * The steps that only name the linked recipes expanding after them: their
 * sections' headers already say it, so the step is not shown on its own. A
 * step carrying images or ingredient chips of its own is kept for those.
 */
export function stepsReplacedByLinked(nodes: LinkedStepNode[]): Set<object> {
  return new Set(
    nodes
      .filter(
        (node) =>
          node.replacedByLinked &&
          (node.step.images?.length ?? 0) === 0 &&
          (node.step.stepIngredients?.length ?? 0) === 0
      )
      .map((node) => node.step)
  );
}

function LinkedRecipeHeader({
  recipe,
  children,
}: {
  recipe: { id: string; name: string };
  children?: React.ReactNode;
}) {
  const t = useTranslations("recipes.linkedRecipe");

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="bg-accent/15 text-accent flex size-7 shrink-0 items-center justify-center rounded-full">
        <LinkIcon aria-hidden className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted text-xs font-medium tracking-wide uppercase">
          {t("fromRecipe")}
        </span>
        <Link
          className="text-foreground decoration-muted hover:decoration-foreground truncate text-base font-semibold underline underline-offset-2 transition-colors"
          href={`/recipes/${recipe.id}`}
        >
          {recipe.name}
        </Link>
      </div>
      {children}
    </div>
  );
}

export type LinkedRecipeStepsSectionProps = {
  section: LinkedSection;
  ingredientsFor: (linked: FullRecipeDTO) => IngredientLines;
  interactive?: boolean;
  enableTimers?: boolean;
};

/**
 * A linked recipe's steps, read in place under a header naming the recipe
 * they come from. Its steps number from one, as on its own page; its step
 * ingredients resolve against its own lines; and anything it links expands
 * inside it in turn.
 */
export function LinkedRecipeStepsSection({
  section,
  ingredientsFor,
  interactive = false,
  enableTimers = false,
}: LinkedRecipeStepsSectionProps) {
  const t = useTranslations("recipes.linkedRecipe");
  const [isExpanded, setIsExpanded] = useState(true);
  const { recipe } = section;
  const nested = linkedSectionsByStep(section.steps);
  const replaced = stepsReplacedByLinked(section.steps);
  const stepsId = `linked-recipe-steps-${recipe.id}`;

  return (
    <section
      aria-label={t("sectionLabel", { name: recipe.name })}
      className="border-accent/40 bg-surface-secondary/40 my-1 rounded-xl border-l-4 py-3 pr-1 pl-2"
      data-linked-recipe-id={recipe.id}
      data-testid="linked-recipe-steps"
    >
      <div className="px-2">
        <LinkedRecipeHeader recipe={recipe}>
          <Button
            isIconOnly
            aria-controls={stepsId}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t("hideSteps") : t("showSteps")}
            className="size-8 min-w-8 shrink-0 rounded-full"
            size="sm"
            variant="ghost"
            onPress={() => setIsExpanded((expanded) => !expanded)}
          >
            <ChevronDownIcon
              className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            />
          </Button>
        </LinkedRecipeHeader>
      </div>

      {isExpanded ? (
        <div className="mt-2" id={stepsId}>
          {section.steps.length > 0 ? (
            <ReadonlyStepsList
              enableTimers={enableTimers}
              ingredients={ingredientsFor(recipe)}
              interactive={interactive}
              isStepHidden={(step) => replaced.has(step)}
              recipeId={recipe.id}
              recipeName={recipe.name}
              renderAfterStep={(step) =>
                nested
                  .get(step)
                  ?.map((child) => (
                    <LinkedRecipeStepsSection
                      key={child.recipe.id}
                      enableTimers={enableTimers}
                      ingredientsFor={ingredientsFor}
                      interactive={interactive}
                      section={child}
                    />
                  ))
              }
              steps={section.steps.map((node) => node.step)}
              systemUsed={section.systemUsed}
            />
          ) : (
            <p className="text-muted px-3 py-2 text-sm">{t("noSteps")}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** One linked recipe's lines, under the recipe they come from. */
export type LinkedIngredientsSection = {
  recipe: { id: string; name: string; systemUsed?: string | null };
  ingredients: React.ComponentProps<typeof ReadonlyIngredientsList>["ingredients"];
};

export type LinkedRecipeIngredientsSectionsProps = {
  sections: LinkedIngredientsSection[];
  /** The system the recipe being read is shown in; linked lines prefer it. */
  systemUsed: string;
  interactive?: boolean;
  /** Ticked lines per linked recipe, for surfaces that keep them across views. */
  checkedByRecipe?: Record<string, Set<number>>;
  onCheckedByRecipeChange?: (recipeId: string, indices: Set<number>) => void;
};

/**
 * The ingredients of every linked recipe, after the recipe's own: one section
 * per recipe, headed with the recipe it comes from, so the cook gathers
 * everything the dish needs from one list.
 */
export function LinkedRecipeIngredientsSections({
  sections,
  systemUsed,
  interactive = false,
  checkedByRecipe,
  onCheckedByRecipeChange,
}: LinkedRecipeIngredientsSectionsProps) {
  const t = useTranslations("recipes.linkedRecipe");

  if (sections.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ recipe, ingredients }) => {
        const lines = selectRowsForSystem(ingredients, systemUsed, recipe.systemUsed);
        const linesSystem = lines[0]?.systemUsed ?? recipe.systemUsed ?? systemUsed;

        return (
          <section
            key={recipe.id}
            aria-label={t("ingredientsLabel", { name: recipe.name })}
            className="border-accent/40 rounded-xl border-l-4 pt-2 pl-2"
            data-linked-recipe-id={recipe.id}
            data-testid="linked-recipe-ingredients"
          >
            <div className="px-2 pb-1">
              <LinkedRecipeHeader recipe={recipe} />
            </div>
            {lines.length > 0 ? (
              <ReadonlyIngredientsList
                checkedIndices={checkedByRecipe?.[recipe.id]}
                ingredients={lines}
                interactive={interactive}
                systemUsed={linesSystem}
                onCheckedIndicesChange={
                  onCheckedByRecipeChange
                    ? (indices) => onCheckedByRecipeChange(recipe.id, indices)
                    : undefined
                }
              />
            ) : (
              <p className="text-muted px-3 py-2 text-sm">{t("noIngredients")}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
