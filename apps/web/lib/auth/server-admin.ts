/**
 * The server-role fields as they ride on a resolved session.
 *
 * They are read off the session the server already resolved; the client
 * cannot write them (`input: false` in the auth config). Reading them is
 * never what authorises an action — every admin surface authorises
 * server-side — so this is only ever a question about what to show or which
 * scope to ask for.
 */
export type SessionRoleUser = {
  isServerAdmin?: boolean;
  isServerOwner?: boolean;
};

/** Whether the session's user holds server-admin reach (the owner always does). */
export function hasServerAdminRole(user: SessionRoleUser | null | undefined): boolean {
  return Boolean(user?.isServerOwner || user?.isServerAdmin);
}
