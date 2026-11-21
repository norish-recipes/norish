"use client";

import React, { useState } from "react";
import MiniGroceries from "@/components/Panel/consumers/mini-groceries";
import { ActionButton } from "@/components/shared/action-button";
import { useTranslations } from "next-intl";

import { useLoadedPageRecipe, usePageServings } from "@norish/shared-react/recipes";

type Props = {
  recipeId: string;
};
export default function AddToGroceries({ recipeId }: Props) {
  const [open, setOpen] = useState(false);
  const recipe = useLoadedPageRecipe();
  const currentServings = usePageServings();
  const tActions = useTranslations("common.actions");
  return (
    <>
      <ActionButton fullWidth action="add" onPress={() => setOpen(true)}>
        {tActions("add")}
      </ActionButton>
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
