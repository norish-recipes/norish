import { useState } from "react";

import type { DraftWrite } from "../utils/draft-rules";
import { canSave, keptDraft, shownDraft } from "../utils/draft-rules";
import { settingsWrite } from "../utils/settings-write";

/** A form's draft over `saved` with Save's state; `editing` holds a draft that sends nothing. Its
 * requests are Settings writes held under `key`, so an unanswered one frees Save. */
export function useDraft<T>(
  write: DraftWrite<T>,
  saved: T,
  { editing = false, offline, key }: { editing?: boolean; offline: boolean; key: string }
) {
  const [draft, setDraft] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const kept = keptDraft(write, draft, saved, editing || saving);

  // Dropped while rendering: a draft that sends nothing would hide, and a save undo, a later change.
  if (kept !== draft) setDraft(kept);

  return {
    draft,
    setDraft,
    shown: shownDraft(draft, saved),
    saving,
    canSave: (staged = false) => canSave(write, { draft, saved, saving, offline }, staged),
    /** Runs `send` with `saving` on throughout. */
    save: async (send: () => Promise<unknown>) => {
      setSaving(true);
      await send();
      setSaving(false);
    },
    /** `send` as the form's request: resolves whether it went through in time. */
    request:
      <V>(send: (value: V) => Promise<boolean>) =>
      async (value: V) =>
        (await settingsWrite(send, key)(value)) === true,
  };
}
