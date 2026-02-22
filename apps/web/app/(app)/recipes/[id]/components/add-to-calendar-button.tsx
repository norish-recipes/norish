"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { CalendarDaysIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { MiniCalendar } from "@/components/Panel/consumers";
import { useRecipeQuery } from "@/hooks/recipes";

type Props = {
  recipeId: string;
};

export default function AddToCalendarButton({ recipeId }: Props) {
  const { recipe } = useRecipeQuery(recipeId);
  const [open, setOpen] = useState(false);
  const t = useTranslations("recipes.detail");

  return (
    <>
      <Button
        isIconOnly
        className="text-default-500"
        size="sm"
        title={t("planMeal")}
        variant="light"
        onPress={() => setOpen(true)}
      >
        <CalendarDaysIcon className="h-5 w-5" />
      </Button>

      <MiniCalendar open={open} recipeId={recipe!.id} onOpenChange={setOpen} />
    </>
  );
}
