import type { DraftWrite, Update } from "./draft-rules";
import { afterSave, saveDraft } from "./draft-rules";

/** The name: the trimmed draft, as the server stores it, sends only when it is not the saved name. */
export const NAME_DRAFT: DraftWrite<string> = {
  sent: (draft) => draft.trim(),
  changes: (sent, saved) => sent !== saved,
};

/** Saves the name, then the photo, each only if online as it goes; one that does not go through
 * stays staged and stops the rest. */
export async function saveProfile<Photo>({
  draft,
  savedName,
  photo,
  updateName,
  uploadAvatar,
  setDraft,
  setPhoto,
  offline,
}: {
  draft: string | null;
  savedName: string;
  photo: Photo | null;
  updateName: (name: string) => Promise<boolean>;
  uploadAvatar: (photo: Photo) => Promise<boolean>;
  setDraft: Update<string>;
  setPhoto: Update<Photo>;
  offline: () => boolean;
}) {
  const send = { draft, saved: savedName, send: updateName, setDraft, offline };

  if (!(await saveDraft(NAME_DRAFT, send)) || !photo || offline()) return;

  const wentThrough = await uploadAvatar(photo);

  setPhoto((current) => afterSave(current, photo, wentThrough));
}
