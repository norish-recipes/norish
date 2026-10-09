import { GroceriesScreen } from "./groceries-screen";

/**
 * Both views of Groceries under one layout, which renders the view itself:
 * the pages only give each view an address, so switching between the list
 * and the Pantry stays on the client. The stored view and grouping come from
 * the App Shell's Device Preferences, already in the server's first frame.
 */
export default function GroceriesLayout() {
  return <GroceriesScreen />;
}
