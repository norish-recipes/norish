"use client";

import type { SmartMarkdownTimerConfig } from "@/components/shared/smart-markdown-renderer";
import Image from "next/image";
import { getNutritionData } from "@/components/recipes/readonly-nutrition";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useTranslations } from "next-intl";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { AmountDisplayMode } from "@norish/shared/lib/format-amount";
import type {
  StepIngredientLineLike,
  StepIngredientRefLike,
} from "@norish/shared/lib/step-ingredients";
import { reconcileCookingTime } from "@norish/shared/lib/cooking-time";
import { formatAmount } from "@norish/shared/lib/format-amount";
import { formatMinutesHM } from "@norish/shared/lib/helpers";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";
import { resolveStepIngredients } from "@norish/shared/lib/step-ingredients";

type PrintRecipe = Pick<
  FullRecipeDTO,
  | "id"
  | "name"
  | "description"
  | "notes"
  | "url"
  | "systemUsed"
  | "prepMinutes"
  | "cookMinutes"
  | "totalMinutes"
  | "calories"
  | "fat"
  | "carbs"
  | "protein"
> & {
  image?: string | null;
  images?: { image: string; order: number }[];
  steps: {
    step: string;
    order: number;
    systemUsed: string;
    stepIngredients: StepIngredientRefLike[];
  }[];
};

export type RecipePrintCardProps = {
  recipe: PrintRecipe;
  ingredients: StepIngredientLineLike[];
  servings: number | null;
  includePhoto: boolean;
  amountMode: AmountDisplayMode;
  formatUnitOnly: (unit: string | null | undefined, amount?: number | null) => string;
  timerConfig: SmartMarkdownTimerConfig;
};

export default function RecipePrintCard({
  recipe,
  ingredients,
  servings,
  includePhoto,
  amountMode,
  formatUnitOnly,
  timerConfig,
}: RecipePrintCardProps) {
  const t = useTranslations("recipes.detail");
  const tNutrition = useTranslations("recipes.nutrition");
  const tPrint = useTranslations("recipes.print");
  const image = includePhoto ? primaryRecipeImage(recipe) : null;
  const lines = ingredients
    .filter((line) => line.systemUsed === recipe.systemUsed)
    .sort((a, b) => a.order - b.order);
  const steps = recipe.steps
    .filter((step) => step.systemUsed === recipe.systemUsed)
    .sort((a, b) => a.order - b.order);
  const nutrition = getNutritionData(recipe, 1);
  const cookingTime = reconcileCookingTime(recipe);
  let stepNumber = 0;

  const ingredientLabel = (name: string, amount: number | null, unit: string | null) => (
    <>
      <strong>
        {[
          amount == null ? "" : formatAmount(amount, amountMode),
          unit ? formatUnitOnly(unit, amount) : "",
        ]
          .filter(Boolean)
          .join(" ")}
      </strong>
      {amount != null || unit ? " " : ""}
      {name}
    </>
  );

  return (
    <article className="recipe-print-card">
      <header className="recipe-print-header">
        <div>
          <h1>{recipe.name}</h1>
          {recipe.description && (
            <p>
              <SmartMarkdownRenderer linkMode="public" text={recipe.description} />
            </p>
          )}
          <ul className="recipe-print-meta">
            {servings != null && (
              <li>
                <strong>{t("servingsCount", { count: servings })}</strong>
              </li>
            )}
            {(["prep", "cook", "total"] as const).map((kind) => {
              const minutes =
                kind === "total" ? cookingTime?.totalMinutes : recipe[`${kind}Minutes`];

              return minutes != null && minutes > 0 ? (
                <li key={kind}>
                  {t(kind)} <strong>{formatMinutesHM(minutes)}</strong>
                </li>
              ) : null;
            })}
          </ul>
        </div>
        {image && (
          <Image
            unoptimized
            alt={recipe.name}
            className="recipe-print-photo"
            height={300}
            loading="eager"
            src={image}
            width={300}
          />
        )}
      </header>
      <div className="recipe-print-columns">
        <div>
          <section aria-label={t("ingredients")}>
            <h2>{t("ingredients")}</h2>
            <ul className="recipe-print-ingredients">
              {lines.map((line) => (
                <li
                  key={line.order}
                  className={
                    line.ingredientName.trim().startsWith("#") ? "recipe-print-heading" : undefined
                  }
                >
                  {line.ingredientName.trim().startsWith("#") ? (
                    <h3>{line.ingredientName.trim().replace(/^#+\s*/, "")}</h3>
                  ) : (
                    ingredientLabel(line.ingredientName, line.amount, line.unit)
                  )}
                </li>
              ))}
            </ul>
          </section>
          {nutrition.hasData && (
            <section aria-label={tNutrition("title")} className="recipe-print-nutrition">
              <h2>{tNutrition("title")}</h2>
              <p>{tPrint("perServing")}</p>
              <dl>
                {Object.entries(nutrition.values).map(([key, value]) =>
                  value != null ? (
                    <div key={key}>
                      <dt>{tNutrition(key)}</dt>
                      <dd>
                        <strong>
                          {Math.round(value)} {key === "calories" ? "kcal" : "g"}
                        </strong>
                      </dd>
                    </div>
                  ) : null
                )}
              </dl>
            </section>
          )}
        </div>
        <section aria-label={t("instructions")}>
          <h2>{t("instructions")}</h2>
          <ol className="recipe-print-steps">
            {steps.map((step) => {
              if (step.step.trim().startsWith("#"))
                return (
                  <li key={step.order} className="recipe-print-heading">
                    <h3>{step.step.trim().replace(/^#+\s*/, "")}</h3>
                  </li>
                );
              stepNumber += 1;
              const refs = resolveStepIngredients(
                step.stepIngredients,
                ingredients,
                step.systemUsed
              );

              return (
                <li key={step.order} className="recipe-print-step">
                  <span className="recipe-print-step-number">{stepNumber}</span>
                  <div>
                    <SmartMarkdownRenderer
                      linkMode="public"
                      text={step.step}
                      timerConfig={{ ...timerConfig, stepIndex: stepNumber - 1 }}
                      timerDisplay="static"
                    />
                    {refs.length > 0 && (
                      <ul className="recipe-print-step-ingredients">
                        {refs.map((ref) => (
                          <li key={ref.ingredientOrder}>
                            {ingredientLabel(ref.name, ref.amount, ref.unit)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {recipe.notes && (
            <section className="recipe-print-notes">
              <h2>{t("notes")}</h2>
              <SmartMarkdownRenderer linkMode="public" text={recipe.notes} />
            </section>
          )}
        </section>
      </div>
      {recipe.url && (
        <footer className="recipe-print-source">
          {t("source")}: <a href={recipe.url}>{recipe.url}</a>
        </footer>
      )}
    </article>
  );
}
