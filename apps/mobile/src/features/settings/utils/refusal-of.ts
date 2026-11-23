export type Refusal = { code?: string } | null;

/** Better Auth answers `{ error }` rather than throwing; a thrown call reads as a refusal with no code. */
export const refusalOf = (call: Promise<{ error: Refusal }>): Promise<Refusal> =>
  call.then(
    ({ error }) => error,
    () => ({})
  );
