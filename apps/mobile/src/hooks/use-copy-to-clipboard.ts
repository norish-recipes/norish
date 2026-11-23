import { useText } from "@/lib/i18n/use-text";
import * as Clipboard from "expo-clipboard";

import { usePlatform } from "@norish/shared-react/platform";

/** Copies `value` and toasts the outcome; a failed copy toasts `failed` (Operation failed unless given). */
export function useCopyToClipboard() {
  const { toast } = usePlatform();
  const text = useText();

  return async (
    value: string,
    { copied, failed = "common.errors.operationFailed" }: { copied: string; failed?: string }
  ) => {
    try {
      await Clipboard.setStringAsync(value);
      toast.show({ severity: "success", title: text(copied) });
    } catch {
      toast.show({ severity: "danger", title: text(failed) });
    }
  };
}
