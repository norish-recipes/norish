/** Create needs text; the mutation throws on an empty name. */
export const canCreate = (name: string) => name.trim().length > 0;
