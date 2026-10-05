import { GroceriesScreen } from "../groceries-screen";

/**
 * The Pantry: the foods the household keeps, a second view of Groceries with
 * an address of its own. It renders under the list's providers, because it
 * reads the household's groceries and creates them.
 */
export default function PantryPage() {
  return <GroceriesScreen view="pantry" />;
}
