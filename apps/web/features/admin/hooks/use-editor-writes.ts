import { usePending } from "@/hooks/use-pending";

import type { WriteResult } from "@norish/shared-react/admin";

/** An editor's save and restore; a refusal lands in `setError`, a failed send shows itself. */
export function useEditorWrites(setError: (error: string) => void, onSaved: () => void) {
  const [saving, whileSaving] = usePending();

  const run = (write: () => Promise<WriteResult | null>, onDone?: () => void) =>
    whileSaving(() =>
      write().then((result) => {
        if (result?.success) onDone?.();
        else if (result?.error) setError(result.error);
      })
    );

  return {
    saving,
    save: (write: () => Promise<WriteResult | null>) => run(write, onSaved),
    restore: (write: () => Promise<WriteResult | null>) => run(write),
  };
}
