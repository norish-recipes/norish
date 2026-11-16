export type Choice = { key: string; label: string };

/** What the editor asks its choice sheet to list and where the picks go: what a route cannot carry. */
export type ChoiceSlot = {
  choices: Choice[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

/** What the route carries to the choice sheet. */
export type ChoiceParams = {
  /** The testID prefix of the sheet and its rows. */
  name: string;
  title: string;
  /** Each tap ticks a choice and the sheet stays; otherwise a tap picks one and closes. */
  multiple?: boolean;
};

// The editor and its choice sheet are different routes, so the slot crosses between them.
let pending: ChoiceSlot | null = null;

export const requestChoice = (slot: ChoiceSlot) => {
  pending = slot;
};

/** The slot, once: the sheet that takes it empties it. */
export const takeChoice = () => {
  const slot = pending;

  pending = null;

  return slot;
};

export const clearChoice = () => {
  pending = null;
};

/** The route's `multiple` is a string param: "1" or absent. */
export const choiceRoute = ({ name, title, multiple }: ChoiceParams) =>
  ({
    pathname: "/editor-choice",
    params: multiple ? { name, title, multiple: "1" } : { name, title },
  }) as const;

export const parseMultiple = (multiple?: string) => multiple === "1";
