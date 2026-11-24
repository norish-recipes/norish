/** For a write whose answer is a one-time secret: the mutation cache drops the answer once no
 * observer holds it. */
export const SECRET_ANSWER = { gcTime: 0 } as const;
