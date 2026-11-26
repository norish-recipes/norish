import { redirect } from "next/navigation";
import { contentHref } from "@/features/content/content-lists";

/** The Ingredients tab became a list of the Content tab; its deep links keep their query. */
export default async function IngredientsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    for (const each of [value ?? []].flat()) query.append(key, each);
  }

  const search = query.toString();

  redirect(`${contentHref("ingredients")}${search ? `?${search}` : ""}`);
}
