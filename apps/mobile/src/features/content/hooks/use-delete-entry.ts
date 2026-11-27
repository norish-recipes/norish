import { Alert } from "react-native";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { useText } from "@/lib/i18n/use-text";

import type { ContentEntry, PickerKind } from "@norish/shared-react/lists";
import { deleteProblemCopy, useEntryDelete } from "@norish/shared-react/lists";
import { usePlatform } from "@norish/shared-react/platform";

/** The one delete flow of an entry, from its sheet or its row's menu: read what it comes off,
 * ask in the alert, delete, then `onDeleted`. A failed count asks nothing; a failed delete says so. */
export function useDeleteEntry(kind: PickerKind) {
  const text = useText();
  const cancel = useCancelButton();
  const { showError } = usePlatform();
  const deletion = useEntryDelete(kind);

  return async (entry: ContentEntry, onDeleted?: () => void) => {
    const impact = await deletion.impact(entry);

    if (!impact) {
      showError(null, "content-delete-count", text("settings.content.delete.countFailed"));

      return;
    }

    Alert.alert(
      text("settings.content.delete.title", { name: entry.name }),
      text(
        impact.scope === "server"
          ? "settings.content.delete.bodyServer"
          : "settings.content.delete.body",
        { count: impact.recipes }
      ),
      [
        cancel,
        {
          text: text(`settings.content.delete.action.${kind}`),
          style: "destructive",
          onPress: async () => {
            const outcome = await deletion.remove(entry);

            if (outcome === "deleted") onDeleted?.();
            else
              showError(
                null,
                "content-delete",
                text(`settings.content.${deleteProblemCopy(outcome)?.key}`)
              );
          },
        },
      ]
    );
  };
}
