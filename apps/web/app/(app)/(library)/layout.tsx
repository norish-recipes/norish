import { QuerySeed } from "@/components/query-seed";
import { LibraryRoot } from "@/features/library/library-root";
import { readerRecipeSeeds } from "@/lib/reader-recipe-seeds";
import { readRecipeFilters } from "@/lib/recipe-filters-server";

// The dashboard and a cookbook page share the Library's filters, drawn under the reader's cookie,
// and the Reader's favourites and allergies their cards draw.
export default async function LibraryLayout({ children }: LayoutProps<"/">) {
  return (
    <QuerySeed reads={readerRecipeSeeds}>
      <LibraryRoot filters={await readRecipeFilters()}>{children}</LibraryRoot>
    </QuerySeed>
  );
}
