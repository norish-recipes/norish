import { createMark } from "@/lib/mark";

/** The Groceries page's two sections: the list and the Pantry. */
export type GroceriesSection = "list" | "pantry";

// A mark, as the tab bar's accessory reads it from another tree; module scope outlives the remount
// when the session settles, and the page keeps its section across visits.
const section = createMark<GroceriesSection>("list");

/** The section the Groceries page shows. */
export const useGroceriesSection = section.use;

/** Shows `next` on the Groceries page, which slides to it. */
export const showGroceriesSection = section.set;
