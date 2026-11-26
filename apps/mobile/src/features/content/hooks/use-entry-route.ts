import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { PickerKind } from "@norish/shared-react/lists";
import { isEntryKind } from "@norish/shared-react/lists";

/** The `kind` a route was opened with, and its `id`; an unknown kind leaves the sheet and gives none. */
export function useEntryRoute(): { kind: PickerKind | null; id: string } {
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const known = isEntryKind(kind) ? kind : null;

  useEffect(() => {
    if (known === null) router.back();
  }, [known, router]);

  return { kind: known, id: id ?? "" };
}
