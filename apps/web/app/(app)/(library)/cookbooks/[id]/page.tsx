"use client";

import { use } from "react";
import CookbookPage from "@/features/library/cookbook-screen";

// Only the params: the offline shell renders this page with no search params.
export default function CookbookRoute({ params }: Pick<PageProps<"/cookbooks/[id]">, "params">) {
  const { id } = use(params);

  return <CookbookPage cookbookId={id} />;
}
