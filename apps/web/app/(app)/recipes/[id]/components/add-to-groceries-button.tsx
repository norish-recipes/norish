"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useRecipeContextRequired } from "../context";

import { MiniGroceries } from "@/components/Panel/consumers";

type Props = {
  recipeId: string;
};

export default function AddToGroceries({ recipeId }: Props) {
  const [open, setOpen] = useState(false);
  const { currentServings, recipe } = useRecipeContextRequired();
  const t = useTranslations("recipes.detail");

  return (
    <>
      <Button
        className="w-full"
        color="primary"
        startContent={<PlusIcon className="h-5 w-5" />}
        onPress={() => setOpen(true)}
      >
        {t("addToGroceries")}
      </Button>
      <MiniGroceries
        initialServings={currentServings}
        open={open}
        originalServings={recipe.servings}
        recipeId={recipeId}
        onOpenChange={setOpen}
      />
    </>
  );
}
