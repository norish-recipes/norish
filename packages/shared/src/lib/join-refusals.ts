/** The server's reason for each refused join; each client shows its own copy for it. */
export const JOIN_REFUSALS = {
  "already-member": "You are already in this household.",
  shared: "You are already in a household. Leave it first to join another one.",
  "holds-things":
    "Your household already has recipes, groceries or plans of its own, so it cannot join another household yet.",
  gone: "Invalid join code",
  expired: "This join code has expired",
} as const;

export type JoinRefusal = keyof typeof JOIN_REFUSALS;

/** The refusal a failed join's message names, if it is one. */
export const joinRefusalOf = (message: string): JoinRefusal | undefined =>
  (Object.keys(JOIN_REFUSALS) as JoinRefusal[]).find((key) => JOIN_REFUSALS[key] === message);
