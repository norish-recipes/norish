import type { ProviderInfo } from "@norish/shared/contracts";
import { keepsOfferedSignInMethod, LAST_SIGN_IN_METHOD } from "@norish/shared/contracts/dto/auth";

type Account = { id: string; providerId: string };

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Save is on only with something to save, and never while saving or Offline. */
export const canSaveProfile = ({
  name,
  savedName,
  hasNewPhoto,
  saving,
  offline,
}: {
  name: string;
  savedName: string;
  hasNewPhoto: boolean;
  saving: boolean;
  offline: boolean;
}) => !saving && !offline && (name !== savedName || hasNewPhoto);

/** Whether the password sheet is offered: the server offers passwords and the account has one. */
export const hasPassword = (accounts: readonly Account[], offered: ReadonlySet<string>) =>
  offered.has("credential") && accounts.some((account) => account.providerId === "credential");

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

const ERROR_KEYS: Record<string, string> = {
  account_already_linked_to_different_user: "usedByAnotherAccount",
  [LAST_SIGN_IN_METHOD]: "lastMethod",
  SESSION_NOT_FRESH: "signInAgain",
};

/** The `settings.user.signInMethods.errors` key a refused link or unlink says; else `fallback`. */
export const signInMethodErrorKey = (code: string | undefined, fallback: string) =>
  `settings.user.signInMethods.errors.${ERROR_KEYS[code ?? ""] ?? fallback}`;

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
  const tooShort = next.length > 0 && next.length < PASSWORD_MIN;
  const tooLong = next.length > PASSWORD_MAX;
  const mismatch = confirmation.length > 0 && confirmation !== next;
  const valid = current !== "" && next !== "" && !tooShort && !tooLong && confirmation === next;

  return { tooShort, tooLong, mismatch, valid };
}

/** Web's admin note applies to an admin whose household has other members; it shows while unknown. */
export const showsAdminNote = (
  household: { users: readonly unknown[] } | null,
  isAdmin: boolean,
  loading: boolean
) => loading || (isAdmin && (household?.users.length ?? 0) > 1);

/** The message ids of the delete confirm's paragraphs, in order. */
export const deleteMessageIds = (adminNote: boolean) => [
  "settings.user.dangerZone.deleteModal.permanentWarning",
  "settings.user.dangerZone.deleteModal.dataWarning",
  "settings.user.dangerZone.deleteModal.recipesNote",
  ...(adminNote ? ["settings.user.dangerZone.deleteModal.adminNote"] : []),
];
