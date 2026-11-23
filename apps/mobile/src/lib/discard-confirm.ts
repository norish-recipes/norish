/** Whether leaving the session (Sign out, Change server) first asks to discard unsynced changes. */
export const confirmsDiscard = (unsynced: number) => unsynced > 0;
