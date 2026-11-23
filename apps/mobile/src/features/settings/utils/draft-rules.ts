/** How a form's draft becomes a write: what Save sends for it, and whether that changes the saved value. */
export type DraftWrite<T> = {
  sent: (draft: T) => T;
  changes: (sent: T, saved: T) => boolean;
};

/** A form's draft (null: none) over the saved value, and whether a write can go now. */
export type DraftState<T> = { draft: T | null; saved: T; saving: boolean; offline: boolean };

export type Update<T> = (update: (current: T | null) => T | null) => void;

/** The field shows the draft until its save takes it, else the saved value, wherever that came from. */
export const shownDraft = <T>(draft: T | null, saved: T) => draft ?? saved;

/** Whether Save would send the draft: a draft that changes nothing is no edit. */
export const isEdited = <T>(write: DraftWrite<T>, draft: T | null, saved: T) =>
  draft !== null && write.changes(write.sent(draft), saved);

/** A draft that would send nothing is dropped, so it can never undo another device's change, unless
 * `held` (typed in or being saved). */
export const keptDraft = <T>(write: DraftWrite<T>, draft: T | null, saved: T, held: boolean) =>
  held || isEdited(write, draft, saved) ? draft : null;

/** Save is on only with something to save (an edit, or `staged` besides), never saving or Offline. */
export const canSave = <T>(
  write: DraftWrite<T>,
  { draft, saved, saving, offline }: DraftState<T>,
  staged = false
) => !saving && !offline && (isEdited(write, draft, saved) || staged);

/** A staged value goes once the save took it; one changed while saving stays. */
export const afterSave = <T>(current: T | null, sent: T | null, tookIt: boolean) =>
  tookIt && current === sent ? null : current;

/** Sends an edited draft, unless Offline as it runs, and drops it once taken; resolves whether a
 * save may go on past it. */
export async function saveDraft<T>(
  write: DraftWrite<T>,
  {
    draft,
    saved,
    send,
    setDraft,
    offline,
  }: {
    draft: T | null;
    saved: T;
    send: (value: T) => Promise<boolean>;
    setDraft: Update<T>;
    offline: () => boolean;
  }
) {
  if (offline()) return false;
  if (draft === null || !isEdited(write, draft, saved)) return true;

  const tookIt = await send(write.sent(draft));

  setDraft((current) => afterSave(current, draft, tookIt));

  return tookIt;
}
