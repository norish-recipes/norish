import { useEffect } from "react";
import { useIsFocused, useRouter } from "expo-router";

/** Closes a sheet whose subject is gone, removed here or by someone else: nothing is left to show.
 * A sheet already closing is not focused, so its own Close or Save is not followed by a second back. */
export function useCloseWhenGone(gone: boolean) {
  const router = useRouter();
  const focused = useIsFocused();

  useEffect(() => {
    if (gone && focused) router.back();
  }, [gone, focused, router]);
}
