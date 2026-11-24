/** Whether leaving the session (Sign out, and Change server through it) asks to discard the Outbox's
 * unsynced changes first. */
export const confirmsDiscard = (unsynced: number) => unsynced > 0;

/** Which alert leaving the session shows: the discard one wins, so a Server change never asks twice. */
export const leaveConfirm = (unsynced: number, serverChange: boolean) =>
  confirmsDiscard(unsynced) ? "discard" : serverChange ? "server" : null;
