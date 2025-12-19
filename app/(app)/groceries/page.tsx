import AddGroceryButton from "./components/add-grocery-button";
import GroceriesList from "./components/groceries-list";
import { GroceriesContextProvider } from "./context";

export default function GroceriesPage() {
  return (
    <GroceriesContextProvider>
      <div className="space-y-4 pb-16 md:p-6 md:pb-0">
        <h1 className="text-2xl font-bold">Groceries</h1>
        <GroceriesList />
        <AddGroceryButton />
      </div>
    </GroceriesContextProvider>
  );
}
