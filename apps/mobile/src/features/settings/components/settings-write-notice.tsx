import { useEffect } from "react";

import { usePlatform } from "@norish/shared-react/platform";

import { listenForNoAnswer } from "../utils/settings-write";

/** Tells the reader a Settings write went unanswered; mounted once, in the Settings stack. */
export function SettingsWriteNotice() {
  const { toast } = usePlatform();

  useEffect(
    () =>
      listenForNoAnswer((messageId) =>
        toast.show({ severity: "danger", title: toast.translate(messageId) })
      ),
    [toast]
  );

  return null;
}
