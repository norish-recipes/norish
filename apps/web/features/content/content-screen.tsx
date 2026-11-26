"use client";

import type { ReactNode } from "react";

import type { ContentList } from "./content-lists";
import { ENTRY_KINDS } from "./content-lists";
import { ContentLayout, ContentNav } from "./content-nav";
import { EntryListCard } from "./entry-list-card";

/**
 * The Content tab: Tags, Cuisines, Categories and Ingredients, the chosen one beside the list
 * picker. The route hands in the Ingredients catalogue, which another feature owns.
 */
export function ContentScreen({
  list,
  ingredients,
}: {
  list: ContentList;
  ingredients: ReactNode;
}) {
  return (
    <ContentLayout nav={<ContentNav list={list} />}>
      {list === "ingredients" ? (
        ingredients
      ) : (
        <EntryListCard key={list} kind={ENTRY_KINDS[list]} list={list} />
      )}
    </ContentLayout>
  );
}
