import type { Macros } from "../read/values";

/** One food of a dataset, as read: its code, its name in the dataset's own words, its numbers. */
export interface SourceFood extends Macros {
  code: string;
  name: string;
}
