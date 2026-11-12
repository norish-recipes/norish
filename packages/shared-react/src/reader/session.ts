import type { User } from "@norish/shared/contracts";

/** The user an auth client's session carries. */
export type SessionUser = { id: string; email: string; name: string; image?: string | null };

/**
 * The Reader a session names, until `user.get` brings their profile. Kept by field, so a
 * refetched session of the same reader keeps the same user.
 */
export function useSessionReader(user: SessionUser | null | undefined): User | null {
  const id = user?.id;
  const email = user?.email;
  const name = user?.name;
  const image = user?.image ?? null;

  return id && email !== undefined && name !== undefined
    ? { id, email, name, image, version: 1 }
    : null;
}
