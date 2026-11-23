import type { ProviderInfo } from "@norish/shared/contracts";
import { keepsOfferedSignInMethod, SIGN_IN_METHODS } from "@norish/shared/contracts/dto/auth";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@norish/shared/lib/auth/password";

type Account = { id: string; providerId: string };

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
