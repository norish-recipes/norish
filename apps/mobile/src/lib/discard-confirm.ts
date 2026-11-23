/** Whether leaving the session (Sign out, and Change server through it) asks to discard the Outbox's
 * unsynced changes first. */
export const confirmsDiscard = (unsynced: number) => unsynced > 0;
