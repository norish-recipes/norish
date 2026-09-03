"use client";

import { use } from "react";

import CookbookPage from "./cookbook-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default function CookbookRoute({ params }: Props) {
  const { id } = use(params);

  return <CookbookPage cookbookId={id} />;
}
