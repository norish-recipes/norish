"use client";

import Link from "next/link";

/** Recipes as links that open them, by name. */
export function RecipeLinks({
  recipes,
  onOpen,
}: {
  recipes: ReadonlyArray<{ id: string; name: string }>;
  onOpen: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <Link
            className="text-accent hover:underline"
            href={`/recipes/${recipe.id}`}
            onClick={onOpen}
          >
            {recipe.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
