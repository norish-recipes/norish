"use client";

import { BookOpenIcon } from "@heroicons/react/24/outline";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function NoRecipesText() {
  const t = useTranslations("recipes.empty");

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20">
      <Card className="bg-surface/90 shadow-surface relative w-full max-w-xl backdrop-blur-xl">
        <Card.Content className="flex flex-col items-center gap-6 p-10 text-center">
          <div className="relative">
            <div className="bg-accent-soft0/20 dark:bg-accent/15 absolute inset-0 scale-125 rounded-full blur-3xl" />
            <div className="bg-accent-soft0/15 text-accent relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
              <BookOpenIcon className="h-7 w-7" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <p className="text-muted text-base">{t("description")}</p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
