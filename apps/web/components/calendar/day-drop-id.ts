const SUFFIX = "_drop";

/** The id a day accepts drops under. */
export const dayDropId = (dateKey: string) => `${dateKey}${SUFFIX}`;

/** The day a drop landed on, or null for anything that isn't a day. */
export const dateKeyOfDrop = (overId: string | number | undefined) =>
  typeof overId === "string" && overId.endsWith(SUFFIX) ? overId.slice(0, -SUFFIX.length) : null;
