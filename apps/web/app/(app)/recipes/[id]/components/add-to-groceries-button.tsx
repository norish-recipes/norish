"use client";

import React, { useState } from "react";
import { MiniGroceries } from "@/components/Panel/consumers";
import { ActionButton } from "@/components/shared/action-button";
import { useTranslations } from "next-intl";

import { useRecipeContextRequired } from "../context";

type Props = {
  recipeId: string;
};
export default function AddToGroceries({ recipeId }: Props) {
  const [open, setOpen] = useState(false);
  const { currentServings, recipe } = useRecipeContextRequired();
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
