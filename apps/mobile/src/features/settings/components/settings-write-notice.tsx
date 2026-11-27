import { useEffect } from "react";

import { usePlatform } from "@norish/shared-react/platform";

import { listenForWriteNotices } from "../utils/settings-write";

/** Tells the reader a Settings write went unanswered, or through after all; mounted once, in the
 * Settings stack. */
export function SettingsWriteNotice() {
  const { toast } = usePlatform();

  useEffect(
    () =>
      listenForWriteNotices((messageId, severity = "danger") =>
        toast.show({ severity, title: toast.translate(messageId) })
      ),
    [toast]
  );

  return null;
}
