"use client";

import type { ReactNode } from "react";
import { Label, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

/** One numbered form section with its real heading. */
function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
          {number}
        </span>
        {title}
      </h2>
      <div className="ml-0 md:ml-9">{children}</div>
    </section>
  );
}

/** A labelled field whose input is still grey. */
function Field({ label, height = "h-9" }: { label: string; height?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Skeleton className={`${height} w-full rounded-xl`} />
    </div>
  );
}

function Help({ children }: { children: ReactNode }) {
  return <p className="text-muted mb-3 text-base">{children}</p>;
}

/** The recipe form while it loads: its sections, headings and labels, with grey fields. */
export default function EditRecipeSkeleton({ mode }: { mode: "create" | "edit" }) {
  const t = useTranslations("recipes.form");
  const tTimes = useTranslations("recipes.timeInputs");
  const tSystem = useTranslations("recipes.measurementSystem");
  const required = <span className="text-danger text-lg">*</span>;

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden px-4 py-6 md:py-8">
      <div className="mb-8">
        <div className="mb-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {mode === "create" ? t("createTitle") : t("editTitle")}
          </h1>
          <p className="text-muted mt-2">
            {mode === "create" ? t("createDescription") : t("editDescription")}
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-10">
        <Section number={1} title={t("photo")}>
          <div className="flex flex-col gap-4">
            <Skeleton className="size-32 rounded-xl" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        </Section>

        <Section number={2} title={t("basicInfo")}>
          <div className="space-y-4">
            <Field label={t("recipeName")} />
            <Field height="h-16" label={t("description")} />
          </div>
        </Section>

        <Section
          number={3}
          title={
            <>
              {t("ingredients")}
              {required}
            </>
          }
        >
          <Help>{t("ingredientsHelp")}</Help>
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </Section>

        <Section
          number={4}
          title={
            <>
              {t("instructions")}
              {required}
            </>
          }
        >
          <Help>{t("instructionsHelp")}</Help>
          <div className="space-y-2">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </Section>

        <Section number={5} title={t("tagsAndCategories")}>
          <div className="space-y-6">
            <div>
              <Help>{t("tagsHelp")}</Help>
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
            <div>
              <Help>{t("categoriesHelp")}</Help>
              <div className="flex flex-wrap gap-2">
                {(["breakfast", "lunch", "dinner", "snack"] as const).map((category) => (
                  <span
                    key={category}
                    className="bg-surface-secondary text-muted flex h-8 items-center rounded-full px-3 text-sm"
                  >
                    {t(`category.${category}`)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section
          number={6}
          title={
            <>
              {t("nutrition")}
              <span className="text-muted text-sm font-normal">{t("nutritionPerServing")}</span>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label={t("calories")} />
            <Field label={t("fat")} />
            <Field label={t("carbs")} />
            <Field label={t("protein")} />
          </div>
        </Section>

        <Section number={7} title={t("provenance")}>
          <div className="flex flex-col gap-4">
            <p className="text-muted text-base">{t("provenanceHelp")}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("originCountry")} />
              <Field label={t("originRegion")} />
            </div>
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </Section>

        <Section number={8} title={t("details")}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("servings")} />
            </div>
            <div>
              <span className="text-foreground mb-3 block text-base font-medium">
                {t("cookingTimes")} <span className="text-muted font-normal">{t("optional")}</span>
              </span>
              <div className="grid grid-cols-3 gap-3">
                <Field label={tTimes("prep")} />
                <Field label={tTimes("cook")} />
                <Field label={tTimes("total")} />
              </div>
            </div>
          </div>
        </Section>

        <Section number={9} title={t("additionalInfo")}>
          <div className="space-y-4">
            <Field height="h-16" label={t("notes")} />
            <Field label={t("sourceUrl")} />
            <div className="flex flex-col gap-2">
              <span className="text-foreground text-sm font-medium">{tSystem("label")}</span>
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          </div>
        </Section>

        <div className="flex justify-end gap-3 border-t pt-6">
          <Skeleton className="h-12 w-24 rounded-xl" />
          <Skeleton className="h-12 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
