import type { ProviderInfo } from "@norish/shared/contracts";
import { keepsOfferedSignInMethod, SIGN_IN_METHODS } from "@norish/shared/contracts/dto/auth";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@norish/shared/lib/auth/password";

type Account = { id: string; providerId: string };

/** The name field shows the draft until its save takes it, else the saved name, wherever that came from. */
export const shownName = (draft: string | null, savedName: string) => draft ?? savedName;

/** What Save sends for the name: the trimmed draft, as the server stores it, or null when that is the saved name. */
export function nameToSend(draft: string | null, savedName: string) {
  const name = draft?.trim() ?? savedName;

  return name === savedName ? null : name;
}

/** A draft that would send nothing is dropped once the field is left, but never mid-typing or mid-save. */
export const keptDraft = ({
  draft,
  savedName,
  editing,
  saving,
}: {
  draft: string | null;
  savedName: string;
  editing: boolean;
  saving: boolean;
}) => (editing || saving || nameToSend(draft, savedName) !== null ? draft : null);

/** A staged name or photo goes once the save took it; one changed while saving stays. */
export const afterSave = <T>(current: T | null, sent: T | null, tookIt: boolean) =>
  tookIt && current === sent ? null : current;

export type Update<T> = (update: (current: T | null) => T | null) => void;

/** Saves the name, then the photo; one that does not go through stays staged and stops the rest. */
export async function saveProfile<Photo>({
  draft,
  savedName,
  photo,
  updateName,
  uploadAvatar,
  setDraft,
  setPhoto,
}: {
  draft: string | null;
  savedName: string;
  photo: Photo | null;
  updateName: (name: string) => Promise<boolean>;
  uploadAvatar: (photo: Photo) => Promise<boolean>;
  setDraft: Update<string>;
  setPhoto: Update<Photo>;
}) {
  const name = nameToSend(draft, savedName);

  if (name !== null) {
    const tookIt = await updateName(name);

    setDraft((current) => afterSave(current, draft, tookIt));
    if (!tookIt) return;
  }
  if (photo) {
    const tookIt = await uploadAvatar(photo);

    setPhoto((current) => afterSave(current, photo, tookIt));
  }
}

/** Save is on only with something to save, and never while saving or Offline. */
export const canSaveProfile = ({
  draft,
  savedName,
  hasNewPhoto,
  saving,
  offline,
}: {
  draft: string | null;
  savedName: string;
  hasNewPhoto: boolean;
  saving: boolean;
  offline: boolean;
}) => !saving && !offline && (nameToSend(draft, savedName) !== null || hasNewPhoto);

/** Whether the password sheet is offered: the server offers passwords and the account has one. */
export const hasPassword = (accounts: readonly Account[], offered: ReadonlySet<string>) =>
  offered.has(SIGN_IN_METHODS.credential.id) &&
  accounts.some((account) => account.providerId === SIGN_IN_METHODS.credential.id);

/** With one method on the server there is nothing to add or remove, only a password to change. */
export const showsSignInMethods = (offeredCount: number, passwordOffered: boolean) =>
  offeredCount > 1 || passwordOffered;

/** The last offered method cannot be removed. */
export const canUnlink = (
  accounts: readonly Account[],
  accountId: string,
  offered: ReadonlySet<string>
) => keepsOfferedSignInMethod(accounts, accountId, offered);

/** The OAuth providers the server offers that the account has not linked yet. */
export const addableProviders = (offered: readonly ProviderInfo[], accounts: readonly Account[]) =>
  offered.filter(
    (provider) =>
      provider.type === "oauth" && !accounts.some((account) => account.providerId === provider.id)
  );

/** What is wrong with a new password, and whether the form can go. */
export function passwordChecks({
  current,
  next,
  confirmation,
}: {
  current: string;
  next: string;
  confirmation: string;
}) {
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const tooLong = next.length > MAX_PASSWORD_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== next;
  const valid = current !== "" && next !== "" && !tooShort && !tooLong && confirmation === next;

  return { tooShort, tooLong, mismatch, valid };
}
