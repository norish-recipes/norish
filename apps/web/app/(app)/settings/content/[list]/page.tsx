import { notFound } from "next/navigation";
import { isContentList } from "@/features/content/content-lists";
import { ContentScreen } from "@/features/content/content-screen";
import { IngredientsScreen } from "@/features/ingredients/ingredients-screen";

export default async function ContentListPage({ params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;

  if (!isContentList(list)) notFound();

  return <ContentScreen ingredients={<IngredientsScreen />} list={list} />;
}
