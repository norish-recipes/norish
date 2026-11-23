import { useAppliedLibraryFilters } from "@norish/shared-react/recipes";

/** Search's filters as it reads them: the Library's applied ones, less any the reader's Hidden Items hides. */
export function useSearchFilters() {
  return useAppliedLibraryFilters();
}
