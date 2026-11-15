"use client";

import { useState } from "react";

import { useCookbooksMutations } from "./use-cookbooks-mutations";
import { useRecipePick } from "./use-recipe-pick";

/** A new cookbook's title and the recipes picked for it, created in one write. */
export function useNewCookbook() {
  const { createCookbook } = useCookbooksMutations();
  const pick = useRecipePick();
  const [title, setTitle] = useState("");
  const trimmed = title.trim();

  return {
    ...pick,
    title,
    setTitle,
    canCreate: trimmed.length > 0,
    /** Creates the cookbook holding the picked recipes; empty when none are picked. */
    create: () => createCookbook({ title: trimmed, recipeIds: pick.selected }),
  };
}
