"use client";

import { use } from "react";

import CookbookPage from "./cookbook-page";

// Only the params: the offline shell renders this page with no search params.
export default function CookbookRoute({ params }: Pick<PageProps<"/cookbooks/[id]">, "params">) {
  const { id } = use(params);

  return <CookbookPage cookbookId={id} />;
}
