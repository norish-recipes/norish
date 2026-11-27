import { notFound } from "next/navigation";
import { ContentScreen } from "@/features/content/content-screen";
import { IngredientsScreen } from "@/features/ingredients/ingredients-screen";

import { isContentList } from "@norish/shared-react/lists";

export default async function ContentListPage({ params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;

  if (!isContentList(list)) notFound();

  return <ContentScreen ingredients={<IngredientsScreen />} list={list} />;
}
