import { LibraryRoot } from "@/features/library/library-root";
import { readRecipeFilters } from "@/lib/recipe-filters-server";

// The dashboard and a cookbook page share the Library's filters, drawn under the reader's cookie.
export default async function LibraryLayout({ children }: LayoutProps<"/">) {
  return <LibraryRoot filters={await readRecipeFilters()}>{children}</LibraryRoot>;
}
