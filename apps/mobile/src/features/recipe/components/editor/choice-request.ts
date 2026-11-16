export type Choice = { key: string; label: string };

/** What the editor asks its choice sheet to list, and where the picks go. */
export type ChoiceRequest = {
  /** The testID prefix of the sheet and its rows. */
  name: string;
  title: string;
  choices: Choice[];
  selected: string[];
  /** Each tap ticks a choice and the sheet stays; otherwise a tap picks one and closes. */
  multiple?: boolean;
  onChange: (selected: string[]) => void;
};

// The editor and its choice sheet are different routes, so the request crosses by this slot.
let pending: ChoiceRequest | null = null;

export const requestChoice = (request: ChoiceRequest) => {
  pending = request;
};

export const takeChoice = () => pending;
