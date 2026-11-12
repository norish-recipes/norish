import { usePending } from "@/hooks/use-pending";
import { useTranslations } from "next-intl";

import type { WriteResult } from "@norish/shared-react/admin";

/** An editor's save and restore; a refusal or a failed send lands in `setError`. */
export function useEditorWrites(setError: (error: string) => void, onSaved: () => void) {
  const t = useTranslations("settings.admin.jsonEditor");
  const [saving, whileSaving] = usePending();

  const run = (write: () => Promise<WriteResult>, failed: string, onDone?: () => void) =>
    whileSaving(() =>
      write()
        .then((result) => {
          if (result.success) onDone?.();
          else if (result.error) setError(result.error);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : failed))
    );

  return {
    saving,
    save: (write: () => Promise<WriteResult>) => run(write, t("failedToSave"), onSaved),
    restore: (write: () => Promise<WriteResult>) => run(write, t("failedToRestore")),
  };
}
