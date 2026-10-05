"use client";

import { PantryView } from "@/components/groceries";

import { GroceriesHeader } from "./groceries-header";

/** The Pantry view of Groceries: no list controls, only what applies to the Pantry. */
export function PantryPage() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <GroceriesHeader view="pantry" />
      <div className="w-full max-w-2xl flex-1">
        <PantryView />
      </div>
    </div>
  );
}
