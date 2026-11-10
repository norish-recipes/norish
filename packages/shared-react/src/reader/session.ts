import type { User } from "@norish/shared/contracts";

/** The user an auth client's session carries. */
export type SessionUser = { id: string; email: string; name: string; image?: string | null };

/** The Reader a session names, until `user.get` brings their profile. */
export function sessionReader(user: SessionUser): User {
  return { id: user.id, email: user.email, name: user.name, image: user.image ?? null, version: 1 };
}
