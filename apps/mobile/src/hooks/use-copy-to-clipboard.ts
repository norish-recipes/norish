import { useText } from "@/lib/i18n/use-text";
import * as Clipboard from "expo-clipboard";

import { usePlatform } from "@norish/shared-react/platform";

/** Copies `value` and toasts the outcome; a failed copy, or a `value` promise that rejects,
 * toasts `failed` (Operation failed unless given). */
export function useCopyToClipboard() {
  const { toast } = usePlatform();
  const text = useText();

  return async (
    value: string | Promise<string>,
    { copied, failed = "common.errors.operationFailed" }: { copied: string; failed?: string }
  ) => {
    try {
      await Clipboard.setStringAsync(await value);
      toast.show({ severity: "success", title: text(copied) });
    } catch {
      toast.show({ severity: "danger", title: text(failed) });
    }
  };
}
