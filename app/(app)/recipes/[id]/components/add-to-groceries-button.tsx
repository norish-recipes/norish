"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/16/solid";

import { MiniGroceries } from "@/components/Panel/consumers";
import { useRecipeContextRequired } from "../context";

type Props = {
  recipeId: string;
};

export default function AddToGroceries({ recipeId }: Props) {
  const [open, setOpen] = useState(false);
  const { currentServings, recipe } = useRecipeContextRequired();

  return (
    <>
      <Button
        className="w-full"
        color="primary"
        startContent={<PlusIcon className="h-5 w-5" />}
        onPress={() => setOpen(true)}
      >
        Add to groceries
      </Button>
      <MiniGroceries 
        open={open} 
        recipeId={recipeId} 
        initialServings={currentServings}
        originalServings={recipe.servings}
        onOpenChange={setOpen} 
      />
    </>
  );
}
